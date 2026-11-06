import type { PageLoad } from './$types';
import type { TrackCatalog } from '#lib/tracks.js';

// the whole game needs window and localstorage, so no server rendering
export const ssr = false;
export const prerender = true;

export const load: PageLoad = ({ fetch, url }) => {
	const artist = url.searchParams.get('artist')?.trim() ?? '';
	const requestedPracticeKey = url.searchParams.get('practice')?.trim() ?? '';
	const practiceKey = /^[a-z0-9_-]{8,80}$/i.test(requestedPracticeKey) ? requestedPracticeKey : '';

	async function loadCatalog(): Promise<{ catalog: TrackCatalog | null; error: string }> {
		if (!artist) return { catalog: null, error: '' };
		if (!/^[a-z0-9_-]+$/i.test(artist)) {
			return {
				catalog: null,
				error: 'Choose an artist from the SoundCloud search results.'
			};
		}

		try {
			const response = await fetch(
				`/api/soundcloud/catalog?artist=${encodeURIComponent(artist)}&schema=4`
			);
			const data = (await response.json()) as TrackCatalog | { error?: string };
			if (!response.ok || !('artist' in data)) {
				return {
					catalog: null,
					error: 'error' in data && data.error ? data.error : 'Could not load this artist.'
				};
			}
			return { catalog: data, error: '' };
		} catch {
			return {
				catalog: null,
				error: 'Could not reach SoundCloud. Please try another artist.'
			};
		}
	}

	return { artist, practiceKey, catalog: loadCatalog() };
};
