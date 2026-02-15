# Session Compaction Summary - Blood Spill Clues & Theme Colors

## User Intent
- Implement atmospheric "blood spill" clue system for murder mystery game
- Only generate blood clues when murder weapon is bloody (knife, pipe) not clean (poison, rope)
- Only reference physical spillable features (tables, chairs) not abstract ones (lighting, views)
- Fix theme-specific foreground colors for buttons and sidebar tabs

## Contextual Work Summary

### Blood Clue Implementation
- Added `bloody: boolean` property to all weapon items across 11 scenarios
- Bloody: edged, blunt, firearms (Knife, Candlestick, Revolver, etc.)
- Non-bloody: poisons, suffocation, clean energy (Poison Vial, Rope, Neural Disruptor)
- Created positive clue approach: "There was blood spilled on the [feature] in [room]"
- Only generates 1-2 clues per game when weapon is bloody, in victim's room

### Feature Object Conversion
- Converted room features from string arrays to object arrays: `{ name: string, spillable: boolean }`
- Marked physical objects as spillable: true (furniture, equipment, surfaces)
- Marked abstract concepts as spillable: false (lighting, views, atmosphere, weather)
- Updated all 11 scenarios (stellar_voyage, classic_manor, medieval, sherlock, gatsby, falcon, continental_express, edge_walker, radio_shrink, indigo_heir, shadow_protocol)

### Generator Changes
- Added `BLOOD_ON_FEATURE` fact type to FACT_TYPES
- Created `generateBloodFacts(truth, roles, mapping)` function
- Filters features by `spillable !== false` before selecting
- Added rendering logic in `renderFact()` with constraint validation
- Integrated into `generateClues()` pipeline
- Added 85% probabilistic protection to prevent pruning (blood clues are fun!)

### Bug Fixes
- Fixed `generateStableId()` to include `featureName` and `relationshipTerm` in hash
- Without this, multiple blood facts in same room got duplicate IDs causing save/restore issues
- Updated code to handle feature objects (removed string/object fallback code)
- Fixed ui.js to render `f.name` instead of `f` directly

### Testing
- Created `tests/test_blood_facts.js` with deterministic test
- Tests bloody property on all items, blood fact generation, and unique IDs
- Manually constructs scenario instead of random generation (fast execution)

### CSS Theme Organization
- Created consolidated theme-specific foreground color section at end of style.css
- Fixed selectors: changed from `.btn-new-case` (non-existent class) to `#btn-new-case` (actual ID)
- Added rules for: `#btn-new-case`, `#btn-verify`, `#btn-reveal`, `#btn-exit`, `#locations-tab *`, `#notebook-tab *`
- All 11 themes now have proper color overrides with `*` selectors to target child elements
- User customized colors per theme based on background compatibility

## Files Touched

### Core Data
- **js/constants.js**: Added `bloody` property to all items (11 scenarios); converted roomFeatures from strings to objects with `spillable` property across all scenarios

### Game Logic
- **js/generator.js**: Added BLOOD_ON_FEATURE fact type; created generateBloodFacts(); added rendering case; integrated into generateClues(); fixed generateStableId() to include featureName
- **js/ui.js**: Fixed renderLocations() to use `f.name` for feature objects

### Tests
- **tests/test_blood_facts.js**: New comprehensive test file for blood properties, fact generation, and unique IDs
- **tests/index.html**: Added test_blood_facts.js to test runner
- **tests/test_ui_relationships.js**: Updated sibling test to expect "younger brother" instead of "brother"

### UI Styling
- **style.css**: Added theme-specific foreground colors section (lines ~1753-1844) with correct ID selectors for buttons and tabs

## Key Technical Details

### Feature Object Structure
```javascript
// Old: ["iron stove", "butcher block"]
// New: [
//   { name: "iron stove", spillable: true },
//   { name: "butcher block", spillable: true },
//   { name: "soft amber light", spillable: false }
// ]
```

### Blood Fact Generation Logic
Only generates when:
1. `mapping.features` exists (gracefully handles old tests)
2. Killer has bloody weapon (`weapon.bloody === true`)
3. Victim's room has spillable features
4. Randomly selects 1-2 spillable features from victim's room

### Stable ID Fix
Critical fix to prevent duplicate blood facts:
```javascript
const props = [
  fact.type,
  fact.suspectId ?? "",
  fact.roomId ?? "",
  fact.itemId ?? "",
  fact.role ?? "",
  fact.featureName ?? "",      // ADDED - prevents duplicate IDs
  fact.relationshipTerm ?? "",  // ADDED - for consistency
].join("-");
```

### Sibling Relationship Fix
Changed sibling terms from duplicate "brother/brother" to unique "older brother/younger brother" to enable relationship fact generation.
