import seedrandom from 'seedrandom';

export type SoundCloudArtist = {
	id: string;
	username: string;
	permalink: string;
	profileUrl: string;
	avatarUrl?: string;
	followersCount: number;
	trackCount: number;
};

export type Track = {
	title: string;
	slug: string;
	artist: string;
	url: string;
	artworkUrl?: string;
};

export type TrackCatalog = {
	artist: SoundCloudArtist;
	tracks: Track[];
	updatedAt: string;
};

// remixes, live versions and so on, we only want the originals
const ALTERNATE_VERSION =
	/(?:[([][^\])]*(?:acoustic|a\s*cappella|acapella|instrumental|karaoke|remix|rework|edit|version|demo|live|stripped|sped[ -]?up|slowed|nightcore|remaster(?:ed)?|edition|mix)[^\])]*[\])])|(?:\s[-–—:]\s*(?:acoustic|a\s*cappella|acapella|instrumental|karaoke|remix|rework|edit|version|demo|live|stripped|sped[ -]?up|slowed|nightcore|remaster(?:ed)?|edition|mix)\b)/i;

export function getLocalDateKey(date = new Date()) {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

export function isValidDateKey(dateKey: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
	const [year, month, day] = dateKey.split('-').map(Number);
	// feb 30 rolls over to march, so check it comes back the same
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// the seed got the new name on 2026-11-04. earlier days keep the old one so nobody's song changed
// on them mid-day. careful changing anything else in here, it changes everyone's daily song
function dailySeedName(dateKey: string) {
	return dateKey < '2026-11-04' ? 'soundcloud-heardle' : 'mp3dle';
}

export function getDailyTrack(dateKey: string, catalog: Track[], artistKey: string) {
	if (!isValidDateKey(dateKey)) throw new Error(`Invalid date key: ${dateKey}`);
	const tracks = filterCatalogTracks(catalog);
	if (!tracks.length) throw new Error('This artist has no playable original tracks.');

	// every track rolls a number for the day and the highest one wins
	let winner = tracks[0];
	let best = -1;
	for (const track of tracks) {
		const score = seedrandom(`${dailySeedName(dateKey)}:${artistKey}:${dateKey}:${track.slug}`)();
		if (score > best) {
			winner = track;
			best = score;
		}
	}
	return winner;
}

export function getGuessTracks(catalog: Track[]) {
	return filterCatalogTracks(catalog).sort((a, b) => a.title.localeCompare(b.title));
}

export function getPracticeTrack<T extends Track>(
	catalog: T[],
	artistKey: string,
	practiceKey: string
): T {
	const tracks = filterCatalogTracks(catalog).sort((a, b) => a.slug.localeCompare(b.slug));
	if (!tracks.length) throw new Error('This artist has no playable original tracks.');
	const roll = seedrandom(`mp3dle:${artistKey}:practice:${practiceKey}`)();
	return tracks[Math.floor(roll * tracks.length)];
}

// drops alternate versions and keeps one track per title
export function filterCatalogTracks<T extends Track>(catalog: T[]): T[] {
	const byTitle = new Map<string, T>();

	for (const track of catalog) {
		if (ALTERNATE_VERSION.test(track.title)) continue;
		const title = normalizeTrackTitle(track.title);
		const existing = byTitle.get(title);
		if (!existing || compareSlugs(track.slug, existing.slug) < 0) byTitle.set(title, track);
	}

	return [...byTitle.values()];
}

// soundcloud adds -1, -2 to re-uploads, so prefer the slug without a number, then the shortest
function compareSlugs(a: string, b: string) {
	const score = (slug: string) => (/-\d+$/.test(slug) ? 10_000 : 0) + slug.length;
	return score(a) - score(b) || a.localeCompare(b);
}

export function normalizeTrackTitle(title: string) {
	return title
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[’‘]/g, "'")
		.replace(/[^a-z0-9]+/gi, ' ')
		.trim()
		.toLowerCase();
}
