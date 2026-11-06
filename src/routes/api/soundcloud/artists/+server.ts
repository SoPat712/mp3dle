import { searchArtists } from '#lib/server/soundcloud.js';

export async function GET({ url }) {
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (query.length < 2 || query.length > 80) {
		return Response.json({ error: 'Enter between 2 and 80 characters.' }, { status: 400 });
	}

	try {
		return Response.json(
			{ artists: await searchArtists(query) },
			{
				headers: {
					'cache-control': 'public, max-age=60, s-maxage=300',
					'netlify-cdn-cache-control':
						'public, durable, s-maxage=3600, stale-while-revalidate=86400'
				}
			}
		);
	} catch (error) {
		console.error(error);
		return Response.json(
			{ error: 'SoundCloud artist search is temporarily unavailable.' },
			{ status: 502 }
		);
	}
}
