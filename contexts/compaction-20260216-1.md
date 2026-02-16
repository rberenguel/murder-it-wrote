# Session Compaction Summary - Printable Mode Implementation

## User Intent

- Add printable mode to the murder mystery logic game
- Implement viking map fold layout (8-pagelet booklet format)
- Include QR code with encoded solution for verification
- Support compact layout for printing and cutting into booklet

## Contextual Work Summary

### Print Button & Modal

- Added print button to notebook drawer sidebar
- Opens new window with printable layout (no auto-print trigger)
- Two buttons in print view: "Print" (triggers print dialog) and "Switch Layout" (toggles compact mode)

### Printable Layout - Normal View

- Case header with title (uses theme fonts) and role manifest
- Difficulty stars display
- QR code with encoded solution (format: 3 digits per suspect = itemId+roomId+roleIndex)
- Extra section: Locations (with door icons and features) and Relationships
- Evidence/clues list
- Three logic grids: Suspects × Items, Suspects × Locations, Suspects × Roles
- Pre-filled cells shown with diagonal stripe pattern for user's current guesses

### Printable Layout - Compact (Viking Fold)

- 4×2 grid (8 pagelets) in landscape orientation
- Cut line with scissors icon at 50% height, from 25%-75% width
- Pagelets arranged for folding: Top row (7↓,6↓,5↓,4↓ flipped), Bottom row (8,1,2,3 normal)
- Content distribution:
  - Page 1: Cover (title + difficulty)
  - Page 2: Manifest + Extra (locations/relationships)
  - Page 3: Clues/Evidence
  - Pages 4-6: Logic grids (one per page, flipped)
  - Page 7: Notes section
  - Page 8: QR code
- Vertical column headers in grids using `writing-mode` + 180° rotation
- Names shortened to first word only in compact mode
- All content scaled to fit pagelets (smaller fonts, tighter spacing)

### QR Code Implementation

- Using qrcodejs library (MIT, by Sangmin Shim)
- Solution encoded as compact number string
- Generates two QR codes: one for normal view, one for compact
- Added to lib/qrcode.min.js (served locally)
- Updated README with library credits and encoding explanation

### Styling & Theming

- Theme fonts properly load in print view via linked CSS files
- Theme-specific font fallbacks defined per scenario
- Print media queries hide control buttons
- Landscape orientation for compact layout
- Scissors icon positioned at top: -21px, left: 40%, dimmed color

### Known Issue (Current)

- **BLOCKER**: `document.write()` failing with "Unexpected token ':'" error
- Likely related to template literal interpolation with `${baseUrl}` in script/link tags
- Need alternative approach to populate print window

## Files Touched

### UI & Print Generation

- **js/ui.js**:
  - Added `generatePrintablePage()` - creates full HTML for print view
  - Added `openPrintMode()` - opens print window with generated HTML
  - Added `encodeSolution()` - encodes solution as number string for QR
  - Modified `generateGrid()` - added compact parameter, shortens names, vertical headers
  - Added `generateExtra()` - compact format for locations and relationships
  - Export `openPrintMode` for button handler

### Main Application

- **js/main.js**:
  - Import `openPrintMode`
  - Added click handler for print button (line ~168)

### HTML Structure

- **index.html**:
  - Added print button to drawer footer (between verify and reveal buttons)
  - Button uses ph-printer icon

### Styling

- **style.css**:
  - Added `#btn-print *` color overrides for all 10 themes
  - Matches reveal/exit button colors per theme

### Documentation

- **README.md**:
  - Added qrcodejs library credit (MIT license)
  - Added "Printable Mode" feature description
  - Added "Solution Encoding" section explaining format

### Standalone Template

- **folded.html**:
  - Created standalone viking fold template
  - Shows 8-pagelet layout with cut line and scissors
  - Can be reused for other projects

## Key Technical Details

### Viking Fold Pagelet Mapping

Physical positions → Reading order when folded:

```
Position 1 (7 flipped) → Page 7
Position 2 (6 flipped) → Page 6
Position 3 (5 flipped) → Page 5
Position 4 (4 flipped) → Page 4
Position 5 (8 normal)  → Page 8
Position 6 (1 normal)  → Page 1 (cover)
Position 7 (2 normal)  → Page 2
Position 8 (3 normal)  → Page 3
```

### Solution Encoding Format

Each suspect: `itemId + roomId + roleIndex` (3 digits)
Example: "321142534" = Suspect 1 has item 3, room 2, role 1; Suspect 2 has item 1, room 4, role 2; etc.

### Vertical Column Headers (Compact)

```css
writing-mode: vertical-rl; /* Normal pagelets */
writing-mode: vertical-lr; /* Flipped pagelets */
transform: rotate(180deg); /* Applied to both */
```

This combo ensures text reads correctly when pagelets are rotated for folding.

### Current Blocker

`document.write()` error likely caused by:

- Template literal with URLs containing colons (`http://...`)
- Possible solutions: escape HTML entities, use `DOMParser`, or `innerHTML` approach
- Temporary fix: remove `${baseUrl}` interpolation, use relative paths only

### Next Steps

1. Fix document.write error (try DOMParser or blob URL approach)
2. Test QR code generation in both layouts
3. Verify fonts load correctly in print window
4. Test print/cut/fold workflow with actual paper
