# Handoff: mp3dle retro redesign

For the Codex agent taking over as orchestrator from Claude. Written 2026-11-01.

## 1. Read this first

**Status, 2026-11-01: Josh approved building, and Claude built the retro UI in `src/lib/retro/` and
`src/lib/Mp3dleGame.svelte`. It is uncommitted and waiting for his review.** Checked in Chrome only.
Safari, Firefox and real phones are untested. `PLAN.md` 1.1, 1.2, 1.5, 1.6, 1.7 and 1.8 are done; 1.3,
1.4 and 1.9 are still open. Josh also asked for simple code with short lowercase comments, so keep it that way. The build phases below describe the original plan; Phase C (splitting the
game) was done in smaller pieces: `Turntable`, `GuessBox`, `GuessTable`.

Favorites (added 2026-11-02): the star in the player header saves an artist to
`soundcloud-heardle:favorites` (`src/lib/favorites.ts`). They show as shortcut icons down the right of
the desktop and in the Start menu, which is the only place phones see them.

Safari (found 2026-11-02, tested in Mac Safari 27.2, iPhone untested): the first `widget.play()` after
page load gets `NotAllowedError`, because the song inside the iframe isn't loaded yet. It looks like a
`PLAY` then a `PAUSE` about 0.2s later. It isn't DRM; FairPlay loads fine, and automatic retries are
refused too. `widget.seekTo(0)` on `READY` loads the song silently so one press works, but it fires a
stray `PLAY`, which is why `pressedPlay` exists. If the browser still blocks it, the status bar asks
for another press. Safari automation only gets clicks while Safari is the front app.

Skip (2026-11-02): while a clip is playing, skip lets it keep going into the longer clip. Once it
has stopped, skip plays the longer clip from 0:00. The pause from the end of a clip can land after
the next press, and seeking while playing sends `PAUSE` in Chrome and Safari. So a `PAUSE` only
counts as "blocked" if a `PLAY` came after the press (`heardPlay`).
Pressing play while it's stuck buffering tries again instead of doing nothing for 15 seconds.

**Your role:** orchestrator first. Split the work, write complete prompts for worker agents, then
verify the results yourself with diffs, checks, and a real browser. Josh interrupted Claude for
implementing when it should have been writing prompts, so don't write the feature code yourself
unless he asks. He is cost-sensitive: send him short updates and don't start work he hasn't asked for.

**Scope:** this repo only (`soundcloud-heardle`). Do **not** apply the retro look to
`../maisie-heardle`. Josh rejected a redesign there and wants its original turntable UI kept, with
functional fixes only.

**Repo state, checked 2026-11-01:**

- Repo: github.com/SoPat712/Hear, branch `main`. CI runs check, lint, test and build on every push.
  Commit only when Josh asks.
- Node 24 (`.nvmrc`). Stack (upgraded 2026-11-02): SvelteKit 3 on Vite 8, Svelte 5 (the code uses
  legacy `export let` and `$:` syntax), Tailwind 4, Netlify adapter 7, Vitest 5, ESLint 10,
  TypeScript 6. TypeScript 7 waits until SvelteKit, svelte-check and typescript-eslint support it.
  SvelteKit 3 has no `svelte.config.js` (options live in `vite.config.ts`) and imports use
  `#lib/...` with `.js` on TypeScript files. `package.json` overrides `minimatch` to 11 to clear an
  advisory in ESLint's copy; drop the override once ESLint depends on 11 itself.
- Commands: `npm run dev`, `npm run check`, `npm test`, `npm run lint`, `npm run build`.
- **Baseline, run 2026-11-01 on Node 22.14:** Vitest 17/17 pass, `svelte-check` 0 errors and 0 warnings,
  Prettier and ESLint clean. `npm run build` was not run. Re-run these yourself before changing anything.
