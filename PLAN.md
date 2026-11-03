# Fix & polish plan

Scope: every file under `src/`, plus config, was read. Bugs were reproduced in a Chromium 152
browser at desktop and 375×812 mobile sizes against the live SoundCloud API. Line references point
at the current code.

**Priority:** this project is still alpha. The live `maisie-heardle` site has the same Chrome and
mobile bugs (worse: 96 of Maisie's 111 tracks are DRM-only), so it gets fixed first. See
`../maisie-heardle/PLAN.md`. The order across both projects is at the end of this file.

---

## 0. Root causes at a glance

| Symptom                            | Root cause                                                                                                                                                                                                                                                                                                                                                                 | Confidence                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Doesn't work in Chrome**         | The widget iframe only has `allow="autoplay"`. Many SoundCloud tracks are now **DRM-only** (encrypted HLS), and Chrome blocks DRM (`encrypted-media`) in cross-origin iframes unless the iframe allows it.                                                                                                                                                                 | **Confirmed** (see evidence)                             |
| **Fails _sometimes_ on mobile**    | (a) the same DRM issue on Android Chrome and in-app browsers; it depends on which track is today's answer. (b) iOS/Safari suggestion taps are dropped. (c) a warm-up race and missing clip cutoff make the player state drift. (d) `crypto.randomUUID` throws on non-HTTPS LAN testing. (e) no feedback while an artist catalog loads, so taps look like nothing happened. | Confirmed (a, e); from code review (b, c, d)             |
| **Weirdly scrolls the whole page** | The game view is `artist bar + main(min-height: 100dvh)`, so it always overflows by about 70px (measured 882px tall in an 812px viewport). The 14px guess input makes iOS zoom in on focus. `scrollIntoView` scrolls the page. Modals have no scroll lock. `dvh` makes the page jump as the URL bar shows and hides.                                                       | Confirmed (overflow, 14px font); from code review (rest) |

### Evidence for the Chrome bug

- With today's glaive track (`1glaive/bennie-kay`), pressing Play sent one `PLAY_PROGRESS` at 0ms
  and nothing else. Clicking SoundCloud's own play button inside the widget gave `PLAY` and then
  an immediate `PAUSE`.
- That track's only transcodings are `cbc-encrypted-hls` and `ctr-encrypted-hls` (policy
  `MONETIZE`). For `1glaive`, **51 of 115 tracks (44%) are DRM-only**. For smaller artists
  (`glaive-3`, `forss`) it's 0%. So it fails for "some days, some artists".
- `iframe.featurePolicy.allowsFeature('encrypted-media')` returns **`false`** for the current
  iframe and **`true`** with `allow="autoplay; encrypted-media"`.
- On a DRM-free artist (`glaive-3`) the same build works: the clip starts and the cutoff pauses at
  1013ms, so the game logic is fine.
- Safari doesn't enforce this permissions policy for FairPlay, which is why it "works in Safari".

---

## Phase 1: Make playback work everywhere (ship first)

All in [Mp3dleGame.svelte](src/lib/Mp3dleGame.svelte) unless noted.

1. **Allow DRM in the widget iframe** ([Mp3dleGame.svelte:1363](src/lib/Mp3dleGame.svelte:1363))
   `allow="autoplay; encrypted-media"`. This is the one-line fix for Chrome, Edge and Android
   Chrome.
2. **Detect "can't play" instead of hanging silently.** After any `play()` request, start a watchdog:
   - `PLAY` then `PAUSE` within about 500ms at position about 0 → playback failed.
   - No advancing `PLAY_PROGRESS` within about 4s → stalled.
     On failure, show a clear error ("This song can't play in this browser") with **Retry**,
     **Play a practice song** and **Open on SoundCloud** actions. Don't leave a dead play button.
3. **Tag DRM-only tracks in the catalog.** In [soundcloud.ts:131-152](src/lib/server/soundcloud.ts:131),
   read `item.media.transcodings` and store `drm: true` when every transcoding is
   `*-encrypted-hls`. This feeds step 2's error copy and the pool decision below. Bump the catalog
   `schema` query param in [+page.ts:20](src/routes/+page.ts:20) so cached catalogs refresh.
