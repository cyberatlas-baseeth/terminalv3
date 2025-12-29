import { COOLDOWN_MINUTES, MAX_SESSIONS_PER_COOLDOWN } from './gameLogic';

// Player data structure
export interface PlayerData {
    fid: number;
    sessionsInCooldown: number;  // Sessions used in current cooldown period
    lastPlayedAt: Date | null;   // When the player last played
    cooldownEndsAt: Date | null; // When the cooldown ends
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
    correctAnswers: number;
    wrongAnswers: number;
}

// In-memory stores (replace with database in production)
const players = new Map<number, PlayerData>();
const sessions = new Map<string, GameSession>();

// Check if cooldown has expired
function isCooldownExpired(cooldownEndsAt: Date | null): boolean {
    if (!cooldownEndsAt) return true;
    return new Date() >= new Date(cooldownEndsAt);
}

// Get remaining cooldown time in milliseconds
export function getRemainingCooldown(cooldownEndsAt: Date | null): number {
    if (!cooldownEndsAt) return 0;
    const remaining = new Date(cooldownEndsAt).getTime() - Date.now();
    return remaining > 0 ? remaining : 0;
}

// Format remaining time as hours:minutes:seconds
export function formatCooldownTime(ms: number): string {
    if (ms <= 0) return '00:00:00';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Get or create player
export function getPlayer(fid: number): PlayerData {
    let player = players.get(fid);

    if (!player) {
        player = {
            fid,
            sessionsInCooldown: 0,
            lastPlayedAt: null,
            cooldownEndsAt: null,
            totalTokens: 0,
            perfectSessions: 0,
            currentStreak: 0,
            lastStreakDate: null,
        };
        players.set(fid, player);
    }

    // Reset session counter if cooldown has expired
    if (isCooldownExpired(player.cooldownEndsAt)) {
        player.sessionsInCooldown = 0;
        player.cooldownEndsAt = null;
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
export function canStartSession(fid: number): { allowed: boolean; reason?: string; cooldownEndsAt?: Date | null } {
    const player = getPlayer(fid);

    if (player.sessionsInCooldown >= MAX_SESSIONS_PER_COOLDOWN && !isCooldownExpired(player.cooldownEndsAt)) {
        const remainingMs = getRemainingCooldown(player.cooldownEndsAt);
        const formatted = formatCooldownTime(remainingMs);
        return {
            allowed: false,
            reason: `Security system is locked. Wait ${formatted} before next attempt.`,
            cooldownEndsAt: player.cooldownEndsAt,
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

// Start cooldown immediately when game starts (prevents mid-game exit exploit)
export function startSessionCooldown(fid: number): void {
    const player = getPlayer(fid);
    const now = new Date();

    // Calculate cooldown end time (COOLDOWN_MINUTES from now)
    const cooldownEnd = new Date(now.getTime() + COOLDOWN_MINUTES * 60 * 1000);

    updatePlayer(fid, {
        sessionsInCooldown: player.sessionsInCooldown + 1,
        lastPlayedAt: now,
        cooldownEndsAt: cooldownEnd,
    });
}

// Record session completion (cooldown already started at game start)
export function recordSessionCompletion(fid: number, perfect: boolean): void {
    const player = getPlayer(fid);

    // Only update perfectSessions (cooldown was already started when game began)
    const updates: Partial<PlayerData> = {};

    if (perfect) {
        updates.perfectSessions = player.perfectSessions + 1;
    }

    // Update streak (based on daily play, not cooldown)
    const today = new Date();
    if (player.lastStreakDate) {
        const lastDate = new Date(player.lastStreakDate);
        const yesterday = new Date(today);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);

        const isSameDay = (
            lastDate.getUTCFullYear() === today.getUTCFullYear() &&
            lastDate.getUTCMonth() === today.getUTCMonth() &&
            lastDate.getUTCDate() === today.getUTCDate()
        );

        const isYesterday = (
            lastDate.getUTCFullYear() === yesterday.getUTCFullYear() &&
            lastDate.getUTCMonth() === yesterday.getUTCMonth() &&
            lastDate.getUTCDate() === yesterday.getUTCDate()
        );

        if (isYesterday) {
            updates.currentStreak = player.currentStreak + 1;
        } else if (!isSameDay) {
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
    const cooldownExpired = isCooldownExpired(player.cooldownEndsAt);
    const remainingMs = getRemainingCooldown(player.cooldownEndsAt);

    return {
        sessionsUsed: player.sessionsInCooldown,
        canPlay: cooldownExpired || player.sessionsInCooldown < MAX_SESSIONS_PER_COOLDOWN,
        cooldownEndsAt: player.cooldownEndsAt,
        cooldownRemaining: remainingMs,
        cooldownFormatted: formatCooldownTime(remainingMs),
        totalTokens: player.totalTokens,
        perfectSessions: player.perfectSessions,
        currentStreak: player.currentStreak,
    };
}