- `PLAN.md` holds the bug analysis and is still open. Phase 1 is not done: the iframe still has
  `allow="autoplay"` only (`src/lib/Mp3dleGame.svelte:1307`), the warm-up still runs, and
  `crypto.randomUUID` is still unguarded (`:928`, `:933`). Only those three were checked; verify the
  other items before relying on them.
- **This document replaces `PLAN.md` Phase 3 (UI polish) only.** Phases 1, 2 and 4 still apply. The
  old "no gradients, no icon set" cleanup note does not apply to this theme, because gradients and
  bevels are part of the look. `PLAN.md` also says Maisie's hotfixes come first across the two
  projects, so ask Josh if that order still holds.

**Design files:**

| What                        | Where                                             | Note                                                 |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Desktop prototype           | `docs/design/retro-final/mp3dle-Desktop.dc.html`  | Working clickable mockup, fake data                  |
| Mobile prototype            | `docs/design/retro-final/mp3dle-Mobile.dc.html`   | Working clickable mockup, fake data                  |
| Canvas (page "Final draft") | https://claude.ai/artifact/9tyCPnoG7c3LYK4PrJQiP2 | Private to Josh. You probably can't open it; ask him |

The prototypes are reference only. They use a proprietary template format (`<x-dc>`, `{{holes}}`,
`<sc-for>`, `class Component extends DCLogic`) and only run in that canvas. Read them for exact
markup, CSS and tokens, then rebuild in Svelte. **Never ship or import them.** If this document and a
prototype disagree, this document wins. Nobody has rendered the prototypes outside the canvas, and
Claude did not check them visually, so confirm details with Josh's screenshots if unsure.

## 2. What Josh wants, and how he got here

He wants it to look **not AI in any way**: made by a person, with personality. His own words on the
attempts, in order:

| Attempt                                                                  | Verdict                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------ |
| Clean "editorial" sleeve design: condensed uppercase headings, hairlines | "even the font looks like AI! And the designs!"        |
| Generic grey media player window                                         | Picked retro, but "yours just looks a little AI!"      |
| Dark hand-made 2004 skin with pixel fonts                                | Wanted it pushed further, into the desktop idea below  |
| Win95 desktop plus recorder-style player **with level meters**           | Direction right, but the meters were a misread (below) |

**Current brief, all of it binding:**

1. **A Windows 95-style desktop**, "similar to Kylie Cantrall's website". Claude never opened that
   site, so look at it if you can browse, as a reference for the feel, and don't copy its content or
   artwork. Use the desktop idea only.
2. **A retro player app on that desktop**, inspired by a screenshot of a late-2000s freeware "Audio
   Recorder". Josh: "i did't mean we had to add the level meters! Just that color scheme and overall
   vibe!" **So: no level meters, spectrum bars, or VU meters anywhere.**
3. What to take from the screenshot: a silver-white glossy window with rounded corners, a small logo
   with a stacked bold product name, round dark window buttons, a dark readout strip, labelled rows
   with round blue bullets, small glossy buttons, a large control on the right, and a light file
   table with a gradient header and side icon buttons. The screenshot isn't in the repo; ask Josh for
   it if you need it. Don't reproduce that product's name, logo or exact layout.
4. **Vinyl stays as the theme, but the record is never the play button.** Today's `.platter` and
   `.mobile-vinyl-button` are buttons; both must go. The record is decoration that shows state.
5. **Keep the brand colours** blue `#127fb3` and pink `#c43a84`. Josh values vinyl personality and
   these colours.
6. **Desktop and mobile are equally important.** "players are on both!"

**Banned, because these read as AI:** condensed-grotesk headlines; Inter, Space Grotesk, or similar;
small letter-spaced uppercase "eyebrow" labels as a design device; hairline-rule lists; flat minimal
palettes with one accent; soft rounded cards with blurred shadows; pill chips; gradient washes on page
backgrounds; left-border accent cards; emoji in the UI; marketing-style feature rows. The existing
share text's coloured squares are game output and stay.

