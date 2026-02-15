import { state, updateState } from "./game-state.js";
import { ROLES_DEF } from "./constants.js";
import { saveGame } from "./persistence.js";

export function getCaseSize(numSuspects) {
  if (numSuspects <= 3) return "Cozy";
  if (numSuspects === 4) return "Intimate";
  if (numSuspects === 5) return "Tense";
  if (numSuspects === 6) return "Complex";
  return "Massive";
}

export function getDifficultyStars(numSuspects, iconName = "star") {
  // Map suspects (3-7) to stars (1-5)
  // 3: ★☆☆☆☆, 4: ★★☆☆☆, 5: ★★★☆☆, 6: ★★★★☆, 7: ★★★★★
  const MIN_SUSPECTS = 3;
  const MAX_SUSPECTS = 7;
  const stars = Math.max(1, Math.min(5, numSuspects - MIN_SUSPECTS + 1));

  const filled =
    `<i class="ph-light ph-${iconName}" style="opacity: 1; color: currentColor;"></i>`.repeat(
      stars,
    );
  const empty =
    `<i class="ph-light ph-${iconName}" style="opacity: 0.25;"></i>`.repeat(
      5 - stars,
    );
  return filled + empty;
}

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
  const adjacency = state.activeScenario?.roomAdjacency || {};

  if (list)
    list.innerHTML = `
        <div class="locations-list">
            ${rooms
              .map((r) => {
                const connectedRooms = adjacency[r.name] || [];
                // Filter to only show rooms that are in the current game
                const activeConnections = connectedRooms.filter((roomName) =>
                  rooms.some((room) => room.name === roomName),
                );

                return `
                <div class="location-item">
                    <h3 class="location-name">${r.name}</h3>
                    <div class="feature-list">
                        ${activeConnections.map((roomName) => `<span class="connection-badge"><i class="ph-light ph-door-open"></i>${roomName}</span>`).join("")}
                        ${(feats[r.name] || []).map((f) => `<span class="feature-badge">${f}</span>`).join("")}
                    </div>
                </div>
            `;
              })
              .join("")}
        </div>`;
}

