import { describe, expect, it } from 'vitest';
import { summarizeSavedData } from './saved-data';

describe('summarizeSavedData', () => {
	it('returns all four empty groups in display order', () => {
		expect(summarizeSavedData([])).toEqual([
			{ id: 'stats', name: 'Stats', detail: 'none', size: '0 KB', keys: [] },
			{ id: 'games', name: 'Saved rounds', detail: 'none', size: '0 KB', keys: [] },
			{ id: 'favorites', name: 'Favorites', detail: 'none', size: '0 KB', keys: [] },
			{ id: 'settings', name: 'Settings', detail: 'none', size: '0 KB', keys: [] }
		]);
	});

	it('includes only the exact supported key shapes, including games from any date', () => {
		const included = [
			'mp3dle:glaive:stats:v1',
			'mp3dle:brakence:stats:v1',
			'mp3dle:glaive:game:2020-01-01:daily',
			'mp3dle:glaive:game:2099-01-01:daily',
			'mp3dle:favorites',
			'mp3dle:volume',
			'mp3dle:theme'
		];
		const excluded = [
			'soundcloud-heardle:glaive:stats:v1',
			'other:mp3dle:glaive:stats:v1',
			'mp3dle:glaive:stats:v2',
			'mp3dle::stats:v1',
			'mp3dle:glaive:extra:stats:v1',
			'mp3dle:glaive:game:2020-01-01',
			'mp3dle:glaive:game::daily',
			'mp3dle:glaive:game:2020-01-01:daily:extra',
			'mp3dle:favorites:extra',
			'mp3dle:theme:extra',
			'mp3dle:unknown'
		];
		const groups = summarizeSavedData([...included, ...excluded].map((key) => [key, 'bad json']));
		expect(groups.map(({ keys }) => keys)).toEqual([
			included.slice(0, 2),
			included.slice(2, 4),
			[included[4]],
			included.slice(5)
		]);
		expect(groups.map(({ detail }) => detail)).toEqual([
			'2 artists',
			'2 rounds',
			'0 artists',
			'theme, volume'
		]);
	});

	it('uses singular labels and parses only valid favorites', () => {
		const groups = summarizeSavedData([
			['mp3dle:glaive:stats:v1', 'not json'],
			['mp3dle:glaive:game:2026-11-03:daily', 'not json'],
			[
				'mp3dle:favorites',
				JSON.stringify([null, { username: 'Glaive', permalink: '1glaive' }, { username: 'bad' }])
			],
			['mp3dle:volume', 'not a number']
		]);
		expect(groups.map(({ detail }) => detail)).toEqual([
			'1 artist',
			'1 round',
			'1 artist',
			'theme, volume'
		]);
	});

	it.each(['not json', '{}', '[]', '[null, 4]'])(
		'counts saved invalid or empty favorites as zero: %s',
		(saved) => {
			const favorites = summarizeSavedData([['mp3dle:favorites', saved]])[2];
			expect(favorites.detail).toBe('0 artists');
			expect(favorites.keys).toEqual(['mp3dle:favorites']);
			expect(favorites.size).toBe('<1 KB');
		}
	);

	it('counts multiple valid favorites and lists a lone theme setting', () => {
		const groups = summarizeSavedData([
			[
				'mp3dle:favorites',
				JSON.stringify([
					{ username: 'Glaive', permalink: '1glaive' },
					{ username: 'Brakence', permalink: 'brakence' }
				])
			],
			['mp3dle:theme', 'light']
		]);
		expect(groups[2].detail).toBe('2 artists');
		expect(groups[3].detail).toBe('theme, volume');
	});

	it.each([
		[24, '<1 KB'],
		[1022, '<1 KB'],
		[1024, '1 KB'],
		[1026, '2 KB'],
		[2048, '2 KB']
	])('formats %i bytes as %s, counting both keys and values', (bytes, expected) => {
		const key = 'mp3dle:theme';
		const value = 'x'.repeat(bytes / 2 - key.length);
		expect(summarizeSavedData([[key, value]])[3].size).toBe(expected);
	});

	it('adds the sizes of every entry in a group using UTF-16 lengths', () => {
		const theme = 'mp3dle:theme';
		const volume = 'mp3dle:volume';
		const entries: [string, string][] = [
			[theme, '🎵'.repeat(240)],
			[volume, 'x'.repeat(512 - theme.length - volume.length - 480)]
		];
		expect(summarizeSavedData(entries)[3].size).toBe('1 KB');
	});
});
