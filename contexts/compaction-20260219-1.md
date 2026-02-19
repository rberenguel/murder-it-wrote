# Session Compaction Summary

## User Intent

- Polish clue rendering: add phrase variety so repeated clue types don't look identical
- Add kill-verb metadata to weapons for richer "not used to X the victim" phrasing
- Ensure rendering variety is seed-stable and backward-compatible
- Fix two minor mobile UI bugs

## Contextual Work Summary

### Mobile UI Fixes

- Lowered `.sound-toggle` z-index from 20000 → 30 (below drawer z-index 40) so it naturally hides behind the notebook drawer when open on mobile
- Changed `debug-seed` input from `inputmode="numeric"` to `inputmode="text"` + added `enterkeyhint="go"` so iOS shows a usable keyboard with a Go/Enter key for alphanumeric game codes

### Seed Checkpoints for Rendering Stability

- Added `resetRng()` to `rng.js` — resets the mulberry32 RNG to the initial seed without changing `_seed`
- Added one checkpoint in `handleNewCase`: before the final `renderFact` pass (after pruning), ensuring phrase variant picks are seed-stable regardless of pruning changes
- Deliberately did NOT add a checkpoint before pruning, to preserve an existing beloved case

### Clue Phrase Variants

- Added `pick`/`draw` helpers inside `renderFact`
- Every fact type now has 3–5 phrasing variants (e.g. "was in", "was found in", "was spotted in", "was reported to be in", "was known to be in")
- Fixed one bad variant: "A scream was heard close to where X was" changed to "X heard a scream from somewhere close by" (preserved subject as listener)
- `pick` used for non-variant random choices (feature selection, kill verb); `draw` used for text variants

### Shuffle-and-Drain Variant Rotation

- `draw(key, ...opts)` uses a shared `deck` object passed into `renderFact`
- Deck stores **shuffled indices** (not interpolated strings) per `fact.type` key — critical fix; storing strings caused all clues of the same type to show the same phrasing
- SUSPECT_LOCATION uses two keys (`fact.type` and `fact.type + "_f"`) for its feature/non-feature branches
- During pruning, `renderFact` is called without a deck so plain random picks are used
- Final render pass creates `deck = {}` after `resetRng()` and passes it through all `renderFact` calls

### Kill Verb System

- Added 10 kill-verb family constants (`kSTAB`, `kSHOOT`, `kBLUDGEON`, etc.) — module-private, not exported
- Added `KILL_VERB_GROUPS` export mapping each key to a synonym array (e.g. `STAB: ["stab", "impale", "pierce", "run through"]`)
- Every item across all 11 scenarios now has a `killVerb` property referencing one of these constants
- `ITEM_NOT_MURDER_WEAPON` gains a 4th variant: "X was not used to [verb] the victim", where verb is picked from the item's synonym group
- Removed "lace" from POISON group and "throttle" from STRANGLE group (register too high)

### Version

- `manifest.json` bumped 0.8.1 → 0.8.2

## Files Touched

### Core Logic

- **js/rng.js**: Added `resetRng()` export
- **js/generator.js**: Added `resetRng` import; one render-phase checkpoint; `renderFact` gains optional `deck` param; `pick` and `draw` helpers; all text variant `pick` calls converted to `draw(fact.type, ...)`; `KILL_VERB_GROUPS` import and usage in `ITEM_NOT_MURDER_WEAPON`; `deck = {}` created and passed in final render pass

### Data

- **js/constants.js**: Added 10 `kXXX` private constants + `KILL_VERB_GROUPS` export; added `killVerb` field to every item in all 11 scenarios

### UI

- **style.css**: `.sound-toggle` z-index 20000 → 30
- **index.html**: `debug-seed` div: `inputmode="numeric"` → `inputmode="text"`, added `enterkeyhint="go"`

### Meta

- **manifest.json**: Version bump to 0.8.2
