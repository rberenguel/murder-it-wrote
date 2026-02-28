import {
  IDS,
  KILL_VERB_GROUPS,
  MYSTERY_WORDS,
  DIFFICULTY_ICONS,
  SIZING_WORDS,
} from "./constants.js";
import { LogicEngine } from "./logic-engine.js";
import { state, updateState } from "./game-state.js";
import { haptic } from "./haptic.js";
import { random, resetRng, shuffle } from "./rng.js";

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
  SCREAM_HEARD: "SCREAM_HEARD",
  RELATIONSHIP_LOCATION: "RELATIONSHIP_LOCATION",
  RELATIONSHIP_ITEM: "RELATIONSHIP_ITEM",
  RELATIONSHIP_HAS_TRAIT: "RELATIONSHIP_HAS_TRAIT",
  BLOOD_ON_FEATURE: "BLOOD_ON_FEATURE",
  SPOTTED_NEARBY: "SPOTTED_NEARBY",
  NOT_NEAR_SCENE: "NOT_NEAR_SCENE",
  SEEN_ARRIVING: "SEEN_ARRIVING",
};

// Probabilistic protection for special fact types during pruning
// Value is the probability (0-1) that the fact will be kept even if not essential
const PROTECTED_FACT_TYPES = {
  [FACT_TYPES.SCREAM_HEARD]: 0.8, // 80% chance to keep proximity clues
  [FACT_TYPES.BLOOD_ON_FEATURE]: 0.85, // 85% chance to keep blood clues (atmospheric)
  [FACT_TYPES.SPOTTED_NEARBY]: 0.8,
  [FACT_TYPES.NOT_NEAR_SCENE]: 0.7,
  [FACT_TYPES.SEEN_ARRIVING]: 0.8,
};

const getVal = (a, id, type) => a[`${id}_${type}`];
const checkVal = (a, subId, type, val) => getVal(a, subId, type) === val;

// Helper: Get adjacent room names for a given room
function getAdjacentRooms(roomName, scenario) {
  if (!scenario.roomAdjacency) return [];
  return scenario.roomAdjacency[roomName] || [];
}

function getScreamAdjacentRooms(roomName, scenario) {
  const adj = scenario.screamAdjacency ?? scenario.roomAdjacency;
  if (!adj) return [];
  return adj[roomName] || [];
}

// Helper: Find suspect ID by relationship term
function findSuspectByRelationshipTerm(mapping, term) {
  if (!mapping.scenario.relationships) return -1;

  // Search through all relationships to find the suspect with this term
  for (const relationship of mapping.scenario.relationships) {
    for (const relSuspect of relationship.suspects) {
      if (relSuspect.term === term) {
        // Check if this suspect is in the game
        const suspectIdx = mapping.suspects.indexOf(relSuspect.name);
        if (suspectIdx !== -1) {
          return suspectIdx;
        }
      }
    }
  }

  return -1; // Not found
}

