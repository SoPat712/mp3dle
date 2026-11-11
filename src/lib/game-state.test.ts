import { describe, expect, it } from 'vitest';
import {
	alreadyGuessed,
	calculateNextStats,
	createEmptyStats,
	parseSavedGame,
	sanitizeStats
} from '#lib/game-state.js';

describe('duplicate guesses', () => {
	it.each(['White Roses', 'WHITE ROSES', 'white---roses!'])(
		'recognizes a repeated wrong title: %s',
		(title) => {
			expect(alreadyGuessed([{ status: 'wrong', title: 'White Roses' }], title)).toBe(true);
		}
	);

	it('ignores skips and correct attempts', () => {
		expect(alreadyGuessed([{ status: 'skip', title: 'White Roses' }], 'White Roses')).toBe(false);
		expect(alreadyGuessed([{ status: 'skip' }], 'White Roses')).toBe(false);
		expect(alreadyGuessed([{ status: 'correct', title: 'White Roses' }], 'White Roses')).toBe(
			false
		);
	});

	it('allows new titles', () => {
		expect(alreadyGuessed([{ status: 'wrong', title: 'White Roses' }], 'Emotional')).toBe(false);
		expect(alreadyGuessed([], 'White Roses')).toBe(false);
	});
});

describe('game statistics', () => {
	it('starts a streak with a win', () => {
		const stats = calculateNextStats(createEmptyStats(6), true, 2, '2026-07-20', 6);

		expect(stats).toMatchObject({
			played: 1,
			wins: 1,
			streak: 1,
			maxStreak: 1,
			lastPlayedDate: '2026-07-20',
			lastResult: 2
		});
		expect(stats.distribution).toEqual([0, 1, 0, 0, 0, 0]);
	});

	it('continues a streak only on consecutive days', () => {
		const first = calculateNextStats(createEmptyStats(6), true, 1, '2026-07-20', 6);
		const consecutive = calculateNextStats(first, true, 3, '2026-07-21', 6);
		const afterGap = calculateNextStats(consecutive, true, 1, '2026-07-23', 6);

		expect(consecutive.streak).toBe(2);
		expect(afterGap.streak).toBe(1);
		expect(afterGap.maxStreak).toBe(2);
	});

	it('resets a streak after a loss', () => {
		const winning = calculateNextStats(createEmptyStats(6), true, 1, '2026-07-20', 6);
		const losing = calculateNextStats(winning, false, 6, '2026-07-21', 6);

		expect(losing.lastResult).toBe(0);
		expect(losing.streak).toBe(0);
		expect(losing.wins).toBe(1);
		expect(losing.distribution).toEqual([1, 0, 0, 0, 0, 0]);
	});

	it('records at most one result per day', () => {
		const first = calculateNextStats(createEmptyStats(6), true, 1, '2026-07-20', 6);
		const duplicate = calculateNextStats(first, false, 6, '2026-07-20', 6);

		expect(first.lastResult).toBe(1);
		expect(duplicate.lastResult).toBe(1);
		expect(duplicate).toEqual(first);
	});

	it('sanitizes stored statistics', () => {
		expect(
			sanitizeStats(
				{
					played: 2,
					wins: 5,
					streak: -1,
					maxStreak: '4',
					distribution: [1, '2', 3],
					lastPlayedDate: 'not-a-date'
				},
				6
			)
		).toEqual({
			played: 2,
			wins: 2,
			streak: 0,
			maxStreak: 0,
			distribution: [1, 0, 3, 0, 0, 0],
			lastPlayedDate: undefined
		});
	});

	it.each([0, 1, 6])('keeps a valid last result of %s', (lastResult) => {
		const stats = sanitizeStats({ lastPlayedDate: '2026-07-20', lastResult }, 6);

		expect(stats.lastResult).toBe(lastResult);
	});

	it.each([-1, 7, 1.5, '2', null, undefined])(
		'drops an invalid last result of %s',
		(lastResult) => {
			const stats = sanitizeStats({ lastPlayedDate: '2026-07-20', lastResult }, 6);

			expect(stats).not.toHaveProperty('lastResult');
		}
	);

	it.each(['not-a-date', '2026-02-30', undefined])(
		'drops the last result without a valid date: %s',
		(lastPlayedDate) => {
			const stats = sanitizeStats({ lastPlayedDate, lastResult: 2 }, 6);

			expect(stats).not.toHaveProperty('lastResult');
		}
	);

	it('loads old statistics without a last result', () => {
		const saved = { ...createEmptyStats(6), lastPlayedDate: '2026-07-20' };

		expect(sanitizeStats(saved, 6)).toEqual(saved);
		expect(sanitizeStats(saved, 6)).not.toHaveProperty('lastResult');
	});

	it('restores only consistent saved games', () => {
		expect(
			parseSavedGame(
				{
					attemptInfos: [{ status: 'skip' }, { status: 'correct', title: 'Psycho' }],
					gameOver: true,
					won: true,
					statsRecorded: true
				},
				6
			)
		).toEqual({
			attemptInfos: [{ status: 'skip' }, { status: 'correct', title: 'Psycho' }],
			gameOver: true,
			won: true,
			statsRecorded: true
		});
		expect(
			parseSavedGame({ attemptInfos: [], gameOver: true, won: false, statsRecorded: false }, 6)
		).toBeNull();
	});
});
