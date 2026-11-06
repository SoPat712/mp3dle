import { getLocalDateKey, isValidDateKey } from '#lib/tracks.js';

// seconds of song you get on each try
export const CLIP_LENGTHS = [1, 2, 4, 7, 11, 16];

export type Stats = {
	played: number;
	wins: number;
	streak: number;
	maxStreak: number;
	distribution: number[];
	lastPlayedDate?: string;
	lastResult?: number;
};

export type AttemptInfo = { status: 'skip' | 'wrong' | 'correct'; title?: string };

export type SavedGame = {
	attemptInfos: AttemptInfo[];
	gameOver: boolean;
	won: boolean;
	statsRecorded: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// anything that isn't a sensible count becomes 0
function toCount(value: unknown) {
	return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function createEmptyStats(maxAttempts: number): Stats {
	return {
		played: 0,
		wins: 0,
		streak: 0,
		maxStreak: 0,
		distribution: Array(maxAttempts).fill(0)
	};
}

// localstorage can hold anything, so clean up what we read back
export function sanitizeStats(value: unknown, maxAttempts: number): Stats {
	const saved = isObject(value) ? value : {};
	const played = toCount(saved.played);
	const wins = Math.min(toCount(saved.wins), played);
	const streak = Math.min(toCount(saved.streak), wins);
	const distribution = Array.isArray(saved.distribution) ? saved.distribution : [];
	const lastPlayed = saved.lastPlayedDate;
	const lastPlayedDate =
		typeof lastPlayed === 'string' && isValidDateKey(lastPlayed) ? lastPlayed : undefined;
	const lastResult = saved.lastResult;

	return {
		played,
		wins,
		streak,
		maxStreak: Math.max(streak, Math.min(toCount(saved.maxStreak), wins)),
		distribution: Array.from({ length: maxAttempts }, (_, i) => toCount(distribution[i])),
		lastPlayedDate,
		...(lastPlayedDate &&
		typeof lastResult === 'number' &&
		Number.isInteger(lastResult) &&
		lastResult >= 0 &&
		lastResult <= maxAttempts
			? { lastResult }
			: {})
	};
}

function parseAttempt(value: unknown): AttemptInfo | null {
	if (!isObject(value)) return null;
	if (value.status === 'skip') return { status: 'skip' };
	if (
		(value.status === 'wrong' || value.status === 'correct') &&
		typeof value.title === 'string' &&
		value.title.trim()
	) {
		return { status: value.status, title: value.title.trim() };
	}
	return null;
}

// returns null if the save doesn't add up, so nobody gets a half broken game back
export function parseSavedGame(value: unknown, maxAttempts: number): SavedGame | null {
	if (
		!isObject(value) ||
		!Array.isArray(value.attemptInfos) ||
		typeof value.gameOver !== 'boolean' ||
		typeof value.won !== 'boolean' ||
		value.attemptInfos.length > maxAttempts
	) {
		return null;
	}

	const attempts = value.attemptInfos.map(parseAttempt);
	if (attempts.includes(null)) return null;
	const attemptInfos = attempts as AttemptInfo[];

	const { gameOver, won } = value;
	const corrects = attemptInfos.filter((attempt) => attempt.status === 'correct').length;
	const count = attemptInfos.length;

	const validWin =
		gameOver && won && corrects === 1 && attemptInfos[count - 1].status === 'correct';
	const validLoss = gameOver && !won && corrects === 0 && count === maxAttempts;
	const stillPlaying = !gameOver && !won && corrects === 0 && count < maxAttempts;
	if (!validWin && !validLoss && !stillPlaying) return null;

	return { attemptInfos, gameOver, won, statsRecorded: gameOver && value.statsRecorded === true };
}

export function calculateNextStats(
	stats: Stats,
	didWin: boolean,
	attempts: number,
	todayKey: string,
	maxAttempts: number
): Stats {
	// one result a day, no farming
	if (stats.lastPlayedDate === todayKey) return stats;

	const yesterday = new Date(`${todayKey}T12:00:00`);
	yesterday.setDate(yesterday.getDate() - 1);
	const playedYesterday = stats.lastPlayedDate === getLocalDateKey(yesterday);
	const streak = !didWin ? 0 : playedYesterday ? stats.streak + 1 : 1;

	const distribution = Array.from({ length: maxAttempts }, (_, i) => stats.distribution[i] || 0);
	if (didWin) distribution[Math.max(Math.min(attempts - 1, maxAttempts - 1), 0)] += 1;

	return {
		...stats,
		played: stats.played + 1,
		wins: stats.wins + (didWin ? 1 : 0),
		streak,
		maxStreak: Math.max(stats.maxStreak, streak),
		distribution,
		lastPlayedDate: todayKey,
		lastResult: didWin ? attempts : 0
	};
}
