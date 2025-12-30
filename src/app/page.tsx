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
    | 'LIMIT_REACHED'
    | 'LEADERBOARD';

interface LeaderboardEntry {
    fid: number;
    total_tokens: number;
    rank: number;
}

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
    correctAnswers: number;
    wrongAnswers: number;
    stats: {
        canPlay: boolean;
        cooldownRemaining: number;
        cooldownFormatted: string;
        cooldownEndsAt: string | null;  // ISO timestamp for client-side countdown
        totalTokens: number;
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
        correctAnswers: 0,
        wrongAnswers: 0,
        stats: null,
    });
    const [introIndex, setIntroIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFarcasterClient, setIsFarcasterClient] = useState(false);
    const [cooldownDisplay, setCooldownDisplay] = useState('00:00:00');
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize SDK and get user
    useEffect(() => {
        async function init() {
            await initializeSDK();

            // Check if running inside Farcaster
            const inFarcaster = await isInFarcaster();
            setIsFarcasterClient(inFarcaster);

            let currentUser = await getUserContext();

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

    // Cooldown countdown effect - updates every second when on LIMIT_REACHED
    useEffect(() => {
        if (gameState.phase !== 'LIMIT_REACHED' || !gameState.stats?.cooldownEndsAt) return;

        const formatTime = (ms: number): string => {
            if (ms <= 0) return '00:00:00';
            const hours = Math.floor(ms / (1000 * 60 * 60));
            const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((ms % (1000 * 60)) / 1000);
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        const updateCountdown = () => {
            const endTime = new Date(gameState.stats!.cooldownEndsAt!).getTime();
            const remaining = endTime - Date.now();

            if (remaining <= 0) {
                setCooldownDisplay('00:00:00');
                // Cooldown expired - allow playing again
                setGameState(prev => ({
                    ...prev,
                    stats: prev.stats ? { ...prev.stats, canPlay: true } : null
                }));
            } else {
                setCooldownDisplay(formatTime(remaining));
            }
        };

        // Initial update
        updateCountdown();

        // Update every second
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [gameState.phase, gameState.stats?.cooldownEndsAt]);

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

            if (data.sessionComplete) {
                // All 3 rounds completed
                setGameState(prev => ({
                    ...prev,
                    phase: data.perfectGame ? 'SESSION_SUCCESS' : 'SESSION_FAIL',
                    tokensEarned: data.tokensEarned,
                    correctAnswers: data.correctAnswers,
                    wrongAnswers: data.wrongAnswers,
                    totalTime: data.totalTime,
                    stats: data.stats,
                }));
            } else if (data.nextRound) {
                // Move to next round (regardless of correct/wrong)
                setGameState(prev => ({
                    ...prev,
                    phase: 'ROUND_RESULT',
                    round: data.nextRound.round,
                    message: data.message,
                    tokensEarned: prev.tokensEarned + (data.tokensEarned || 0),
                    correctAnswers: data.correct ? prev.correctAnswers + 1 : prev.correctAnswers,
                    wrongAnswers: data.correct ? prev.wrongAnswers : prev.wrongAnswers + 1,
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
            correctAnswers: 0,
            wrongAnswers: 0,
        }));
    };

    const viewCooldownStatus = async () => {
        if (!user) return;

        try {
            // Fetch fresh stats from API (includes totalTokens from Supabase)
            const res = await fetch(`/api/player/stats?fid=${user.fid}`);
            const stats = await res.json();

            setGameState(prev => ({
                ...prev,
                phase: 'LIMIT_REACHED',
                stats,
            }));
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            // Still navigate but with existing stats
            setGameState(prev => ({ ...prev, phase: 'LIMIT_REACHED' }));
        }
    };

    const viewLeaderboard = async () => {
        setIsLoadingLeaderboard(true);

        try {
            const res = await fetch('/api/leaderboard');
            const data = await res.json();

            // Add rank to each entry
            const rankedLeaderboard = data.leaderboard.map((entry: { fid: number; total_tokens: number }, index: number) => ({
                ...entry,
                rank: index + 1,
            }));

            setLeaderboard(rankedLeaderboard);
            setGameState(prev => ({ ...prev, phase: 'LEADERBOARD' }));
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
        } finally {
            setIsLoadingLeaderboard(false);
        }
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
                                Security system is locked.
                                <br />
                                Next attempt available in: {cooldownDisplay}
                            </div>
                        </div>

                        {gameState.stats && (
                            <div className="stats-container">
                                <div className="stat-row">
                                    <span className="stat-label">Cooldown Remaining</span>
                                    <span className="stat-value">{cooldownDisplay}</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Total Tokens</span>
                                    <span className="stat-value">{gameState.stats.totalTokens}</span>
                                </div>
                            </div>
                        )}

                        <button
                            className={`action-btn ${gameState.stats?.canPlay ? 'primary' : ''}`}
                            onClick={startGame}
                            disabled={!gameState.stats?.canPlay}
                            style={{
                                marginTop: 20,
                                opacity: gameState.stats?.canPlay ? 1 : 0.5,
                                cursor: gameState.stats?.canPlay ? 'pointer' : 'not-allowed'
                            }}
                        >
                            [ SSH ]
                        </button>

                        <button
                            className="action-btn"
                            onClick={viewLeaderboard}
                            disabled={isLoadingLeaderboard}
                            style={{ marginTop: 10 }}
                        >
                            {isLoadingLeaderboard ? '[ LOADING... ]' : '[ LEADERBOARD ]'}
                        </button>
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
                                        1 attempt available
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
                            switch
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
                const isCorrectRound = gameState.message.includes('SECURED');
                return (
                    <div className="terminal-screen">
                        <div className="result-container">
                            <div className={`result-title ${isCorrectRound ? 'success' : 'error'} glitch-text`}>
                                {gameState.message}
                            </div>
                            {isCorrectRound ? (
                                <div className="terminal-line success" style={{ textAlign: 'center' }}>
                                    +10 ASLR TOKEN EARNED
                                </div>
                            ) : (
                                <div className="terminal-line error" style={{ textAlign: 'center' }}>
                                    NO TOKEN - WRONG NODE
                                </div>
                            )}
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

                            <button
                                className="action-btn primary"
                                onClick={viewCooldownStatus}
                            >
                                [ STATUS ]
                            </button>
                        </div>
                    </div>
                );

            case 'SESSION_FAIL':
                return (
                    <div className="terminal-screen">
                        <div className="result-container">
                            <div className="result-title error glitch">
                                SESSION COMPLETE
                            </div>
                            <div className="terminal-line" style={{ textAlign: 'center' }}>
                                Some nodes were incorrect
                            </div>

                            <div className="stats-container" style={{ marginTop: 30 }}>
                                <div className="stat-row">
                                    <span className="stat-label">Correct Answers</span>
                                    <span className="stat-value" style={{ color: '#00ff41' }}>{gameState.correctAnswers}/3</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Wrong Answers</span>
                                    <span className="stat-value" style={{ color: '#ff4444' }}>{gameState.wrongAnswers}/3</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">ASLR Tokens Earned</span>
                                    <span className="stat-value">{gameState.tokensEarned}</span>
                                </div>
                            </div>

                            <button
                                className="action-btn primary"
                                onClick={viewCooldownStatus}
                            >
                                [ STATUS ]
                            </button>
                        </div>
                    </div>
                );

            case 'LEADERBOARD':
                return (
                    <div className="terminal-screen">
                        <div className="result-container">
                            <div className="result-title" style={{ marginBottom: 20 }}>
                                🏆 LEADERBOARD 🏆
                            </div>

                            <div className="leaderboard-container" style={{ width: '100%', maxWidth: 400 }}>
                                {leaderboard.length === 0 ? (
                                    <div className="terminal-line muted" style={{ textAlign: 'center' }}>
                                        No entries yet
                                    </div>
                                ) : (
                                    leaderboard.map((entry) => (
                                        <div
                                            key={entry.fid}
                                            className="stat-row"
                                            style={{
                                                padding: '8px 12px',
                                                marginBottom: 4,
                                                background: entry.rank <= 3 ? 'rgba(0, 255, 65, 0.1)' : 'transparent',
                                                borderRadius: 4,
                                                border: entry.fid === user?.fid ? '1px solid #00ff41' : 'none'
                                            }}
                                        >
                                            <span className="stat-label">
                                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                                                {' '}FID: {entry.fid}
                                                {entry.fid === user?.fid && ' (YOU)'}
                                            </span>
                                            <span className="stat-value" style={{ color: entry.rank <= 3 ? '#00ff41' : '#888' }}>
                                                {entry.total_tokens} ASLR
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <button
                                className="action-btn primary"
                                onClick={viewCooldownStatus}
                                style={{ marginTop: 20 }}
                            >
                                [ BACK ]
                            </button>
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
