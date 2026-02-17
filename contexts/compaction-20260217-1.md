# Session Compaction Summary - Accomplice Bug Fix

## User Intent

- Investigate a reported bug related to the Accomplice role
- Reproduce the bug with automated tests before fixing
- Fix the bugs and bump the patch version

## Contextual Work Summary

### Bug Discovery & Analysis

- Read all 6 prior compaction files to establish context
- Analysed `generateTruth`, `mergeFacts`, `renderFact`, and `renderUI` to trace accomplice handling
- Identified two distinct bugs, both rooted in how the accomplice role was added without fully updating surrounding logic

### Bug 1: Phantom Roles in `generateTruth`

- When both Witness AND Accomplice were randomly selected for a game with fewer suspects than total optional roles (e.g. 3-suspect games), `activeRoles` grew to 4 entries
- Only the first `numSuspects` entries of the shuffled array were assigned to `truth`, silently dropping one role
- But `roles` was returned as the full over-length array — causing the dropped role to appear as a "phantom" in manifests, logic grids, and the LogicEngine's roleBag
- Fix: guard both `push` calls with `activeRoles.length < numSuspects` so roles never exceed suspect count

### Bug 2: Accomplice Missing from Case Manifest

- `renderUI` computed manifest role counts excluding `"Killer"`, `"Victim"`, AND `"Accomplice"` from the count
- Manifest always said "1 Killer, 1 Victim, …" then listed Witness/Innocent counts — Accomplice was invisible
- In a 5-suspect game with Accomplice, the manifest accounted for only 4 suspects
- The print mode (added in 0.6.0) correctly included Accomplice in its manifest — inconsistency confirmed the in-game UI was wrong
- Fix: remove `"Accomplice"` from the exclusion list so it appears in the manifest like Witness/Innocent

### Test Suite

- Created `tests/test_accomplice.js` with 4 tests across 2 groups
- Group 1 ("no phantom roles"): generates 100 3-suspect games, asserts `roles.length === numSuspects` and that every role in the array is actually assigned in `truth`
- Group 2 ("manifest counted correctly"): simulates manifest logic, asserts total across 3- and 5-suspect games always equals `numSuspects`
- All 4 tests failed before fixes, all 4 pass after
- Registered in `tests/index.html`

### Version Bump

- `manifest.json`: 0.6.2 → 0.6.3

## Files Touched

### Core Logic

- **js/generator.js**: Added `activeRoles.length < numSuspects` guard before pushing Witness and Accomplice into `activeRoles`

### UI

- **js/ui.js**: Removed `"Accomplice"` from the `roleCounts` exclusion list in `renderUI` so the case manifest counts accomplices

### Tests

- **tests/test_accomplice.js**: New file — 4 tests reproducing and regression-checking both bugs
- **tests/index.html**: Added `test_accomplice.js` script tag

### Config

- **manifest.json**: Version 0.6.2 → 0.6.3
