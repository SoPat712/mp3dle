Open work after the retro redesign; checked against the code on 2026-11-05.

- **Tag DRM-only tracks.** `toTrack` in `src/lib/server/soundcloud.ts` (~120) does not read
  `item.media.transcodings`, and `Track` in `src/lib/tracks.ts` has no DRM flag. Store `drm: true`
  when a nonempty transcoding list contains only `*-encrypted-hls`, use it in playback error copy,
  and bump the catalog `schema` in `src/routes/+page.ts` (~21) to refresh cached catalogs.
- **Josh: exclude DRM-only daily answers?** `getDailyTrack` in `src/lib/tracks.ts` currently has no
  DRM exclusion. Excluding them while keeping them guessable improves playback in browsers and
  webviews without DRM support; it removes many popular monetized songs from the answer pool and
  can change the current daily answer when enabled.
- **Enforce the clip cutoff without a PLAY event.** `PLAY_PROGRESS` in
  `src/lib/Mp3dleGame.svelte` (~239) returns while `playing` is false, so a missing or late PLAY
  event can bypass the cutoff. Enforce the limit independently and let advancing progress update
  playback state.
- **Retry only the player.** The 15-second load timeout in `startWidget` and Retry button in
  `src/lib/Mp3dleGame.svelte` (~182, ~510) still ask for or perform a page reload. Re-create the
  widget iframe, clear its timers and error state, and bind the replacement widget without
  reloading the game.
- **Apply the theme before paint and outside the shell.** `src/app.html` (~7) and `src/app.css`
  (~14) hard-code the light wallpaper; `src/routes/+page.svelte` (~26) only updates the shell and
  color scheme. Initialize the saved/system theme before paint and use it for the document
  background and theme-color metadata too.
- **Use consistent page and share titles.** `src/routes/+page.svelte` (~39) uses “artist mp3dle”;
  `shareText` in `src/lib/Mp3dleGame.svelte` (~471) still uses “mp3dle - artist”. Use
  “artist · mp3dle” in both, retaining the share result details.
- **Finish numeric typography.** The player timer and countdown use tabular digits, but stats in
  `src/lib/retro/StatsWindow.svelte` (~75) do not. Apply `font-variant-numeric: tabular-nums` to
  the stats numerals and distribution counts.
- **Highlight today's stats result.** `src/lib/retro/StatsWindow.svelte` (~9) gives every winning
  distribution row the same color and receives no current result. Pass the completed daily
  result to it and distinguish that row without treating practice as today's result.
- **Show clip lengths in help.** `src/lib/retro/ReadmeWindow.svelte` (~9) describes unlocking
  clips but omits the lengths. Add a compact 1s → 2s → 4s → 7s → 11s → 16s visual.
- **Extract widget control.** `src/lib/Mp3dleGame.svelte` (~169–317) still owns script loading,
  widget events, the watchdog and cutoff. Move them into `src/lib/player/soundcloud-player.ts`
  with a small playback API and fake-widget tests for cutoff and failure handling.
- **Finish splitting the player view.** `src/lib/Mp3dleGame.svelte` still contains the header
  (~531), result panel (~648) and controls (~692), despite the extracted turntable, guesses,
  stats and help. Extract those remaining sections into focused components.
- **Finish the Svelte runes migration during extraction.** `src/lib/Mp3dleGame.svelte` (~30,
  ~105), `src/lib/retro/GuessBox.svelte` (~4, ~17) and the other extracted retro components still
  use legacy props, reactive statements and slots. Convert each component as it is refactored.
- **Move the newer catalog rules onto the server after 2026-11-07.** The
  variant-of-an-existing-title and live-session rules in `filterCatalogTracks`
  (`src/lib/tracks.ts`, `NEWER_RULES_FROM`) only run in the browser, from the player's local
  2026-11-06, because the server does not know the player's date. After 2026-11-07,
  when no time zone is still on 2026-11-05, apply them in `filterCatalogTracks` in
  `src/lib/tracks.ts`, also called by `src/lib/server/soundcloud.ts` (`getArtistCatalog`), to
  shrink the catalog payload; remove the temporary date check then.
