import type { Handle } from '@sveltejs/kit/hooks';
import lcdFont from '@fontsource/vt323/files/vt323-latin-400-normal.woff2?url';

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace(
				'</head>',
				`<link rel="preload" href="${lcdFont}" as="font" type="font/woff2" crossorigin></head>`
			)
	});
