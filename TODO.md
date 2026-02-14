# TODO - Future Enhancements

## Grammar & Wording Improvements

- **Populous locations wording**: Locations like "Central Park" should never read "was empty". Instead use phrasing like "None of the suspects were in Central Park" for more realistic flavor.

- **Alternate sizing words**: Add variety to the difficulty descriptors (currently: Cozy, Intimate, Tense, Complex, Massive). Create a pool of synonyms for each level.

## Scenario Variety

- **Alternate scenario names and characters**: Add multiple variants for each scenario "style" with different character names but same visual theme and setting.
  - Exception: Maltese Falcon and Great Gatsby would either stay unique OR get "partners" with randomized names but same aesthetic
  - Would require maintaining multiple character/location sets per theme

## Advanced Clue Types

### Blood/Weapon Details
- **Blood spill clues**: Add "there was no blood spilled on X" clues where X is a feature in the corpse's room
  - Requirements:
    - Weapon categorization system (blunt/pointy/bloody vs clean/venom/etc.)
    - Only applies to "bloody" type weapons
    - Room features need "spillable" property to determine valid targets
  - This adds atmospheric detail and additional deduction paths

### Room Proximity System
- **Visible corpse clues**: "The corpse was visible in the distance from ROOM" for adjacent rooms
  - Requirements:
    - Room adjacency/connection graph
    - Visibility system between connected rooms
    - **Solver changes needed**: New clue type (multiple rooms could share adjacency to corpse room)
    - This is NOT a simple rewording - it's genuinely new information

- **Sound-based clues**: "Person in adjacent room heard a scream coming from somewhere"
  - Requirements:
    - Room proximity graph (same as above)
    - Weapon type system (blunt/bloody weapons = loud)
    - Sound propagation rules
    - **Solver changes needed**: "Somewhere" means one of several possible neighbor rooms
    - Adds ambiguity and requires cross-referencing with other clues

## Notes

- Proximity-based clues would significantly increase puzzle complexity and realism
- Blood/weapon details could be added without solver changes (just flavor)
- Room graph system would enable both visibility and sound clues
- The CSP solver ensures all puzzles remain logically solvable regardless of clue ambiguity - it validates unique solutions before presenting the puzzle
- Ambiguous clues would increase deduction complexity for humans but the solver guarantees solvability
