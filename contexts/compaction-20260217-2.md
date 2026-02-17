# Session Compaction Summary

## User Intent

- Introduce deterministic seeded puzzle generation so games are reproducible and shareable
- Make seeds human-readable and usable from both the debug panel and printed QR codes
- Polish the intro screen for small phones and fix minor theme/clue styling issues

## Contextual Work Summary

### Seeded RNG (`js/rng.js` — new)

- Mulberry32 PRNG with `initRng(seed?)`, `getSeed()`, `random()`, `shuffle()`
- `seedToCode` / `codeToSeed`: bijective base-52 (a-zA-Z) encoding, 6 chars covers all 32-bit seeds
- All `Math.random()` calls in `generator.js` and `game-state.js` replaced with `random()`; local `shuffle` definitions removed

### Seed Lifecycle

- `beginInvestigation(restore, presetSeed?)` in `main.js` calls `initRng` before `pickRandomScenario`; accepts optional preset seed for replay
- `performNewCaseWithSeed(seed)` handles in-game seed replay from debug panel
- Seed stored in `state.seed`, persisted in save data (`persistence.js`)
- `window.miw.getSeed()` and `window.miw.playWithSeed(seed)` exposed for console access

### Debug Panel Seed Input

- `#debug-seed` is `contenteditable` — shows 6-char code, select-all on focus, Enter replays
- `toggleDebug()` populates element with `seedToCode(state.seed)`; keydown handler uses `codeToSeed`
- CSS `::before` pseudo provides non-editable "seed: " label; dashed underline on hover/focus

### Print & QR Integration

- QR URL format changed from `#solution:items-rooms-roles` to `#play:CODE-items-rooms-roles`
- `checkSolutionHash` handles both `#play:` (new) and `#solution:` (legacy)
- `#play:` auto-starts the game with that seed behind the solution modal; player dismisses to continue digitally
- Game code printed as text below QR in both normal and compact layout

### Intro Screen Scroll Fix

- `.intro-screen` changed to `flex-direction: column; overflow-y: auto` — no `justify-content: center`
- `.intro-content` uses `margin: auto 0` to centre when space allows, push to top when overflowing
- `padding-bottom` moved from screen to content to avoid Chrome flex scroll bug
- `.intro-scroll-fade` sticky gradient element (opacity driven by `has-overflow` / `at-bottom` classes)
- `syncIntroScroll()` in `main.js` wires scroll + resize events

### Theme & Clue Polish

- `classic_manor` entity styles added: person = small-caps mahogany, item = italic gold with `1px 1px 1px rgba(0,0,0,0.4)` shadow, room = bold + faint mahogany underline
- All 22 trailing periods removed from clue template strings in `generator.js`

### Version & Docs

- Version bumped `0.6.3` → `0.7.0`
- README "Solution Encoding" section updated to document game codes and `#play:` URL format

## Files Touched

### Core Logic

- **`js/rng.js`**: New module — Mulberry32 PRNG, seed↔code encoding, shuffle
- **`js/generator.js`**: All `Math.random()` → `random()`, local shuffles removed, trailing periods stripped from all 22 clue strings
- **`js/game-state.js`**: Imports `random`, `activeScenario` init deferred to `null`, `seed: null` added to state
- **`js/main.js`**: `initRng` wired into all game-start paths; seed input events; `checkSolutionHash` handles `#play:`; `syncIntroScroll` for intro fade
- **`js/persistence.js`**: `seed` added to save data

### UI

- **`js/ui.js`**: Imports `seedToCode`; debug panel shows code; `toggleDebug` populates element; QR URL uses `#play:`; print template shows game code near QR in both layouts
- **`index.html`**: `#debug-seed` made `contenteditable`; `.intro-scroll-fade` div added inside intro screen
- **`style.css`**: `.debug-seed` styles (with `::before` label); intro screen scroll layout; classic_manor entity-person/item/room rules; `.intro-scroll-fade` sticky gradient

### Docs & Config

- **`manifest.json`**: Version `0.7.0`
- **`README.md`**: New "Seeded Generation & Game Codes" section; solution encoding note updated
