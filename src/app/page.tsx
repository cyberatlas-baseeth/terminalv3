'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeSDK, getUserContext, getMockUser, shareResult, isInFarcaster, FarcasterUser } from '@/lib/farcaster';
import { TOTAL_ROUNDS } from '@/lib/gameLogic';

// Game phases
type GamePhase =
    | 'LOADING'
    | 'INTRO'
    | 'MEMORIZE'
    | 'SELECT'
    | 'ROUND_RESULT'
    | 'SESSION_SUCCESS'
    | 'SESSION_FAIL'
    | 'LIMIT_REACHED';

interface GameState {
    phase: GamePhase;
    sessionId: string | null;
    round: number;
    numbers: number[];
    displayTime: number;
    nonce: string;
    timeLeft: number;
    selectionOptions: number[];
    tokensEarned: number;
    totalTime: number;
    message: string;
    stats: {
        sessionsToday: number;
        sessionsRemaining: number;
        tokensToday: number;
        totalTokens: number;
        currentStreak: number;
        canPlay: boolean;
    } | null;
}

// Terminal text animation messages
const INTRO_MESSAGES = [
    { text: 'Initializing secure connection...', delay: 0 },
    { text: 'Scanning network nodes...', delay: 800 },
    { text: 'Searching for active switch...', delay: 1600 },
    { text: 'Verifying node integrity...', delay: 2400 },
    { text: 'ALERT: Unauthorized node detected', delay: 3200 },
    { text: 'Initiating memory verification protocol...', delay: 4000 },
];

