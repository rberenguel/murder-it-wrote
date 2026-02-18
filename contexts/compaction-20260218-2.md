# Crossfade transition — what was tried and how to fix it

## The ask

After the intro content fades to black (door sound), make the loading overlay (typewriter icon)
fade in smoothly rather than appear abruptly.

## What was attempted (and broke things)

1. Added `requestAnimationFrame` between `classList.remove("hidden")` and
   `classList.add("active")` on the overlay in both `beginInvestigation` and `handleNewCase`
   to force the CSS opacity transition to fire.
2. Added a 450 ms delay on `playTypewriter()` so the sound starts when the overlay is visible.
3. Added `html { background-color: #000 }` as extra insurance.

## Why it broke

The app-container uses `background-color: var(--app-bg)` which defaults to
`var(--clr-slate-50)` (light/white) when no `data-theme` is set (new game, no saved state).
During the overlay's 0.45 s fade-in the overlay is partially transparent, exposing the light
app-container → white flash.

## The correct fix (not yet applied)

Exploit the existing z-index stack:

- `app-container`: z-index auto (0) — behind everything
- `intro-screen`: position fixed, z-index 1000
- `transition-overlay`: position fixed, z-index 10000

**Order of operations:**

1. Door plays, intro content fades out (existing — no change).
2. After door finishes: reset intro-content styles. Do NOT hide intro-screen yet.
3. `app-container.classList.remove("hidden")` — invisible, buried behind intro-screen.
4. Overlay: `remove("hidden")` → one rAF → `add("active")` — transition fires cleanly.
5. `playTypewriter()` — no delay needed, sound + visual start together.
6. `await handleNewCase(...)` — generation runs, overlay fades out at end.
7. **After handleNewCase returns**: `intro-screen.classList.add("hidden")` —
   the overlay is already fading out at this point, so the switch is invisible.
8. `stopTypewriter()` + ding.

This way intro-screen's black background shields the light app-container throughout the
overlay fade-in, and intro-screen is only removed once it's safely covered by the fading overlay.

## Files to change for the correct fix

- `js/main.js`: restructure `beginInvestigation` as above (move intro-screen hide to end)
- `js/generator.js`: add rAF in `handleNewCase` overlay show (for `performNewCase` path)
- `js/sampler.js`: `playTypewriter` can stay simple (no delay param needed)
- `style.css`: `html, body { background-color: #000 }` is still a good safety net
