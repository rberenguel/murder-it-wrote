# Session Compaction Summary

## User Intent
- Add three new proximity-based clue types to expand the clue vocabulary
- Fix pre-existing test failures introduced by Calliope (0.8.4)
- Polish clue wording based on gameplay feedback
- Bump version to 0.9.0

## Contextual Work Summary

### New Clue Types (js/generator.js)
Three new fact types added to `FACT_TYPES` and `PROTECTED_FACT_TYPES`:
- **`SPOTTED_NEARBY`**: Suspect seen near a named room; uses `screamAdjacency`. Weight 0.80.
- **`NOT_NEAR_SCENE`**: Suspect was not in or adjacent to the murder scene; uses `screamAdjacency`. Weight 0.70. Suppressed when victim's room has no scream neighbours (e.g. Calliope).
- **`SEEN_ARRIVING`**: Suspect seen arriving from a named room; uses `roomAdjacency`. Weight 0.80. Primary payoff for Calliope's transit routes.

### Generation Logic
- `generateProximityFacts` extended with three new generation blocks after the `SCREAM_HEARD` block
- Critical bug fixed: original `if (adjacentRoomNames.length === 0) return facts` early-return was blocking all new types on Calliope (empty `screamAdjacency: {}`). Converted to a conditional block around SCREAM_HEARD only.
- `NOT_NEAR_SCENE` guarded with `adjacentRoomNames.length > 0` — without scream adjacency the clue has zero deductive power and misleading phrasing.

### renderFact Cases
Three new `switch` cases with 3 phrase variants each and correct CSP constraint `fn` closures:
- `SPOTTED_NEARBY` fn: suspect's room is in `getScreamAdjacentRooms(refRoom)`
- `NOT_NEAR_SCENE` fn: suspect not in victim's room AND not in `getScreamAdjacentRooms(victimRoom)`
- `SEEN_ARRIVING` fn: suspect's room is in `getAdjacentRooms(refRoom)`

### Wording Fixes
- "nowhere near the scene" → "nowhere near the **murder scene**" (and same for "well away from" variant) — "scene" alone was ambiguous
- "had just come **through** ${rText}" → "had just come **from** ${rText}" — "through" read oddly

### Corrupt-Data Validator
Added guards for `SEEN_ARRIVING` and `SPOTTED_NEARBY` missing `roomId`.

### Pre-existing Test Failures Fixed
Three failures introduced by Calliope (0.8.4) but caught this session:
1. `test_relationships.js`: `scenario.suspects` may contain objects `{ name, forcedItem }` not just strings — normalized to names before `.include()` check
2. `test_blood_facts.js`: "firearms should be bloody" assumed all "pistol" items are bloody — Calliope's Plasma Pistol is intentionally `bloody: false` (energy weapon). Excluded "plasma" from the filter.
3. `test_proximity_clues.js` SEEN_ARRIVING generation test: fixed by the early-return bug fix above.

### New Test File
`tests/test_proximity_clues.js` — 12 tests across the three new types:
- `fn` correctness (adjacent = true, non-adjacent = false, undecided = true)
- Text phrase matching
- Generation loop tests (40 runs) confirming each type fires in practice
- Edge case: SEEN_ARRIVING never fires for a suspect with no in-game adjacency neighbours

### Version Bump
0.8.4 → 0.9.0 (minor bump for new clue vocabulary feature)

## Files Touched

### Core Logic
- **js/generator.js**: New fact types, protection weights, generation blocks, renderFact cases, validator guards, early-return bug fix, wording fixes

### Tests
- **tests/test_proximity_clues.js**: New file — full coverage for SPOTTED_NEARBY, NOT_NEAR_SCENE, SEEN_ARRIVING
- **tests/test_relationships.js**: Normalize suspect names (string vs object) before `.include()` check
- **tests/test_blood_facts.js**: Exclude plasma weapons from traditional-firearms-are-bloody assertion
- **tests/index.html**: Registered `test_proximity_clues.js`

### Config / Memory
- **manifest.json**: Version bump to 0.9.0
- **memory/MEMORY.md**: Version and feature history updated
