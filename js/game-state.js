import { SCENARIOS } from './constants.js';

export let state = {
    activeScenario: SCENARIOS[0],
    gameMapping: null,
    puzzle: [],
    solution: null,
    userGuesses: {},
    isGenerating: false,
    sortable: null
};

export function setState(newState) {
    state = { ...state, ...newState };
}

export function updateState(updates) {
    Object.assign(state, updates);
}