4. **Always enforce the clip cutoff** ([Mp3dleGame.svelte:494-502](src/lib/Mp3dleGame.svelte:494)).
   `PLAY_PROGRESS` returns early when `!isPlaying`, so a lost or late `PLAY` event lets the clip
   run past its limit. Enforce `limit` regardless of `isPlaying`, and set `isPlaying = true` from
   progress events if they arrive first.
5. **Remove (or gate) the warm-up** ([Mp3dleGame.svelte:515-536](src/lib/Mp3dleGame.svelte:515)).
   It calls `play()` before any user gesture: autoplay blocks it on mobile, it's audible on iOS
   (`setVolume` is ignored there), and a `PLAY` that arrives after the 1s window flips the UI into
   a phantom "playing" state. Mark the widget ready on `READY` + `getDuration`, and do any priming
   inside the first real tap.
6. **`crypto.randomUUID` fallback** ([Mp3dleGame.svelte:940](src/lib/Mp3dleGame.svelte:940)).
   It's undefined on `http://192.168.x.x` (phone testing) and older Safari, so **Play another**
   throws. Fall back to `crypto.getRandomValues` → hex.
7. **Fix suggestion taps on iOS/Safari** ([Mp3dleGame.svelte:1029-1043](src/lib/Mp3dleGame.svelte:1029)).
   Safari doesn't focus buttons on tap, so `focusout.relatedTarget` is `null`, the list closes, and
   the tap lands on nothing. Add `on:pointerdown|preventDefault` on the listbox (keeps focus in the
   input) and select on `click`.
8. **Show progress while an artist loads** ([ArtistPicker.svelte:51](src/lib/ArtistPicker.svelte:51)).
   The catalog import can take several seconds (up to 10 API pages), and nothing on screen changes.
   Use `navigating` from `$app/state` to show a pending state on the chosen result, disable other
   results, and avoid double-taps.
9. **Friendlier slow-network handling.** The 15s widget timeout
   ([Mp3dleGame.svelte:308](src/lib/Mp3dleGame.svelte:308)) shows a hard error. Offer **Retry**,
   which re-creates the iframe instead of a full page reload.

**Decision for you:** should DRM-only tracks be **excluded from the daily answer pool** (they stay
guessable)?

- **Pro:** the daily song plays in every browser, including Firefox, in-app browsers
  (Instagram/Discord/TikTok webviews) and Android WebViews that lack Widevine.
- **Con:** for big artists it removes many popular (monetized) songs as answers. It also changes
  today's answer for those artists once.

My recommendation: ship steps 1 to 9 first, then decide based on how often the step-2 error shows up.

---

## Phase 2: Stop the page from scrolling

1. **One flex column that fills the screen and doesn't overflow.**
   - [+page.svelte:135](src/routes/+page.svelte:135): `.game-view { display:flex; flex-direction:column; min-height:100svh }`.
   - [Mp3dleGame.svelte:1292](src/lib/Mp3dleGame.svelte:1292): drop `min-h-[100dvh]` on
     `<main>` and use `flex: 1`. That removes the constant overflow of about 70px.
   - Use `svh` (stable) instead of `dvh` for `min-height` everywhere, so layout doesn't jump when
     the mobile URL bar collapses. Keep `dvh` only for modal `max-height`.
2. **No iOS focus-zoom:** inputs must be at least 16px on mobile. The guess input is `text-sm`
   (14px) at [Mp3dleGame.svelte:2016](src/lib/Mp3dleGame.svelte:2016). Use `text-base`.
3. **Replace `scrollIntoView`** for the active suggestion
   ([Mp3dleGame.svelte:999-1001](src/lib/Mp3dleGame.svelte:999)). It scrolls every ancestor,
   including the page. Adjust the listbox's own `scrollTop` instead.
4. **Modal scroll lock.** The overlays
   ([Mp3dleGame.svelte:1141](src/lib/Mp3dleGame.svelte:1141), [1176](src/lib/Mp3dleGame.svelte:1176))
   let the page scroll behind them on touch. Move to native `<dialog>` + `showModal()`; that gives
   focus trapping, Esc and `inert` for free and lets you delete `handleDialogKeydown`. Add
   `overscroll-behavior: contain` and lock `html { overflow: hidden }` while open.