## 3. Design system

Tokens below match the prototypes. Put them in `src/lib/retro/tokens.css`, set on `.app-shell`, with
dark values under `.app-shell.dark-mode`, replacing the current `--app-*` variables and the `COLORS`
object in `Mp3dleGame.svelte`.

### Colour

| Token           | Light (silver)          | Dark (graphite)         | Use                                       |
| --------------- | ----------------------- | ----------------------- | ----------------------------------------- |
| `--wall`        | `#1f3561`               | `#10192e`               | Desktop wallpaper                         |
| `--wall-stripe` | `rgb(255 255 255 / 3%)` | `rgb(255 255 255 / 2%)` | 45deg, 6px stripes over wallpaper         |
| `--face`        | `#c0c0c0`               | `#3c3f46`               | Win95 window and taskbar face             |
| `--hi`          | `#ffffff`               | `#6b707a`               | Bevel, top and left outer                 |
| `--lite`        | `#dfdfdf`               | `#50545c`               | Bevel, top and left inner                 |
| `--shade`       | `#808080`               | `#24262b`               | Bevel, bottom and right inner             |
| `--dark`        | `#404040`               | `#0e0f12`               | Bevel, bottom and right outer             |
| `--w-text`      | `#000000`               | `#ffffff`               | Text on Win95 chrome                      |
| `--field`       | `#ffffff`               | `#1b1d21`               | Inputs, lists, table rows                 |
| `--field-alt`   | `#f3f5f8`               | `#24272d`               | Alternate table row                       |
| `--p-top`       | `#fbfbfc`               | `#3a3f49`               | Player gradient, 0%                       |
| `--p-mid`       | `#eceef1`               | `#2e3239`               | Player gradient, 40%                      |
| `--p-bot`       | `#dadde2`               | `#24272d`               | Player gradient, 100%                     |
| `--p-edge`      | `#8b9099`               | `#0e1013`               | Player outline, field borders             |
| `--p-text`      | `#1b1e23`               | `#eef0f3`               | Player text                               |
| `--p-muted`     | `#565b63`               | `#b4bac4`               | Secondary text                            |
| `--deck`        | `#15171a`               | `#0c0d0f`               | Dark deck and readout strip               |
| `--deck-edge`   | `#2a2d33`               | `#2a2d33`               | Deck border, locked clip segments         |
| `--lcd`         | `#57e24d`               | `#57e24d`               | Readout digits, played part of clip       |
| `--lcd-dim`     | `#4fbf45`               | `#4fbf45`               | Readout labels                            |
| `--unlock`      | `#e6e23a`               | `#e6e23a`               | Unlocked, unplayed part of clip           |
| `--blue`        | `#127fb3`               | `#3aa3d8`               | Brand blue, bullets                       |
| `--select`      | `#0f6e9c`               | `#0f6e9c`               | Selected rows and suggestions, white text |
| `--pink`        | `#c43a84`               | `#d9579d`               | Brand pink, Guess                         |
| `--pink-deep`   | `#8a1f58`               | `#8a1f58`               | Pink edge                                 |
| `--good`        | `#1f7a4f`               | `#57e24d`               | Correct guess, Solved                     |
| `--bad`         | `#b3261e`               | `#ff8a80`               | Wrong guess, Revealed, errors             |

Fixed gradients:

- Active title bar: `90deg, #0b4f75, #127fb3 60%, #2a95cc`, white bold text.
- Inactive title bar: `90deg, #6f6f6f, #a0a0a0`.
- Glossy blue: `180deg, #8fd3f5 0, #3aa3d8 48%, #127fb3 52%, #0c5f8b 100%`, edge `#05324a`.
- Glossy pink: `180deg, #f6a8d2 0, #d9579d 48%, #c43a84 52%, #93245f 100%`, edge `#5a0f37`.

Text must reach 4.5:1. White on `--blue` falls just short (about 4.4:1), so selected rows use
`--select`. Never use `--unlock` or `--lcd` as text on the silver player.

