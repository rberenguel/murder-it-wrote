import { state, updateState } from "./game-state.js";
import { ROLES_DEF } from "./constants.js";
import { saveGame } from "./persistence.js";
import { haptic } from "./haptic.js";

export function getCaseSize() {
  // Return the stored sizing word for this case
  return state.sizingWord || "Mysterious";
}

export function getCaseTitle() {
  const sizeWord = getCaseSize();
  const mysteryWord = state.mysteryWord || "Mystery";
  const scenarioName = state.scenarioName || state.activeScenario.name;
  return `The ${sizeWord} ${scenarioName} ${mysteryWord}`;
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
  haptic();
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
                        ${(feats[r.name] || []).map((f) => `<span class="feature-badge">${f.name}</span>`).join("")}
                    </div>
                </div>
            `;
              })
              .join("")}
        </div>`;
}

// Helper: Get relationship information for a suspect
export function getSuspectRelationships(suspectName) {
  if (!state.gameMapping?.scenario?.relationships) return [];

  const relationships = [];
  const activeSuspects = state.gameMapping.suspects;

  state.gameMapping.scenario.relationships.forEach((rel) => {
    // Check if all suspects in this relationship are in the game
    const allActive = rel.suspects.every((s) =>
      activeSuspects.includes(s.name),
    );
    if (!allActive) return;

    // Find this suspect in the relationship
    const thisSuspect = rel.suspects.find((s) => s.name === suspectName);
    if (!thisSuspect) return;

    // Find the other suspects in the relationship
    const others = rel.suspects.filter((s) => s.name !== suspectName);

    others.forEach((other) => {
      relationships.push({
        term: thisSuspect.term,
        relatedTo: other.name,
        relatedTerm: other.term,
        type: rel.type,
      });
    });
  });

  return relationships;
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
    const caseTitle = getCaseTitle();
    const difficultyStars = getDifficultyStars(
      numSuspects,
      state.difficultyIcon || "star",
    );
    evidenceHeader.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <h2 class="card-title" style="font-family: var(--font-sans);">
                    <i class="ph-light ph-magnifying-glass"></i>${caseTitle}
                    <span style="margin-left: 0.5rem; font-size: 0.875rem;">${difficultyStars}</span>
                </h2>
                <span style="font-size: 0.625rem; color: var(--text-slate-400); font-weight: 400; margin-left: 1.75rem;">Manifest: 1 ${wrapRole("Killer")}, 1 ${wrapRole("Victim")}, ${roleStr}</span>
            </div>`;
  }

  cc.innerHTML = `<ul class="clue-list">${state.puzzle
    .map(
      (c) => `
        <li class="clue-item ${state.dimmedClues.has(c.id) ? "dimmed" : ""}" data-clue-id="${c.id}">
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
        onStart: () => {
          haptic();
        },
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

  // Add double-tap/double-click handling for dimming clues
  cc.removeEventListener("dblclick", handleClueDim);
  cc.addEventListener("dblclick", handleClueDim);

  // Mobile double-tap support - attach to each clue item directly
  // Use capturing phase (true) to run before Sortable's handlers
  const clueItems = cc.querySelectorAll(".clue-item");
  clueItems.forEach((item) => {
    item.removeEventListener("touchend", handleTouchTap, true);
    item.addEventListener("touchend", handleTouchTap, true);
  });

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
              .map((name) => {
                const relationships = getSuspectRelationships(name);
                const relationshipHTML =
                  relationships.length > 0
                    ? `<div class="suspect-relationships">
                            ${relationships
                              .map(
                                (rel) =>
                                  `<span class="relationship-badge" title="${rel.term} of ${rel.relatedTo}">
                                    <i class="ph-light ph-users-three"></i>
                                    ${rel.term.charAt(0).toUpperCase() + rel.term.slice(1)} of ${rel.relatedTo}
                                </span>`,
                              )
                              .join("")}
                        </div>`
                    : "";

                return `
                <div class="suspect-card">
                    <h3 class="suspect-name">
                        <span class="suspect-icon"><i class="ph-light ph-user"></i></span>
                        ${name}
                    </h3>
                    ${relationshipHTML}
                    <div class="guess-grid">
                        ${renderSelect(name, "room", "Loc", state.gameMapping.rooms, usedMap)}
                        ${renderSelect(name, "item", "Item", state.gameMapping.items, usedMap)}
                        ${renderSelect(name, "role", "Role", availableRoles, usedMap)}
                    </div>
                </div>
            `;
              })
              .join("")}
        </div>`;

  // Event delegation for select changes
  grid.removeEventListener("change", handleGuessChange);
  grid.addEventListener("change", handleGuessChange);

  renderLocations();
}

async function handleGuessChange(e) {
  if (e.target.matches("select.select-input")) {
    haptic();
    const suspect = e.target.dataset.suspect;
    const field = e.target.dataset.field;
    const value = e.target.value;
    await window.updateGuess(suspect, field, value);
    renderUI();
  }
}

async function handleClueDim(clueItemOrEvent) {
  // Debounce to prevent dblclick and touchend both firing
  const now = Date.now();
  if (now - lastDimTime < DIM_DEBOUNCE) {
    return;
  }
  lastDimTime = now;

  // Support both direct clueItem element or event object
  const clueItem =
    clueItemOrEvent instanceof Element
      ? clueItemOrEvent
      : clueItemOrEvent.target?.closest(".clue-item");

  if (!clueItem) return;

  const clueId = clueItem.dataset.clueId;
  if (!clueId) return;

  haptic();

  // Toggle dimmed state in state only, then re-render
  if (state.dimmedClues.has(clueId)) {
    state.dimmedClues.delete(clueId);
  } else {
    state.dimmedClues.add(clueId);
  }

  updateState({ hasInteracted: true });
  await saveGame();
  renderUI(); // Re-render to apply dimmed class from state
}

// Double-tap detection for mobile
let lastTapTime = 0;
let lastTapTarget = null;
let lastDimTime = 0; // Prevent duplicate dims from dblclick + touchend
const DOUBLE_TAP_DELAY = 300; // ms
const DIM_DEBOUNCE = 100; // ms - prevent duplicate dim calls

async function handleTouchTap(e) {
  // Don't handle double-tap on the drag handle
  if (e.target.closest(".clue-handle")) return;

  const clueItem = e.target.closest(".clue-item");
  if (!clueItem) return;

  const currentTime = Date.now();
  const timeDiff = currentTime - lastTapTime;

  if (timeDiff < DOUBLE_TAP_DELAY && lastTapTarget === clueItem) {
    // Double tap detected
    e.preventDefault();
    e.stopPropagation(); // Prevent dblclick event from firing
    await handleClueDim(clueItem);
    lastTapTime = 0;
    lastTapTarget = null;
  } else {
    // First tap
    lastTapTime = currentTime;
    lastTapTarget = clueItem;
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

// Generate printable logic puzzle grids
export function generatePrintablePage(qrNormalDataURL, qrCompactDataURL) {
  const suspects = state.gameMapping.suspects;
  const items = state.gameMapping.items.map(i => typeof i === 'string' ? i : i.name);
  const rooms = state.gameMapping.rooms;
  const roomNames = rooms.map(r => typeof r === 'string' ? r : r.name);
  const roles = [...new Set(state.solution.roles)];
  const clues = state.puzzle;

  // Get role counts for manifest
  const roleCounts = state.solution.roles.reduce((acc, role) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  // Build role manifest string
  const roleManifest = Object.entries(roleCounts)
    .map(([role, count]) => `${count} ${role}${count > 1 ? 's' : ''}`)
    .join(', ');

  // Get locations with features and connections
  const features = state.gameMapping.features || state.activeScenario.roomFeatures;
  const adjacency = state.activeScenario?.roomAdjacency || {};

  // Get all relationships
  const allRelationships = [];
  const processedPairs = new Set();

  state.gameMapping.suspects.forEach(suspectName => {
    const relationships = getSuspectRelationships(suspectName);
    relationships.forEach(rel => {
      // Create a unique key for this relationship pair (order-independent)
      const pairKey = [suspectName, rel.relatedTo].sort().join('|');
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);
        allRelationships.push({
          person1: suspectName,
          term1: rel.term,
          person2: rel.relatedTo,
          term2: rel.relatedTerm,
          type: rel.type
        });
      }
    });
  });

  // Helper to check if user has guessed a specific combination
  const hasGuess = (suspect, category, value) => {
    const guess = state.userGuesses[suspect];
    if (!guess) return false;
    return guess[category] === value;
  };

  // Helper to get shortened name (skip articles, keep meaningful words)
  const getShortName = (name, maxWords = 2) => {
    const words = name.split(' ');
    const articles = ['The', 'A', 'An'];
    let startIdx = 0;

    // Skip leading articles
    if (words.length > 1 && articles.includes(words[0])) {
      startIdx = 1;
    }

    return words.slice(startIdx, startIdx + maxWords).join(' ');
  };

  // Helper to get unique short names (expand words if duplicates exist)
  const getUniqueShortNames = (names, initialWords = 1) => {
    const result = names.map(name => ({
      original: name,
      short: getShortName(name, initialWords),
      wordCount: initialWords
    }));

    // Find duplicates and expand until unique
    let hasConflicts = true;
    while (hasConflicts) {
      hasConflicts = false;
      const counts = {};

      // Count occurrences
      result.forEach(item => {
        counts[item.short] = (counts[item.short] || 0) + 1;
      });

      // Expand conflicting names
      result.forEach(item => {
        if (counts[item.short] > 1) {
          const words = item.original.split(' ');
          const articles = ['The', 'A', 'An'];
          const startIdx = words.length > 1 && articles.includes(words[0]) ? 1 : 0;
          const maxAvailable = words.length - startIdx;

          if (item.wordCount < maxAvailable) {
            item.wordCount++;
            item.short = getShortName(item.original, item.wordCount);
            hasConflicts = true;
          }
        }
      });
    }

    return result.map(item => item.short);
  };

  // Generate a grid table
  const generateGrid = (title, rowLabel, rows, colLabel, cols, category, compact = false) => {
    const displayCols = compact ? cols.map(c => getShortName(c, 2)) : cols;
    const displayRows = compact ? getUniqueShortNames(rows, 1) : rows;

    return `
      <div class="grid-container">
        <h3 class="grid-title">${title}</h3>
        <table class="logic-grid">
          <thead>
            <tr>
              <th class="corner-cell">${compact ? '' : `${rowLabel} / ${colLabel}`}</th>
              ${displayCols.map((col, i) => `<th class="col-header">${compact ? `<span>${col}</span>` : col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${displayRows.map((row, rowIdx) => `
              <tr>
                <th class="row-header">${row}</th>
                ${cols.map((col, colIdx) => {
                  const isGuessed = hasGuess(rows[rowIdx], category, col);
                  return `<td class="grid-cell ${isGuessed ? 'pre-filled' : ''}"></td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  // Encode solution as compact number string for QR code
  const encodeSolution = () => {
    // Create solution string: for each suspect, encode item+room+role indices
    const solution = [];
    suspects.forEach((suspectName, suspectIdx) => {
      const truth = state.solution.truth.find(t => t.id === suspectIdx);
      if (truth) {
        solution.push(`${truth.itemId}${truth.roomId}${roles.indexOf(truth.role)}`);
      }
    });
    return solution.join('');
  };

  // Generate extra info section (locations + relationships)
  const generateExtra = () => {
    const locationsHTML = rooms.length > 0 ? `
      <div class="compact-list">
        <strong>Locations:</strong>
        <ul>
          ${rooms.map(r => {
            const roomName = typeof r === 'string' ? r : r.name;
            const connectedRooms = adjacency[roomName] || [];
            const activeConnections = connectedRooms.filter(name =>
              rooms.some(room => (typeof room === 'string' ? room : room.name) === name)
            );
            const roomFeatures = features[roomName] || [];

            const doors = activeConnections.length > 0
              ? `(${activeConnections.map(dest => `<i class="ph-light ph-door-open"></i> ${dest}`).join(', ')})`
              : '';
            const feats = roomFeatures.map(f => f.name).join(', ');
            const parts = [doors, feats].filter(Boolean).join(', ');

            return `<li><strong>${roomName}</strong>${parts ? ` ${parts}` : ''}</li>`;
          }).join('')}
        </ul>
      </div>
    ` : '';

    const relationshipsHTML = allRelationships.length > 0 ? `
      <div class="compact-list">
        <strong>Relationships:</strong>
        <ul>
          ${allRelationships.map(rel =>
            `<li>${rel.person1}/${rel.person2} (${rel.term1})</li>`
          ).join('')}
        </ul>
      </div>
    ` : '';

    if (!locationsHTML && !relationshipsHTML) return '';

    return `
      <div class="info-section">
        <div class="section-title">Extra</div>
        ${locationsHTML}
        ${relationshipsHTML}
      </div>
    `;
  };

  // Get case info
  const caseTitle = getCaseTitle();
  const numSuspects = state.gameMapping.suspects.length;
  const difficultyStars = getDifficultyStars(numSuspects, state.difficultyIcon || "star");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${caseTitle}</title>
  <link rel="stylesheet" href="fonts/phosphor/phosphor.css">
  <link rel="stylesheet" href="fonts/reforma.css">
  <link rel="stylesheet" href="fonts/monoid.css">
  <link rel="stylesheet" href="fonts/cinzel.css">
  <link rel="stylesheet" href="fonts/scenario-themes.css">
  <style>
    :root {
      --font-sans: ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    [data-theme="stellar_voyage"] { --font-sans: "Monoid", monospace; }
    [data-theme="classic_manor"] { --font-sans: "reforma", "Georgia", serif; }
    [data-theme="medieval"] { --font-sans: "Cinzel", "reforma", serif; }
    [data-theme="sherlock"] { --font-sans: "Playfair Display", "Georgia", serif; }
    [data-theme="gatsby"] { --font-sans: "Caviar Dreams", "Georgia", serif; }
    [data-theme="falcon"] { --font-sans: "Reforma", "Georgia", serif; }
    [data-theme="continental_express"] { --font-sans: "Libre Bodoni", "Didot", "Georgia", serif; }
    [data-theme="edge_walker"] { --font-sans: "Orbitron", "Arial", sans-serif; }
    [data-theme="radio_shrink"] { --font-sans: "Lato", "Helvetica Neue", sans-serif; }
    [data-theme="indigo_heir"] { --font-sans: "Quicksand", "Helvetica Neue", sans-serif; }
    [data-theme="shadow_protocol"] { --font-sans: "Monoid", "Courier New", monospace; }
  </style>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      padding: 0.5in;
      background: white;
      color: black;
    }

    .print-controls {
      position: fixed;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 0.5rem;
      z-index: 1000;
    }

    .print-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #333;
      background: white;
      cursor: pointer;
      font-size: 10pt;
      border-radius: 4px;
      font-family: 'Arial', sans-serif;
    }

    .print-btn:hover {
      background: #f0f0f0;
    }

    .print-btn:active {
      background: #e0e0e0;
    }

    .case-header {
      text-align: center;
      margin-bottom: 1rem;
      border-bottom: 2px solid #000;
      padding-bottom: 0.5rem;
    }

    .case-title {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 0.25rem;
      font-family: var(--font-sans);
    }

    .case-subtitle {
      font-size: 10pt;
      color: #000;
      font-weight: normal;
    }

    .info-section {
      margin-bottom: 1rem;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 0.25rem;
      border-bottom: 1px solid #666;
    }

    .compact-list {
      font-size: 9pt;
      margin-bottom: 0.5rem;
    }

    .compact-list ul {
      list-style: none;
      margin-top: 0.25rem;
    }

    .compact-list li {
      margin-bottom: 0.25rem;
    }

    .compact-list i {
      font-size: 1.2em;
      font-weight: bold;
    }

    .clues-section {
      margin-bottom: 1rem;
      page-break-inside: avoid;
    }

    .clues-title {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid #666;
    }

    .clues-list {
      list-style: none;
      font-size: 9pt;
    }

    .clue-item {
      margin-bottom: 0.25rem;
      display: flex;
      gap: 0.5rem;
    }

    .clue-number {
      font-weight: bold;
      min-width: 1.5rem;
    }

    .grid-container {
      margin-bottom: 1.5rem;
      page-break-inside: avoid;
    }

    .grid-title {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 0.5rem;
      text-align: center;
    }

    .logic-grid {
      width: 100%;
      border-collapse: collapse;
      margin: 0 auto;
      max-width: 100%;
    }

    .logic-grid th,
    .logic-grid td {
      border: 1px solid #333;
      text-align: center;
      padding: 0.15rem 0.25rem;
    }

    .corner-cell {
      background: #e0e0e0;
      font-size: 8pt;
      font-weight: bold;
    }

    .col-header,
    .row-header {
      background: #f5f5f5;
      font-size: 8pt;
      font-weight: bold;
    }

    .row-header {
      text-align: left;
      padding-left: 0.5rem;
    }

    .grid-cell {
      width: 1.5rem;
      height: 1.5rem;
      background: white;
    }

    .grid-cell.pre-filled {
      background: repeating-linear-gradient(
        45deg,
        #f0f0f0,
        #f0f0f0 2px,
        white 2px,
        white 4px
      );
    }

    @page portrait-page {
      size: A4 portrait;
      margin: 0.5in;
    }

    @page landscape-page {
      size: A4 landscape;
      margin: 0;
    }

    body:not(.compact-layout) {
      page: portrait-page;
    }

    body.compact-layout {
      page: landscape-page;
    }

    @media print {
      body:not(.compact-layout) {
        padding: 0.25in;
      }

      .grid-container {
        page-break-inside: avoid;
      }

      .clues-section {
        page-break-inside: avoid;
      }

      .print-controls {
        display: none;
      }
    }

    /* Compact Viking Map Layout */
    .pagelet {
      display: none;
    }

    body.compact-layout {
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(2, 1fr);
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      position: relative;
    }

    body.compact-layout > *:not(.print-controls):not(.cut-line):not(.pagelet) {
      display: none;
    }

    body.compact-layout .pagelet {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      border: 1px dashed #999;
      padding: 0.25in;
      overflow: hidden;
      font-size: 8pt;
      line-height: 1.3;
      position: relative;
    }

    body.compact-layout .pagelet-8 {
      padding: 0.2in;
    }

    body.compact-layout .pagelet.flipped {
      transform: rotate(180deg);
    }

    body.compact-layout .pagelet-content {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    body.compact-layout .page-number {
      position: absolute;
      bottom: 0.15in;
      left: 50%;
      transform: translateX(-50%);
      font-size: 7pt;
      color: #999;
      font-weight: normal;
      pointer-events: none;
    }

    body.compact-layout .grid-container {
      margin: 0;
    }

    body.compact-layout .grid-title {
      font-size: 9pt;
      margin-bottom: 0.25rem;
    }

    body.compact-layout .logic-grid {
      font-size: 6pt;
    }

    body.compact-layout .logic-grid th,
    body.compact-layout .logic-grid td {
      padding: 0.1rem 0.15rem;
    }

    body.compact-layout .col-header {
      width: 1.5em;
      max-width: 1.5em;
      height: 4rem;
      padding: 0.25rem 0.2rem;
      vertical-align: bottom;
      text-align: left;
      font-size: 6pt;
    }

    body.compact-layout .col-header > span {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      display: inline-block;
      white-space: nowrap;
      transform: rotate(180deg);
    }

    body.compact-layout .flipped .col-header > span {
      writing-mode: vertical-lr;
      transform: rotate(180deg);
    }

    body.compact-layout .grid-cell {
      width: 1rem;
      height: 1rem;
    }

    body.compact-layout .info-section {
      margin-bottom: 0.5rem;
    }

    body.compact-layout .section-title {
      font-size: 9pt;
      margin-bottom: 0.25rem;
    }

    body.compact-layout .compact-list {
      font-size: 7pt;
    }

    body.compact-layout .compact-list ul {
      margin-top: 0.15rem;
    }

    body.compact-layout .compact-list li {
      margin-bottom: 0.15rem;
    }

    body.compact-layout .clues-list {
      font-size: 6.5pt;
      line-height: 1.2;
    }

    body.compact-layout .clue-item {
      margin-bottom: 0.1rem;
      gap: 0.25rem;
    }

    body.compact-layout .clue-number {
      min-width: 1rem;
    }

    body.compact-layout .pagelet-8 h3 {
      font-size: 9pt;
      margin-bottom: 0.25rem;
    }

    body.compact-layout .cut-line {
      display: block;
      position: absolute;
      top: 50%;
      left: 25%;
      width: 50%;
      height: 2px;
      background: repeating-linear-gradient(
        90deg,
        #000 0px,
        #000 10px,
        transparent 10px,
        transparent 20px
      );
      transform: translateY(-1px);
      pointer-events: none;
      z-index: 999;
    }

    body.compact-layout .cut-line::before {
      content: '✂';
      position: absolute;
      left: 40%;
      top: -21px;
      transform: translateX(-50%);
      font-size: 24pt;
      color: #999;
    }

    .cut-line {
      display: none;
    }

    @media print {
      body.compact-layout {
        width: 297mm;
        height: 210mm;
        overflow: hidden;
        page-break-after: auto;
      }

      body.compact-layout .pagelet {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body data-theme="${state.activeScenario.id}">
  <div class="print-controls">
    <button class="print-btn" onclick="window.print()">Print</button>
    <button class="print-btn" onclick="switchLayout()">Switch Layout</button>
  </div>

  <div class="cut-line"></div>

  <div class="pagelet pagelet-1 flipped">
    <div class="pagelet-content">
      <!-- Page 7: Notes -->
      <h3>Notes</h3>
      <div class="page-number">7</div>
    </div>
  </div>
  <div class="pagelet pagelet-2 flipped">
    <div class="pagelet-content">
      <!-- Page 6: Grid 3 -->
      ${generateGrid('Suspects × Roles', 'Suspects', suspects, 'Roles', roles, 'role', true)}
      <div class="page-number">6</div>
    </div>
  </div>
  <div class="pagelet pagelet-3 flipped">
    <div class="pagelet-content">
      <!-- Page 5: Grid 2 -->
      ${generateGrid('Suspects × Locations', 'Suspects', suspects, 'Locations', roomNames, 'room', true)}
      <div class="page-number">5</div>
    </div>
  </div>
  <div class="pagelet pagelet-4 flipped">
    <div class="pagelet-content">
      <!-- Page 4: Grid 1 -->
      ${generateGrid('Suspects × Items', 'Suspects', suspects, 'Items', items, 'item', true)}
      <div class="page-number">4</div>
    </div>
  </div>
  <div class="pagelet pagelet-5">
    <div class="pagelet-content">
      <!-- Page 8: Back with QR solution -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 0.25rem;">
        <h3 style="font-size: 9pt; font-weight: bold; margin: 0;">Solution</h3>
        <img src="${qrCompactDataURL}" style="border: 2px solid #ccc; padding: 0.25rem; background: white; max-width: 120px; height: auto;" alt="Solution QR Code" />
        <p style="font-size: 5.5pt; color: #666; text-align: center; line-height: 1.2; max-width: 140px;">
          3 lines: items | rooms | roles<br>(indices per suspect)
        </p>
      </div>
    </div>
  </div>
  <div class="pagelet pagelet-6">
    <div class="pagelet-content">
      <!-- Page 1: Cover -->
      <div style="text-align: center; padding-top: 25%;">
        <h2 style="font-size: 14pt; line-height: 1.3; font-family: var(--font-sans);">${caseTitle}</h2>
        <p style="margin-top: 0.5rem; font-size: 8pt;">${difficultyStars}</p>
        <p style="margin-top: 1rem; font-size: 7pt; font-family: 'Monoid', monospace; color: #666;">mostlymaths.net/murder-it-wrote</p>
      </div>
    </div>
  </div>
  <div class="pagelet pagelet-7">
    <div class="pagelet-content">
      <!-- Page 2: Manifest + Extra -->
      <div style="margin-bottom: 0.5rem; font-size: 7pt;"><strong>Manifest:</strong> ${roleManifest}</div>
      ${generateExtra()}
      <div class="page-number">2</div>
    </div>
  </div>
  <div class="pagelet pagelet-8">
    <div class="pagelet-content">
      <!-- Page 3: Clues -->
      <h3 style="font-size: 10pt; margin-bottom: 0.5rem;">Evidence</h3>
      <ul class="clues-list">
        ${clues.map(clue => `
          <li class="clue-item">
            <span class="clue-number">${clue.number}.</span>
            <span class="clue-text">${clue.text}</span>
          </li>
        `).join('')}
      </ul>
      <div class="page-number">3</div>
    </div>
  </div>

  <div class="case-header">
    <div class="case-title">${caseTitle}</div>
    <div class="case-subtitle">Manifest: ${roleManifest} ${difficultyStars}</div>
    <div style="font-size: 8pt; font-family: 'Monoid', monospace; color: #999; margin-top: 0.25rem;">mostlymaths.net/murder-it-wrote</div>
  </div>

  ${generateExtra()}

  <div class="clues-section">
    <div class="clues-title">Evidence</div>
    <ul class="clues-list">
      ${clues.map(clue => `
        <li class="clue-item">
          <span class="clue-number">${clue.number}.</span>
          <span class="clue-text">${clue.text}</span>
        </li>
      `).join('')}
    </ul>
  </div>

  ${generateGrid('Suspects × Items', 'Suspects', suspects, 'Items', items, 'item', false)}
  ${generateGrid('Suspects × Locations', 'Suspects', suspects, 'Locations', roomNames, 'room', false)}
  ${generateGrid('Suspects × Roles', 'Suspects', suspects, 'Roles', roles, 'role', false)}

  <div style="text-align: center; margin: 2rem 0 1rem 0; page-break-inside: avoid;">
    <h3 style="font-size: 11pt; font-weight: bold; margin-bottom: 0.5rem;">Solution</h3>
    <img src="${qrNormalDataURL}" style="border: 2px solid #ccc; padding: 0.5rem; background: white; max-width: 150px; height: auto;" alt="Solution QR Code" />
    <p style="font-size: 8pt; color: #666; margin-top: 0.5rem; line-height: 1.3;">
      QR format: 3 lines (items | rooms | roles)<br>
      Each digit = index per suspect, in order
    </p>
  </div>

  <script>
    let isCompactLayout = false;

    function switchLayout() {
      isCompactLayout = !isCompactLayout;
      const body = document.body;

      if (isCompactLayout) {
        body.classList.add('compact-layout');
      } else {
        body.classList.remove('compact-layout');
      }
    }
  </script>
</body>
</html>
  `;

  return html;
}

export function openPrintMode() {
  haptic();

  // Generate QR codes in the main page first
  const suspects = state.gameMapping.suspects;
  const roles = [...new Set(state.solution.roles)];

  // Encode solution as 3 separate number strings for QR code
  const encodeSolution = () => {
    const items = [];
    const rooms = [];
    const roleIndices = [];

    suspects.forEach((suspectName, suspectIdx) => {
      const truth = state.solution.truth.find(t => t.id === suspectIdx);
      if (truth) {
        items.push(truth.itemId);
        rooms.push(truth.roomId);
        roleIndices.push(roles.indexOf(truth.role));
      }
    });

    // Return 3 lines: items, rooms, roles
    return `${items.join('')}\n${rooms.join('')}\n${roleIndices.join('')}`;
  };

  const solutionCode = encodeSolution();

  // Create temporary containers for QR code generation
  const tempContainerNormal = document.createElement('div');
  tempContainerNormal.style.position = 'absolute';
  tempContainerNormal.style.left = '-9999px';
  document.body.appendChild(tempContainerNormal);

  const tempContainerCompact = document.createElement('div');
  tempContainerCompact.style.position = 'absolute';
  tempContainerCompact.style.left = '-9999px';
  document.body.appendChild(tempContainerCompact);

  // Generate QR codes
  if (typeof QRCode === 'undefined') {
    alert('QR Code library not loaded. Please refresh the page.');
    document.body.removeChild(tempContainerNormal);
    document.body.removeChild(tempContainerCompact);
    return;
  }

  const qrNormal = new QRCode(tempContainerNormal, {
    text: solutionCode,
    width: 150,
    height: 150,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  const qrCompact = new QRCode(tempContainerCompact, {
    text: solutionCode,
    width: 120,
    height: 120,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  // Wait a moment for QR codes to render, then extract as data URLs
  setTimeout(() => {
    const canvasNormal = tempContainerNormal.querySelector('canvas');
    const canvasCompact = tempContainerCompact.querySelector('canvas');

    if (!canvasNormal || !canvasCompact) {
      alert('Failed to generate QR codes. Please try again.');
      document.body.removeChild(tempContainerNormal);
      document.body.removeChild(tempContainerCompact);
      return;
    }

    const qrNormalDataURL = canvasNormal.toDataURL('image/png');
    const qrCompactDataURL = canvasCompact.toDataURL('image/png');

    // Clean up temporary containers
    document.body.removeChild(tempContainerNormal);
    document.body.removeChild(tempContainerCompact);

    // Open print window with QR data URLs
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to open the print view');
      return;
    }

    const html = generatePrintablePage(qrNormalDataURL, qrCompactDataURL);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }, 100);
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
window.openPrintMode = openPrintMode;
