import { state, updateState } from "./game-state.js";
import { ROLES_DEF } from "./constants.js";
import { saveGame } from "./persistence.js";

export function addLog(m) {
  const c = document.getElementById("log-container");
  if (c)
    c.innerHTML += `<div class="log-entry"><span class="log-time">[${new Date().toLocaleTimeString().split(" ")[0]}]</span>${m}</div>`;
}

export function toggleDebug() {
  document.getElementById("debug-overlay").classList.toggle("hidden");
}

export function renderLocations() {
  const list = document.getElementById("locations-list");
  const rooms = state.gameMapping ? state.gameMapping.rooms : [];
  if (!rooms.length) {
    if (list) list.innerHTML = "";
    return;
  }
  const feats = state.gameMapping.features || state.activeScenario.roomFeatures;
  if (list)
    list.innerHTML = `
        <div class="locations-list">
            ${rooms
              .map(
                (r) => `
                <div class="location-item">
                    <h3 class="location-name">${r.name}</h3>
                    <div class="feature-list">
                        ${(feats[r.name] || []).map((f) => `<span class="feature-badge">${f}</span>`).join("")}
                    </div>
                </div>
            `,
              )
              .join("")}
        </div>`;
}

export function renderSelect(s, f, l, opts, usedMap) {
  const v = state.userGuesses[s]?.[f] || "";
  // Only Items must be unique. Rooms and Roles can be shared.
  const isConflict = f === "item" && v && usedMap?.[f]?.[v] > 1;

  return `<div class="guess-row ${isConflict ? "has-conflict" : ""}">
                <label class="guess-label">${l}</label>
                <select onchange="updateGuess('${s}','${f}',this.value); renderUI();" class="select-input">
                    <option value="">Unknown</option>
                    ${opts
                      .map((o) => {
                        const name = typeof o === "string" ? o : o.name;
                        const isUsedByOther =
                          f === "item" &&
                          usedMap?.[f]?.[name] > 0 &&
                          v !== name;
                        return `<option value="${name}" ${v === name ? "selected" : ""}>${name}${isUsedByOther ? " •" : ""}</option>`;
                      })
                      .join("")}
                </select>
            </div>`;
}

export function renderUI() {
  document.body.dataset.theme = state.activeScenario.id;
  const badge = document.getElementById("status-badge");
  if (badge) {
    badge.classList.add("hidden");
    badge.textContent = "";
  }
  const cc = document.getElementById("clues-container");
  const roleCounts = state.solution.roles.reduce((a, r) => {
    if (!["Killer", "Victim"].includes(r)) a[r] = (a[r] || 0) + 1;
    return a;
  }, {});

  const evidenceHeader = document.querySelector(".evidence-card .card-header");
  if (evidenceHeader) {
    const wrapRole = (r) => `<span class="entity-role">${r}</span>`;
    const roleStr = Object.entries(roleCounts)
      .map(([r, c]) => `${c} ${wrapRole(r)}${c > 1 ? "s" : ""}`)
      .join(", ");
    evidenceHeader.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <h2 class="card-title"><i class="ph-light ph-magnifying-glass"></i>Evidence</h2>
                <span style="font-size: 0.625rem; color: var(--text-slate-400); font-weight: 400; margin-left: 1.75rem;">Manifest: 1 ${wrapRole("Killer")}, 1 ${wrapRole("Victim")}, ${roleStr}</span>
            </div>`;
  }

  cc.innerHTML = `<ul class="clue-list">${state.puzzle
    .map(
      (c) => `
        <li class="clue-item" data-clue-id="${c.id}">
            <span class="clue-handle">${c.number}.</span>
            <span class="clue-text">${c.text}</span>
        </li>`,
    )
    .join("")}</ul>`;

  if (state.sortable) state.sortable.destroy();
  if (typeof Sortable !== "undefined") {
    updateState({
      sortable: new Sortable(cc.querySelector(".clue-list"), {
        handle: ".clue-handle",
        animation: 150,
        ghostClass: "sortable-ghost",
        delay: 100,
        delayOnTouchOnly: true,
        onEnd: async () => {
          // Update state.puzzle to match the new DOM order
          const clueList = document.querySelector('.clue-list');
          const items = Array.from(clueList.querySelectorAll('.clue-item'));
          const reorderedPuzzle = items.map(item => {
            const clueId = item.dataset.clueId;
            return state.puzzle.find(c => c.id === clueId);
          }).filter(Boolean);

          updateState({ puzzle: reorderedPuzzle });
          await saveGame(); // Save after reordering
        }
      }),
    });
  }

  const usedMap = { item: {} };
  Object.values(state.userGuesses).forEach((g) => {
    if (g.item) usedMap.item[g.item] = (usedMap.item[g.item] || 0) + 1;
  });

  const grid = document.getElementById("notebook-grid");
  grid.innerHTML = `
        <div class="notebook-grid">
            ${state.gameMapping.suspects
              .map(
                (name) => `
                <div class="suspect-card">
                    <h3 class="suspect-name">
                        <span class="suspect-icon"><i class="ph-light ph-user"></i></span>
                        ${name}
                    </h3>
                    <div class="guess-grid">
                        ${renderSelect(name, "room", "Loc", state.gameMapping.rooms, usedMap)}
                        ${renderSelect(name, "item", "Item", state.gameMapping.items, usedMap)}
                        ${renderSelect(name, "role", "Role", ROLES_DEF, usedMap)}
                    </div>
                </div>
            `,
              )
              .join("")}
        </div>`;

  renderLocations();
}

export function verifySolution() {
  if (!state.solution) return;
  let ok = true;
  state.solution.truth.forEach((p) => {
    const n = state.gameMapping.suspects[p.id],
      g = state.userGuesses[n];
    if (
      !g ||
      g.room !== state.gameMapping.rooms[p.roomId].name ||
      g.item !== state.gameMapping.items[p.itemId] ||
      g.role !== p.role
    )
      ok = false;
  });
  const b = document.getElementById("status-badge");
  b.innerText = ok ? "CORRECT" : "INCORRECT";
  b.className = `status-badge ${ok ? "correct" : "incorrect"}`;
  b.classList.remove("hidden");
}

export function revealSolution() {
  document.getElementById("reveal-modal").classList.remove("hidden");
}

export function closeRevealModal() {
  document.getElementById("reveal-modal").classList.add("hidden");
}

export function performReveal() {
  closeRevealModal();
  if (!state.solution) return;
  state.solution.truth.forEach((p) => {
    const n = state.gameMapping.suspects[p.id];
    state.userGuesses[n] = {
      room: state.gameMapping.rooms[p.roomId].name,
      item: state.gameMapping.items[p.itemId].name,
      role: p.role,
    };
  });
  renderUI();
  const b = document.getElementById("status-badge");
  b.innerText = "REVEALED";
  b.className = "status-badge revealed";
  b.classList.remove("hidden");
}

// Attach globals for inline handlers
window.updateGuess = async (s, f, v) => {
  if (!state.userGuesses[s]) state.userGuesses[s] = {};
  state.userGuesses[s][f] = v;
  await saveGame(); // Auto-save on every guess
};

window.toggleDebug = toggleDebug;
window.renderUI = renderUI;