### Type

No sans web font. The system stack is the point. Do not substitute Inter or a Google sans.

| Role             | Font                                            | Size and weight                |
| ---------------- | ----------------------------------------------- | ------------------------------ |
| UI, Win95 chrome | `Tahoma, Verdana, 'DejaVu Sans', sans-serif`    | 12-13px; bold in title bars    |
| Player text      | same                                            | 13-14px                        |
| Logo line 1      | `'Arial Black', Arial, sans-serif`, italic, 900 | 22px, `MP3DLE`                 |
| Logo line 2      | `Arial, sans-serif`, bold                       | 11px, blue, `PLAYER 2.1`       |
| Readouts         | `'VT323', monospace`                            | 56px desktop, 44px mobile      |
| Inputs           | UI stack                                        | **16px minimum** (no iOS zoom) |

Self-host VT323 with `@fontsource/vt323` rather than a Google link. The app promises no third-party
tracking beyond SoundCloud, so ask before adding other external requests. Tahoma is missing on
Android and Linux, so check Verdana and DejaVu fallbacks don't break layouts.

### Shape and depth

- **Win95 raised:** 2px border, colours `--hi --dark --dark --hi`, plus
  `box-shadow: inset -1px -1px 0 var(--shade), inset 1px 1px 0 var(--lite)`.
- **Win95 pressed or sunken:** border `--shade --hi --hi --shade`.
- **Square corners on all Win95 chrome**, and no blur shadows.
- **Player window:** radius 9px, 1px `--p-edge`, top inner highlight, drop shadow
  `0 10px 24px rgb(0 0 0 / 45%)`. This is the only soft shadow allowed.
- **Glossy small buttons:** radius 3px, hard split at about 50% height.
- **Touch targets:** minimum 44px on mobile. On desktop, title-bar controls may be smaller, but every
  control still gets a keyboard path and `aria-label`.
- **Spacing:** tight and uneven is fine. Old software wasn't on an 8px grid, so don't tidy it into
  even card layouts.

### Icons

Hand-drawn inline SVG or pixel art in a `src/lib/retro/icons/` folder. No Lucide, Heroicons or emoji.
No Microsoft logos or Win95 artwork. The Start button uses a small record as its logo.

## 4. Screens

Mock data is fake (`moth fields`, `Glasshouse`, `Moonwalk Static`). The real data comes from
`TrackCatalog`, `Stats` and `AttemptInfo`.

### Desktop (over 900px)

```
+-- wallpaper: blue stripes, huge faded record bottom-right ---------------+
| [mp3dle    ]  +--mp3dle Player (draggable)--------+  +-stats.xls-----+ |
| [Find Artist]  | logo                     (?)(_)(x) |  | played won... | |
| [readme.txt ]  | +--dark deck--------------------+  |  | distribution  | |
| [stats.xls  ]  | | record+arm   00:02 / 00:04    |  |  +---------------+ |
| [practice   ]  | |              DAILY  TRY 3 OF 6|  |                    |
|                | | clip bar 1|2|4|7|11|16         |  |                    |
|                | +-------------------------------+  |                    |
|                | * Clip length   1s 2s 4s 7s 11s 16s|                    |
|                | * Artist     moth fields [Change]  |   [ PLAY ]         |
|                | * Your guess [______] [Guess]      |                    |
|                | [Skip +3s]                         |                    |
|                | [ # Guess | Clip | Result table ]  |                    |
|                +------------------------------------+                    |
+--[Start] [mp3dle Player] [stats.xls]---------------------[spk] 12:04 AM-+
```

- **Wallpaper:** `--wall` with stripes, and a large faded record bleeding off the bottom-right. The
  page itself never scrolls.
- **Desktop icons** (34px art, white label, double-click on mouse, single tap on touch; Enter works):
  `mp3dle Player`, `Find Artist`, `readme.txt`, `stats.xls`, `practice.exe`.
