import { describe, expect, it } from 'vitest';
import {
	filterCatalogTracks,
	getDailyTrack,
	getGuessTracks,
	getPracticeTrack,
	type Track
} from '$lib/tracks';
import { parsePublicClientId, parsePublicProfileAccess } from '$lib/server/soundcloud';

const track = (title: string, slug: string): Track => ({
	title,
	slug,
	artist: 'Test Artist',
	url: `https://soundcloud.com/test-artist/${slug}`
});

describe('catalog cleanup', () => {
	it('removes alternate versions without rejecting collaborations or ordinary titles', () => {
		const cleaned = filterCatalogTracks([
			track('Song (Acoustic)', 'song-acoustic'),
			track('Song (Live at Home)', 'song-live'),
			track('Song [Extended Remix]', 'song-remix'),
			track('Song - Instrumental', 'song-instrumental'),
			track('Duet (feat. Somebody)', 'duet'),
			track('Live Forever', 'live-forever')
		]);

		expect(cleaned.map(({ title }) => title)).toEqual(['Duet (feat. Somebody)', 'Live Forever']);
	});

	it('collapses duplicate titles and prefers an unsuffixed canonical slug', () => {
		expect(
			filterCatalogTracks([track('Same Song', 'same-song-2'), track('Same Song', 'same-song')])
		).toEqual([track('Same Song', 'same-song')]);
	});

	it('returns alphabetized unique guesses', () => {
		expect(
			getGuessTracks([
				track('Zulu', 'zulu'),
				track('Alpha', 'alpha'),
				track('Alpha', 'alpha-2')
			]).map(({ title }) => title)
		).toEqual(['Alpha', 'Zulu']);
	});
});

describe('daily artist selection', () => {
	const catalog = [track('One', 'one'), track('Two', 'two'), track('Three', 'three')];

	it('is stable for an artist and date', () => {
		expect(getDailyTrack('2026-08-20', catalog, 'artist')).toEqual(
			getDailyTrack('2026-08-20', catalog, 'artist')
		);
	});

	it('does not depend on catalog ordering', () => {
		expect(getDailyTrack('2026-08-20', catalog, 'artist')).toEqual(
			getDailyTrack('2026-08-20', [...catalog].reverse(), 'artist')
		);
	});

	it('rejects an empty catalog', () => {
		expect(() => getDailyTrack('2026-08-20', [], 'artist')).toThrow('no playable');
	});
});

describe('unlimited practice selection', () => {
	const catalog = [track('One', 'one'), track('Two', 'two'), track('Three', 'three')];

	it('is stable for an artist and practice key', () => {
		expect(getPracticeTrack(catalog, 'artist', 'round-one')).toEqual(
			getPracticeTrack(catalog, 'artist', 'round-one')
		);
	});

	it('does not depend on catalog ordering', () => {
		expect(getPracticeTrack(catalog, 'artist', 'round-two')).toEqual(
			getPracticeTrack([...catalog].reverse(), 'artist', 'round-two')
		);
	});

	it('supports a one-track catalog', () => {
		expect(getPracticeTrack([track('Only', 'only')], 'artist', 'round').slug).toBe('only');
	});
});

describe('public SoundCloud discovery', () => {
	const html = `
		<meta content="soundcloud://users:198614687">
		<script>[{"hydratable":"apiClient","data":{"id":"public-client-id"}}]</script>
	`;

	it('reads the public web client and profile identifiers', () => {
		expect(parsePublicClientId(html)).toBe('public-client-id');
		expect(parsePublicProfileAccess(html)).toEqual({
			clientId: 'public-client-id',
			userId: '198614687'
		});
	});

	it('fails closed if SoundCloud changes its public payload', () => {
		expect(() => parsePublicProfileAccess('<html></html>')).toThrow('public client data');
	});
});
