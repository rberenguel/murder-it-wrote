import { state, updateState } from './game-state.js';
import { ROLES_DEF } from './constants.js';

export function addLog(m) {
    const c = document.getElementById('log-container');
    if(c) c.innerHTML += `<div class="log-entry"><span class="log-time">[${new Date().toLocaleTimeString().split(' ')[0]}]</span>${m}</div>`;
}

export function toggleDebug() {
    document.getElementById('debug-overlay').classList.toggle('hidden');
}

export function renderLocations() {
    const list = document.getElementById('locations-list');
    const rooms = state.gameMapping ? state.gameMapping.rooms : [];
    if (!rooms.length) { if(list) list.innerHTML = ''; return; }
    const feats = state.activeScenario.roomFeatures;
    if(list) list.innerHTML = `
        <div class="locations-list">
            ${rooms.map(r => `
                <div class="location-item">
                    <h3 class="location-name">${r.name}</h3>
                    <div class="feature-list">
                        ${(feats[r.name]||[]).map(f => `<span class="feature-badge">${f}</span>`).join('')}
                    </div>
                </div>
            `).join('')}
        </div>`;
}

export function renderSelect(s, f, l, opts) {
    const v = state.userGuesses[s]?.[f] || '';
    return `<div class="guess-row">
                <label class="guess-label">${l}</label>
                <select onchange="updateGuess('${s}','${f}',this.value)" class="select-input">
                    <option value="">Unknown</option>
                    ${opts.map(o=>{
                        const name = typeof o === 'string' ? o : o.name;
                        return `<option value="${name}" ${v===name?'selected':''}>${name}</option>`;
                    }).join('')}
                </select>
            </div>`;
}

export function renderUI() {
    const cc = document.getElementById('clues-container');
    const roleCounts = state.solution.roles.reduce((a,r)=>{ if(!['Killer','Victim'].includes(r)) a[r]=(a[r]||0)+1; return a; }, {});
    const roleStr = Object.entries(roleCounts).map(([r,c]) => `${c} ${r}${c>1?'s':''}`).join(', ');
    
    const evidenceHeader = document.querySelector('.evidence-card .card-header');
    if (evidenceHeader) {
        evidenceHeader.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <h2 class="card-title"><i class="ph ph-magnifying-glass"></i>Evidence</h2>
                <span style="font-size: 0.625rem; color: var(--text-slate-400); font-weight: 400; margin-left: 1.75rem;">Manifest: 1 Killer, 1 Victim, ${roleStr}</span>
            </div>`;
    }

    cc.innerHTML = state.puzzle.map((c,i) => `
        <div class="clue-item">
            <div class="clue-grip"><i class="ph ph-dots-six-vertical" style="font-size: 1.125rem;"></i></div>
            <div class="clue-text-container">
                <span class="clue-index">${i+1}.</span>
                <span class="clue-text">${c.text}</span>
            </div>
        </div>`).join('');

    if (state.sortable) state.sortable.destroy();
    if (typeof Sortable !== 'undefined') {
        updateState({
            sortable: new Sortable(cc, { handle: '.clue-grip', animation: 150, ghostClass: 'sortable-ghost', delay: 100, delayOnTouchOnly: true })
        });
    }

    const grid = document.getElementById('notebook-grid');
    grid.innerHTML = `
        <div class="notebook-grid">
            ${state.gameMapping.suspects.map(name => `
                <div class="suspect-card">
                    <h3 class="suspect-name">
                        <span class="suspect-icon"><i class="ph ph-user"></i></span>
                        ${name}
                    </h3>
                    <div class="guess-grid">
                        ${renderSelect(name, 'room', 'Loc', state.gameMapping.rooms)}
                        ${renderSelect(name, 'item', 'Item', state.gameMapping.items)}
                        ${renderSelect(name, 'role', 'Role', ROLES_DEF)}
                    </div>
                </div>
            `).join('')}
        </div>`;
    
    document.getElementById('scenario-badge').innerText = state.activeScenario.name;
    renderLocations();
}

export function verifySolution() {
    if (!state.solution) return;
    let ok = true;
    state.solution.truth.forEach(p => {
        const n = state.gameMapping.suspects[p.id], g = state.userGuesses[n];
        if (!g || g.room !== state.gameMapping.rooms[p.roomId].name || g.item !== state.gameMapping.items[p.itemId] || g.role !== p.role) ok = false;
    });
    const b = document.getElementById('status-badge');
    b.innerText = ok ? 'CORRECT' : 'INCORRECT'; 
    b.className = `status-badge ${ok ? 'correct' : 'incorrect'}`;
    b.classList.remove('hidden');
}

export function revealSolution() {
    if (!confirm("Give up?")) return;
    state.solution.truth.forEach(p => {
        const n = state.gameMapping.suspects[p.id];
        state.userGuesses[n] = { room: state.gameMapping.rooms[p.roomId].name, item: state.gameMapping.items[p.itemId], role: p.role };
    });
    renderUI();
    const b = document.getElementById('status-badge');
    b.innerText = "REVEALED"; 
    b.className = "status-badge revealed";
    b.classList.remove('hidden');
}

// Attach globals for inline handlers
window.updateGuess = (s, f, v) => { 
    if (!state.userGuesses[s]) state.userGuesses[s] = {}; 
    state.userGuesses[s][f] = v; 
};

window.toggleDebug = toggleDebug;
