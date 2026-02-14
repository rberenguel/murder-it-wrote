import { state, updateState, pickRandomScenario } from './game-state.js';
import { SCENARIOS } from './constants.js';
import { handleNewCase } from './generator.js';
import { renderUI, renderLocations, verifySolution, revealSolution, toggleDebug, addLog, performReveal, closeRevealModal } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const uiCallbacks = { addLog, renderUI };

    // --- Intro Flow ---
    const beginInvestigation = async () => {
        addLog('Beginning investigation...', 'system');
        updateState({ activeScenario: pickRandomScenario() });
        
        // Hide intro, show empty game UI with loading state
        document.getElementById('intro-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        const cluesCont = document.getElementById('clues-container');
        if (cluesCont) cluesCont.innerHTML = '<div class="clues-empty">Generating case...</div>';
        
        await handleNewCase(uiCallbacks);
        renderUI();
    };

    const startBtn = document.getElementById('btn-start');
    if (startBtn) startBtn.addEventListener('click', beginInvestigation);

    // --- Global Test Hook ---
    window.miw = {
        select: async (id) => {
            const s = SCENARIOS.find(x => x.id === id);
            if (s) {
                updateState({ activeScenario: s });
                document.getElementById('intro-screen').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');
                await handleNewCase(uiCallbacks);
                renderUI();
                addLog(`Manual Scenario Select: ${s.name}`, 'system');
            } else {
                console.warn(`Scenario "${id}" not found.`);
            }
        }
    };

    // --- Drawer Logic ---
    const nd = document.getElementById('notebook-drawer'), nt = document.getElementById('notebook-tab');
    let no = false;
    if (nt && nd) {
        nt.addEventListener('click', () => { 
            no = !no; 
            nd.style.transform = `translate3d(${no ? 0 : 100}%,0,0)`; 
            addLog(`Notebook drawer: ${no ? 'opened' : 'closed'}`, 'system');
        });
    }
    
    const ld = document.getElementById('locations-drawer'), lt = document.getElementById('locations-tab');
    let lo = false;
    if (lt && ld) {
        lt.addEventListener('click', () => { 
            lo = !lo; 
            ld.style.transform = `translate3d(${lo ? 0 : -100}%,0,0)`; 
            addLog(`Locations drawer: ${lo ? 'opened' : 'closed'}`, 'system');
        });
    }

    // --- Button Bindings ---
    const newCaseBtn = document.getElementById('btn-new-case');
    if (newCaseBtn) {
        newCaseBtn.addEventListener('click', () => {
            addLog('Generating new case...', 'system');
            updateState({ activeScenario: pickRandomScenario() });
            handleNewCase(uiCallbacks);
        });
    }
    
    document.getElementById('btn-verify')?.addEventListener('click', verifySolution);
    document.getElementById('btn-reveal')?.addEventListener('click', revealSolution);
    document.getElementById('btn-reveal-confirm')?.addEventListener('click', performReveal);
    document.getElementById('btn-reveal-cancel')?.addEventListener('click', closeRevealModal);
    document.getElementById('btn-debug-pi')?.addEventListener('click', toggleDebug);

    // Initial render
    renderLocations();
});
