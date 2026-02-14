import { get, set } from "../lib/idb-keyval.js";
import { state } from "./game-state.js";

const STORAGE_KEY = "miw-game-state";

// Extract current clue order from DOM (CRITICAL)
function extractClueOrder() {
  const clueList = document.querySelector(".clue-list");
  if (!clueList) return state.puzzle.map((c) => c.id);

  const items = Array.from(clueList.querySelectorAll(".clue-item"));
  return items
    .map((item) => {
      // Use data-clue-id attribute for reliable matching
      const clueId = item.dataset.clueId;
      if (clueId) return clueId;

      // Fallback: Match DOM element to clue by finding text content
      const textContent = item.querySelector(".clue-text")?.innerHTML || "";
      const clue = state.puzzle.find((c) => c.text === textContent);
      return clue?.id;
    })
    .filter(Boolean);
}

export async function saveGame() {
  if (state.isGenerating) return; // Don't save during generation
  if (!state.solution) return; // Don't save if no active game

  const saveData = {
    version: 1,
    timestamp: Date.now(),
    activeScenario: state.activeScenario,
    gameMapping: state.gameMapping,
    puzzleData: state.puzzle.map((clue) => ({
      text: clue.text,
      masks: clue.masks,
      id: clue.id,
      number: clue.number, // Save original clue number
      // Omit fn - cannot serialize functions
    })),
    clueOrder: extractClueOrder(), // Visual order from DOM
    solution: state.solution,
    mysteryWord: state.mysteryWord,
    userGuesses: state.userGuesses,
  };

  await set(STORAGE_KEY, saveData);
}

export async function loadGame() {
  try {
    const saved = await get(STORAGE_KEY);
    if (!saved) return null;

    if (saved.version !== 1) {
      console.warn("Incompatible save version");
      return null;
    }

    // Basic validation
    if (!saved.activeScenario || !saved.gameMapping || !saved.solution) {
      console.warn("Corrupted save data");
      return null;
    }

    return saved;
  } catch (error) {
    console.error("Failed to load game:", error);
    return null;
  }
}

export async function clearGame() {
  await set(STORAGE_KEY, null);
}
