import { IDS } from "./constants.js";
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
      text = `${rText.charAt(0).toUpperCase() + rText.slice(1)} was empty.`;
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
      text = `${name} is not the ${wrapRole("killer")} or the ${wrapRole("victim")}.`;
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

  return { text, fn, masks, id: Math.random() };
}

export function generateClues(truth, roles, numSuspects) {
  return [
    ...generateSuspectFacts(truth, roles),
    ...generateRoomFacts(truth, numSuspects),
    ...generateItemFacts(truth, numSuspects),
  ];
}

export async function handleNewCase(uiCallbacks) {
  const { addLog, renderUI } = uiCallbacks;
  if (state.isGenerating) return;
  updateState({ isGenerating: true });

  const overlay = document.getElementById("transition-overlay");
  if (overlay) {
    overlay.classList.remove("hidden");
    overlay.classList.add("active");
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
  let allFacts = generateClues(truth, roles, numSuspects);
  allFacts = shuffle(allFacts);
  addLog(`Universe: ${allFacts.length} possibilities. Pruning...`);

  let keptFacts = [...allFacts];
  for (let i = keptFacts.length - 1; i >= 0; i--) {
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

  updateState({
    gameMapping,
    puzzle: shuffle(finalClues),
    solution: { truth, roles },
    userGuesses: {},
    isGenerating: false,
  });

  renderUI();

  if (overlay) {
    overlay.classList.remove("active");
    setTimeout(() => overlay.classList.add("hidden"), 450);
  }

  addLog(`Success. Pruned to ${finalClues.length} clues.`, "system");
}
