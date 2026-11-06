import { getArtistCatalog, NotFoundError } from '#lib/server/soundcloud.js';

export async function GET({ url }) {
	const artist = url.searchParams.get('artist')?.trim() ?? '';
	if (!/^[a-z0-9_-]+$/i.test(artist)) {
		return Response.json({ error: 'Choose a valid SoundCloud artist.' }, { status: 400 });
	}

	try {
		return Response.json(await getArtistCatalog(artist), {
			headers: {
				'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
				'netlify-cdn-cache-control':
					'public, durable, s-maxage=86400, stale-while-revalidate=604800'
			}
		});
	} catch (error) {
		if (error instanceof NotFoundError)
			return Response.json({ error: error.message }, { status: 404 });
		console.error(error);
		return Response.json(
			{ error: error instanceof Error ? error.message : 'Could not load this artist.' },
			{ status: 502 }
		);
	}
}
