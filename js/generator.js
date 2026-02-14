import { IDS, MYSTERY_WORDS, DIFFICULTY_ICONS } from "./constants.js";
import { LogicEngine } from "./logic-engine.js";
import { state, updateState } from "./game-state.js";

const FACT_TYPES = {
  SUSPECT_LOCATION: "SUSPECT_LOCATION",
  SUSPECT_ITEM: "SUSPECT_ITEM",
  SUSPECT_ROLE: "SUSPECT_ROLE",
  SUSPECT_NOT_ROLE: "SUSPECT_NOT_ROLE",
  SUSPECT_LOCATION_ITEM: "SUSPECT_LOCATION_ITEM",
  ROOM_ITEM: "ROOM_ITEM",
  ROOM_EMPTY: "ROOM_EMPTY",
  ITEM_NOT_MURDER_WEAPON: "ITEM_NOT_MURDER_WEAPON",
  ROOM_NOT_CORPSE: "ROOM_NOT_CORPSE",
  ROLE_EXCLUSION: "ROLE_EXCLUSION",
};

const getVal = (a, id, type) => a[`${id}_${type}`];
const checkVal = (a, subId, type, val) => getVal(a, subId, type) === val;

export function generateTruth(numSuspects) {
  const activeRoles = ["Killer", "Victim"];
  if (Math.random() > 0.6) activeRoles.push("Witness");
  if (Math.random() > 0.7) activeRoles.push("Accomplice");
  while (activeRoles.length < numSuspects) activeRoles.push("Innocent");

  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sRoles = shuffle([...activeRoles]);
  const sItems = shuffle([...Array(numSuspects).keys()]);
  const sRooms = Array.from({ length: numSuspects }, () =>
    Math.floor(Math.random() * numSuspects),
  );

  // Force Witness to be in the same room as the Victim
  const vIdx = sRoles.indexOf("Victim");
  const wIdx = sRoles.indexOf("Witness");
  if (vIdx !== -1 && wIdx !== -1) {
    sRooms[wIdx] = sRooms[vIdx];
  }

  const truth = Array.from({ length: numSuspects }, (_, id) => ({
    id,
    roomId: sRooms[id],
    itemId: sItems[id],
    role: sRoles[id],
  }));
  return { truth, roles: sRoles };
}

function generateSuspectFacts(truth, roles) {
  const facts = [];

  // Validate all truth entries first
  const hasInvalidEntries = truth.some(p =>
    p.id === undefined || p.roomId === undefined || p.itemId === undefined || p.role === undefined
  );

  if (hasInvalidEntries) {
    console.error("Invalid truth entries detected in generateSuspectFacts");
    console.error("Full truth array:", truth);
    throw new Error("CORRUPT_TRUTH_DATA");
  }

  truth.forEach((p) => {

    facts.push({
      type: FACT_TYPES.SUSPECT_LOCATION,
      suspectId: p.id,
      roomId: p.roomId,
    });
    facts.push({
      type: FACT_TYPES.SUSPECT_ITEM,
      suspectId: p.id,
      itemId: p.itemId,
    });

    if (!["Killer", "Victim"].includes(p.role)) {
      facts.push({
        type: FACT_TYPES.SUSPECT_ROLE,
        suspectId: p.id,
        role: p.role,
      });
    }

    ["Killer", "Victim"].forEach((bad) => {
      if (p.role !== bad) {
        facts.push({
          type: FACT_TYPES.SUSPECT_NOT_ROLE,
          suspectId: p.id,
          role: bad,
        });
      }
    });
  });
  return facts;
}

function generateRoomFacts(truth, numSuspects) {
  const facts = [];
  for (let rid = 0; rid < numSuspects; rid++) {
    const residents = truth.filter((p) => p.roomId === rid);
    if (residents.length === 1) {
      facts.push({
        type: FACT_TYPES.ROOM_ITEM,
        roomId: rid,
        itemId: residents[0].itemId,
      });
    } else if (residents.length === 0) {
      facts.push({ type: FACT_TYPES.ROOM_EMPTY, roomId: rid });
    }

    // ROOM_NOT_CORPSE: True if the Victim was NOT in this room
    if (!residents.some((r) => r.role === "Victim")) {
      facts.push({ type: FACT_TYPES.ROOM_NOT_CORPSE, roomId: rid });
    }
  }
  return facts;
}