- **Taskbar** (40px): Start, one button per open window (pressed when focused, click to minimise or
  restore), and a tray with a speaker icon that opens the volume slider and a local-time clock.
- **Start menu:** a vertical sidebar reading `mp3dle`, then the same five items, plus `Display: Light
/ Dark` and `Open SoundCloud profile`.
- **Windows:** draggable by the title bar with pointer capture (no global listeners), clamped so the
  title bar stays on screen. Clicking raises a window. Position is per session; don't persist it.
- **Default layout:** Player open and focused, with `stats.xls` open beside it only if there's room
  at the current width. First visit with no artist: `Find Artist` open and focused, Player closed.

### Player window

From top to bottom:

1. **Header:** small record logo (just the record: a tiny tonearm beside it read as a stray number), `MP3DLE` / `PLAYER 2.1`, then round `?` (readme), `_` (minimise),
   `x` (close). Closing it is fine because the desktop icon reopens it.
2. **Deck (dark, `--deck`):**
   - **Left:** a **brushed-silver platter panel** (`#e8eaed` to `#b4b9c0`, edge `#5f646c`) with a grey
     platter ring, so the record never sits black on black. Josh rejected that. Record with visible
     grooves (`#33373d` / `#101114`) and a faint sheen, pink centre label with a `?` during play, artwork
     after the round, and a dark-outlined tonearm. It spins and the arm moves onto the record **only
     while audio plays**. Not clickable, `aria-hidden`.
     With `prefers-reduced-motion`, no spin.
   - **Right:** VT323 time `00:02 / 00:04`; a line `DAILY` or `PRACTICE`, `TRY 3 OF 6`; the artist name
     and either `today's song` or `practice song`.
   - **Clip bar:** six segments with widths 1:1:2:3:4:5 and gaps. Played `--lcd`, unlocked `--unlock`,
     locked `--deck-edge`. Labels 1 2 4 7 11 16 below. After the round it becomes a full-song seek bar
     using the existing seek logic and keyboard support.
3. **Rows** (each with a round blue bullet, label column 92px):
   - `Clip length`: six status chips, current one blue, future ones greyed. **Indicators, not buttons.**
     Each attempt always plays from the start up to its limit.
   - `Artist`: name, handle and track count, plus `Change...`, which opens Find Artist.
   - `Your guess`: input, suggestions dropdown, pink glossy `Guess`, and grey `Skip +3s` (`I don't know
it` on the last try, with the increment taken from `nextIncrementSec`).
   - **Rectangular Play key on the right**, 104x76px on desktop: glossy blue, radius 3px, hard bottom
     edge, white icon above the label `PLAY 4s` or `PAUSE`. **This is the only play control.** Josh
     rejected the earlier big round pink button, so don't bring back a round one.
4. **Guess table:** columns `#`, `Guess`, `Clip`, `Result`. Six rows always. Skipped rows are muted
   `[skipped]`, wrong are `--bad` `wrong`, correct are `--good` `correct`, and the current row is
   `--select` with `... listening`. Side button: Stats. Share lives only in the result panel, and its label changes to `Copied!`.
5. **Status bar:** left message (`Ready`, `Playing clip 3...`, `Loading...`, `Copied.`). Right: `Next
song in 04:12:09` from the existing `timeLeft`, or `Practice: stats not counted`.

**After the round**, the three rows are replaced by a result panel: artwork as a square sleeve,
`Solved 3/6` in `--good` or `Revealed X/6` in `--bad`, the title, `resultMessage`, and `Open song
links`. Buttons: `Play another`, `Share result`, and `Daily puzzle` in practice mode. The Play key stays
and plays the full song.

### Other windows

