import { sdk } from '@farcaster/miniapp-sdk';

export interface FarcasterUser {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
}

// Check if we're running inside Farcaster
export async function isInFarcaster(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
        return await sdk.isInMiniApp();
    } catch {
        return false;
    }
}

// Initialize SDK and signal ready
export async function initializeSDK(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        await sdk.actions.ready();
    } catch (error) {
        console.log('SDK ready failed (might not be in Farcaster client):', error);
    }
}

// Get user context from SDK
export async function getUserContext(): Promise<FarcasterUser | null> {
    if (typeof window === 'undefined') return null;

    try {
        const context = await sdk.context;
        if (context?.user) {
            return {
                fid: context.user.fid,
                username: context.user.username,
                displayName: context.user.displayName,
                pfpUrl: context.user.pfpUrl,
            };
        }
    } catch (error) {
        console.log('Failed to get user context:', error);
    }

    return null;
}

// Share game result via cast
export async function shareResult(totalTime: number, perfectGame: boolean): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        const accessLevel = perfectGame ? 'ELITE' : 'VERIFIED';
        const timeDisplay = totalTime < 60
            ? `${totalTime} seconds`
            : `${Math.floor(totalTime / 60)}m ${totalTime % 60}s`;

        const text = `🔒 I secured the connection in ${timeDisplay}.\n\nAccess level: ${accessLevel}\n\nCan you beat my time?\n\nhttps://farcaster.xyz/miniapps/cIo-J-RvhenI/terminal`;

        await sdk.actions.composeCast({
            text,
            embeds: [],
        });
    } catch (error) {
        console.log('Failed to share result:', error);
    }
}

// For testing outside Farcaster - generate a mock user
export function getMockUser(): FarcasterUser {
    return {
        fid: Math.floor(Math.random() * 100000) + 1,
        username: 'test_user',
        displayName: 'Test User',
    };
}
