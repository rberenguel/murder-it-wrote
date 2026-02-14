import { SCENARIOS } from "./constants.js";

export function pickRandomScenario() {
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
}

export let state = {
  activeScenario: pickRandomScenario(),
  gameMapping: null,
  puzzle: [],
  solution: null,
  userGuesses: {},
  isGenerating: false,
  sortable: null,
  difficultyIcon: null,
};

export function setState(newState) {
  state = { ...state, ...newState };
}

export function updateState(updates) {
  Object.assign(state, updates);
}
