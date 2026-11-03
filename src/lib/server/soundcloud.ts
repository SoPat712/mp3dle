import {
	filterCatalogTracks,
	type SoundCloudArtist,
	type Track,
	type TrackCatalog
} from '#lib/tracks.js';

const API_URL = 'https://api-v2.soundcloud.com';
const SOUNDCLOUD_URL = 'https://soundcloud.com';
// the longest clip is 16 seconds, so songs need to be longer than that
const MIN_DURATION_MS = 17_000;

type SoundCloudUser = {
	avatar_url?: string;
	followers_count?: number;
	id?: number;
	permalink?: string;
	permalink_url?: string;
	track_count?: number;
	username?: string;
};

type SoundCloudTrack = {
	artwork_url?: string | null;
	duration?: number;
	permalink_url?: string;
	policy?: string;
	public?: boolean;
	publisher_metadata?: { artist?: string };
	streamable?: boolean;
	title?: string;
	user?: { username?: string };
};

type SoundCloudPage<T> = { collection?: T[]; next_href?: string | null };

// a typo, an old link or an artist with nothing to play. nothing actually broke
export class NotFoundError extends Error {}

// soundcloud has no free api keys anymore, so we borrow the public id their own site uses.
// it changes now and then, so only hang on to it for 30 mins
let cachedClient: { id: string; expiresAt: number } | undefined;

export function parsePublicClientId(html: string) {
	const clientId = /"hydratable":"apiClient","data":\{"id":"([^"]+)"/.exec(html)?.[1];
	if (!clientId) throw new Error('SoundCloud public client data has changed.');
	return clientId;
}

export function parsePublicProfileAccess(html: string) {
	const clientId = parsePublicClientId(html);
	const userId = /soundcloud:\/\/users:(\d+)/.exec(html)?.[1];
	if (!userId) throw new Error('SoundCloud public profile data has changed.');
	return { clientId, userId };
}

async function fetchHtml(url: string) {
	const response = await fetch(url, {
		headers: {
			accept: 'text/html',
			'user-agent': 'Mozilla/5.0 (compatible; SoundCloudHeardle/1.0)'
		},
		signal: AbortSignal.timeout(15_000)
	});
	if (response.status === 404) throw new NotFoundError("Couldn't find that artist on SoundCloud.");
	if (!response.ok) throw new Error(`SoundCloud page request failed (${response.status}).`);
	return response.text();
}

async function getPublicClientId() {
	if (cachedClient && cachedClient.expiresAt > Date.now()) return cachedClient.id;
	const id = parsePublicClientId(await fetchHtml(SOUNDCLOUD_URL));
	cachedClient = { id, expiresAt: Date.now() + 30 * 60_000 };
	return id;
}

async function soundCloudJson<T>(url: string | URL, clientId: string): Promise<T> {
	const target = new URL(url);
	// next_href comes from them, don't send our requests anywhere else
	if (target.origin !== API_URL) throw new Error('SoundCloud returned an unexpected API URL.');
	target.searchParams.set('client_id', clientId);
	const response = await fetch(target, {
		headers: { accept: 'application/json' },
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) throw new Error(`SoundCloud request failed (${response.status}).`);
	return (await response.json()) as T;
}

function toArtist(user: SoundCloudUser): SoundCloudArtist | null {
	if (!user.id || !user.username || !user.permalink || !/^[a-z0-9_-]+$/i.test(user.permalink)) {
		return null;
	}
	return {
		id: String(user.id),
		username: user.username.trim(),
		permalink: user.permalink,
		profileUrl: user.permalink_url || `${SOUNDCLOUD_URL}/${user.permalink}`,
		avatarUrl: user.avatar_url,
		followersCount: Math.max(0, user.followers_count ?? 0),
		trackCount: Math.max(0, user.track_count ?? 0)
	};
}

export async function searchArtists(query: string) {
	const clientId = await getPublicClientId();
	const url = new URL(`${API_URL}/search/users`);
	url.searchParams.set('q', query);
	url.searchParams.set('limit', '10');
	url.searchParams.set('linked_partitioning', '1');
	const page = await soundCloudJson<SoundCloudPage<SoundCloudUser>>(url, clientId);
	return (page.collection ?? [])
		.map(toArtist)
		.filter((artist): artist is SoundCloudArtist => Boolean(artist?.trackCount))
		.sort((a, b) => b.followersCount - a.followersCount)
		.slice(0, 8);
}

// returns null for anything we can't use in the game
function toTrack(item: SoundCloudTrack, artistName: string): Track | null {
	if (
		item.policy === 'BLOCK' ||
		item.public === false ||
		item.streamable === false ||
		!item.title ||
		!item.permalink_url ||
		(item.duration ?? 0) < MIN_DURATION_MS
	) {
		return null;
	}

	const url = new URL(item.permalink_url);
	const slug = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
	if (url.hostname !== 'soundcloud.com' || !/^[a-z0-9-]+$/.test(slug)) return null;

	return {
		title: item.title.trim(),
		slug,
		artist: item.publisher_metadata?.artist?.trim() || item.user?.username?.trim() || artistName,
		url: url.toString(),
		artworkUrl: item.artwork_url || undefined
	};
}

export async function getArtistCatalog(permalink: string): Promise<TrackCatalog> {
	if (!/^[a-z0-9_-]+$/i.test(permalink)) throw new Error('Invalid SoundCloud artist.');
	const profileHtml = await fetchHtml(`${SOUNDCLOUD_URL}/${permalink}`);
	const { clientId, userId } = parsePublicProfileAccess(profileHtml);
	const user = await soundCloudJson<SoundCloudUser>(`${API_URL}/users/${userId}`, clientId);
	const artist = toArtist(user);
	if (!artist) throw new Error('SoundCloud returned an invalid artist profile.');

	// go through their uploads page by page. 10 pages of 200 is plenty for anyone
	const imported: Track[] = [];
	let nextUrl: string | null = `${API_URL}/users/${userId}/tracks?limit=200&linked_partitioning=1`;
	for (let pages = 0; nextUrl && pages < 10; pages++) {
		const page: SoundCloudPage<SoundCloudTrack> = await soundCloudJson(nextUrl, clientId);
		for (const item of page.collection ?? []) {
			const track = toTrack(item, artist.username);
			if (track) imported.push(track);
		}
		nextUrl = page.next_href ?? null;
	}

	const uniqueSlugs = [...new Map(imported.map((track) => [track.slug, track])).values()];
	const tracks = filterCatalogTracks(uniqueSlugs);
	if (!tracks.length) throw new NotFoundError('This artist has no playable original tracks.');
	return { artist, tracks, updatedAt: new Date().toISOString() };
}