export default function Game() {
    const [user, setUser] = useState<FarcasterUser | null>(null);
    const [gameState, setGameState] = useState<GameState>({
        phase: 'LOADING',
        sessionId: null,
        round: 1,
        numbers: [],
        displayTime: 10000,
        nonce: '',
        timeLeft: 0,
        selectionOptions: [],
        tokensEarned: 0,
        totalTime: 0,
        message: '',
        stats: null,
    });
    const [introIndex, setIntroIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFarcasterClient, setIsFarcasterClient] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize SDK and get user
    useEffect(() => {
        async function init() {
            await initializeSDK();

            // Check if running inside Farcaster
            const inFarcaster = await isInFarcaster();
            setIsFarcasterClient(inFarcaster);

            let currentUser = getUserContext();

            // If not in Farcaster or no user context, use mock for testing
            if (!currentUser) {
                currentUser = getMockUser();
            }

            setUser(currentUser);

            // Fetch initial stats
            if (currentUser) {
                try {
                    const res = await fetch(`/api/player/stats?fid=${currentUser.fid}`);
                    const stats = await res.json();

                    if (!stats.canPlay) {
                        setGameState(prev => ({
                            ...prev,
                            phase: 'LIMIT_REACHED',
                            stats,
                        }));
                    } else {
                        setGameState(prev => ({
                            ...prev,
                            phase: 'INTRO',
                            stats,
                        }));
                    }
                } catch (error) {
                    console.error('Failed to fetch stats:', error);
                    setGameState(prev => ({ ...prev, phase: 'INTRO' }));
                }
            }
        }

        init();
    }, []);

    // Intro animation effect
    useEffect(() => {
        if (gameState.phase !== 'INTRO') return;

        if (introIndex < INTRO_MESSAGES.length) {
            const timer = setTimeout(() => {
                setIntroIndex(prev => prev + 1);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [gameState.phase, introIndex]);

    // Timer countdown effect
    useEffect(() => {
        if (gameState.phase !== 'MEMORIZE' || gameState.timeLeft <= 0) return;

        timerRef.current = setTimeout(() => {
            setGameState(prev => ({
                ...prev,
                timeLeft: prev.timeLeft - 1,
            }));
        }, 1000);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [gameState.phase, gameState.timeLeft]);

    // When timer reaches 0, fetch selection options
    useEffect(() => {
        if (gameState.phase === 'MEMORIZE' && gameState.timeLeft === 0) {
            const fetchOptions = async () => {
                try {
                    const res = await fetch(
                        `/api/game/submit?sessionId=${gameState.sessionId}&nonce=${gameState.nonce}`
                    );
                    const data = await res.json();

                    if (data.options) {
                        setGameState(prev => ({
                            ...prev,
                            phase: 'SELECT',
                            selectionOptions: data.options,
                        }));
                    }
                } catch (error) {
                    console.error('Failed to fetch options:', error);
                }
            };
            fetchOptions();
        }
    }, [gameState.phase, gameState.timeLeft, gameState.sessionId, gameState.nonce]);

    const startGame = async () => {
        if (!user) return;

        setIntroIndex(0);

        try {
            const res = await fetch('/api/game/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fid: user.fid }),
            });

            const data = await res.json();

            if (data.error) {
                if (data.code === 'SESSION_LIMIT') {
                    setGameState(prev => ({
                        ...prev,
                        phase: 'LIMIT_REACHED',
                        message: data.error,
                    }));
                    return;
                }
                throw new Error(data.error);
            }

            setGameState(prev => ({
                ...prev,
                phase: 'MEMORIZE',
                sessionId: data.sessionId,
                round: 1,
                numbers: data.numbers,
                displayTime: data.displayTime,
                nonce: data.nonce,
                timeLeft: Math.floor(data.displayTime / 1000),
                tokensEarned: 0,
            }));

        } catch (error) {
            console.error('Failed to start game:', error);
        }
    };

    const submitAnswer = async (selectedNumber: number) => {
        if (!user || !gameState.sessionId || isSubmitting) return;

        setIsSubmitting(true);

        try {
            const res = await fetch('/api/game/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fid: user.fid,
                    sessionId: gameState.sessionId,
                    selectedNumber,
                    nonce: gameState.nonce,
                }),
            });

            const data = await res.json();

            if (!data.correct) {
                // Wrong answer - game over
                setGameState(prev => ({
                    ...prev,
                    phase: 'SESSION_FAIL',
                    message: data.message,
                    stats: data.stats,
                }));
            } else if (data.sessionComplete) {
                // All rounds completed - success!
                setGameState(prev => ({
                    ...prev,
                    phase: 'SESSION_SUCCESS',
                    tokensEarned: data.tokensEarned,
                    totalTime: data.totalTime,
                    stats: data.stats,
                }));
            } else if (data.nextRound) {
                // Move to next round
                setGameState(prev => ({
                    ...prev,
                    phase: 'ROUND_RESULT',
                    round: data.nextRound.round,
                    message: data.message,
                    tokensEarned: prev.tokensEarned + (data.tokensEarned || 0),
                }));

                // After brief delay, start next round
                setTimeout(() => {
                    setGameState(prev => ({
                        ...prev,
                        phase: 'MEMORIZE',
                        numbers: data.nextRound.numbers,
                        displayTime: data.nextRound.displayTime,
                        nonce: data.nextRound.nonce,
                        timeLeft: Math.floor(data.nextRound.displayTime / 1000),
                    }));
                }, 1500);
            }

        } catch (error) {
            console.error('Failed to submit answer:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleShare = async () => {
        await shareResult(gameState.totalTime, true);
    };

    const resetGame = () => {
        setIntroIndex(0);
        setGameState(prev => ({
            ...prev,
            phase: 'INTRO',
            sessionId: null,
            round: 1,
            numbers: [],
            tokensEarned: 0,
            totalTime: 0,
            message: '',
        }));
    };

    // Render based on game phase
    const renderContent = () => {
        switch (gameState.phase) {
            case 'LOADING':
                return (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p className="terminal-line muted" style={{ marginTop: 20 }}>
                            Establishing connection...
                        </p>
                    </div>
                );

            case 'LIMIT_REACHED':
                return (
                    <div className="terminal-screen">
                        <div className="limit-warning">
                            <div className="limit-warning-title">⚠ ACCESS RESTRICTED ⚠</div>
                            <div className="limit-warning-text">
                                Security system allows only 3 breach attempts per day.
                                <br />
                                Return tomorrow to continue.
                            </div>
                        </div>

                        {gameState.stats && (
                            <div className="stats-container">
                                <div className="stat-row">
                                    <span className="stat-label">Sessions Today</span>
                                    <span className="stat-value">{gameState.stats.sessionsToday}/3</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Tokens Today</span>
                                    <span className="stat-value">{gameState.stats.tokensToday}</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Total Tokens</span>
                                    <span className="stat-value">{gameState.stats.totalTokens}</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Current Streak</span>
                                    <span className="stat-value">{gameState.stats.currentStreak} days</span>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'INTRO':
                return (
                    <div className="terminal-screen">
                        {INTRO_MESSAGES.slice(0, introIndex).map((msg, i) => (
                            <div
                                key={i}
                                className={`terminal-line fade-in ${msg.text.includes('ALERT') ? 'warning' : 'success'
                                    }`}
                            >
                                <span className="prefix">&gt;</span>
                                {msg.text}
                            </div>
                        ))}

                        {introIndex < INTRO_MESSAGES.length && (
                            <div className="terminal-line">
                                <span className="prefix">&gt;</span>
                                <span className="cursor"></span>
                            </div>
                        )}

                        {introIndex >= INTRO_MESSAGES.length && (
                            <div className="fade-in" style={{ marginTop: 30 }}>
                                <div className="terminal-line warning" style={{ marginBottom: 20 }}>
                                    <span className="prefix">&gt;</span>
                                    Identify the FAKE node to secure connection
                                </div>

                                {gameState.stats && (
                                    <div className="terminal-line muted" style={{ marginBottom: 20 }}>
                                        Sessions remaining: {gameState.stats.sessionsRemaining}/3
                                    </div>
                                )}

                                <button className="action-btn primary" onClick={startGame}>
                                    [ INITIATE SCAN ]
                                </button>
                            </div>
                        )}
                    </div>
                );

            case 'MEMORIZE':
                return (
                    <div className="terminal-screen">
                        <div className="terminal-line warning">
                            <span className="prefix">&gt;</span>
                            ROUND {gameState.round}/{TOTAL_ROUNDS} - MEMORIZE NODES
                        </div>

                        <div className="round-indicator">
                            {[1, 2, 3].map(r => (
                                <div
                                    key={r}
                                    className={`round-dot ${r < gameState.round ? 'completed' :
                                        r === gameState.round ? 'current' : ''
                                        }`}
                                />
                            ))}
                        </div>

                        <div className="timer-container">
                            <div className="timer-value">{gameState.timeLeft}</div>
                            <div className="timer-label">Seconds Remaining</div>
                        </div>

                        <div className="number-grid">
                            {gameState.numbers.map((num, i) => (
                                <div
                                    key={i}
                                    className="number-cell"
                                    style={{
                                        animationDelay: `${i * 100}ms`,
                                        marginLeft: `${(Math.random() - 0.5) * 4}px`,
                                        marginTop: `${(Math.random() - 0.5) * 4}px`,
                                    }}
                                >
                                    {num}
                                </div>
                            ))}
                        </div>

                        <div className="terminal-line muted" style={{ textAlign: 'center' }}>
                            One of these nodes is fake. Memorize them all.
                        </div>
                    </div>
                );

            case 'SELECT':
                return (
                    <div className="terminal-screen">
                        <div className="terminal-line warning">
                            <span className="prefix">&gt;</span>
                            ROUND {gameState.round}/{TOTAL_ROUNDS} - IDENTIFY INTRUDER
                        </div>

                        <div className="round-indicator">
                            {[1, 2, 3].map(r => (
                                <div
                                    key={r}
                                    className={`round-dot ${r < gameState.round ? 'completed' :
                                        r === gameState.round ? 'current' : ''
                                        }`}
                                />
                            ))}
                        </div>

                        <div className="terminal-line" style={{ margin: '20px 0', textAlign: 'center' }}>
                            Which node was NOT displayed?
                        </div>

                        <div className="selection-container">
                            {gameState.selectionOptions.map((num, i) => (
                                <button
                                    key={i}
                                    className="selection-btn"
                                    onClick={() => submitAnswer(num)}
                                    disabled={isSubmitting}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>

                        <div className="terminal-line muted" style={{ textAlign: 'center', marginTop: 20 }}>
                            Select the unauthorized node
                        </div>
                    </div>
                );

            case 'ROUND_RESULT':
                return (
                    <div className="terminal-screen">
                        <div className="result-container">
                            <div className="result-title success glitch-text">
                                {gameState.message}
                            </div>
                            <div className="terminal-line" style={{ textAlign: 'center' }}>
                                +1 TOKEN EARNED
                            </div>
                            <div className="terminal-line muted" style={{ textAlign: 'center', marginTop: 10 }}>
                                Proceeding to Round {gameState.round}...
                            </div>
                        </div>

                        <IntegrityBar round={gameState.round - 1} />
                    </div>
                );

            case 'SESSION_SUCCESS':
                return (
                    <div className="terminal-screen">
                        <div className="result-container">
                            <div className="result-title success">
                                ████████████████████
                                <br />
                                CONNECTION SECURED
                                <br />
                                ████████████████████
                            </div>

                            <IntegrityBar round={3} />

                            <div className="stats-container">
                                <div className="stat-row">
                                    <span className="stat-label">Tokens Earned</span>
                                    <span className="stat-value">{gameState.tokensEarned}</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Total Time</span>
                                    <span className="stat-value">{gameState.totalTime}s</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Access Level</span>
                                    <span className="stat-value" style={{ color: '#00ff41' }}>VERIFIED</span>
                                </div>
                            </div>

                            {isFarcasterClient && (
                                <button className="action-btn" onClick={handleShare}>
                                    [ SHARE RESULT ]
                                </button>
                            )}

                            {gameState.stats && gameState.stats.sessionsRemaining > 0 && (
                                <button className="action-btn primary" onClick={resetGame}>
                                    [ TRY AGAIN ]
                                </button>
                            )}
                        </div>
                    </div>
                );

            case 'SESSION_FAIL':
                return (
                    <div className="terminal-screen">
                        <div className="result-container">
                            <div className="result-title error glitch">
                                ⚠ CONNECTION BREACHED ⚠
                            </div>
                            <div className="terminal-line error" style={{ textAlign: 'center' }}>
                                TRACE DETECTED
                            </div>
                            <div className="terminal-line error" style={{ textAlign: 'center' }}>
                                ACCESS DENIED
                            </div>

                            <div className="stats-container" style={{ marginTop: 30 }}>
                                <div className="stat-row">
                                    <span className="stat-label">Round Reached</span>
                                    <span className="stat-value">{gameState.round}/{TOTAL_ROUNDS}</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Sessions Remaining</span>
                                    <span className="stat-value">
                                        {gameState.stats?.sessionsRemaining ?? 0}
                                    </span>
                                </div>
                            </div>

                            {gameState.stats && gameState.stats.sessionsRemaining > 0 ? (
                                <button className="action-btn primary" onClick={resetGame}>
                                    [ TRY AGAIN ]
                                </button>
                            ) : (
                                <div className="limit-warning" style={{ marginTop: 20 }}>
                                    <div className="limit-warning-title">NO ATTEMPTS REMAINING</div>
                                    <div className="limit-warning-text">Return tomorrow</div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="terminal-container">
            <div className="terminal-header">
                <div className="terminal-title">TERMINAL</div>
                <div className="terminal-subtitle">
                    {user ? `OPERATOR: ${user.username || `FID:${user.fid}`}` : 'ANONYMOUS'}
                </div>
            </div>

            {renderContent()}
        </div>
    );
}

// Integrity Bar Component
function IntegrityBar({ round }: { round: number }) {
    const segments = 10;
    const filled = Math.floor((round / TOTAL_ROUNDS) * segments);
    const percent = Math.floor((round / TOTAL_ROUNDS) * 100);

    return (
        <div className="integrity-container">
            <div className="integrity-label">Connection Integrity</div>
            <div className="integrity-bar">
                {Array.from({ length: segments }).map((_, i) => (
                    <div
                        key={i}
                        className={`integrity-segment ${i < filled ? 'filled' : ''}`}
                    />
                ))}
            </div>
            <div className={`integrity-percent ${percent === 100 ? 'secured' : ''}`}>
                {percent}% {percent === 100 ? 'SECURED' : ''}
            </div>
        </div>
    );
}
