# SoundCloud Heardle

An artist-agnostic Heardle game. Search for a public SoundCloud artist, choose the correct profile,
and play a daily song drawn from that artist's cleaned public catalog.

## What it does

- Searches public SoundCloud artist profiles without requiring users to paste profile slugs.
- Shows usernames, profile handles, upload counts, follower counts, and avatars to disambiguate
  similarly named accounts.
- Imports every public, streamable track of at least 17 seconds from the selected profile.
- Removes acoustic, a cappella, instrumental, karaoke, remix, rework, edit, alternate-version,
  demo, live, stripped, sped-up, slowed, nightcore, remastered, edition, and mix variants when
  those labels appear as a bracketed qualifier or title suffix.
- Collapses duplicate normalized titles and prefers a clean, unsuffixed SoundCloud slug.
- Offers another practice song after every completed round without changing the daily result,
  statistics, or streak.
- Keeps game progress, per-artist statistics, theme, and volume in the browser only.
- Uses SoundCloud's official widget for playback.

## Privacy and limitations

This app has no accounts, analytics, advertising identifiers, or application database. Netlify
serves and temporarily caches the search/catalog API responses. The browser contacts SoundCloud
through the app's server routes for artist metadata and through the SoundCloud widget for audio.

The credential-free discovery path reads the temporary web client identifier present in
SoundCloud's public pages. That interface is not a documented public API contract and may change.
Failures are returned visibly; the app never replaces a catalog with malformed or empty data.

Only tracks uploaded by the selected profile are included. Reposts, likes, playlists, private
tracks, blocked tracks, and clips shorter than 17 seconds are excluded.

## Run locally

Requirements: Node.js 20.19+ and npm 10+.

```bash
npm install
npm run dev -- --open
```

## Validate

```bash
npm run check
npm run lint
npm test
npm run build
```

## Deploy to Netlify

Connect the repository to Netlify and deploy. `netlify.toml` supplies the build command and the
SvelteKit Netlify adapter creates the API functions automatically. No SoundCloud API key or
environment variables are required.

## Catalog filtering

The shared rules live in `src/lib/tracks.ts`. To support project-specific curation later, add or
remove qualifier terms in `ALTERNATE_VERSION`. Parenthetical collaborations such as
`(feat. Artist)` are retained, and ordinary song titles such as `Live Forever` are not treated as
alternate versions.

## Structure

```text
src/lib/ArtistPicker.svelte          Artist search and profile selection
src/lib/HeardleGame.svelte          Daily and unlimited-practice game interface
src/lib/server/soundcloud.ts        Public artist search and catalog import
src/lib/tracks.ts                    Catalog filtering and daily selection
src/routes/api/soundcloud/artists   Artist search endpoint
src/routes/api/soundcloud/catalog   Per-artist catalog endpoint
```

Licensed under GPL-3.0.
