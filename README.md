# <img src="icon.png" alt="Murder, it wrote Icon" width="32" height="32"> Murder, it wrote

A logic puzzle game where you solve procedurally generated murder mysteries.

Written with a combination of Gemini web app, Antigravity and a touch of Claude.

Initial version used Tau Prolog, but that is a bit cumbersome and slow.

## How it Works

Every time you start a new case, the game generates a unique scenario from scratch. There are no pre-written plots or solutions. The system builds a consistent "truth" and then selectively reveals just enough information for you to deduce it.

### 1. Generating the Truth

First, the engine creates a "Universe":

- It picks a random number of suspects (usually 3 to 7).
- It assigns three key roles: **Killer**, **Victim**, and **Witness**. Everyone else is Innocent or an Accomplice.
- It deals one **Item** and one **Room** to every single person. These assignments are unique; if Colonel Mustard has the Rope, no one else does.
- **The Golden Rule**: The Witness is always placed in the same room as the Victim (the body).

### 2. Generating Clues

Once the truth is established, the game generates every possible fact about it.

- "Plum was in the Library."
- "Scarlet had the Revolver."
- "Green is not the Killer."
- "The Rope is not the murder weapon."

Obviously, giving you all these facts would make the game trivial. The challenge is to give you _just enough_.

### 3. The CSP Solver (Constraint Satisfaction Problem)

The game uses a custom **CSP Solver** to prune the list of clues down to the bare minimum.

- **Variables**: Every suspect has a _Role_, an _Item_, and a _Room_.
- **Domains**: Initially, everything is possible. A suspect could be the _Killer_, have the _Lead Pipe_, and be in the _Kitchen_.
- **Constraints**: Clues act as filters. _Plum was in the Library_ instantly removes all other rooms from Plum's possibilities.

The generator iterates through the list of all true facts and tests them one by one. For each fact, it asks the Solver: _"If I remove this clue, is the solution still unique?"_

- If the answer is **Yes** (the solution remains unique without this clue), the clue is discarded.
- If the answer is **No** (removing it makes the puzzle unsolvable or ambiguous), the clue is kept.

This process—called **Essentiality Pruning**—ensures that every single clue you receive is vital to the solution. There is no fluff.

## Features

- **Several Themes**: Play to see them all. I may add more.
- **Dynamic Case Sizing**: Cases are labeled by complexity (Cozy, Intimate, Tense, Complex, Massive) based on the number of suspects.
- **Whimsical Case Titles**: Each case gets a randomly selected mystery descriptor (Mystery, Conundrum, Enigma, etc.) that persists with your save.
- **Relationship Clues**: Suspects can have relationships (married couples, siblings, employer-servant, etc.) that create additional deductive challenges. Clues like "The husband was in the Library" don't reveal which suspect is the husband—you must figure that out.
- **Atmospheric Details**: Bloody crime scenes may leave traces on room features, adding flavor to your investigation.
- **Auto-Save**: Your progress is automatically saved. Close the game and resume exactly where you left off.
- **Clue Reordering**: Drag clues to reorder them by their handle numbers. Your custom order is preserved across sessions.
- **Logic Grid**: A built-in notebook to track your deductions.
- **Smart Validation**: The notebook highlights impossible combinations (e.g., assigning the same item to two people).
- **Polished UI**: Hopefully. Theme-aware styling, scrollbars, and typography. It might need more work on mobile or to keep the style consistent though.
- **Printable Mode**: Generate a printable logic puzzle with a viking map fold layout, perfect for solving on paper. Includes a QR code with the encoded solution for verification.

### Seeded Generation & Game Codes

Every case is generated from a 32-bit seed, encoded as a 6-character alphanumeric **game code** (e.g. `aBcDeF`). The code is shown in the debug panel (π button) and can be edited: type any valid code and press Enter to replay that exact case.

The printable version includes a QR code that encodes both the seed and the solution in a `#play:CODE-…` URL. Scanning it on a phone opens the same case digitally — the solution modal appears on top so you can verify your paper answers, and dismissing it drops you straight into the live game.

### Solution Encoding

The solution embedded in the QR / URL is a compact digit string where each suspect (in order) contributes three digits:

- **First digit**: Item index (which item they have)
- **Second digit**: Room index (which room they're in)
- **Third digit**: Role index (their role in the case)

For example, 5 suspects → `321142534201430` (15 digits). Not immediately readable at a glance, which is intentional.

## Credits / references

### Icon

The icon was created by Gemini, I just asked for a typewriter and got this. I edited it a bit on GIMP. I love it, because it reminds me of the art of two authors I have bought stuff from, and you should check: [Danny Gregory](https://www.dannygregory.com/) and [Michael Nobbs](https://www.gogently.co/).

### Fonts

This project uses the following typefaces:

- **[Phosphor Icons](https://phosphoricons.com/)** - A flexible open-source icon family for interfaces
- **[Reforma 1969](https://pampatype.com/reforma)** - Designed by PampaType for Universidad Nacional de Córdoba (Creative Commons)
- **[Monoid](https://larsenwork.com/monoid/)** - A coding font by Tyler Finck / [Andreas Larsen](https://github.com/larsenwork/monoid) (SIL OFL 1.1)
- **[Cinzel](https://fonts.google.com/specimen/Cinzel)** - Designed by Natanael Gama (SIL OFL 1.1)
- **[Inter](https://rsms.me/inter/)** - Designed by [Rasmus Andersson](https://github.com/rsms/inter) (SIL OFL 1.1)
- **[Caviar Dreams](https://www.dafont.com/caviar-dreams.font)** - Designed by Lauren Thompson (Free for personal and commercial use)
- **[Playfair Display](https://fonts.google.com/specimen/Playfair+Display)** - Google Fonts (SIL OFL 1.1)
- **[Libre Bodoni](https://fonts.google.com/specimen/Libre+Bodoni)** - Google Fonts (SIL OFL 1.1)
- **[Orbitron](https://fonts.google.com/specimen/Orbitron)** - Google Fonts (SIL OFL 1.1)
- **[Lato](https://fonts.google.com/specimen/Lato)** - Designed by Łukasz Dziedzic (SIL OFL 1.1)
- **[Quicksand](https://fonts.google.com/specimen/Quicksand)** - Designed by Andrew Paglinawan (SIL OFL 1.1)

Additional fonts in the fonts folder (not currently used):

- **[Roboto](https://fonts.google.com/specimen/Roboto)** - Designed by Christian Robertson for Google (Apache 2.0)
- **[Sixtyfour](https://fonts.google.com/specimen/Sixtyfour)** - Designed by Jens Kutilek (SIL OFL 1.1)
- **[Ostrich Sans](https://www.theleagueofmoveabletype.com/ostrich-sans)** - Designed by Tyler Finck (SIL OFL 1.1)

### Libraries

- **[idb-keyval](https://github.com/jakearchibald/idb-keyval)** - A super-simple promise-based keyval store by [Jake Archibald](https://github.com/jakearchibald) (Apache 2.0)
- **[qrcodejs](https://github.com/davidshimjs/qrcodejs)** - QR code generator by [Sangmin, Shim](https://github.com/davidshimjs) (MIT)
- **[Tone.js](https://tonejs.github.io/)** - A Web Audio framework for interactive music and sound in the browser, used here for the sampler-based sound effects (MIT)

### Sound effects

- All door effects by <a href="https://pixabay.com/users/dragon-studio-38165424/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=454242">DRAGON-STUDIO</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=454242">Pixabay</a>.
- Keys, ding and quack from [daktilo](https://github.com/orhun/daktilo)
