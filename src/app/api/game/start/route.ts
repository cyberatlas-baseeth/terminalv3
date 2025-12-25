import { NextRequest, NextResponse } from 'next/server';
import {
    generateNumbers,
    generateFakeNumber,
    createSelectionOptions,
    getRoundConfig,
    generateNonce
} from '@/lib/gameLogic';
import {
    canStartSession,
    createSession,
    getPlayer,
    updatePlayer
} from '@/lib/store';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fid } = body;

        if (!fid || typeof fid !== 'number') {
            return NextResponse.json(
                { error: 'Invalid fid' },
                { status: 400 }
            );
        }

        // Check if player can start a new session
        const canStart = canStartSession(fid);
        if (!canStart.allowed) {
            return NextResponse.json(
                { error: canStart.reason, code: 'SESSION_LIMIT' },
                { status: 429 }
            );
        }

        // Get round 1 configuration
        const roundConfig = getRoundConfig(1);

        // Generate numbers server-side
        const shownNumbers = generateNumbers(roundConfig.numberCount);
        const fakeNumber = generateFakeNumber(shownNumbers);
        const selectionOptions = createSelectionOptions(shownNumbers, fakeNumber);
        const nonce = generateNonce();
        const sessionId = generateNonce();

        // Create session
        const session = {
            id: sessionId,
            fid,
            round: 1,
            shownNumbers,
            fakeNumber,
            selectionOptions,
            nonce,
            startedAt: new Date(),
            roundStartedAt: new Date(),
            displayTime: roundConfig.displayTime,
            tokensEarned: 0,
            completed: false,
        };

        createSession(session);

        // Update player's last played
        const player = getPlayer(fid);
        updatePlayer(fid, { lastPlayedAt: new Date() });

        // Return data to client (don't send fakeNumber!)
        return NextResponse.json({
            sessionId,
            round: 1,
            numbers: shownNumbers,
            displayTime: roundConfig.displayTime * 1000, // Convert to ms
            nonce,
            sessionsRemaining: 3 - player.dailySessions - 1,
        });

    } catch (error) {
        console.error('Error starting game:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