5. **Horizontal-overflow guard.** `.artist-meta` is `white-space: nowrap` with no clipping
   ([ArtistPicker.svelte:348](src/lib/ArtistPicker.svelte:348)). A long handle pushes the page
   sideways on phones. Add `overflow:hidden; text-overflow:ellipsis; min-width:0`.
6. **Theme-correct overscroll.** [app.css](src/app.css) paints `body` from the _system_ scheme, so
   with a manual override the iOS rubber-band and safe areas show the wrong color, and the first
   frame flashes. Set `data-theme` on `<html>` from an inline script in
   [app.html](src/app.html) before paint, and drive `body` background and `meta[name=theme-color]`
   from it.
7. Add `viewport-fit=cover` and `env(safe-area-inset-bottom)` padding so bottom controls clear the
   iPhone home indicator.

---

## Phase 3: UI polish

### 3.1 One design system

Done already: the pink-to-blue gradients, the heroicons, the "Any artist · one daily track" badge
and the em-dash copy are gone. Keep it that way: flat colors, text labels on buttons, and plain
play/pause shapes only.

There are currently **three palettes**: `--app-*` in [+page.svelte:104](src/routes/+page.svelte:104),
`--page-*`/`--deck-*` in [Mp3dleGame.svelte:2108](src/lib/Mp3dleGame.svelte:2108), and a JS
`COLORS` object ([Mp3dleGame.svelte:42](src/lib/Mp3dleGame.svelte:42)). On top of those are about
40 inline `style="color: {darkMode ? '#bbb' : …}"` ternaries.

- Move one token set into [app.css](src/app.css) under `:root` / `:root[data-theme="dark"]`:
  surface, surface-muted, fg, muted, border, primary, secondary, accent, success, danger, radius,
  shadow.
- Delete `COLORS` and every inline color ternary. Components use `var(--…)` or Tailwind
  `@theme` tokens.
- Pick one radius scale. Right now it mixes 8px, 0.65rem, 0.72rem, 0.75rem, 0.85rem, 1rem,
  1.25rem and `rounded`.
- Use `font-variant-numeric: tabular-nums` on timers, countdown and stats so digits don't jitter.

### 3.2 Game screen

- **Merge the two stacked headers.** The artist bar and the deck header both show the artist name
  and both have a theme toggle. Use one top bar: avatar + name (tap to change artist) · info ·
  help · theme.
- **Mobile control dock.** On phones, make the control deck `position: sticky; bottom: 0` with
  safe-area padding. Play, the input and Skip/Submit stay in thumb reach, and the dead space under
  the deck goes away.
- **Bigger, clearer play button** on mobile (64px), with a spinner while loading instead of a
  greyed button plus pulsing text.
- Keep the status line ("1s unlocked · 6 guesses left") on one row at narrow widths. Stacking it
  at < 520px ([Mp3dleGame.svelte:2478](src/lib/Mp3dleGame.svelte:2478)) wastes a line.
- Title: "mp3dle - glaive" → "glaive · mp3dle" (no hyphen-as-dash), also in the share text.
- **Turntable responsiveness.** The platter is a fixed 400px at `left: 40px`, while the tonearm
  SVG scales with the column ([Mp3dleGame.svelte:1430-1500](src/lib/Mp3dleGame.svelte:1430)),
  so they drift out of alignment as the column width changes. Build the turntable on one
  `aspect-ratio` box with `%` / container-query units, with the tonearm in the same coordinate
  space.
- **Seek bar semantics.** The game-over seek control is a `<button role="slider">`
  ([Mp3dleGame.svelte:1832](src/lib/Mp3dleGame.svelte:1832)). Make it a `div role="slider"
tabindex="0"` (or a styled `input type=range`) and show a visible thumb.
- Result card: larger artwork on mobile, and **Play another** as the primary action.
  **Share** shows "Copied!" inline as a toast that fades out.
- Empty attempt rows: lighter dashed style; filled rows get a short text status ("Skipped",
  "Wrong", "Correct") next to the color bar, not color alone (accessibility).