function generateItemFacts(truth, numSuspects) {
  const facts = [];
  for (let iid = 0; iid < numSuspects; iid++) {
    const owner = truth.find((p) => p.itemId === iid);
    // ITEM_NOT_MURDER_WEAPON: True if the Killer does NOT have this item
    if (owner && owner.role !== "Killer") {
      facts.push({ type: FACT_TYPES.ITEM_NOT_MURDER_WEAPON, itemId: iid });
    }
  }
  return facts;
}

function mergeFacts(facts) {
  const merged = [];
  const suspectFacts = {}; // Maps suspectId to { location, item, notKiller, notVictim }

  facts.forEach((f) => {
    if (f.type === FACT_TYPES.SUSPECT_LOCATION) {
      if (!suspectFacts[f.suspectId]) suspectFacts[f.suspectId] = {};
      suspectFacts[f.suspectId].location = f;
    } else if (f.type === FACT_TYPES.SUSPECT_ITEM) {
      if (!suspectFacts[f.suspectId]) suspectFacts[f.suspectId] = {};
      suspectFacts[f.suspectId].item = f;
    } else if (f.type === FACT_TYPES.SUSPECT_NOT_ROLE) {
      if (!suspectFacts[f.suspectId]) suspectFacts[f.suspectId] = {};
      if (f.role === "Killer") suspectFacts[f.suspectId].notKiller = f;
      else if (f.role === "Victim") suspectFacts[f.suspectId].notVictim = f;
      else merged.push(f);
    } else {
      merged.push(f);
    }
  });

  Object.keys(suspectFacts).forEach((sidStr) => {
    const sid = parseInt(sidStr);
    const { location, item, notKiller, notVictim } = suspectFacts[sid];

    // 1. Double Exclusion Merge
    if (notKiller && notVictim) {
      merged.push({ type: FACT_TYPES.ROLE_EXCLUSION, suspectId: sid });
    } else {
      if (notKiller) merged.push(notKiller);
      if (notVictim) merged.push(notVictim);
    }

    // 2. Location/Item Merge
    if (location && item) {
      merged.push({
        type: FACT_TYPES.SUSPECT_LOCATION_ITEM,
        suspectId: sid,
        roomId: location.roomId,
        itemId: item.itemId,
      });
    } else {
      if (location) merged.push(location);
      if (item) merged.push(item);
    }
  });

  return merged;
}

