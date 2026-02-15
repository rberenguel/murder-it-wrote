# Session Compaction Summary

## User Intent

Add relationship system to murder mystery game where:

- Relationships work as **true CSP constraints** (not just rewordings)
- Clues like "The husband was in X" don't reveal which suspect is the husband
- System prevents ambiguity (e.g., won't generate "husband" clues if two husbands exist)
- Relationships displayed in UI so players can solve relationship-based clues
- Support both mandatory and optional relationships (with probability)
- Rename Indigo Heir scenario to match Blue Prince (GOTY 2025) family structure

## Contextual Work Summary

### Relationship System Implementation

- Added 3 new fact types: `RELATIONSHIP_LOCATION`, `RELATIONSHIP_ITEM`, `RELATIONSHIP_HAS_TRAIT`
- Facts store relationship term (e.g., "husband") not suspect ID
- Constraint functions resolve term → suspect ID at solve time (true CSP)
- Two-pass algorithm: build term map across all relationships, then generate facts only for unique terms
- Optional relationships randomly included based on probability

### UI Integration

- Added `getSuspectRelationships()` helper in ui.js
- Suspect cards now display relationship badges (e.g., "Husband of Archduchess Elara")
- Only shows relationships where all parties are in the game
- Styled with relationship-badge CSS

### Scenario Updates

Added relationships to:

- **Continental Express**: Archduke/Archduchess (married), servant-employer, rivals (optional)
- **Great Gatsby**: Two married couples (Tom/Daisy, George/Myrtle)
- **Sherlock Holmes**: Holmes brothers (siblings), Watson/Morstan marriage (optional), landlord-tenant (optional)
- **Pompous Psychiatrist**: Heron family (siblings, father-sons, colleagues optional)
- **Indigo Heir**: Complete Blue Prince family tree with proper names

### Indigo Heir Restructure

Renamed to match Blue Prince structure:

- Simon B. Evans ← Simon P. Jones (protagonist)
- Baron Horace M. Ashford ← Baron Herbert S. Sinclair
- Julian H. Ashford ← Simon H. Sinclair (brother)
- Martha Larsen ← Clara Epsen (wife)
- Cecily M. Evans ← Mary Matthew Jones (daughter)
- David Evans ← (father of protagonist)

## Files Touched

### Core Logic

- **js/generator.js**: Added relationship fact types, `generateRelationshipFacts()`, `findSuspectByRelationshipTerm()`, rendering logic for relationship clues
- **js/logic-engine.js**: No changes (relationships use existing CSP infrastructure)

### Data

- **js/constants.js**: Added `relationships` arrays to 5 scenarios, renamed all Indigo Heir suspects to match Blue Prince

### UI

- **js/ui.js**: Added `getSuspectRelationships()`, updated suspect card rendering to show relationship badges
- **style.css**: Added `.suspect-relationships` and `.relationship-badge` styles

### Tests

- **tests/test_relationships.js**: Tests for relationship fact generation, uniqueness checking, optional relationships
- **tests/test_ui_relationships.js**: Tests for UI relationship display logic
- **tests/test_generator.js**: Added retry helpers for CORRUPT_TRUTH_DATA
- **tests/index.html**: Added new test files

## Key Technical Details

**Uniqueness Check**: Critical for CSP correctness

```javascript
// If two "husbands" exist, NO husband clues generated
const isUniqueTerm = termToSuspects[suspect.term].length === 1;
```

**Runtime Resolution**: Constraint resolves term at solve time

```javascript
fn = (a) => {
  const suspectId = findSuspectByRelationshipTerm(mapping, "husband");
  return checkVal(a, suspectId, "Room", fact.roomId);
};
```

**Blue Prince Family Tree**:

```
Baron Horace M. Ashford
|
Julian H. Ashford ━━ Martha Larsen
         |
    Cecily M. Evans ━━ David Evans
              |
         Simon B. Evans
```
