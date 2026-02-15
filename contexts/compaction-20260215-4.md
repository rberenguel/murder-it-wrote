# Session Compaction Summary - README Update & Safari Double-Tap Fix

## User Intent

- Review today's compactions and update README with newly added features
- Fix mobile clue dimming issue (double-tap not working on Safari/iOS devices)

## Contextual Work Summary

### Documentation

- Reviewed three previous compaction files from 2026-02-15 covering: relationships system, blood spill clues, random vocabulary, and haptic feedback
- Updated README Features section to document relationship clues and blood spill atmospheric details
- Excluded haptic feedback from documentation per user request

### Safari Double-Tap Bug Investigation

- Identified issue: clue dimming worked in Chrome simulator but not on real Safari devices
- Haptic feedback triggered correctly, indicating function was being called
- Added extensive debug logging to trace state changes and rendering
- Discovered root cause: Safari fires both `touchend` (custom handler) and synthetic `dblclick` (native) events for double-tap
- Result: `handleClueDim` called twice, toggling dimmed state on then immediately off

### Bug Fix Implementation

- Added 100ms debounce (`DIM_DEBOUNCE`) to `handleClueDim` using `lastDimTime` timestamp
- Prevents duplicate calls from `touchend` and `dblclick` within same gesture
- Added `e.stopPropagation()` to touchend handler as additional safeguard
- Refactored to call `renderUI()` after state update instead of manual classList manipulation (more reliable cross-browser)
- Removed all debug logging after confirming fix works on real device

### Version Management

- Bumped version from 0.5.0 to 0.5.1 in manifest.json

## Files Touched

### Documentation

- **README.md**: Added "Relationship Clues" and "Atmospheric Details" to Features section documenting relationship constraints and blood spill mechanics

### Game Logic

- **js/ui.js**:
  - Added `DIM_DEBOUNCE` constant (100ms) and `lastDimTime` variable for debouncing
  - Modified `handleClueDim` to debounce duplicate calls and call `renderUI()` instead of manual DOM manipulation
  - Updated `handleTouchTap` to add `e.stopPropagation()` when double-tap detected
  - Cleaned up all debug console.log statements after successful fix

### Config

- **manifest.json**: Version 0.5.0 → 0.5.1

## Key Technical Details

**Safari Double-Tap Event Sequence**:
Mobile Safari fires both custom touchend handler AND synthetic dblclick for double-tap gestures, causing `handleClueDim` to be called twice in rapid succession.

**Fix Strategy**:

```javascript
// Debounce prevents duplicate calls within 100ms
const now = Date.now();
if (now - lastDimTime < DIM_DEBOUNCE) {
  return;
}
lastDimTime = now;
```

**Cross-Browser Reliability**: Switched from manual classList manipulation to calling `renderUI()` after state update, ensuring DOM reflects state consistently across all browsers.
