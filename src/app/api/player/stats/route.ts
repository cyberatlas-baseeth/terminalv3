import { NextRequest, NextResponse } from 'next/server';
import { getPlayerStats } from '@/lib/store';

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

        const stats = getPlayerStats(fid);

        return NextResponse.json(stats);

    } catch (error) {
        console.error('Error getting player stats:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