- **Find Artist** (Win95 chrome, 460px): a search input and `Search`; results in a sunken list with
  avatar, username, `@permalink`, tracks and followers; `Cancel` when an artist is already loaded.
  Selecting shows a **Win95 copy-style progress dialog**, `Loading moth fields' songs...`, with a blue
  block bar. This fixes `PLAN.md` 1.8. The tip about follower counts stays. Errors stay visible here.
- **readme.txt** (Notepad look, white text area): how-to-play copy from `Mp3dleGame.svelte:1148-1150`,
  privacy copy from `:1235-1238`, and the catalog line from `:1239-1243`. Keep this wording.
- **stats.xls** (spreadsheet look): played, win %, streak, max streak from `Stats`, plus a distribution
  chart with fail count (`played - wins`) as an `X` row. Show `Next song in`, the practice note, and the
  profile link.
- **Can't-play error dialog:** Win95 message box with a red icon: `This song can't play in this
browser.` Buttons `Retry`, `Play a practice song`, `Open on SoundCloud`. Implements `PLAN.md` 1.2.
- **practice.exe while today's round is unfinished:** message box `Finish today's song first.` The
  README promises practice after a completed round; confirm this rule with Josh.

Modals use native `<dialog>` as `PLAN.md` 2.4 recommends. Non-modal windows are plain sections with
`aria-label`.

### Mobile (900px and under)

Pocket-PC feel: one app fills the screen, and the taskbar stays at the bottom.

```
+--mp3dle Player------(?)(x)+   glossy silver header
| deck: record 92px, time    |
| clip bar                   |
| TRY 3 OF 6, artist [Change]|
| Your guess [___________]   |   suggestions open UPWARD, above the keyboard
| [Guess]  [Skip +3s] [ PLAY ]|  rectangular Play key, 118px wide
| guess table, compact       |   this scrolls internally if needed
+[Start][Player][Stats][Help]+   taskbar, safe-area padded
```

- **No page scroll and no sideways scroll, ever.** Use `100svh`, a flex column with `min-height: 0`,
  and `viewport-fit=cover` with `env(safe-area-inset-bottom)`. Keep this design inside `PLAN.md`
  Phase 2's rules.
- No wallpaper or icons while an app is open. Windows aren't draggable. Each opens full height.
- The Start menu opens upward. It holds Find Artist, practice, display theme, and the profile link.
- Result panel, Find Artist, readme, stats and error dialog all exist as full-height screens.
- Inputs 16px, targets at least 44px. The suggestions fix in `PLAN.md` 1.7 is essential on iOS.
- The SoundCloud iframe has to stay mounted and must not be `display: none`. Check the existing
  `.soundcloud-player` CSS before moving it, and don't remount it when switching windows or minimising.

## 5. Keep working: feature parity

Nothing below may be lost. Map every item in QA.

| Feature                                 | Today                                             | In the retro UI                |
| --------------------------------------- | ------------------------------------------------- | ------------------------------ |
| Artist search and choose                | `ArtistPicker.svelte`, `/api/soundcloud/artists`  | Find Artist window             |
| Clip lengths 1, 2, 4, 7, 11, 16 seconds | `SEGMENT_INCREMENTS = [1,1,2,3,4,5]`              | Clip bar, chips, table         |
| Play, pause, skip, guess                | `togglePlayPause`, `skipIntro`, `submitGuess`     | Play key, Skip, Guess          |
| Suggestions and keyboard nav            | `suggestions`, `onInputKeydown`, ARIA listbox     | Dropdown, same ARIA            |
| Saved game, stats, volume, theme        | `localStorage` keys `soundcloud-heardle:*`        | **Keep keys unchanged**        |
| Daily song and practice                 | `getDailyTrack`, `getPracticeTrack`, `?practice=` | Unchanged                      |
| Full-song seek after the round          | Pointer and keyboard seek handlers                | Clip bar becomes seek bar      |
| Record rotation matches playback        | `spinVinyl`, `syncVinylToPosition`                | Deck record                    |
| Share                                   | `shareResult`, `buildShareText`                   | Result panel, side button      |
| Result, artwork, song links             | `.end-game-dock`                                  | Result panel                   |
| Theme toggle                            | `+page.svelte`, `soundcloud-heardle:theme`        | Start menu                     |
| Widget errors and retry                 | `widgetError`, `reloadPlayer`                     | Error dialog                   |
| Page titles and meta                    | `+page.svelte`, `+layout.svelte`                  | Unchanged                      |
| Catalog rules and API routes            | `tracks.ts`, `src/lib/server/soundcloud.ts`       | **Do not touch for this work** |

