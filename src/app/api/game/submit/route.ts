import { NextRequest, NextResponse } from 'next/server';
import {
    generateNumbers,
    generateFakeNumber,
    createSelectionOptions,
    getRoundConfig,
    generateNonce,
    TOTAL_ROUNDS,
    TOKENS_PER_CORRECT
} from '@/lib/gameLogic';
import {
    getSession,
    updateSession,
    deleteSession,
    recordSessionCompletion,
    getPlayerStats
} from '@/lib/store';
import { addPlayerTokens } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fid, sessionId, selectedNumber, nonce } = body;

        // Validate inputs
        if (!fid || !sessionId || selectedNumber === undefined || !nonce) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Get session
        const session = getSession(sessionId);
        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        // Validate session belongs to this user
        if (session.fid !== fid) {
            return NextResponse.json(
                { error: 'Session mismatch' },
                { status: 403 }
            );
        }

        // Validate nonce
        if (session.nonce !== nonce) {
            return NextResponse.json(
                { error: 'Invalid nonce' },
                { status: 400 }
            );
        }

        // Check if session is already completed
        if (session.completed) {
            return NextResponse.json(
                { error: 'Session already completed' },
                { status: 400 }
            );
        }

        // Check if the selected number is the fake one
        const isCorrect = selectedNumber === session.fakeNumber;

        let tokensAwarded = 0;
        let newCorrectAnswers = session.correctAnswers;
        let newWrongAnswers = session.wrongAnswers;
        let newTokensEarned = session.tokensEarned;

        if (isCorrect) {
            // Correct answer - award tokens
            tokensAwarded = TOKENS_PER_CORRECT;
            newCorrectAnswers += 1;
            newTokensEarned += tokensAwarded;

            // Save to Supabase
            try {
                await addPlayerTokens(fid, tokensAwarded);
            } catch (dbError) {
                console.error('Failed to save tokens to database:', dbError);
                // Continue even if DB fails - we'll track locally
            }
        } else {
            // Wrong answer - track it but continue to next round
            newWrongAnswers += 1;
        }

        // Check if this was the last round (regardless of correct/wrong)
        if (session.round >= TOTAL_ROUNDS) {
            // Session complete - all 3 rounds finished!
            updateSession(sessionId, {
                completed: true,
                tokensEarned: newTokensEarned,
                correctAnswers: newCorrectAnswers,
                wrongAnswers: newWrongAnswers
            });

            const perfect = newWrongAnswers === 0;
            recordSessionCompletion(fid, perfect);

            const totalTime = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

            return NextResponse.json({
                correct: isCorrect,
                message: perfect ? 'CONNECTION FULLY SECURED' : 'SESSION COMPLETE',
                sessionComplete: true,
                tokensEarned: newTokensEarned,
                correctAnswers: newCorrectAnswers,
                wrongAnswers: newWrongAnswers,
                totalTime,
                perfectGame: perfect,
                stats: getPlayerStats(fid),
            });
        }

        // Prepare next round (continue regardless of answer)
        const nextRound = session.round + 1;
        const roundConfig = getRoundConfig(nextRound);

        const shownNumbers = generateNumbers(roundConfig.numberCount);
        const fakeNumber = generateFakeNumber(shownNumbers);
        const selectionOptions = createSelectionOptions(shownNumbers, fakeNumber, roundConfig.optionCount);
        const newNonce = generateNonce();

        // Update session for next round
        updateSession(sessionId, {
            round: nextRound,
            shownNumbers,
            fakeNumber,
            selectionOptions,
            nonce: newNonce,
            roundStartedAt: new Date(),
            displayTime: roundConfig.displayTime,
            tokensEarned: newTokensEarned,
            correctAnswers: newCorrectAnswers,
            wrongAnswers: newWrongAnswers,
        });

        return NextResponse.json({
            correct: isCorrect,
            message: isCorrect ? 'CONNECTION SECURED' : 'WRONG NODE - CONTINUE',
            tokensEarned: isCorrect ? tokensAwarded : 0,
            nextRound: {
                round: nextRound,
                numbers: shownNumbers,
                displayTime: roundConfig.displayTime * 1000,
                nonce: newNonce,
            },
        });

    } catch (error) {
        console.error('Error submitting answer:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET endpoint to fetch selection options for current round
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');
        const nonce = searchParams.get('nonce');

        if (!sessionId || !nonce) {
            return NextResponse.json(
                { error: 'Missing sessionId or nonce' },
                { status: 400 }
            );
        }

        const session = getSession(sessionId);
        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        if (session.nonce !== nonce) {
            return NextResponse.json(
                { error: 'Invalid nonce' },
                { status: 400 }
            );
        }

        // Return selection options (doesn't reveal which is fake)
        return NextResponse.json({
            options: session.selectionOptions,
            round: session.round,
        });

    } catch (error) {
        console.error('Error getting options:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
