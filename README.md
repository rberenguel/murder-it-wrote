# <img src="icon.png" alt="Murder, it wrote Icon" width="32" height="32"> Murder, it wrote

A logic puzzle game where you solve procedurally generated murder mysteries.

Written with a combination of Gemini web app, Antigravity and a touch of Claude.

Initial version used Tau Prolog, but that is a bit cumbersome and slow.

## How it Works

Every time you start a new case, the game generates a unique scenario from scratch. There are no pre-written plots or solutions. The system builds a consistent "truth" and then selectively reveals just enough information for you to deduce it.

### 1. Generating the Truth

First, the engine creates a "Universe":
*   It picks a random number of suspects (usually 3 to 7).
*   It assigns three key roles: **Killer**, **Victim**, and **Witness**. Everyone else is Innocent or an Accomplice.
*   It deals one **Item** and one **Room** to every single person. These assignments are unique; if Colonel Mustard has the Rope, no one else does.
*   **The Golden Rule**: The Witness is always placed in the same room as the Victim (the body).

### 2. Generating Clues

Once the truth is established, the game generates every possible fact about it.
*   "Plum was in the Library."
*   "Scarlet had the Revolver."
*   "Green is not the Killer."
*   "The Rope is not the murder weapon."

Obviously, giving you all these facts would make the game trivial. The challenge is to give you *just enough*.

### 3. The CSP Solver (Constraint Satisfaction Problem)

The game uses a custom **CSP Solver** to prune the list of clues down to the bare minimum.

*   **Variables**: Every suspect has a _Role_, an _Item_, and a _Room_.
*   **Domains**: Initially, everything is possible. A suspect could be the _Killer_, have the _Lead Pipe_, and be in the _Kitchen_.
*   **Constraints**: Clues act as filters. _Plum was in the Library_ instantly removes all other rooms from Plum's possibilities.

The generator iterates through the list of all true facts and tests them one by one. For each fact, it asks the Solver: *"If I remove this clue, is the solution still unique?"*

*   If the answer is **Yes** (the solution remains unique without this clue), the clue is discarded.
*   If the answer is **No** (removing it makes the puzzle unsolvable or ambiguous), the clue is kept.

This process—called **Essentiality Pruning**—ensures that every single clue you receive is vital to the solution. There is no fluff.

## Features

*   **Several Themes**: Play to see them all. I may add more.
*   **Logic Grid**: A built-in notebook to track your deductions.
*   **Smart Validation**: The notebook highlights impossible combinations (e.g., assigning the same item to two people).
*   **Polished UI**: Hopefully. Theme-aware styling, scrollbars, and typography. It might need more work on mobile or to keep the style consistent though.
