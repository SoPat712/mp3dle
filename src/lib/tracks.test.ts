import seedrandom from 'seedrandom';
import { describe, expect, it } from 'vitest';
import {
	filterCatalogTracks,
	getDailyTrack,
	getGuessTracks,
	getPracticeTrack,
	getWidgetSrc,
	normalizeTrackTitle,
	type Track
} from '#lib/tracks.js';
import { parsePublicClientId, parsePublicProfileAccess } from '#lib/server/soundcloud.js';

const track = (title: string, slug: string): Track => ({
	title,
	slug,
	artist: 'Test Artist',
	url: `https://soundcloud.com/test-artist/${slug}`
});

describe('widget source', () => {
	it.each([123, undefined])('uses the track address and lean options with id %s', (id) => {
		const song = { ...track('Song', 'song'), id };
		const url = id ? `https://api.soundcloud.com/tracks/${id}` : song.url;
		expect(getWidgetSrc(song)).toBe(
			`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&show_artwork=false&visual=false&show_comments=false&hide_related=true&show_user=false&show_reposts=false&show_teaser=false&buying=false&sharing=false&download=false`
		);
	});
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

	it.each([
		'Blank Space (Commentary)',
		'Radio Outro (Commentary)',
		'Blank Space (Voice Memo)',
		'I Wish You Would (Voice Memo)',
		'Opalite (Track by Track)',
		'CANCELLED! (Track by Track)',
		'august (the long pond studio sessions)',
		'exile (the long pond studio sessions) [feat. Bon Iver]',
		"Should've Said No (The 3D Concert Experience)",
		'All Too Well (10 Minute Version) (The Short Film)',
		'glaive & kurtains - The Troubles (cdq snippet)',
		'glaive - weird (lq snippet)',
		'glaive - j (snippet)',
		'kurtains - violent (feat. glaive & ericdoa)[snippet] FULL LEAK IN DESCRIPTION',
		'glaive - feathered indians (cover)',
		'glaive - stay (cover)',
		"Cate's Brother (BRELAND's Version)",
		"Cate's Brother (Matt's Version)",
		'Message In A Bottle (Fat Max G Remix) (Taylor’s Version)',
		'Fortnight (Acoustic Version) [feat. Post Malone]',
		'I Can Do It With a Broken Heart (Instrumental)',
		'Cruel Summer (Live from TS | The Eras Tour)',
		'Patient Zero (Piano Version)'
	])('removes %s from the catalog', (title) => {
		expect(filterCatalogTracks([track(title, 'song')])).toEqual([]);
	});

	it.each([
		"Love Story (Taylor's Version)",
		"Say Don't Go (Taylor's Version) (From The Vault)",
		'Electric Touch (Taylor’s Version) (From The Vault) [feat. Fall Out Boy]',
		'Mr. Perfectly Fine (Taylor’s Version) (From The Vault)',
		'You’re Losing Me (From The Vault)',
		'it’s time to go (bonus track)',
		'right where you left me (bonus track)',
		'Carolina (From The Motion Picture “Where The Crawdads Sing”)',
		'Beautiful Ghosts (From The Motion Picture Soundtrack "Cats")',
		'Safe & Sound (from The Hunger Games Soundtrack) [feat. The Civil Wars]',
		'Anti-Hero (feat. Bleachers)',
		'If You Let Me (with Marcus Mumford)',
		'sticks (p. heartdept)',
		"glaive - there's a little bit farther left to go (v2)",
		'kurtains - violent (feat. glaive & ericdoa) [full song]',
		'Old Freight Train Interlude',
		'Duet (feat. Somebody)',
		'Live Forever',
		"Love Story [Taylor's Version]",
		'Love Story [Taylor’s Version]',
		"Love Story (TAYLOR'S VERSION)"
	])('keeps %s in the catalog', (title) => {
		const song = track(title, 'song');
		expect(filterCatalogTracks([song])).toEqual([song]);
	});

	it.each([
		'commentary',
		'voice memo',
		'track by track',
		'interview',
		'session',
		'sessions',
		'concert',
		'rehearsal',
		'short film',
		'snippet',
		'teaser',
		'preview',
		'cover',
		'extended'
	])('removes bracketed %s qualifiers even when glued or unclosed', (qualifier) => {
		for (const title of [
			`Song (${qualifier})`,
			`Song[${qualifier}]`,
			`Song (${qualifier}`,
			`Song[${qualifier}`
		]) {
			expect(filterCatalogTracks([track(title, 'song')])).toEqual([]);
		}
	});

	it.each(['commentary', 'voice memo', 'track by track', 'interview'])(
		'removes %s dash suffixes',
		(qualifier) => {
			expect(filterCatalogTracks([track(`Song - ${qualifier}`, 'song')])).toEqual([]);
		}
	);

	it.each([
		'session',
		'sessions',
		'concert',
		'rehearsal',
		'short film',
		'snippet',
		'teaser',
		'preview',
		'cover',
		'extended'
	])('keeps artist uploads whose titles start with %s', (word) => {
		const song = track(`Artist - ${word} song`, 'song');
		expect(filterCatalogTracks([song])).toEqual([song]);
	});

	it.each([
		"Song (Taylor's Version Deluxe)",
		"Song (Not Taylor's Version)",
		"Song [Taylor's Version] (Remix)",
		"Song (Taylor's Version) - Acoustic"
	])('only exempts the exact taylor rerecording label in %s', (title) => {
		expect(filterCatalogTracks([track(title, 'song')])).toEqual([]);
	});

	it('collapses duplicate titles and prefers an unsuffixed canonical slug', () => {
		expect(
			filterCatalogTracks([track('Same Song', 'same-song-2'), track('Same Song', 'same-song')])
		).toEqual([track('Same Song', 'same-song')]);
	});

	it.each([
		[
			track('Snow On The Beach (feat. Lana Del Rey)', 'snow-on-the-beach'),
			track('Snow On The Beach (feat. More Lana Del Rey)', 'snow-on-the-beach-more-lana')
		],
		[
			track('Love Story', 'love-story'),
			track("Love Story (Taylor's Version)", 'love-story-taylors-version')
		]
	])('dedupes %s and %s regardless of catalog order', (canonical, duplicate) => {
		expect(filterCatalogTracks([duplicate, canonical])).toEqual([canonical]);
		expect(filterCatalogTracks([canonical, duplicate])).toEqual([canonical]);
	});

	it.each([
		'Song (feat. Somebody)',
		'Song [feat. Somebody]',
		'Song (ft. Somebody)',
		'Song (with Somebody)',
		'Song (From The Vault)',
		'Song (Taylor’s Version) (From The Vault) [feat. Somebody]',
		"Song [Taylor's Version]"
	])('ignores credits and rerecording labels when deduping %s', (title) => {
		const canonical = track(title, 'song');
		expect(filterCatalogTracks([track('Song', 'song-2'), canonical])).toEqual([canonical]);
	});

	it('keeps credits and rerecording labels in guess normalization', () => {
		expect(normalizeTrackTitle('Song (Taylor’s Version) (From The Vault) [feat. Somebody]')).toBe(
			'song taylor s version from the vault feat somebody'
		);
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

describe('variant and live-session cleanup', () => {
	const plain = [
		track('Soft', 'soft'),
		track('Walk Like This', 'walk-like-this'),
		track('Cardboard Box', 'cardboard-box'),
		track('Trustworthy (Interlude)', 'trustworthy-interlude'),
		track('Do It Again', 'do-it-again'),
		track('Do It Again (Part 2)', 'do-it-again-part-2'),
		track('Colors', 'colors')
	];
	const variants = [
		track('Soft (Unlocked)', 'soft-unlocked'),
		track('Walk Like This (Strut Speed)', 'walk-like-this-strut-speed'),
		track('Cardboard Box (Studio Vocals)', 'cardboard-box-studio-vocals'),
		track('Iron Man - A COLORS SHOW', 'iron-man-colors'),
		track('Song (A COLORS SHOW)', 'song-colors'),
		track('Song (Tiny Desk)', 'song-tiny-desk')
	];
	const catalog = [...plain, ...variants];

	it('drops variants with plain titles and live sessions', () => {
		expect(filterCatalogTracks(catalog)).toEqual(plain);
		expect(filterCatalogTracks([...catalog].reverse())).toEqual([...plain].reverse());
	});

	it.each([
		'Song [Unlocked]',
		'Song - Unlocked',
		'Song – Unlocked',
		'Song — Unlocked',
		'Song: Unlocked'
	])('drops %s only when a plain title exists', (title) => {
		const variant = track(title, 'song-unlocked');
		const original = track('Song', 'song');
		expect(filterCatalogTracks([variant])).toEqual([variant]);
		expect(filterCatalogTracks([variant, original])).toEqual([original]);
	});

	it.each(['Song (Part 2)', 'Song (Pt. 2)', 'Song - Pt 2'])(
		'keeps part numbers in %s next to the plain title',
		(title) => {
			const catalog = [track('Song', 'song'), track(title, 'song-part-2')];
			expect(filterCatalogTracks(catalog)).toEqual(catalog);
		}
	);

	it('strips credits and rerecording labels before comparing normalized variant titles', () => {
		const original = track('Café [feat. Somebody]', 'cafe');
		const variant = track("Cafe (Unlocked) (Taylor's Version) (From The Vault)", 'cafe-unlocked');
		expect(filterCatalogTracks([variant, original])).toEqual([original]);
	});

	it('does not treat another qualified title as a plain version', () => {
		const catalog = [
			track('Song (Unlocked)', 'song-unlocked'),
			track('Song [Bonus]', 'song-bonus')
		];
		expect(filterCatalogTracks(catalog)).toEqual(catalog);
	});

	it.each([
		'A COLOURS SHOW - Song',
		'Song: a colors show',
		'Tiny Desk - Song',
		'Song tiny desk concert'
	])('removes live platform labels anywhere in %s', (title) => {
		expect(filterCatalogTracks([track(title, 'song')])).toEqual([]);
	});

	it('keeps ordinary colors and colours titles', () => {
		const catalog = [track('Colors', 'colors'), track('Colours', 'colours')];
		expect(filterCatalogTracks(catalog)).toEqual(catalog);
	});

	it('never picks a dropped variant for the daily song', () => {
		for (const day of ['2026-11-03', '2026-11-05', '2026-11-06', '2027-01-01']) {
			for (let i = 0; i < 20; i++) {
				expect(plain).toContainEqual(getDailyTrack(day, catalog, `artist-${i}`));
			}
		}
	});

	it('filters guesses and practice songs', () => {
		expect(getGuessTracks(catalog)).toEqual(
			[...plain].sort((a, b) => a.title.localeCompare(b.title))
		);
		for (let i = 0; i < 20; i++) {
			expect(plain).toContainEqual(getPracticeTrack(catalog, 'artist', `round-${i}`));
		}
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

	it('keeps the old seed name for days before the rename', () => {
		const catalog = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((slug) => track(slug, slug));
		// the old way of picking, written out by hand
		const pick = (name: string, dateKey: string) =>
			catalog.reduce((best, item) =>
				seedrandom(`${name}:artist:${dateKey}:${item.slug}`)() >
				seedrandom(`${name}:artist:${dateKey}:${best.slug}`)()
					? item
					: best
			);
		for (const day of ['2026-11-01', '2026-11-02', '2026-11-03']) {
			expect(getDailyTrack(day, catalog, 'artist')).toEqual(pick('soundcloud-heardle', day));
		}
		for (const day of ['2026-11-04', '2026-11-05', '2027-01-01']) {
			expect(getDailyTrack(day, catalog, 'artist')).toEqual(pick('mp3dle', day));
		}
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
