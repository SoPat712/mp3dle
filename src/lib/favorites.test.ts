import { describe, expect, it } from 'vitest';
import { parseFavorites } from './favorites';

describe('parseFavorites', () => {
	it('reads a saved list', () => {
		const saved = JSON.stringify([
			{ username: 'Glaive', permalink: '1glaive', avatarUrl: 'a.jpg' }
		]);
		expect(parseFavorites(saved)).toEqual([
			{ username: 'Glaive', permalink: '1glaive', avatarUrl: 'a.jpg' }
		]);
	});

	it('starts empty when nothing is saved', () => {
		expect(parseFavorites(null)).toEqual([]);
	});

	it('ignores junk', () => {
		expect(parseFavorites('not json')).toEqual([]);
		expect(parseFavorites('{"username":"x"}')).toEqual([]);
		expect(parseFavorites('[null, 4, {"username":"x"}]')).toEqual([]);
	});
});
