// Game configuration
export const ROUND_CONFIG = [
    { round: 1, numberCount: 6, displayTime: 10 },  // 10 seconds, 6 options
    { round: 2, numberCount: 6, displayTime: 10 },  // 10 seconds, 6 options
    { round: 3, numberCount: 6, displayTime: 10 },  // 10 seconds, 6 options
];

export const MAX_SESSIONS_PER_COOLDOWN = 1;  // 1 attempt per cooldown period
export const COOLDOWN_HOURS = 6;  // 6 hour cooldown after attempt
export const MAX_TOKENS_PER_SESSION = 30; // 10 tokens x 3 rounds max per session
export const TOKENS_PER_CORRECT = 10; // 10 ASLR tokens per correct answer
export const TOTAL_ROUNDS = 3;

// Generate unique random 3-digit numbers
export function generateNumbers(count: number): number[] {
    const numbers = new Set<number>();
    while (numbers.size < count) {
        // Generate number between 100-999
        const num = Math.floor(Math.random() * 900) + 100;
        numbers.add(num);
    }
    return Array.from(numbers);
}

// Generate a fake number that's not in the shown numbers
export function generateFakeNumber(shownNumbers: number[]): number {
    let fakeNumber: number;
    do {
        fakeNumber = Math.floor(Math.random() * 900) + 100;
    } while (shownNumbers.includes(fakeNumber));
    return fakeNumber;
}

// Select 2 real numbers and 1 fake for the selection phase
export function createSelectionOptions(shownNumbers: number[], fakeNumber: number): number[] {
    // Pick 2 random numbers from the shown ones
    const shuffled = [...shownNumbers].sort(() => Math.random() - 0.5);
    const realNumbers = shuffled.slice(0, 2);

    // Combine with fake and shuffle
    const options = [...realNumbers, fakeNumber].sort(() => Math.random() - 0.5);
    return options;
}

// Get round configuration
export function getRoundConfig(round: number) {
    return ROUND_CONFIG[round - 1] || ROUND_CONFIG[0];
}

// Generate a secure nonce
export function generateNonce(): string {
    const array = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
    } else {
        // Fallback for server-side
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Check if date is today (UTC)
export function isToday(date: Date): boolean {
    const today = new Date();
    return (
        date.getUTCFullYear() === today.getUTCFullYear() &&
        date.getUTCMonth() === today.getUTCMonth() &&
        date.getUTCDate() === today.getUTCDate()
    );
}