function renderFact(fact, mapping, roles) {
  const numSuspects = mapping.suspects.length;

  // Generate stable ID based on fact properties
  const generateStableId = (fact) => {
    const props = [
      fact.type,
      fact.suspectId ?? "",
      fact.roomId ?? "",
      fact.itemId ?? "",
      fact.role ?? "",
    ].join("-");
    // Simple hash function for deterministic IDs
    let hash = 0;
    for (let i = 0; i < props.length; i++) {
      const char = props.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  };

  const fmt = (type, id) => {
    const item = mapping[type][id];
    const rawName = typeof item === "string" ? item : item.name;
    const className =
      type === "suspects" ? "person" : type === "items" ? "item" : "room";
    return `<span class="entity-${className}">${rawName}</span>`;
  };
  const fmtRoom = (rid) => {
    const r = mapping.rooms[rid];
    if (!r) return "a mysterious room";
    const name = r.isProper ? r.name : r.name.toLowerCase();
    const rName = `<span class="entity-room">${name}</span>`;
    return r.noArticle ? rName : `the ${rName}`;
  };
  const fmtItem = (iid) => {
    const item = mapping.items[iid];
    const name = item.isProper ? item.name : item.name.toLowerCase();
    const iText = `<span class="entity-item">${name}</span>`;
    return item.isProper ? iText : `the ${iText}`;
  };
  const wrapRole = (r) => `<span class="entity-role">${r}</span>`;
  let text,
    fn,
    masks = [];

  switch (fact.type) {
    case FACT_TYPES.SUSPECT_LOCATION: {
      const name = fmt("suspects", fact.suspectId);
      const rObj = mapping.rooms[fact.roomId];

      if (!rObj) {
        console.error(`Invalid roomId ${fact.roomId} in fact:`, fact);
        text = `${name} was found in an unknown location.`;
        fn = () => true;
        break;
      }

      const feats = mapping.features[rObj.name] || [];

      if (feats.length > 0 && Math.random() > 0.5) {
        const feat = feats[Math.floor(Math.random() * feats.length)];
        text = `${name} was close to the ${feat}.`;
      } else {
        const rText = fmtRoom(fact.roomId);
        text = `${name} was in ${rText}.`;
      }

      fn = (a) => checkVal(a, fact.suspectId, "Room", fact.roomId);
      masks = [
        { varIdx: 2 * numSuspects + fact.suspectId, mask: 1 << fact.roomId },
      ];
      break;
    }
    case FACT_TYPES.SUSPECT_ITEM: {
      const name = fmt("suspects", fact.suspectId);
      const item = fmtItem(fact.itemId);
      text = `${name} had ${item}.`;
      fn = (a) => checkVal(a, fact.suspectId, "Item", fact.itemId);
      masks = [
        { varIdx: numSuspects + fact.suspectId, mask: 1 << fact.itemId },
      ];
      break;
    }
    case FACT_TYPES.SUSPECT_LOCATION_ITEM: {
      const name = fmt("suspects", fact.suspectId);
      const rText = fmtRoom(fact.roomId);
      const item = fmtItem(fact.itemId);
      text = `${name} was in ${rText} with ${item}.`;
      fn = (a) =>
        checkVal(a, fact.suspectId, "Room", fact.roomId) &&
        checkVal(a, fact.suspectId, "Item", fact.itemId);
      masks = [
        { varIdx: 2 * numSuspects + fact.suspectId, mask: 1 << fact.roomId },
        { varIdx: numSuspects + fact.suspectId, mask: 1 << fact.itemId },
      ];
      break;
    }
    case FACT_TYPES.SUSPECT_ROLE: {
      const name = fmt("suspects", fact.suspectId);
      const roleIndices = roles
        .map((r, i) => (r === fact.role ? i : -1))
        .filter((i) => i !== -1);
      let roleMask = 0;
      roleIndices.forEach((i) => (roleMask |= 1 << i));
      let rText =
        fact.role === "Innocent"
          ? "innocent"
          : `the ${wrapRole(fact.role.toLowerCase())}`;
      text = `${name} is ${rText}.`;
      fn = (a) => checkVal(a, fact.suspectId, "Role", fact.role);
      masks = [{ varIdx: fact.suspectId, mask: roleMask }];
      break;
    }
    case FACT_TYPES.SUSPECT_NOT_ROLE: {
      const name = fmt("suspects", fact.suspectId);
      const badIndices = roles
        .map((r, i) => (r === fact.role ? i : -1))
        .filter((i) => i !== -1);
      let badMask = 0;
      badIndices.forEach((i) => (badMask |= 1 << i));
      text = `${name} is not the ${wrapRole(fact.role.toLowerCase())}.`;
      fn = (a) => getVal(a, fact.suspectId, "Role") !== fact.role;
      masks = [{ varIdx: fact.suspectId, mask: ~badMask }];
      break;
    }
    case FACT_TYPES.ROOM_ITEM: {
      const rText = fmtRoom(fact.roomId);
      const item = fmtItem(fact.itemId);
      text = `The person in ${rText} had ${item}.`;
      fn = (a) => {
        const occupants = Array.from({ length: numSuspects }, (_, i) => i);
        const r = occupants.filter((i) => getVal(a, i, "Room") === fact.roomId);
        return (
          r.length > 0 && r.some((id) => checkVal(a, id, "Item", fact.itemId))
        );
      };
      break;
    }
    case FACT_TYPES.ROOM_EMPTY: {
      const rText = fmtRoom(fact.roomId);
      const rObj = mapping.rooms[fact.roomId];

      if (!rObj) {
        console.error(`Invalid roomId ${fact.roomId} in ROOM_EMPTY fact:`, fact);
        text = `An unknown location was empty.`;
        fn = () => true;
        break;
      }

      if (Math.random() > 0.5) {
        // "The Kitchen was empty."
        text = `${rText.charAt(0).toUpperCase() + rText.slice(1)} was empty.`;
      } else {
        // "There was nobody at the Kitchen" or "There was nobody at Kitchen"
        const name = rObj.isProper ? rObj.name : rObj.name.toLowerCase();
        const rName = `<span class="entity-room">${name}</span>`;
        const atLocation = rObj.noArticle ? rName : `the ${rName}`;
        text = `There was nobody at ${atLocation}.`;
      }

      fn = (a) => {
        for (let i = 0; i < numSuspects; i++)
          if (getVal(a, i, "Room") === fact.roomId) return false;
        return true;
      };
      masks = Array.from({ length: numSuspects }, (_, pid) => ({
        varIdx: 2 * numSuspects + pid,
        mask: ~(1 << fact.roomId),
      }));
      break;
    }
    case FACT_TYPES.ITEM_NOT_MURDER_WEAPON: {
      const item = fmtItem(fact.itemId);
      const capItem = item.charAt(0).toUpperCase() + item.slice(1);
      text = `${capItem} was not the murder weapon.`;
      fn = (a) => {
        const owner = Array.from({ length: numSuspects }, (_, i) => i).find(
          (pid) => checkVal(a, pid, "Item", fact.itemId),
        );
        return owner !== undefined && getVal(a, owner, "Role") !== "Killer";
      };
      break;
    }
    case FACT_TYPES.ROOM_NOT_CORPSE: {
      const rText = fmtRoom(fact.roomId);
      text = `There is no corpse in ${rText}.`;
      fn = (a) => {
        const occupants = Array.from({ length: numSuspects }, (_, i) => i);
        const suspectsInRoom = occupants.filter((pid) =>
          checkVal(a, pid, "Room", fact.roomId),
        );
        return suspectsInRoom.every(
          (pid) => getVal(a, pid, "Role") !== "Victim",
        );
      };
      break;
    }
    case FACT_TYPES.ROLE_EXCLUSION: {
      const name = fmt("suspects", fact.suspectId);
      text = `${name} is neither the ${wrapRole("killer")} nor the ${wrapRole("victim")}.`;
      fn = (a) =>
        getVal(a, fact.suspectId, "Role") !== "Killer" &&
        getVal(a, fact.suspectId, "Role") !== "Victim";
      const kIndices = roles
        .map((r, i) => (r === "Killer" ? i : -1))
        .filter((i) => i !== -1);
      const vIndices = roles
        .map((r, i) => (r === "Victim" ? i : -1))
        .filter((i) => i !== -1);
      let mask = 0;
      kIndices.forEach((i) => (mask |= 1 << i));
      vIndices.forEach((i) => (mask |= 1 << i));
      masks = [{ varIdx: fact.suspectId, mask: ~mask }];
      break;
    }
  }

  return { text, fn, masks, id: generateStableId(fact) };
}

export function generateClues(truth, roles, numSuspects) {
  return [
    ...generateSuspectFacts(truth, roles),
    ...generateRoomFacts(truth, numSuspects),
    ...generateItemFacts(truth, numSuspects),
  ];
}

export async function handleNewCase(uiCallbacks, restoredState = null) {
  const { addLog, renderUI } = uiCallbacks;
  if (state.isGenerating) return;

  // Handle restoration path
  if (restoredState) {
    updateState({
      activeScenario: restoredState.activeScenario,
      gameMapping: restoredState.gameMapping,
      solution: restoredState.solution,
      mysteryWord: restoredState.mysteryWord,
      difficultyIcon: restoredState.difficultyIcon,
      userGuesses: restoredState.userGuesses,
      isGenerating: false,
    });

    // Restore clues from saved data in the correct order
    // We need to reconstruct validation functions from saved clues
    const numSuspects = restoredState.gameMapping.suspects.length;
    const roles = restoredState.solution.roles;

    // Helper to reconstruct validation function from masks
    const createValidatorFromMasks = (masks) => {
      if (!masks || masks.length === 0) {
        // For clues without masks (like ROOM_ITEM, ROOM_EMPTY, etc.)
        // we'll create a permissive validator since these are harder to reconstruct
        return () => true;
      }

      // Create validator from masks
      return (assignment) => {
        // Check if assignment satisfies all mask constraints
        return masks.every(({ varIdx, mask }) => {
          const value = assignment[varIdx];
          if (value === undefined) return true; // Allow undefined values
          return (1 << value) & mask;
        });
      };
    };

    // Restore puzzle in the saved order with reconstructed functions
    const restoredPuzzle = restoredState.clueOrder
      .map((id) => restoredState.puzzleData.find((c) => c.id === id))
      .filter(Boolean)
      .map((savedClue) => ({
        text: savedClue.text,
        masks: savedClue.masks,
        id: savedClue.id,
        number: savedClue.number,
        fn: createValidatorFromMasks(savedClue.masks),
      }));

    updateState({ puzzle: restoredPuzzle });
    addLog("Investigation restored", "system");
    renderUI();

    // Wait for overlay animation to complete before removing
    const overlay = document.getElementById("transition-overlay");
    if (overlay) {
      await new Promise((r) => setTimeout(r, 800));
      overlay.classList.remove("active");
      setTimeout(() => overlay.classList.add("hidden"), 450);
    }

    return;
  }

  updateState({ isGenerating: true });

  const overlay = document.getElementById("transition-overlay");
  const loaderMessage = document.getElementById("loader-message");
  const regenerateBtn = document.getElementById("btn-regenerate");

  // Reset overlay state
  if (loaderMessage) {
    loaderMessage.textContent = "";
    loaderMessage.classList.add("hidden");
  }
  if (regenerateBtn) {
    regenerateBtn.classList.add("hidden");
  }

  // Timers for progressive messages
  let messageTimer = null;
  let buttonTimer = null;
  let shouldAbort = false;

  if (overlay) {
    overlay.classList.remove("hidden");
    overlay.classList.add("active");

    // Show message after 30 seconds
    messageTimer = setTimeout(() => {
      if (loaderMessage) {
        loaderMessage.textContent = "If this is taking so long, it's going to be a complex one...";
        loaderMessage.classList.remove("hidden");
      }
    }, 30000);

    // Show regenerate button after 60 seconds
    buttonTimer = setTimeout(() => {
      if (regenerateBtn && loaderMessage) {
        loaderMessage.textContent = "This is taking quite a while. You can wait or try generating a new case.";
        regenerateBtn.classList.remove("hidden");
        regenerateBtn.onclick = () => {
          shouldAbort = true;
          if (messageTimer) clearTimeout(messageTimer);
          if (buttonTimer) clearTimeout(buttonTimer);
          updateState({ isGenerating: false });
          overlay.classList.remove("active");
          setTimeout(() => overlay.classList.add("hidden"), 450);
          // Restart generation
          setTimeout(() => handleNewCase(uiCallbacks), 500);
        };
      }
    }, 60000);

    await new Promise((r) => setTimeout(r, 450));
  }

  // Choose dynamic suspect count between 3 and the minimum availability in current scenario
  const s = state.activeScenario;
  const maxAvailable = Math.min(
    s.suspects.length,
    s.rooms.length,
    s.items.length,
  );
  const numSuspects =
    Math.floor(Math.random() * (Math.min(maxAvailable, 7) - 3 + 1)) + 3;

  addLog(`Generating Universe (${numSuspects} suspects)...`);

  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const getSubset = (arr, count) => shuffle([...arr]).slice(0, count);

  const gameMapping = {
    suspects: getSubset(s.suspects, numSuspects),
    rooms: getSubset(s.rooms, numSuspects),
    items: getSubset(s.items, numSuspects),
  };

  // Generate feature subsets for this specific case
  gameMapping.features = {};
  gameMapping.rooms.forEach((room) => {
    const allFeats = s.roomFeatures[room.name] || [];
    const count = Math.floor(Math.random() * 2) + 2; // Pick 2 or 3 features
    gameMapping.features[room.name] = shuffle([...allFeats]).slice(0, count);
  });

  const { truth, roles } = generateTruth(numSuspects);

  try {
    var allFacts = generateClues(truth, roles, numSuspects);
  } catch (error) {
    if (error.message === "CORRUPT_TRUTH_DATA") {
      console.error("Corrupt truth data detected, regenerating...");
      addLog(`⚠️ CORRUPT DATA DETECTED - Regenerating...`);

      // Clear timers
      if (messageTimer) clearTimeout(messageTimer);
      if (buttonTimer) clearTimeout(buttonTimer);

      // Hide overlay
      if (overlay) {
        overlay.classList.remove("active");
        setTimeout(() => overlay.classList.add("hidden"), 450);
      }

      updateState({ isGenerating: false });

      // Retry generation
      setTimeout(() => handleNewCase(uiCallbacks), 500);
      return;
    }
    throw error; // Re-throw if it's a different error
  }

  allFacts = shuffle(allFacts);
  addLog(`Universe: ${allFacts.length} possibilities. Pruning...`);

  // Validate facts before pruning
  const invalidFacts = allFacts.filter((f) => {
    // Check for undefined IDs that should be defined based on fact type
    if (f.type === FACT_TYPES.SUSPECT_LOCATION && f.roomId === undefined) return true;
    if (f.type === FACT_TYPES.SUSPECT_ITEM && f.itemId === undefined) return true;
    if (f.type === FACT_TYPES.SUSPECT_LOCATION_ITEM && (f.roomId === undefined || f.itemId === undefined)) return true;
    if (f.type === FACT_TYPES.ROOM_ITEM && (f.roomId === undefined || f.itemId === undefined)) return true;
    if (f.type === FACT_TYPES.ROOM_EMPTY && f.roomId === undefined) return true;
    if (f.type === FACT_TYPES.ROOM_NOT_CORPSE && f.roomId === undefined) return true;
    if (f.type === FACT_TYPES.ITEM_NOT_MURDER_WEAPON && f.itemId === undefined) return true;

    // Check for out of range IDs
    if (f.roomId !== undefined && (f.roomId < 0 || f.roomId >= numSuspects)) return true;
    if (f.itemId !== undefined && (f.itemId < 0 || f.itemId >= numSuspects)) return true;
    if (f.suspectId !== undefined && (f.suspectId < 0 || f.suspectId >= numSuspects)) return true;
    return false;
  });
  if (invalidFacts.length > 0) {
    console.error(`Found ${invalidFacts.length} invalid facts before pruning:`, invalidFacts);
    console.error(`numSuspects: ${numSuspects}, truth:`, truth);
    console.error(`Roles:`, roles);
    addLog(`⚠️ CORRUPT DATA DETECTED - Regenerating...`);

    // Clear timers
    if (messageTimer) clearTimeout(messageTimer);
    if (buttonTimer) clearTimeout(buttonTimer);

    // Hide overlay
    if (overlay) {
      overlay.classList.remove("active");
      setTimeout(() => overlay.classList.add("hidden"), 450);
    }

    updateState({ isGenerating: false });

    // Retry generation after a brief delay
    setTimeout(() => handleNewCase(uiCallbacks), 500);
    return;
  }

  let keptFacts = [...allFacts];
  for (let i = keptFacts.length - 1; i >= 0; i--) {
    // Check if user requested abort
    if (shouldAbort) {
      addLog("Generation aborted by user");
      return;
    }

    const fact = keptFacts[i];
    const testSet = keptFacts.filter((_, idx) => idx !== i);

    const engine = new LogicEngine(numSuspects, roles);
    testSet.forEach((f) => {
      engine.addConstraint(f.fn || renderFact(f, gameMapping, roles).fn);
      const masks = f.masks || renderFact(f, gameMapping, roles).masks;
      if (masks) masks.forEach((m) => engine.restrict(m.varIdx, m.mask));
    });

    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));

    if (engine.solve(2).length === 1) {
      // Check if essential (covers a term not covered by others)
      // For facts, we need to check the rendered text
      const rendered = renderFact(fact, gameMapping, roles);
      const otherTexts = testSet.map(
        (f) => renderFact(f, gameMapping, roles).text,
      );
      let essential = false;

      // Collect all raw names (not formatted HTML) for search
      const terms = [
        ...gameMapping.suspects,
        ...gameMapping.rooms.map((r) => r.name),
        ...gameMapping.items.map((i) => i.name),
      ];

      for (let t of terms) {
        if (
          rendered.text.includes(t) &&
          !otherTexts.some((ot) => ot.includes(t))
        ) {
          essential = true;
          break;
        }
      }
      if (!essential) keptFacts.splice(i, 1);
    }
  }

  // Post-Pruning Merge and Render
  const finalFacts = mergeFacts(keptFacts);
  const finalClues = finalFacts.map((f) => renderFact(f, gameMapping, roles));

  // Shuffle and assign original numbers to each clue
  const shuffledClues = shuffle(finalClues).map((clue, index) => ({
    ...clue,
    number: index + 1,
  }));

  // Pick a random mystery word for this case
  const mysteryWord =
    MYSTERY_WORDS[Math.floor(Math.random() * MYSTERY_WORDS.length)];

  // Pick a random difficulty icon for this case
  const difficultyIcon =
    DIFFICULTY_ICONS[Math.floor(Math.random() * DIFFICULTY_ICONS.length)];

  updateState({
    gameMapping,
    puzzle: shuffledClues,
    solution: { truth, roles },
    mysteryWord,
    difficultyIcon,
    userGuesses: {},
    isGenerating: false,
  });

  renderUI();

  // Clear timers
  if (messageTimer) clearTimeout(messageTimer);
  if (buttonTimer) clearTimeout(buttonTimer);

  if (overlay) {
    if (loaderMessage) loaderMessage.classList.add("hidden");
    if (regenerateBtn) regenerateBtn.classList.add("hidden");
    overlay.classList.remove("active");
    setTimeout(() => overlay.classList.add("hidden"), 450);
  }

  addLog(`Success. Pruned to ${finalClues.length} clues.`, "system");
}
