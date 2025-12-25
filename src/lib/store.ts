import { isToday, MAX_SESSIONS_PER_DAY, MAX_TOKENS_PER_DAY } from './gameLogic';

// Player data structure
export interface PlayerData {
    fid: number;
    dailySessions: number;
    lastPlayedAt: Date | null;
    tokensToday: number;
    totalTokens: number;
    perfectSessions: number;
    currentStreak: number;
    lastStreakDate: Date | null;
}

// Game session structure
export interface GameSession {
    id: string;
    fid: number;
    round: number;
    shownNumbers: number[];
    fakeNumber: number;
    selectionOptions: number[];
    nonce: string;
    startedAt: Date;
    roundStartedAt: Date;
    displayTime: number;
    tokensEarned: number;
    completed: boolean;
}

// In-memory stores (replace with database in production)
const players = new Map<number, PlayerData>();
const sessions = new Map<string, GameSession>();

// Get or create player
export function getPlayer(fid: number): PlayerData {
    let player = players.get(fid);

    if (!player) {
        player = {
            fid,
            dailySessions: 0,
            lastPlayedAt: null,
            tokensToday: 0,
            totalTokens: 0,
            perfectSessions: 0,
            currentStreak: 0,
            lastStreakDate: null,
        };
        players.set(fid, player);
    }

    // Reset daily counters if it's a new day
    if (player.lastPlayedAt && !isToday(new Date(player.lastPlayedAt))) {
        player.dailySessions = 0;
        player.tokensToday = 0;
    }

    return player;
}

// Update player
export function updatePlayer(fid: number, updates: Partial<PlayerData>): PlayerData {
    const player = getPlayer(fid);
    const updated = { ...player, ...updates };
    players.set(fid, updated);
    return updated;
}

// Check if player can start new session
export function canStartSession(fid: number): { allowed: boolean; reason?: string } {
    const player = getPlayer(fid);

    if (player.dailySessions >= MAX_SESSIONS_PER_DAY) {
        return {
            allowed: false,
            reason: `Security system allows only ${MAX_SESSIONS_PER_DAY} breach attempts per day. Return tomorrow.`,
        };
    }

    return { allowed: true };
}

// Create new session
export function createSession(session: GameSession): void {
    sessions.set(session.id, session);
}

// Get session
export function getSession(sessionId: string): GameSession | undefined {
    return sessions.get(sessionId);
}

// Update session
export function updateSession(sessionId: string, updates: Partial<GameSession>): GameSession | undefined {
    const session = sessions.get(sessionId);
    if (!session) return undefined;

    const updated = { ...session, ...updates };
    sessions.set(sessionId, updated);
    return updated;
}

// Delete session
export function deleteSession(sessionId: string): void {
    sessions.delete(sessionId);
}

// Award tokens to player
export function awardTokens(fid: number, amount: number): number {
    const player = getPlayer(fid);

    // Cap daily tokens
    const tokensToAward = Math.min(amount, MAX_TOKENS_PER_DAY - player.tokensToday);

    if (tokensToAward > 0) {
        updatePlayer(fid, {
            tokensToday: player.tokensToday + tokensToAward,
            totalTokens: player.totalTokens + tokensToAward,
        });
    }

    return tokensToAward;
}

// Record session completion
export function recordSessionCompletion(fid: number, perfect: boolean): void {
    const player = getPlayer(fid);
    const today = new Date();

    const updates: Partial<PlayerData> = {
        dailySessions: player.dailySessions + 1,
        lastPlayedAt: today,
    };

    if (perfect) {
        updates.perfectSessions = player.perfectSessions + 1;
    }

    // Update streak
    if (player.lastStreakDate) {
        const lastDate = new Date(player.lastStreakDate);
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);

        if (
            lastDate.getUTCFullYear() === yesterday.getUTCFullYear() &&
            lastDate.getUTCMonth() === yesterday.getUTCMonth() &&
            lastDate.getUTCDate() === yesterday.getUTCDate()
        ) {
            updates.currentStreak = player.currentStreak + 1;
        } else if (!isToday(lastDate)) {
            updates.currentStreak = 1;
        }
    } else {
        updates.currentStreak = 1;
    }

    updates.lastStreakDate = today;

    updatePlayer(fid, updates);
}

// Get player stats
export function getPlayerStats(fid: number) {
    const player = getPlayer(fid);

    return {
        sessionsToday: player.dailySessions,
        sessionsRemaining: MAX_SESSIONS_PER_DAY - player.dailySessions,
        tokensToday: player.tokensToday,
        totalTokens: player.totalTokens,
        perfectSessions: player.perfectSessions,
        currentStreak: player.currentStreak,
        canPlay: player.dailySessions < MAX_SESSIONS_PER_DAY,
    };
}
