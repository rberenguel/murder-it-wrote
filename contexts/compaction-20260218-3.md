# Session Compaction Summary

## User Intent

- Fix a representational bug where married couples could produce ambiguous clues ("the married person") indistinguishable by the human solver
- Follow TDD: write a failing regression test first, confirm it fails, then apply the fix
- Keep the test style consistent with existing regression tests (e.g. `test_accomplice.js`)

## Contextual Work Summary

### Bug Analysis

- `renderFact()` in `generator.js` used a random 50/50 branch for `RELATIONSHIP_LOCATION`, `RELATIONSHIP_ITEM`, and `RELATIONSHIP_HAS_TRAIT` facts
- The generic branch produced text like "The married person was in X" — ambiguous because both spouses share the `married` type
- The CSP solver correctly tracked suspects via the specific `relationshipTerm` internally, but the human-visible text was misleading
- Argument established: for any _complete_ relationship, there are always 2+ members sharing the same `relationshipType`, so the generic form is always ambiguous

### Side Discovery

- `RELATIONSHIP_HAS_TRAIT` facts (`fn = () => true`, not in `PROTECTED_FACT_TYPES`) are always pruned away during essentiality checks — they are dead code but were left in place intentionally

### Testing

- User enforced TDD strictly: write the failing test first, confirm failure in browser, then fix
- Exported `renderFact` from `generator.js` to make it testable
- Wrote `tests/test_married_ambiguity.js` with three tests (one per affected fact type)
- Tests call `renderFact` on generated facts and assert the rendered text never uses the generic `[type] person` form
- Tests were confirmed to fail ~50% of the time before the fix (matching the 50/50 random branch)

### Fix

- Removed the `else` branch (generic form) from all three relationship rendering cases in `renderFact()`
- All three now unconditionally use the specific `relationshipTerm` (e.g. "husband", "wife")

### Version

- `manifest.json` bumped 0.8.0 → 0.8.1

## Files Touched

### Core Logic

- **js/generator.js**: Exported `renderFact`; removed generic rendering alternatives from `RELATIONSHIP_LOCATION`, `RELATIONSHIP_ITEM`, and `RELATIONSHIP_HAS_TRAIT` cases

### Tests

- **tests/test_married_ambiguity.js**: New regression test file — three tests covering the three affected relationship fact types
- **tests/index.html**: Added `test_married_ambiguity.js` script tag

### Meta

- **manifest.json**: Version bump to 0.8.1
