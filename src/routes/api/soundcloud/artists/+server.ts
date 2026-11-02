import { json } from '@sveltejs/kit';
import { searchArtists } from '$lib/server/soundcloud';

export async function GET({ url }) {
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (query.length < 2 || query.length > 80) {
		return json({ error: 'Enter between 2 and 80 characters.' }, { status: 400 });
	}

	try {
		return json(
			{ artists: await searchArtists(query) },
			{ headers: { 'cache-control': 'public, max-age=60, s-maxage=300' } }
		);
	} catch (error) {
		console.error(error);
		return json({ error: 'SoundCloud artist search is temporarily unavailable.' }, { status: 502 });
	}
}