export function generateTruth(numSuspects, forcedConstraints = []) {
  const activeRoles = ["Killer", "Victim"];
  if (activeRoles.length < numSuspects && random() > 0.6)
    activeRoles.push("Witness");
  if (activeRoles.length < numSuspects && random() > 0.7)
    activeRoles.push("Accomplice");
  while (activeRoles.length < numSuspects) activeRoles.push("Innocent");

  const sRoles = shuffle([...activeRoles]);
  const sItems = shuffle([...Array(numSuspects).keys()]);

  // Apply forced-item constraints: swap so that suspect at suspectIdx gets itemIdx
  for (const { suspectIdx, itemIdx } of forcedConstraints) {
    const swapPos = sItems.indexOf(itemIdx);
    [sItems[suspectIdx], sItems[swapPos]] = [
      sItems[swapPos],
      sItems[suspectIdx],
    ];
  }
  const sRooms = Array.from({ length: numSuspects }, () =>
    Math.floor(random() * numSuspects),
  );

  // Force Witness and Accomplice to be in the same room as the Victim (murder room)
  const vIdx = sRoles.indexOf("Victim");
  const wIdx = sRoles.indexOf("Witness");
  const aIdx = sRoles.indexOf("Accomplice");
  if (vIdx !== -1 && wIdx !== -1) {
    sRooms[wIdx] = sRooms[vIdx];
  }
  if (vIdx !== -1 && aIdx !== -1) {
    sRooms[aIdx] = sRooms[vIdx];
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
  const hasInvalidEntries = truth.some(
    (p) =>
      p.id === undefined ||
      p.roomId === undefined ||
      p.itemId === undefined ||
      p.role === undefined,
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

    if (!["Killer", "Victim", "Accomplice"].includes(p.role)) {
      facts.push({
        type: FACT_TYPES.SUSPECT_ROLE,
        suspectId: p.id,
        role: p.role,
      });
    }

    ["Killer", "Victim", "Accomplice"].forEach((bad) => {
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

function generateProximityFacts(truth, roles, mapping) {
  const facts = [];

  // Only generate if scenario has adjacency data
  if (!mapping.scenario.roomAdjacency) {
    console.log("No adjacency data for scenario");
    return facts;
  }

  // Find victim's room (where the scream came from)
  const victim = truth.find((p) => p.role === "Victim");
  const victimRoom = mapping.rooms[victim.roomId];

  if (!victimRoom) return facts;

  // Get scream-reachable room names (may differ from general adjacency)
  const adjacentRoomNames = getScreamAdjacentRooms(
    victimRoom.name,
    mapping.scenario,
  );

  // SCREAM_HEARD requires non-empty scream adjacency
  if (adjacentRoomNames.length > 0) {
    // Find people in adjacent rooms (anyone could hear the scream)
    const listeners = truth.filter((p) => {
      if (p.role === "Victim") return false; // Victim can't hear their own scream
      const personRoom = mapping.rooms[p.roomId];
      return personRoom && adjacentRoomNames.includes(personRoom.name);
    });

    // Generate scream fact if there are listeners (100% chance for testing)
    if (listeners.length > 0) {
      const listener = listeners[Math.floor(random() * listeners.length)];
      console.log(
        `✓ SCREAM FACT GENERATED: ${mapping.suspects[listener.id]} in ${mapping.rooms[truth[listener.id].roomId]?.name} heard scream from ${victimRoom.name}`,
      );
      facts.push({
        type: FACT_TYPES.SCREAM_HEARD,
        suspectId: listener.id,
      });
    }
  }

  // SPOTTED_NEARBY: non-victim suspect in a room that has scream-adjacent in-game neighbours
  const nonVictims = truth.filter((p) => p.role !== "Victim");
  const spottedCandidates = nonVictims.filter((p) => {
    const personRoom = mapping.rooms[p.roomId];
    if (!personRoom) return false;
    const neighbours = getScreamAdjacentRooms(
      personRoom.name,
      mapping.scenario,
    );
    return neighbours.some((n) => mapping.rooms.some((r) => r.name === n));
  });
  if (spottedCandidates.length > 0) {
    const subject =
      spottedCandidates[Math.floor(random() * spottedCandidates.length)];
    const subjectRoom = mapping.rooms[subject.roomId];
    const inGameNeighbours = getScreamAdjacentRooms(
      subjectRoom.name,
      mapping.scenario,
    )
      .map((n) => mapping.rooms.findIndex((r) => r.name === n))
      .filter((idx) => idx !== -1);
    const refRoomIdx =
      inGameNeighbours[Math.floor(random() * inGameNeighbours.length)];
    facts.push({
      type: FACT_TYPES.SPOTTED_NEARBY,
      suspectId: subject.id,
      roomId: refRoomIdx,
    });
  }

  // NOT_NEAR_SCENE: only meaningful when the victim's room has scream-adjacent rooms;
  // without adjacency the "near" concept is undefined and the clue has no deductive power
  if (adjacentRoomNames.length > 0) {
    const notNearCandidates = nonVictims.filter((p) => {
      const personRoom = mapping.rooms[p.roomId];
      if (!personRoom) return false;
      if (p.roomId === victim.roomId) return false;
      return !adjacentRoomNames.includes(personRoom.name);
    });
    if (notNearCandidates.length > 0) {
      const subject =
        notNearCandidates[Math.floor(random() * notNearCandidates.length)];
      facts.push({
        type: FACT_TYPES.NOT_NEAR_SCENE,
        suspectId: subject.id,
      });
    }
  }

  // SEEN_ARRIVING: non-victim suspect whose room has in-game neighbours via roomAdjacency
  const arrivingCandidates = nonVictims.filter((p) => {
    const personRoom = mapping.rooms[p.roomId];
    if (!personRoom) return false;
    const neighbours = getAdjacentRooms(personRoom.name, mapping.scenario);
    return neighbours.some((n) => mapping.rooms.some((r) => r.name === n));
  });
  if (arrivingCandidates.length > 0) {
    const subject =
      arrivingCandidates[Math.floor(random() * arrivingCandidates.length)];
    const subjectRoom = mapping.rooms[subject.roomId];
    const inGameNeighbours = getAdjacentRooms(
      subjectRoom.name,
      mapping.scenario,
    )
      .map((n) => mapping.rooms.findIndex((r) => r.name === n))
      .filter((idx) => idx !== -1);
    const refRoomIdx =
      inGameNeighbours[Math.floor(random() * inGameNeighbours.length)];
    facts.push({
      type: FACT_TYPES.SEEN_ARRIVING,
      suspectId: subject.id,
      roomId: refRoomIdx,
    });
  }

  return facts;
}

function generateRelationshipFacts(truth, roles, mapping) {
  const facts = [];

  // Only generate if scenario has relationships
  if (!mapping.scenario.relationships) {
    return facts;
  }

  // FIRST PASS: Build a complete map of relationship terms to suspects
  // This must be done before checking uniqueness
  const termToSuspects = {}; // { "husband": [0, 2], "wife": [1, 3] }
  const activeRelationships = []; // Store relationships with all suspects active

  mapping.scenario.relationships.forEach((relationship) => {
    // Check if this is an optional relationship
    if (relationship.optional) {
      const probability = relationship.probability || 0.5;
      // Roll the dice - skip this relationship if we don't meet the probability
      if (random() > probability) {
        return; // Skip this optional relationship
      }
    }

    const activeSuspects = [];

    // Find which suspects from this relationship are in the game
    relationship.suspects.forEach((relSuspect) => {
      const suspectIdx = mapping.suspects.indexOf(relSuspect.name);
      if (suspectIdx !== -1) {
        activeSuspects.push({
          id: suspectIdx,
          name: relSuspect.name,
          term: relSuspect.term,
        });

        // Track all suspects with each term across ALL relationships
        if (!termToSuspects[relSuspect.term]) {
          termToSuspects[relSuspect.term] = [];
        }
        termToSuspects[relSuspect.term].push(suspectIdx);
      }
    });

    // Only consider complete relationships (all members in game)
    if (activeSuspects.length === relationship.suspects.length) {
      activeRelationships.push({
        relationship: relationship,
        activeSuspects: activeSuspects,
      });
    }
  });

  // SECOND PASS: Generate facts only for unique terms
  activeRelationships.forEach(({ relationship, activeSuspects }) => {
    activeSuspects.forEach((suspect) => {
      const truthEntry = truth[suspect.id];

      // Only generate if the term is UNIQUE across ALL relationships
      const isUniqueTerm = termToSuspects[suspect.term].length === 1;

      if (isUniqueTerm) {
        // RELATIONSHIP_LOCATION: "The husband was in X"
        facts.push({
          type: FACT_TYPES.RELATIONSHIP_LOCATION,
          relationshipTerm: suspect.term,
          roomId: truthEntry.roomId,
          relationshipType: relationship.type,
        });

        // RELATIONSHIP_ITEM: "The wife had Y"
        facts.push({
          type: FACT_TYPES.RELATIONSHIP_ITEM,
          relationshipTerm: suspect.term,
          itemId: truthEntry.itemId,
          relationshipType: relationship.type,
        });

        // RELATIONSHIP_HAS_TRAIT: "Someone is the husband"
        facts.push({
          type: FACT_TYPES.RELATIONSHIP_HAS_TRAIT,
          relationshipTerm: suspect.term,
          relationshipType: relationship.type,
        });
      }
    });
  });

  return facts;
}

function generateBloodFacts(truth, roles, mapping) {
  const facts = [];

  // Only generate if mapping has features
  if (!mapping.features) {
    return facts;
  }

  // Find victim and killer
  const victim = truth.find((p) => p.role === "Victim");
  const killer = truth.find((p) => p.role === "Killer");

  if (!victim || !killer) {
    return facts;
  }

  // Get killer's weapon
  const weapon = mapping.items[killer.itemId];
  if (!weapon || !weapon.bloody) {
    // No blood facts if weapon is not bloody
    return facts;
  }

  // Get victim's room
  const victimRoom = mapping.rooms[victim.roomId];
  if (!victimRoom) {
    return facts;
  }

  // Get features in victim's room
  const allFeatures = mapping.features[victimRoom.name] || [];

  // Filter to only spillable features (physical objects, not abstract concepts)
  const spillableFeatures = allFeatures.filter((f) => f.spillable !== false);

  if (spillableFeatures.length === 0) {
    return facts;
  }

  // Generate 1-2 blood facts for random spillable features in the corpse's room
  const numBloodFacts = Math.min(2, spillableFeatures.length);
  const selectedFeatures = shuffle([...spillableFeatures]).slice(
    0,
    numBloodFacts,
  );

  selectedFeatures.forEach((feature) => {
    facts.push({
      type: FACT_TYPES.BLOOD_ON_FEATURE,
      roomId: victim.roomId,
      featureName: feature.name,
    });
  });

  return facts;
}

function mergeFacts(facts) {
  const merged = [];
  const suspectFacts = {}; // Maps suspectId to { location, item, notKiller, notVictim, notAccomplice }

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
      else if (f.role === "Accomplice")
        suspectFacts[f.suspectId].notAccomplice = f;
      else merged.push(f);
    } else {
      merged.push(f);
    }
  });

  Object.keys(suspectFacts).forEach((sidStr) => {
    const sid = parseInt(sidStr);
    const { location, item, notKiller, notVictim, notAccomplice } =
      suspectFacts[sid];

    // 1. Triple Exclusion Merge (not Killer, not Victim, not Accomplice)
    if (notKiller && notVictim && notAccomplice) {
      merged.push({ type: FACT_TYPES.ROLE_EXCLUSION, suspectId: sid });
    } else {
      if (notKiller) merged.push(notKiller);
      if (notVictim) merged.push(notVictim);
      if (notAccomplice) merged.push(notAccomplice);
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

export function renderFact(fact, mapping, roles, deck = null) {
  const numSuspects = mapping.suspects.length;

  // Generate stable ID based on fact properties
  const generateStableId = (fact) => {
    const props = [
      fact.type,
      fact.suspectId ?? "",
      fact.roomId ?? "",
      fact.itemId ?? "",
      fact.role ?? "",
      fact.featureName ?? "",
      fact.relationshipTerm ?? "",
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
  // pick: pure random, for non-variant choices (feature selection, kill verb)
  const pick = (...opts) => opts[Math.floor(random() * opts.length)];
  // draw: shuffle-and-drain per key so variants cycle before repeating.
  // Stores shuffled indices so each call's interpolated strings are independent.
  const draw = deck
    ? (key, ...opts) => {
        if (!deck[key] || deck[key].length === 0)
          deck[key] = shuffle([...Array(opts.length).keys()]);
        return opts[deck[key].pop()];
      }
    : (_key, ...opts) => opts[Math.floor(random() * opts.length)];
  let text,
    fn,
    masks = [];

  switch (fact.type) {
    case FACT_TYPES.SUSPECT_LOCATION: {
      const name = fmt("suspects", fact.suspectId);
      const rObj = mapping.rooms[fact.roomId];

      if (!rObj) {
        console.error(`Invalid roomId ${fact.roomId} in fact:`, fact);
        text = `${name} was found in an unknown location`;
        fn = () => true;
        break;
      }

      const feats = mapping.features[rObj.name] || [];

      if (feats.length > 0 && random() > 0.5) {
        const feat = feats[Math.floor(random() * feats.length)];
        text = draw(
          fact.type + "_f",
          `${name} was close to the ${feat.name}`,
          `${name} was near the ${feat.name}`,
          `${name} was found by the ${feat.name}`,
        );
      } else {
        const rText = fmtRoom(fact.roomId);
        text = draw(
          fact.type,
          `${name} was in ${rText}`,
          `${name} was found in ${rText}`,
          `${name} was spotted in ${rText}`,
          `${name} was reported to be in ${rText}`,
          `${name} was known to be in ${rText}`,
        );
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
      text = draw(
        fact.type,
        `${name} had ${item}`,
        `${name} was carrying ${item}`,
        `${name} was found with ${item}`,
      );
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
      text = draw(
        fact.type,
        `${name} was in ${rText} with ${item}`,
        `${name} was found in ${rText}, carrying ${item}`,
        `In ${rText}, ${name} had ${item}`,
        `${name} was reported to be in ${rText} with ${item}`,
        `${name} was known to be in ${rText}, carrying ${item}`,
      );
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
      text = draw(
        fact.type,
        `${name} is ${rText}`,
        `${name} was found to be ${rText}`,
        `Records confirm ${name} is ${rText}`,
      );
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
      text = draw(
        fact.type,
        `${name} is not the ${wrapRole(fact.role.toLowerCase())}`,
        `${name} was not the ${wrapRole(fact.role.toLowerCase())}`,
        `It is confirmed that ${name} is not the ${wrapRole(fact.role.toLowerCase())}`,
      );
      fn = (a) => getVal(a, fact.suspectId, "Role") !== fact.role;
      masks = [{ varIdx: fact.suspectId, mask: ~badMask }];
      break;
    }
    case FACT_TYPES.ROOM_ITEM: {
      const rText = fmtRoom(fact.roomId);
      const item = fmtItem(fact.itemId);
      text = draw(
        fact.type,
        `The person in ${rText} had ${item}`,
        `Whoever was in ${rText} had ${item}`,
        `The occupant of ${rText} was carrying ${item}`,
      );
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
        console.error(
          `Invalid roomId ${fact.roomId} in ROOM_EMPTY fact:`,
          fact,
        );
        text = `An unknown location was empty`;
        fn = () => true;
        break;
      }

      {
        const capRText = rText.charAt(0).toUpperCase() + rText.slice(1);
        if (rObj.large) {
          text = draw(
            fact.type,
            `No one was on ${rText}`,
            `None of the suspects visited ${rText}`,
            `No suspect was present on ${rText}`,
          );
        } else {
          text = draw(
            fact.type,
            `${capRText} was empty`,
            `There was nobody at ${rText}`,
            `No one was found in ${rText}`,
          );
        }
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
      const itemObj = mapping.items[fact.itemId];
      const item = fmtItem(fact.itemId);
      const capItem = item.charAt(0).toUpperCase() + item.slice(1);
      const kvGroup = itemObj.killVerb
        ? KILL_VERB_GROUPS[itemObj.killVerb]
        : null;
      const kv = kvGroup ? pick(...kvGroup) : "kill";
      text = draw(
        fact.type,
        `${capItem} was not the murder weapon`,
        `${capItem} was ruled out as the murder weapon`,
        `The murder was not committed with ${item}`,
        `${capItem} was not used to ${kv} the victim`,
      );
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
      text = draw(
        fact.type,
        `There is no corpse in ${rText}`,
        `No body was found in ${rText}`,
        `The victim was not in ${rText}`,
      );
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
      text = draw(
        fact.type,
        `${name} is neither the ${wrapRole("killer")} nor the ${wrapRole("victim")} nor the ${wrapRole("accomplice")}`,
        `${name} is not the ${wrapRole("killer")}, not the ${wrapRole("victim")}, and not the ${wrapRole("accomplice")}`,
        `${name} was cleared of being the ${wrapRole("killer")}, the ${wrapRole("victim")}, and the ${wrapRole("accomplice")}`,
      );
      fn = (a) =>
        getVal(a, fact.suspectId, "Role") !== "Killer" &&
        getVal(a, fact.suspectId, "Role") !== "Victim" &&
        getVal(a, fact.suspectId, "Role") !== "Accomplice";
      const kIndices = roles
        .map((r, i) => (r === "Killer" ? i : -1))
        .filter((i) => i !== -1);
      const vIndices = roles
        .map((r, i) => (r === "Victim" ? i : -1))
        .filter((i) => i !== -1);
      const aIndices = roles
        .map((r, i) => (r === "Accomplice" ? i : -1))
        .filter((i) => i !== -1);
      let mask = 0;
      kIndices.forEach((i) => (mask |= 1 << i));
      vIndices.forEach((i) => (mask |= 1 << i));
      aIndices.forEach((i) => (mask |= 1 << i));
      masks = [{ varIdx: fact.suspectId, mask: ~mask }];
      break;
    }
    case FACT_TYPES.SCREAM_HEARD: {
      const name = fmt("suspects", fact.suspectId);
      text = draw(
        fact.type,
        `${name} heard a scream coming from somewhere nearby`,
        `${name} reported hearing a scream nearby`,
        `${name} heard a scream from somewhere close by`,
      );

      // No masks - this is a relational constraint between listener and victim
      masks = [];

      fn = (a) => {
        // Get listener's room
        const listenerRoom = getVal(a, fact.suspectId, "Room");
        if (listenerRoom === undefined) return true; // Not yet assigned

        const listenerRoomObj = mapping.rooms[listenerRoom];
        if (!listenerRoomObj) return false;

        // Get scream-reachable room names (may differ from general adjacency)
        const adjacentRoomNames = getScreamAdjacentRooms(
          listenerRoomObj.name,
          mapping.scenario,
        );
        if (adjacentRoomNames.length === 0) return false;

        // Find victim's room (where the scream came from)
        const victimIdx = roles.findIndex((r) => r === "Victim");
        if (victimIdx === -1) return false;

        const victimRoom = getVal(a, victimIdx, "Room");
        if (victimRoom === undefined) return true; // Not yet assigned

        const victimRoomObj = mapping.rooms[victimRoom];
        if (!victimRoomObj) return false;

        // Check if victim's room is adjacent to listener's room
        return adjacentRoomNames.includes(victimRoomObj.name);
      };
      break;
    }
    case FACT_TYPES.SPOTTED_NEARBY: {
      const name = fmt("suspects", fact.suspectId);
      const rText = fmtRoom(fact.roomId);
      text = draw(
        fact.type,
        `${name} was spotted near ${rText}`,
        `${name} was seen in the vicinity of ${rText}`,
        `${name} was found close to ${rText}`,
      );
      masks = [];
      fn = (a) => {
        const suspectRoom = getVal(a, fact.suspectId, "Room");
        if (suspectRoom === undefined) return true;
        const suspectRoomObj = mapping.rooms[suspectRoom];
        if (!suspectRoomObj) return false;
        const refRoom = mapping.rooms[fact.roomId];
        if (!refRoom) return false;
        return getScreamAdjacentRooms(refRoom.name, mapping.scenario).includes(
          suspectRoomObj.name,
        );
      };
      break;
    }
    case FACT_TYPES.NOT_NEAR_SCENE: {
      const name = fmt("suspects", fact.suspectId);
      text = draw(
        fact.type,
        `${name} was nowhere near the murder scene`,
        `${name} was far from where the victim was found`,
        `${name} was located well away from the murder scene`,
      );
      masks = [];
      fn = (a) => {
        const suspectRoom = getVal(a, fact.suspectId, "Room");
        if (suspectRoom === undefined) return true;
        const victimIdx = roles.findIndex((r) => r === "Victim");
        if (victimIdx === -1) return false;
        const victimRoom = getVal(a, victimIdx, "Room");
        if (victimRoom === undefined) return true;
        if (suspectRoom === victimRoom) return false;
        const victimRoomObj = mapping.rooms[victimRoom];
        const suspectRoomObj = mapping.rooms[suspectRoom];
        if (!victimRoomObj || !suspectRoomObj) return false;
        return !getScreamAdjacentRooms(
          victimRoomObj.name,
          mapping.scenario,
        ).includes(suspectRoomObj.name);
      };
      break;
    }
    case FACT_TYPES.SEEN_ARRIVING: {
      const name = fmt("suspects", fact.suspectId);
      const rText = fmtRoom(fact.roomId);
      text = draw(
        fact.type,
        `${name} was seen arriving from ${rText}`,
        `${name} had just come from ${rText}`,
        `${name} was spotted heading in from ${rText}`,
      );
      masks = [];
      fn = (a) => {
        const suspectRoom = getVal(a, fact.suspectId, "Room");
        if (suspectRoom === undefined) return true;
        const suspectRoomObj = mapping.rooms[suspectRoom];
        if (!suspectRoomObj) return false;
        const refRoom = mapping.rooms[fact.roomId];
        if (!refRoom) return false;
        return getAdjacentRooms(refRoom.name, mapping.scenario).includes(
          suspectRoomObj.name,
        );
      };
      break;
    }
    case FACT_TYPES.RELATIONSHIP_LOCATION: {
      // "The husband was in X"
      const rText = fmtRoom(fact.roomId);
      const term = `<span class="entity-person">${fact.relationshipTerm}</span>`;

      text = draw(
        fact.type,
        `The ${term} was in ${rText}`,
        `The ${term} was found in ${rText}`,
        `The ${term} was spotted in ${rText}`,
      );

      // CSP constraint: Find which suspect has this term, check their room
      fn = (a) => {
        // Find the suspect ID with this relationship term
        const suspectId = findSuspectByRelationshipTerm(
          mapping,
          fact.relationshipTerm,
        );
        if (suspectId === -1) return false;
        return checkVal(a, suspectId, "Room", fact.roomId);
      };

      // No masks - can't use bitmask optimization for relationship constraints
      masks = [];
      break;
    }
    case FACT_TYPES.RELATIONSHIP_ITEM: {
      // "The wife had X"
      const item = fmtItem(fact.itemId);
      const term = `<span class="entity-person">${fact.relationshipTerm}</span>`;

      text = draw(
        fact.type,
        `The ${term} had ${item}`,
        `The ${term} was carrying ${item}`,
        `The ${term} was found with ${item}`,
      );

      // CSP constraint: Find which suspect has this term, check their item
      fn = (a) => {
        const suspectId = findSuspectByRelationshipTerm(
          mapping,
          fact.relationshipTerm,
        );
        if (suspectId === -1) return false;
        return checkVal(a, suspectId, "Item", fact.itemId);
      };

      masks = [];
      break;
    }
    case FACT_TYPES.RELATIONSHIP_HAS_TRAIT: {
      // "Someone is the husband"
      const term = `<span class="entity-person">${fact.relationshipTerm}</span>`;

      // We can't reveal the name - that would defeat the purpose
      // Instead, use this as an identifier constraint
      text = `Someone in the investigation is the ${term}`;

      // This is an existence claim - always true if we generated it
      fn = () => true;
      masks = [];
      break;
    }
    case FACT_TYPES.BLOOD_ON_FEATURE: {
      // "There was blood spilled on the X in Y"
      const rText = fmtRoom(fact.roomId);
      const feature = fact.featureName;

      text = draw(
        fact.type,
        `There was blood spilled on the ${feature} in ${rText}`,
        `Blood was found on the ${feature} in ${rText}`,
        `The ${feature} in ${rText} was stained with blood`,
      );

      // No masks - this is a relational constraint between weapon and victim's room
      masks = [];

      fn = (a) => {
        // Find victim's room
        const victimIdx = roles.findIndex((r) => r === "Victim");
        if (victimIdx === -1) return false;

        const victimRoom = getVal(a, victimIdx, "Room");
        if (victimRoom === undefined) return true; // Not yet assigned

        // Find killer's weapon
        const killerIdx = roles.findIndex((r) => r === "Killer");
        if (killerIdx === -1) return false;

        const weaponId = getVal(a, killerIdx, "Item");
        if (weaponId === undefined) return true; // Not yet assigned

        // Check if weapon is bloody
        const weapon = mapping.items[weaponId];
        const isWeaponBloody = weapon?.bloody || false;

        // True if: weapon IS bloody AND victim IS in this room
        return isWeaponBloody && victimRoom === fact.roomId;
      };
      break;
    }
  }

  return { text, fn, masks, id: generateStableId(fact) };
}

export function generateClues(truth, roles, numSuspects, mapping) {
  return [
    ...generateSuspectFacts(truth, roles),
    ...generateRoomFacts(truth, numSuspects),
    ...generateItemFacts(truth, numSuspects),
    ...generateProximityFacts(truth, roles, mapping),
    ...generateRelationshipFacts(truth, roles, mapping),
    ...generateBloodFacts(truth, roles, mapping),
  ];
}

export async function handleNewCase(uiCallbacks, restoredState = null) {
  const { addLog, renderUI } = uiCallbacks;
  if (state.isGenerating) return;

  // Handle restoration path
  if (restoredState) {
    // Check if user had interacted with the saved game
    const hadInteraction =
      Object.values(restoredState.userGuesses || {}).some(
        (guess) => guess.room || guess.item || guess.role,
      ) ||
      (restoredState.clueOrder && restoredState.clueOrder.length > 0);

    updateState({
      activeScenario: restoredState.activeScenario,
      gameMapping: restoredState.gameMapping,
      solution: restoredState.solution,
      mysteryWord: restoredState.mysteryWord,
      difficultyIcon: restoredState.difficultyIcon,
      sizingWord: restoredState.sizingWord,
      scenarioName: restoredState.scenarioName,
      userGuesses: restoredState.userGuesses,
      isGenerating: false,
      hasInteracted: hadInteraction,
      dimmedClues: new Set(restoredState.dimmedClues || []),
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

    // Show message after 15 seconds
    messageTimer = setTimeout(() => {
      if (loaderMessage) {
        loaderMessage.textContent =
          "If this is taking so long, it's going to be a complex one...";
        loaderMessage.classList.remove("hidden");
      }
    }, 15000);

    // Show regenerate button after 30 seconds
    buttonTimer = setTimeout(() => {
      if (regenerateBtn && loaderMessage) {
        loaderMessage.textContent =
          "This is taking quite a while. You can wait or try generating a new case.";
        regenerateBtn.classList.remove("hidden");
        regenerateBtn.onclick = () => {
          haptic();
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
    }, 30000);

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
    Math.floor(random() * (Math.min(maxAvailable, 7) - 3 + 1)) + 3;

  addLog(`Generating Universe (${numSuspects} suspects)...`);

  const getSubset = (arr, count) => shuffle([...arr]).slice(0, count);

  // Build raw suspect subset — entries may be strings or { name, forcedItem } objects
  const rawSuspects = getSubset(s.suspects, numSuspects);

  // Extract forced-item requirements from object suspects
  const forcedItemReqs = rawSuspects
    .map((sus, idx) =>
      typeof sus === "object" && sus.forcedItem
        ? { suspectIdx: idx, itemName: sus.forcedItem }
        : null,
    )
    .filter(Boolean);

  // Normalize suspects to plain strings for the mapping
  const normalizedSuspects = rawSuspects.map((sus) =>
    typeof sus === "string" ? sus : sus.name,
  );

  // Build item subset: forced items first, then random fill from the rest
  // Items with reservedFor are excluded unless their named suspect is in the game
  const forcedItems = forcedItemReqs
    .map((req) => s.items.find((item) => item.name === req.itemName))
    .filter(Boolean);
  const otherItems = shuffle(
    s.items.filter((item) => {
      if (forcedItems.includes(item)) return false;
      if (item.reservedFor && !normalizedSuspects.includes(item.reservedFor))
        return false;
      return true;
    }),
  );
  const selectedItems = [...forcedItems, ...otherItems].slice(0, numSuspects);

  // Build index-based constraints for generateTruth
  const forcedConstraints = forcedItemReqs
    .map((req) => {
      const itemIdx = selectedItems.findIndex(
        (item) => item.name === req.itemName,
      );
      return itemIdx !== -1 ? { suspectIdx: req.suspectIdx, itemIdx } : null;
    })
    .filter(Boolean);

  const gameMapping = {
    suspects: normalizedSuspects,
    rooms: getSubset(s.rooms, numSuspects),
    items: selectedItems,
    scenario: s, // Store scenario for adjacency data
  };

  // Generate feature subsets for this specific case
  gameMapping.features = {};
  gameMapping.rooms.forEach((room) => {
    const allFeats = s.roomFeatures[room.name] || [];
    const count = Math.floor(random() * 2) + 2; // Pick 2 or 3 features
    gameMapping.features[room.name] = shuffle([...allFeats]).slice(0, count);
  });

  const { truth, roles } = generateTruth(numSuspects, forcedConstraints);

  try {
    var allFacts = generateClues(truth, roles, numSuspects, gameMapping);
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
    if (f.type === FACT_TYPES.SUSPECT_LOCATION && f.roomId === undefined)
      return true;
    if (f.type === FACT_TYPES.SUSPECT_ITEM && f.itemId === undefined)
      return true;
    if (
      f.type === FACT_TYPES.SUSPECT_LOCATION_ITEM &&
      (f.roomId === undefined || f.itemId === undefined)
    )
      return true;
    if (
      f.type === FACT_TYPES.ROOM_ITEM &&
      (f.roomId === undefined || f.itemId === undefined)
    )
      return true;
    if (f.type === FACT_TYPES.ROOM_EMPTY && f.roomId === undefined) return true;
    if (f.type === FACT_TYPES.ROOM_NOT_CORPSE && f.roomId === undefined)
      return true;
    if (f.type === FACT_TYPES.ITEM_NOT_MURDER_WEAPON && f.itemId === undefined)
      return true;
    if (f.type === FACT_TYPES.SEEN_ARRIVING && f.roomId === undefined)
      return true;
    if (f.type === FACT_TYPES.SPOTTED_NEARBY && f.roomId === undefined)
      return true;

    // Check for out of range IDs
    if (f.roomId !== undefined && (f.roomId < 0 || f.roomId >= numSuspects))
      return true;
    if (f.itemId !== undefined && (f.itemId < 0 || f.itemId >= numSuspects))
      return true;
    if (
      f.suspectId !== undefined &&
      (f.suspectId < 0 || f.suspectId >= numSuspects)
    )
      return true;
    return false;
  });
  if (invalidFacts.length > 0) {
    console.error(
      `Found ${invalidFacts.length} invalid facts before pruning:`,
      invalidFacts,
    );
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

  await new Promise((r) => setTimeout(r, 0));

  let keptFacts = [...allFacts];
  for (let i = keptFacts.length - 1; i >= 0; i--) {
    // Yield every iteration so click events (e.g. abort button) can be processed
    await new Promise((r) => setTimeout(r, 0));

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

      // Probabilistic protection for special fact types
      if (!essential) {
        const protectionChance = PROTECTED_FACT_TYPES[fact.type];
        if (protectionChance && random() < protectionChance) {
          essential = true; // Protected! Keep this fact
        }
      }

      if (!essential) keptFacts.splice(i, 1);
    }
  }

  // Post-Pruning Merge and Render
  await new Promise((r) => setTimeout(r, 0));
  // Reset before rendering so phrase variants are seed-stable regardless of
  // pruning changes or new clue types added in the future.
  resetRng();
  const finalFacts = mergeFacts(keptFacts);
  const deck = {};
  const finalClues = finalFacts.map((f) =>
    renderFact(f, gameMapping, roles, deck),
  );

  // Shuffle and assign original numbers to each clue
  const shuffledClues = shuffle(finalClues).map((clue, index) => ({
    ...clue,
    number: index + 1,
  }));

  // Pick a random mystery word for this case
  const mysteryWord =
    MYSTERY_WORDS[Math.floor(random() * MYSTERY_WORDS.length)];

  // Pick a random difficulty icon for this case
  const difficultyIcon =
    DIFFICULTY_ICONS[Math.floor(random() * DIFFICULTY_ICONS.length)];

  // Pick a random sizing word based on number of suspects
  const sizingKey = numSuspects <= 3 ? 3 : numSuspects >= 7 ? 7 : numSuspects;
  const sizingPool = SIZING_WORDS[sizingKey];
  const sizingWord = sizingPool[Math.floor(random() * sizingPool.length)];

  // Pick a random scenario name (or use original if no alternates)
  const alternates = s.alternateNames || [];
  const namePool = alternates.length > 0 ? [s.name, ...alternates] : [s.name];
  const scenarioName = namePool[Math.floor(random() * namePool.length)];

  updateState({
    gameMapping,
    puzzle: shuffledClues,
    solution: { truth, roles },
    mysteryWord,
    difficultyIcon,
    sizingWord,
    scenarioName,
    userGuesses: {},
    isGenerating: false,
    hasInteracted: false,
    dimmedClues: new Set(),
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
