import { state, updateState } from './game-state.js';
import { SCENARIOS } from './constants.js';
import { handleNewCase } from './generator.js';
import { renderUI, renderLocations, verifySolution, revealSolution, toggleDebug, addLog } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Helpers ---
    const uiCallbacks = { addLog, renderUI };

    // --- Drawer Logic ---
    const nd = document.getElementById('notebook-drawer');
    const nt = document.getElementById('notebook-tab');
    let no = false;
    nt.addEventListener('click', () => { no = !no; nd.style.transform = `translate3d(${no ? 0 : 100}%,0,0)`; });
    
    const ld = document.getElementById('locations-drawer');
    const lt = document.getElementById('locations-tab');
    let lo = false;
    if(lt) lt.addEventListener('click', () => { lo = !lo; ld.style.transform = `translate3d(${lo ? 0 : -100}%,0,0)`; });
    
    // --- Scenario Selection ---
    const sel = document.getElementById('scenario-select');
    if(sel) {
        sel.innerHTML = ''; 
        SCENARIOS.forEach(s => sel.appendChild(new Option(s.name, s.id)));
        sel.addEventListener('change', e => { 
            const newScenario = SCENARIOS.find(s => s.id === e.target.value);
            updateState({ activeScenario: newScenario }); 
            renderLocations(); 
        });
    }

    // --- Button Bindings ---
    document.getElementById('btn-new-case').addEventListener('click', () => handleNewCase(uiCallbacks));
    document.getElementById('btn-verify').addEventListener('click', verifySolution);
    document.getElementById('btn-reveal').addEventListener('click', revealSolution);
    document.getElementById('btn-debug').addEventListener('click', toggleDebug);

    // Initial render
    renderLocations();
});