### 3.3 Landing / artist picker

- On a 375×812 phone the **search box sits right at the bottom of the first screen**, and results
  appear entirely below the fold. Compress the hero on mobile (smaller H1, feature chips moved
  under the card or dropped) so the input is visible on load. After a search, scroll results into
  view.
- Move the theme toggle out of the picker card into a consistent top-right app header, the same
  as on the game screen.
- The eyebrow "SoundCloud artist selector" wraps to 2 lines on phones. Shorten it to "Pick an
  artist".
- **Focus ring:** the search input shows two rings at once (accent outline + primary box-shadow,
  [ArtistPicker.svelte:445-484](src/lib/ArtistPicker.svelte:445)). Keep one.
- Loading skeletons for results. Optional: debounced type-ahead (about 300ms) instead of
  submit-only search.
- Result cards: show a verified-looking emphasis (bold follower count) on the top result to help
  pick the official profile.

### 3.4 Dialogs

- Native `<dialog>` (see Phase 2.4), styled by tokens instead of inline hex.
- Stats: 4-up grid on all sizes (it fits at 375px with smaller numerals); highlight today's bar in
  the distribution.
- How-to: add the clip lengths (1s → 2s → 4s → 7s → 11s → 16s) as a small visual.

---

## Phase 4: Code health that makes the above sustainable

[Mp3dleGame.svelte](src/lib/Mp3dleGame.svelte) is 2,632 lines that mix Tailwind, inline styles
and scoped CSS. Split it while doing Phases 1 to 3:

- `lib/player/soundcloud-player.ts`: loads `api.js`, owns the widget, and exposes
  `ready / playClip(ms) / pause / seek / onError`, the stall watchdog and cutoff enforcement.
  Unit-testable with a fake widget.
- `GameHeader`, `AttemptList`, `Turntable`, `ControlDock`, `GuessCombobox`, `ResultCard`,
  `StatsDialog`, `HowToDialog`.
- Convert to Svelte 5 runes as each piece is extracted. The project is on Svelte 5.56 but uses
  legacy `export let`, `$:` and `<slot/>`.
- Remove dead bits: the unused `.game-scroll` wrapper and the `/api/soundcloud/oembed` duplication
  if `getCurrentSound` already provides artwork.

---

## Verification plan

- **Unit:** player wrapper (cutoff fires without `PLAY`; failure detection), catalog DRM tagging,
  UUID fallback.
- **Playwright e2e** (add `@playwright/test`):
  - Use `channel: 'chrome'` for a DRM track. Bundled Chromium has no Widevine, so it reproduces the
    failure but can't prove the fix.
  - Use `webkit` + iPhone emulation for suggestion taps and 16px input.
  - Layout assertion at 375×812 and 390×844: `scrollHeight <= innerHeight` on the game screen and
    `scrollWidth === innerWidth` everywhere.
- **Manual device pass:** iPhone Safari, Android Chrome, desktop Chrome/Firefox/Safari.
  - Play a DRM-only daily track (e.g. `?artist=1glaive`) and a DRM-free one (`?artist=glaive-3`).
  - Open a modal and try to scroll behind it.
  - Toggle the theme opposite to the system theme and rubber-band scroll.
- Keep `npm run check`, `lint`, `test`, `build` green (CI already runs them).

## Suggested order

Within this project:

1. Phase 1.1 (one line), then 1.2 to 1.9.
2. Phase 2 (layout/scroll).
3. Phase 4 split, done together with Phase 3 polish, component by component, then launch.

Across both projects (details in `../maisie-heardle/PLAN.md`):

1. Maisie Hotfix 1 (playback: `encrypted-media`, DRM probe, watchdog, cutoff, 16px input), then
   deploy. Turn off Cloudflare Rocket Loader.
2. Maisie Hotfix 2 (scroll/layout), then deploy.
3. This project's Phases 1 and 2, reusing the same code.
4. Maisie's uncommitted catalog-sync work, with its fixes, plus the visual cleanup already done
   here (no gradients, no icon set, no em dashes).
5. Share one player module between both repos.
6. This project's Phase 3/4 polish, then launch.
