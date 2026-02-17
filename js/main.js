import { state, updateState, pickRandomScenario } from "./game-state.js";
import { initRng, getSeed, codeToSeed, seedToCode } from "./rng.js";
import { SCENARIOS } from "./constants.js";
import { handleNewCase } from "./generator.js";
import {
  renderUI,
  renderLocations,
  verifySolution,
  revealSolution,
  toggleDebug,
  addLog,
  performReveal,
  closeRevealModal,
  showNewCaseModal,
  closeNewCaseModal,
  hasUserProgress,
  getCaseSize,
  openPrintMode,
} from "./ui.js";
import { loadGame, clearGame } from "./persistence.js";
import { haptic } from "./haptic.js";

document.addEventListener("DOMContentLoaded", async () => {
  const uiCallbacks = { addLog, renderUI };

  // Check for saved game
  const savedGame = await loadGame();

  // --- Intro Flow ---
  const beginInvestigation = async (restore = false, presetSeed = null) => {
    const overlay = document.getElementById("transition-overlay");
    if (overlay) {
      overlay.classList.remove("hidden");
      overlay.classList.add("active");
    }

    document.getElementById("intro-screen").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");

    if (restore && savedGame) {
      addLog("Restoring investigation...", "system");
      initRng(savedGame.seed);
      updateState({ seed: getSeed() });
      await handleNewCase(uiCallbacks, savedGame);
    } else {
      addLog("Beginning investigation...", "system");
      initRng(presetSeed); // null → random seed
      updateState({ seed: getSeed(), activeScenario: pickRandomScenario() });
      await handleNewCase(uiCallbacks);
    }
  };

  // Update intro screen based on saved game
  const introButtons = document.getElementById("intro-buttons");
  const startBtn = document.getElementById("btn-start");

  if (savedGame) {
    // Apply saved theme to intro screen for font styling
    document.body.dataset.theme = savedGame.activeScenario.id;

    // Get saved sizing word and mystery word
    const sizeWord = savedGame.sizingWord || "Mysterious";
    const mysteryWord = savedGame.mysteryWord || "Mystery";

    // Show Continue and New Case buttons
    introButtons.classList.add("has-saved-game");
    startBtn.innerHTML = `
      <i class="ph-light ph-sign-in"></i>
      <span>CONTINUE</span>
      <span class="scenario-subtitle">${sizeWord} ${savedGame.scenarioName || savedGame.activeScenario.name} ${mysteryWord}</span>
    `;

    const newCaseBtn = document.createElement("button");
    newCaseBtn.id = "btn-new-case-intro";
    newCaseBtn.className = "btn-new-case";
    newCaseBtn.innerHTML = `
      <i class="ph-light ph-magic-wand"></i>
      <span>NEW CASE</span>
    `;
    introButtons.appendChild(newCaseBtn);

    // Continue button
    startBtn.addEventListener("click", () => {
      haptic();
      beginInvestigation(true);
    });

    // New Case button
    newCaseBtn.addEventListener("click", async () => {
      haptic();
      await clearGame();
      beginInvestigation(false);
    });
  } else {
    // Show only Begin button (default)
    startBtn.addEventListener("click", () => {
      haptic();
      beginInvestigation(false);
    });
  }

  // --- Global Test Hook ---
  window.miw = {
    getSeed: () => getSeed(),
    playWithSeed: (seed) => performNewCaseWithSeed(seed),
    select: async (id) => {
      const s = SCENARIOS.find((x) => x.id === id);
      if (s) {
        updateState({ activeScenario: s });
        document.getElementById("intro-screen").classList.add("hidden");
        document.getElementById("app-container").classList.remove("hidden");
        await handleNewCase(uiCallbacks);
        addLog(`Manual Scenario Select: ${s.name}`, "system");
      } else {
        console.warn(`Scenario "${id}" not found.`);
      }
    },
  };

  // --- Drawer Logic ---
  const nd = document.getElementById("notebook-drawer"),
    nt = document.getElementById("notebook-tab");
  let no = false;
  if (nt && nd) {
    nt.addEventListener("click", () => {
      if (window.innerWidth >= 1200) return;
      haptic();
      no = !no;
      nd.style.transform = `translate3d(${no ? 0 : 100}%,0,0)`;
      addLog(`Notebook drawer: ${no ? "opened" : "closed"}`, "system");
    });
  }

  const ld = document.getElementById("locations-drawer"),
    lt = document.getElementById("locations-tab");
  let lo = false;
  if (lt && ld) {
    lt.addEventListener("click", () => {
      if (window.innerWidth >= 1200) return;
      haptic();
      lo = !lo;
      ld.style.transform = `translate3d(${lo ? 0 : -100}%,0,0)`;
      addLog(`Locations drawer: ${lo ? "opened" : "closed"}`, "system");
    });
  }

  // --- Button Bindings ---
  const performNewCase = async () => {
    await clearGame(); // Clear save before new case
    addLog("Generating new case...", "system");
    initRng();
    updateState({ seed: getSeed(), activeScenario: pickRandomScenario() });
    handleNewCase(uiCallbacks);
  };

  const performNewCaseWithSeed = async (seed) => {
    await clearGame();
    initRng(seed);
    addLog(`Generating case ${seedToCode(getSeed())}...`, "system");
    updateState({ seed: getSeed(), activeScenario: pickRandomScenario() });
    handleNewCase(uiCallbacks);
  };

  // --- Seed input in debug panel ---
  const seedEl = document.getElementById("debug-seed");
  if (seedEl) {
    seedEl.addEventListener("focus", () => {
      const range = document.createRange();
      range.selectNodeContents(seedEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    seedEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const seed = codeToSeed(seedEl.textContent.trim());
        if (seed != null) {
          seedEl.blur();
          document.getElementById("debug-overlay").classList.add("hidden");
          performNewCaseWithSeed(seed);
        }
      }
    });
  }

  const newCaseBtn = document.getElementById("btn-new-case");
  if (newCaseBtn) {
    newCaseBtn.addEventListener("click", () => {
      haptic();
      // Check if user has made progress
      if (hasUserProgress()) {
        showNewCaseModal();
      } else {
        performNewCase();
      }
    });
  }

  document.getElementById("btn-verify")?.addEventListener("click", () => {
    haptic();
    verifySolution();
  });
  document.getElementById("btn-print")?.addEventListener("click", () => {
    haptic();
    openPrintMode();
  });
  document.getElementById("btn-reveal")?.addEventListener("click", () => {
    haptic();
    revealSolution();
  });
  document
    .getElementById("btn-reveal-confirm")
    ?.addEventListener("click", () => {
      haptic();
      performReveal();
    });
  document
    .getElementById("btn-reveal-cancel")
    ?.addEventListener("click", () => {
      haptic();
      closeRevealModal();
    });
  document
    .getElementById("btn-new-case-confirm")
    ?.addEventListener("click", () => {
      haptic();
      closeNewCaseModal();
      performNewCase();
    });
  document
    .getElementById("btn-new-case-cancel")
    ?.addEventListener("click", () => {
      haptic();
      closeNewCaseModal();
    });
  document
    .getElementById("btn-debug-pi")
    ?.addEventListener("click", toggleDebug);
  document.getElementById("btn-exit")?.addEventListener("click", () => {
    haptic();
    // Return to intro screen
    document.getElementById("app-container").classList.add("hidden");
    document.getElementById("intro-screen").classList.remove("hidden");
    addLog("Returned to menu", "system");
  });

  // Initial render
  renderLocations();

  // Intro scroll-hint fade
  const introScreen = document.getElementById("intro-screen");
  const syncIntroScroll = () => {
    const overflows = introScreen.scrollHeight > introScreen.clientHeight + 2;
    const atBottom =
      introScreen.scrollTop + introScreen.clientHeight >=
      introScreen.scrollHeight - 4;
    introScreen.classList.toggle("has-overflow", overflows);
    introScreen.classList.toggle("at-bottom", atBottom && overflows);
  };
  introScreen.addEventListener("scroll", syncIntroScroll, { passive: true });
  window.addEventListener("resize", syncIntroScroll);
  syncIntroScroll();

  // Fetch and display version from manifest.json
  fetch("manifest.json")
    .then((res) => res.json())
    .then((manifest) => {
      const versionDisplay = document.getElementById("intro-version");
      if (versionDisplay && manifest.version) {
        versionDisplay.textContent = `v${manifest.version}`;
      }
    })
    .catch((err) => {
      console.warn("Could not load version from manifest:", err);
    });

  // Solution modal handler
  const solutionModal = document.getElementById("solution-modal");
  const solutionDisplay = document.getElementById("solution-display");
  const closeSolutionBtn = document.getElementById("btn-solution-close");

  // Check for solution / play hash
  const checkSolutionHash = async () => {
    const hash = window.location.hash;

    if (hash.startsWith("#play:")) {
      // Format: #play:CODE-items-rooms-roles
      const data = hash.substring(6);
      const parts = data.split("-");
      history.replaceState(null, null, window.location.pathname);

      if (parts.length === 4) {
        const [seedCode, items, locations, roles] = parts;
        const seed = codeToSeed(seedCode);

        solutionDisplay.innerHTML = `
          <div style="margin-bottom: 0.75rem; font-family: var(--font-mono); font-size: 0.875rem; color: var(--text-muted);">
            Game code: <strong style="color: var(--accent); letter-spacing: 0.05em;">${seedCode}</strong>
          </div>
          <div style="margin-bottom: 0.75rem;">
            <strong style="color: var(--accent);">Items:</strong> ${items.split("").join(" ")}
          </div>
          <div style="margin-bottom: 0.75rem;">
            <strong style="color: var(--accent);">Locations:</strong> ${locations.split("").join(" ")}
          </div>
          <div>
            <strong style="color: var(--accent);">Roles:</strong> ${roles.split("").join(" ")}
          </div>
        `;
        solutionModal.classList.remove("hidden");

        // Auto-start the game with this seed so the player can continue digitally
        if (seed != null) {
          await clearGame();
          await beginInvestigation(false, seed);
        }
      }
    } else if (hash.startsWith("#solution:")) {
      // Legacy format: #solution:items-rooms-roles
      const solutionData = hash.substring(10);
      const parts = solutionData.split("-");
      history.replaceState(null, null, window.location.pathname);

      if (parts.length === 3) {
        const [items, locations, roles] = parts;

        solutionDisplay.innerHTML = `
          <div style="margin-bottom: 0.75rem;">
            <strong style="color: var(--accent);">Items:</strong> ${items.split("").join(" ")}
          </div>
          <div style="margin-bottom: 0.75rem;">
            <strong style="color: var(--accent);">Locations:</strong> ${locations.split("").join(" ")}
          </div>
          <div>
            <strong style="color: var(--accent);">Roles:</strong> ${roles.split("").join(" ")}
          </div>
        `;
        solutionModal.classList.remove("hidden");
      }
    }
  };

  // Close solution modal
  closeSolutionBtn?.addEventListener("click", () => {
    haptic();
    solutionModal.classList.add("hidden");
  });

  // Check on load
  await checkSolutionHash();

  // Check when hash changes
  window.addEventListener("hashchange", checkSolutionHash);
});
