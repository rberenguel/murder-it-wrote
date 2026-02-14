import { SCENARIOS, CONFIG } from './constants.js';

export function pickRandomScenario() {
    const classic = SCENARIOS.find(s => s.id === 'classic');
    const others = SCENARIOS.filter(s => s.id !== 'classic');
    
    if (Math.random() < CONFIG.classicWeight && classic) return classic;
    return others.length > 0 ? others[Math.floor(Math.random() * others.length)] : classic;
}

export let state = {
    activeScenario: pickRandomScenario(),
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