Also update `meta name="theme-color"` to match the wallpaper and redraw `static/favicon.svg` as the
small record.

## 6. Suggested build order

Give each phase to a worker with this section, section 3, the relevant part of section 4, and clear
done-criteria. Verify each before starting the next.

**Phase A: baseline (can start now, once Josh agrees).** Re-run all checks and record the results. Ask
Josh about the baseline commit. Fix `PLAN.md` Phases 1 and 2, because there's no point skinning a
player that doesn't play in Chrome. Phase 1.1 is a one-line change. Ask Josh the open DRM-pool question
in `PLAN.md`.

**Phase B: design system (after Josh approves the draft).** `tokens.css`, fonts, and primitives under
`src/lib/retro/`: `Win95Window`, `Win95Button`, `GlossyButton`, `Taskbar`, `StartMenu`, `DesktopIcon`,
`MessageBox`, plus icons. No game logic yet. Add a temporary dev-only preview route for checking them,
and remove it before finishing.

**Phase C: split the game.** `Mp3dleGame.svelte` is 2,551 lines. Extract state and widget control
without changing the UI (`PLAN.md` Phase 4). Tests must stay green. Keep this separate from the visual
work so regressions can be traced.

**Phase D: desktop shell.** Build `Desktop.svelte` to hold windows, focus, dragging and the taskbar.
Rebuild `+page.svelte` around it, and port Find Artist, readme and stats.

**Phase E: player.** Deck, rows, Play key, table, result panel, error dialog. Remove `.platter`,
`.mobile-vinyl-button`, the turntable markup, and all the old CSS.

**Phase F: mobile.** Implement with the same components and one breakpoint, not a separate app.

**Phase G: QA and launch.** Everything in section 7. Show Josh before calling it done.

## 7. How to verify

Don't accept "it should work". Check all of this yourself:

- `npm run check`, `npm test`, `npm run lint`, `npm run build` all pass.
- **Real browsers at 1440x900, 1280x720, 390x844 and 360x640:** Chrome, Safari, Firefox, plus Android
  Chrome and iOS Safari if available. Take screenshots. Use a DRM-only artist (`1glaive`) and a DRM-free
  one (`glaive-3`, `forss`), per `PLAN.md`.
- Play a whole daily round, win and lose. Reload midway and confirm state returns. Confirm a practice
  round doesn't change stats. Confirm old `localStorage` saves still load.
- `document.documentElement.scrollHeight <= innerHeight` on every screen and width. No sideways scroll.
- Grep the result: no level meter or spectrum markup, and no `<button>` wraps the record.
- Keyboard only: reach and use everything, Esc closes dialogs, focus returns to the opener. Contrast
  4.5:1. Reduced motion stops the record.
- The audio doesn't restart or die when you drag, minimise, switch windows, or change theme.
- **The human test:** show Josh screenshots early. If he says it looks AI, it does. Ask which part, then
  make it stranger or more specific, not cleaner.

## 8. Open questions for Josh

1. Is the final draft approved, and what should change?
2. Should the header keep `mp3dle Player`, and is `PLAYER 2.1` the version string he wants?
3. Practice blocked until today's round is done: yes or no?
4. Should DRM-only tracks be excluded from the daily answer pool (`PLAN.md` Phase 1)?
5. Does the Maisie-first order in `PLAN.md` still apply, and when should the baseline commit happen?
