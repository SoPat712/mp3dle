These are optional refactors with no player-facing change, best done together with a bigger player change.

- **Extract widget control.** `src/lib/Mp3dleGame.svelte` (~169–317) still owns script loading,
  widget events, the watchdog and cutoff. Move them into `src/lib/player/soundcloud-player.ts`
  with a small playback API and fake-widget tests for cutoff and failure handling.
- **Finish splitting the player view.** `src/lib/Mp3dleGame.svelte` still contains the header
  (~531), result panel (~648) and controls (~692), despite the extracted turntable, guesses,
  stats and help. Extract those remaining sections into focused components.
- **Finish the Svelte runes migration during extraction.** `src/lib/Mp3dleGame.svelte` (~30,
  ~105), `src/lib/retro/GuessBox.svelte` (~4, ~17) and the other extracted retro components still
  use legacy props, reactive statements and slots. Convert each component as it is refactored.
