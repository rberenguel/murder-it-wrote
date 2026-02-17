import { SCENARIOS } from "./constants.js";
import { random } from "./rng.js";

export function pickRandomScenario() {
  return SCENARIOS[Math.floor(random() * SCENARIOS.length)];
}

export let state = {
  activeScenario: null,
  seed: null,
  gameMapping: null,
  puzzle: [],
  solution: null,
  userGuesses: {},
  isGenerating: false,
  sortable: null,
  difficultyIcon: null,
  hasInteracted: false, // Track if user has dragged clues or made guesses
  dimmedClues: new Set(), // Track which clues are dimmed (marked as used)
};

export function setState(newState) {
  state = { ...state, ...newState };
}

export function updateState(updates) {
  Object.assign(state, updates);
}
