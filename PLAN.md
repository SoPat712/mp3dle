Open work after the retro redesign; checked against the code on 2026-11-05.

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