export function renderSelect(s, f, l, opts, usedMap) {
  const v = state.userGuesses[s]?.[f] || "";
  // Only Items must be unique. Rooms and Roles can be shared.
  const isConflict = f === "item" && v && usedMap?.[f]?.[v] > 1;

  return `<div class="guess-row ${isConflict ? "has-conflict" : ""}">
                <label class="guess-label">${l}</label>
                <select class="select-input" data-suspect="${s}" data-field="${f}">
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
    if (!["Killer", "Victim", "Accomplice"].includes(r)) a[r] = (a[r] || 0) + 1;
    return a;
  }, {});

  const evidenceHeader = document.querySelector(".evidence-card .card-header");
  if (evidenceHeader) {
    const wrapRole = (r) => `<span class="entity-role">${r}</span>`;
    const roleStr = Object.entries(roleCounts)
      .map(([r, c]) => `${c} ${wrapRole(r)}${c > 1 ? "s" : ""}`)
      .join(", ");
    const numSuspects = state.gameMapping.suspects.length;
    const sizeWord = getCaseSize(numSuspects);
    const mysteryWord = state.mysteryWord || "Mystery";
    const difficultyStars = getDifficultyStars(
      numSuspects,
      state.difficultyIcon || "star",
    );
    evidenceHeader.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <h2 class="card-title" style="font-family: var(--font-sans);">
                    <i class="ph-light ph-magnifying-glass"></i>The ${sizeWord} ${state.activeScenario.name} ${mysteryWord}
                    <span style="margin-left: 0.5rem; font-size: 0.875rem;">${difficultyStars}</span>
                </h2>
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
          const clueList = document.querySelector(".clue-list");
          const items = Array.from(clueList.querySelectorAll(".clue-item"));
          const reorderedPuzzle = items
            .map((item) => {
              const clueId = item.dataset.clueId;
              return state.puzzle.find((c) => c.id === clueId);
            })
            .filter(Boolean);

          updateState({ puzzle: reorderedPuzzle, hasInteracted: true });
          await saveGame(); // Save after reordering
        },
      }),
    });
  }

  const usedMap = { item: {} };
  Object.values(state.userGuesses).forEach((g) => {
    if (g.item) usedMap.item[g.item] = (usedMap.item[g.item] || 0) + 1;
  });

  // Get unique roles present in this scenario
  const availableRoles = [...new Set(state.solution.roles)];

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
                        ${renderSelect(name, "role", "Role", availableRoles, usedMap)}
                    </div>
                </div>
            `,
              )
              .join("")}
        </div>`;

  // Event delegation for select changes
  grid.removeEventListener("change", handleGuessChange);
  grid.addEventListener("change", handleGuessChange);

  renderLocations();
}

async function handleGuessChange(e) {
  if (e.target.matches("select.select-input")) {
    const suspect = e.target.dataset.suspect;
    const field = e.target.dataset.field;
    const value = e.target.value;
    await window.updateGuess(suspect, field, value);
    renderUI();
  }
}

export function verifySolution() {
  if (!state.solution) return;

  // Validate truth data first
  let hasErrors = false;
  state.solution.truth.forEach((p) => {
    const n = state.gameMapping.suspects[p.id];
    const room = state.gameMapping.rooms[p.roomId];
    const item = state.gameMapping.items[p.itemId];

    if (!room || !item || !n) {
      console.error("Invalid truth entry in verifySolution:", p);
      hasErrors = true;
    }
  });

  if (hasErrors) {
    addLog("⚠️ CORRUPT PUZZLE DETECTED - Regenerating...");
    alert(
      "This puzzle has corrupt data and is unsolvable. Generating a new case...",
    );
    // Trigger regeneration
    setTimeout(() => {
      const newCaseBtn = document.getElementById("btn-new-case");
      if (newCaseBtn) newCaseBtn.click();
    }, 100);
    return;
  }

  let ok = true;
  state.solution.truth.forEach((p) => {
    const n = state.gameMapping.suspects[p.id];
    const g = state.userGuesses[n];
    const room = state.gameMapping.rooms[p.roomId];
    const item = state.gameMapping.items[p.itemId];

    if (!g || g.room !== room.name || g.item !== item.name || g.role !== p.role)
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

  // Validate truth data first
  let hasErrors = false;
  state.solution.truth.forEach((p) => {
    const n = state.gameMapping.suspects[p.id];
    const room = state.gameMapping.rooms[p.roomId];
    const item = state.gameMapping.items[p.itemId];

    if (!room || !item || !n) {
      console.error("Invalid truth entry in performReveal:", p);
      console.error("Room:", room, "Item:", item, "Suspect:", n);
      hasErrors = true;
    }
  });

  if (hasErrors) {
    addLog("⚠️ CORRUPT PUZZLE DETECTED - Regenerating...");
    alert(
      "This puzzle has corrupt data and is unsolvable. Generating a new case...",
    );
    // Trigger regeneration
    setTimeout(() => {
      const newCaseBtn = document.getElementById("btn-new-case");
      if (newCaseBtn) newCaseBtn.click();
    }, 100);
    return;
  }

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

export function showNewCaseModal() {
  document.getElementById("new-case-modal").classList.remove("hidden");
}

export function closeNewCaseModal() {
  document.getElementById("new-case-modal").classList.add("hidden");
}

export function hasUserProgress() {
  // Check if user has interacted with the case (dragged clues or made guesses)
  return state.hasInteracted;
}

// Attach globals for inline handlers
window.updateGuess = async (s, f, v) => {
  if (!state.userGuesses[s]) state.userGuesses[s] = {};
  state.userGuesses[s][f] = v;
  updateState({ hasInteracted: true });
  await saveGame(); // Auto-save on every guess
};

window.toggleDebug = toggleDebug;
window.renderUI = renderUI;
