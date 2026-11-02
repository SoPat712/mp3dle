import { json } from '@sveltejs/kit';
import { getArtistCatalog, NotFoundError } from '$lib/server/soundcloud';

export async function GET({ url }) {
	const artist = url.searchParams.get('artist')?.trim() ?? '';
	if (!/^[a-z0-9_-]+$/i.test(artist)) {
		return json({ error: 'Choose a valid SoundCloud artist.' }, { status: 400 });
	}

	try {
		return json(await getArtistCatalog(artist), {
			headers: {
				'cache-control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
			}
		});
	} catch (error) {
		if (error instanceof NotFoundError) return json({ error: error.message }, { status: 404 });
		console.error(error);
		return json(
			{ error: error instanceof Error ? error.message : 'Could not load this artist.' },
			{ status: 502 }
		);
	}
}
