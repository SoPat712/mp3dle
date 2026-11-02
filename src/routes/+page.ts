import type { PageLoad } from './$types';
import type { TrackCatalog } from '$lib/tracks';

// the whole game needs window and localstorage, so no server rendering
export const ssr = false;

export const load: PageLoad = async ({ fetch, url }) => {
	const artist = url.searchParams.get('artist')?.trim() ?? '';
	const requestedPracticeKey = url.searchParams.get('practice')?.trim() ?? '';
	if (!artist) return { catalog: null, error: '', practiceKey: '' };
	if (!/^[a-z0-9_-]+$/i.test(artist)) {
		return {
			catalog: null,
			error: 'Choose an artist from the SoundCloud search results.',
			practiceKey: ''
		};
	}

	try {
		const response = await fetch(
			`/api/soundcloud/catalog?artist=${encodeURIComponent(artist)}&schema=2`
		);
		const data = (await response.json()) as TrackCatalog | { error?: string };
		if (!response.ok || !('artist' in data)) {
			return {
				catalog: null,
				error: 'error' in data && data.error ? data.error : 'Could not load this artist.',
				practiceKey: ''
			};
		}
		const practiceKey = /^[a-z0-9_-]{8,80}$/i.test(requestedPracticeKey)
			? requestedPracticeKey
			: '';
		return { catalog: data, error: '', practiceKey };
	} catch {
		return {
			catalog: null,
			error: 'Could not reach SoundCloud. Please try another artist.',
			practiceKey: ''
		};
	}
};
