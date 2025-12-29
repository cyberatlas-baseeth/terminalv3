import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db';

export async function GET() {
    try {
        const leaderboard = await getLeaderboard();

        return NextResponse.json({
            leaderboard,
        });

    } catch (error) {
        console.error('Error getting leaderboard:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
