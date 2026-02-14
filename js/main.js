import { state, updateState, pickRandomScenario } from "./game-state.js";
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
} from "./ui.js";
import { loadGame, clearGame } from "./persistence.js";

document.addEventListener("DOMContentLoaded", async () => {
  const uiCallbacks = { addLog, renderUI };

  // Check for saved game
  const savedGame = await loadGame();

  // --- Intro Flow ---
  const beginInvestigation = async (restore = false) => {
    const overlay = document.getElementById("transition-overlay");
    if (overlay) {
      overlay.classList.remove("hidden");
      overlay.classList.add("active");
    }

    document.getElementById("intro-screen").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");

    if (restore && savedGame) {
      addLog("Restoring investigation...", "system");
      await handleNewCase(uiCallbacks, savedGame);
    } else {
      addLog("Beginning investigation...", "system");
      updateState({ activeScenario: pickRandomScenario() });
      await handleNewCase(uiCallbacks);
    }
  };

  // Update intro screen based on saved game
  const introButtons = document.getElementById("intro-buttons");
  const startBtn = document.getElementById("btn-start");

  if (savedGame) {
    // Apply saved theme to intro screen for font styling
    document.body.dataset.theme = savedGame.activeScenario.id;

    // Show Continue and New Case buttons
    introButtons.classList.add("has-saved-game");
    startBtn.innerHTML = `
      <i class="ph-light ph-sign-in"></i>
      <span>CONTINUE</span>
      <span class="scenario-subtitle">${savedGame.activeScenario.name}</span>
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
    startBtn.addEventListener("click", () => beginInvestigation(true));

    // New Case button
    newCaseBtn.addEventListener("click", async () => {
      await clearGame();
      beginInvestigation(false);
    });
  } else {
    // Show only Begin button (default)
    startBtn.addEventListener("click", () => beginInvestigation(false));
  }

  // --- Global Test Hook ---
  window.miw = {
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
      lo = !lo;
      ld.style.transform = `translate3d(${lo ? 0 : -100}%,0,0)`;
      addLog(`Locations drawer: ${lo ? "opened" : "closed"}`, "system");
    });
  }

  // --- Button Bindings ---
  const newCaseBtn = document.getElementById("btn-new-case");
  if (newCaseBtn) {
    newCaseBtn.addEventListener("click", async () => {
      await clearGame(); // Clear save before new case
      addLog("Generating new case...", "system");
      updateState({ activeScenario: pickRandomScenario() });
      handleNewCase(uiCallbacks);
    });
  }

  document
    .getElementById("btn-verify")
    ?.addEventListener("click", verifySolution);
  document
    .getElementById("btn-reveal")
    ?.addEventListener("click", revealSolution);
  document
    .getElementById("btn-reveal-confirm")
    ?.addEventListener("click", performReveal);
  document
    .getElementById("btn-reveal-cancel")
    ?.addEventListener("click", closeRevealModal);
  document
    .getElementById("btn-debug-pi")
    ?.addEventListener("click", toggleDebug);

  // Initial render
  renderLocations();

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
});
