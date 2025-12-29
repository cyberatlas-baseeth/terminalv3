import { NextRequest, NextResponse } from 'next/server';
import { getPlayerStats } from '@/lib/store';
import { getPlayerTokens } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const fidParam = searchParams.get('fid');

        if (!fidParam) {
            return NextResponse.json(
                { error: 'Missing fid parameter' },
                { status: 400 }
            );
        }

        const fid = parseInt(fidParam, 10);
        if (isNaN(fid)) {
            return NextResponse.json(
                { error: 'Invalid fid' },
                { status: 400 }
            );
        }

        // Get in-memory stats (cooldown info)
        const stats = getPlayerStats(fid);

        // Get total tokens from Supabase
        const totalTokens = await getPlayerTokens(fid);

        return NextResponse.json({
            ...stats,
            totalTokens,  // Override with Supabase value
        });

    } catch (error) {
        console.error('Error getting player stats:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
