const { expect } = chai;

import { generateClues, renderFact } from "../js/generator.js";
import { SCENARIOS } from "../js/constants.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeMapping(scenario, numSuspects) {
  const mapping = {
    suspects: scenario.suspects
      .slice(0, numSuspects)
      .map((s) => (typeof s === "string" ? s : s.name)),
    rooms: scenario.rooms.slice(0, numSuspects),
    items: scenario.items.slice(0, numSuspects),
    scenario,
  };
  if (scenario.roomFeatures) {
    mapping.features = {};
    mapping.rooms.forEach((room) => {
      const name = typeof room === "string" ? room : room.name;
      mapping.features[name] = (scenario.roomFeatures[name] || []).slice(0, 3);
    });
  }
  return mapping;
}

// Build a minimal mapping with an explicit room list (name/id pairs)
function makeCustomMapping(scenario, roomNames) {
  const rooms = roomNames.map((name) => {
    const r = scenario.rooms.find((r) => r.name === name);
    return r || { name, noArticle: false, isProper: false };
  });
  const numSuspects = rooms.length;
  return {
    suspects: scenario.suspects
      .slice(0, numSuspects)
      .map((s) => (typeof s === "string" ? s : s.name)),
    rooms,
    items: scenario.items.slice(0, numSuspects),
    scenario,
    features: Object.fromEntries(
      rooms.map((r) => [
        r.name,
        (scenario.roomFeatures?.[r.name] || []).slice(0, 2),
      ]),
    ),
  };
}

// ─── renderFact helper ────────────────────────────────────────────────────────

function renderAll(clues, mapping, roles) {
  return clues.map((f) => {
    const rendered = renderFact(f, mapping, roles);
    return { ...f, text: rendered.text, fn: rendered.fn };
  });
}

// ─── SPOTTED_NEARBY ───────────────────────────────────────────────────────────

describe("SPOTTED_NEARBY clue type", function () {
  this.timeout(10000);

  const scenario = SCENARIOS.find((s) => s.id === "classic_manor");

  it("fact fn returns true when suspect is scream-adjacent to the reference room", function () {
    // Hall neighbours: Ballroom, Library, Study, Lounge, Dining Room
    // Place suspect in Hall (idx 0), reference room Library (idx 2)
    const mapping = makeCustomMapping(scenario, [
      "Hall",
      "Ballroom",
      "Library",
      "Study",
      "Lounge",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];

    const fact = { type: "SPOTTED_NEARBY", suspectId: 0, roomId: 2 }; // suspect in Hall, ref=Library
    const { fn } = renderFact(fact, mapping, roles);

    // Simulate assignment: suspect 0 → room 0 (Hall)
    const assignment = { "0_Room": 0 };
    expect(fn(assignment)).to.be.true;
  });

  it("fact fn returns false when suspect is NOT scream-adjacent to the reference room", function () {
    // Hall neighbours: Ballroom, Library, Study, Lounge, Dining Room
    // Place suspect in Ballroom (idx 1), reference room Study (idx 3)
    // Ballroom's neighbours: Hall, Conservatory — Study is not adjacent to Ballroom
    const mapping = makeCustomMapping(scenario, [
      "Hall",
      "Ballroom",
      "Library",
      "Study",
      "Lounge",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];

    const fact = { type: "SPOTTED_NEARBY", suspectId: 1, roomId: 3 }; // suspect in Ballroom, ref=Study
    const { fn } = renderFact(fact, mapping, roles);

    const assignment = { "1_Room": 1 }; // Ballroom
    expect(fn(assignment)).to.be.false;
  });

  it("fact fn returns true (undecided) when suspect room not yet assigned", function () {
    const mapping = makeCustomMapping(scenario, [
      "Hall",
      "Library",
      "Study",
      "Lounge",
      "Ballroom",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];
    const fact = { type: "SPOTTED_NEARBY", suspectId: 0, roomId: 1 };
    const { fn } = renderFact(fact, mapping, roles);
    expect(fn({})).to.be.true;
  });

  it("text contains a proximity phrase and is non-empty", function () {
    const mapping = makeCustomMapping(scenario, [
      "Hall",
      "Library",
      "Study",
      "Lounge",
      "Ballroom",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];
    const fact = { type: "SPOTTED_NEARBY", suspectId: 0, roomId: 1 };
    const { text } = renderFact(fact, mapping, roles);
    expect(text).to.be.a("string").and.not.empty;
    // Should mention the room
    expect(text).to.match(/near|vicinity|close/i);
  });

  it("generates SPOTTED_NEARBY facts over many runs of a manor case", function () {
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      const numSuspects = 5;
      const mapping = makeMapping(scenario, numSuspects);
      // Use truth with controlled adjacency-friendly placement
      const truth = [
        { id: 0, role: "Killer", roomId: 0, itemId: 0 },
        { id: 1, role: "Victim", roomId: 1, itemId: 1 },
        { id: 2, role: "Witness", roomId: 1, itemId: 2 },
        { id: 3, role: "Innocent", roomId: 2, itemId: 3 },
        { id: 4, role: "Innocent", roomId: 3, itemId: 4 },
      ];
      const roles = truth.map((t) => t.role);
      const clues = generateClues(truth, roles, numSuspects, mapping);
      if (clues.some((c) => c.type === "SPOTTED_NEARBY")) found = true;
    }
    expect(found, "Should generate at least one SPOTTED_NEARBY over 40 runs").to
      .be.true;
  });
});

// ─── NOT_NEAR_SCENE ───────────────────────────────────────────────────────────

describe("NOT_NEAR_SCENE clue type", function () {
  this.timeout(10000);

  const scenario = SCENARIOS.find((s) => s.id === "classic_manor");

  it("fact fn returns false when suspect IS in the victim's room", function () {
    const mapping = makeCustomMapping(scenario, [
      "Hall",
      "Ballroom",
      "Library",
      "Study",
      "Lounge",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];

    const fact = { type: "NOT_NEAR_SCENE", suspectId: 0 };
    const { fn } = renderFact(fact, mapping, roles);

    // Victim (idx 1) → room 1; suspect 0 also → room 1
    const assignment = { "0_Room": 1, "1_Room": 1 };
    expect(fn(assignment)).to.be.false;
  });

  it("fact fn returns false when suspect IS scream-adjacent to victim", function () {
    // Hall (0) and Library (2) are adjacent (Hall neighbours include Library)
    const mapping = makeCustomMapping(scenario, [
      "Hall",
      "Library",
      "Study",
      "Lounge",
      "Ballroom",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];

    const fact = { type: "NOT_NEAR_SCENE", suspectId: 0 };
    const { fn } = renderFact(fact, mapping, roles);

    // Victim (idx 1) → room 1 (Library); suspect 0 → room 0 (Hall)
    // Hall is scream-adjacent to Library → NOT_NEAR_SCENE should be false
    const assignment = { "0_Room": 0, "1_Room": 1 };
    expect(fn(assignment)).to.be.false;
  });

  it("fact fn returns true when suspect is far from victim", function () {
    // Ballroom (4) is adjacent to Hall; Cellar is not adjacent to Ballroom
    // Use Conservatory and Cellar which are distant from each other
    const mapping = makeCustomMapping(scenario, [
      "Hall",
      "Ballroom",
      "Library",
      "Cellar",
      "Conservatory",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];

    const fact = { type: "NOT_NEAR_SCENE", suspectId: 3 };
    const { fn } = renderFact(fact, mapping, roles);

    // Victim (idx 1) → room 4 (Conservatory); suspect 3 → room 3 (Cellar)
    // Conservatory neighbours: Ballroom — Cellar not in that list
    const assignment = { "3_Room": 3, "1_Room": 4 };
    expect(fn(assignment)).to.be.true;
  });

  it("fact fn returns true (undecided) when suspect room not yet assigned", function () {
    const mapping = makeCustomMapping(scenario, [
      "Hall",
      "Library",
      "Study",
      "Lounge",
      "Ballroom",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];
    const fact = { type: "NOT_NEAR_SCENE", suspectId: 0 };
    const { fn } = renderFact(fact, mapping, roles);
    expect(fn({})).to.be.true;
  });

  it("text contains an absence phrase and is non-empty", function () {
    const mapping = makeCustomMapping(scenario, [
      "Hall",
      "Library",
      "Study",
      "Lounge",
      "Ballroom",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];
    const fact = { type: "NOT_NEAR_SCENE", suspectId: 0 };
    const { text } = renderFact(fact, mapping, roles);
    expect(text).to.be.a("string").and.not.empty;
    expect(text).to.match(
      /nowhere near the murder scene|far from where the victim|away from the murder scene/i,
    );
  });
});

// ─── SEEN_ARRIVING ────────────────────────────────────────────────────────────

describe("SEEN_ARRIVING clue type", function () {
  this.timeout(10000);

  const calliope = SCENARIOS.find((s) => s.id === "calliope");

  it("fact fn returns true when suspect room is roomAdjacency-adjacent to reference room", function () {
    // Calliope: Titan neighbours = Enceladus, Dione, Tethys
    // roomNames index: 0=Titan, 1=Enceladus, 2=Dione, 3=Tethys, 4=Phoebe
    const mapping = makeCustomMapping(calliope, [
      "Titan",
      "Enceladus",
      "Dione",
      "Tethys",
      "Phoebe",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];

    // Suspect 0 is in Titan (idx 0), reference room is Enceladus (idx 1)
    // Enceladus's roomAdjacency includes Titan → should be true
    const fact = { type: "SEEN_ARRIVING", suspectId: 0, roomId: 1 };
    const { fn } = renderFact(fact, mapping, roles);

    const assignment = { "0_Room": 0 };
    expect(fn(assignment)).to.be.true;
  });

  it("fact fn returns false when suspect room is NOT roomAdjacency-adjacent to reference room", function () {
    // Titan: Enceladus, Dione, Tethys — but NOT Phoebe
    // Phoebe's neighbours: Iapetus, Enceladus — Titan not adjacent to Phoebe
    const mapping = makeCustomMapping(calliope, [
      "Titan",
      "Enceladus",
      "Dione",
      "Tethys",
      "Phoebe",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];

    // Suspect 0 is in Titan (idx 0), reference room is Phoebe (idx 4)
    // Phoebe's roomAdjacency does NOT include Titan
    const fact = { type: "SEEN_ARRIVING", suspectId: 0, roomId: 4 };
    const { fn } = renderFact(fact, mapping, roles);

    const assignment = { "0_Room": 0 };
    expect(fn(assignment)).to.be.false;
  });

  it("fact fn returns true (undecided) when suspect room not yet assigned", function () {
    const mapping = makeCustomMapping(calliope, [
      "Titan",
      "Enceladus",
      "Dione",
      "Tethys",
      "Phoebe",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];
    const fact = { type: "SEEN_ARRIVING", suspectId: 0, roomId: 1 };
    const { fn } = renderFact(fact, mapping, roles);
    expect(fn({})).to.be.true;
  });

  it("text contains an arriving phrase and mentions the reference room", function () {
    const mapping = makeCustomMapping(calliope, [
      "Titan",
      "Enceladus",
      "Dione",
      "Tethys",
      "Phoebe",
    ]);
    const roles = ["Innocent", "Victim", "Killer", "Innocent", "Innocent"];
    const fact = { type: "SEEN_ARRIVING", suspectId: 0, roomId: 1 };
    const { text } = renderFact(fact, mapping, roles);
    expect(text).to.be.a("string").and.not.empty;
    expect(text).to.match(/arriving|come from|heading in/i);
    expect(text).to.include("Enceladus");
  });

  it("generates SEEN_ARRIVING facts on Calliope scenario over many runs", function () {
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      const numSuspects = 5;
      const mapping = makeCustomMapping(calliope, [
        "Titan",
        "Enceladus",
        "Dione",
        "Tethys",
        "Phoebe",
      ]);
      // Victim in Titan; all others in adjacent moons so NOT_NEAR_SCENE won't fire
      const truth = [
        { id: 0, role: "Killer", roomId: 1, itemId: 0 }, // Enceladus
        { id: 1, role: "Victim", roomId: 0, itemId: 1 }, // Titan
        { id: 2, role: "Witness", roomId: 0, itemId: 2 }, // Titan
        { id: 3, role: "Innocent", roomId: 2, itemId: 3 }, // Dione
        { id: 4, role: "Innocent", roomId: 3, itemId: 4 }, // Tethys
      ];
      const roles = truth.map((t) => t.role);
      const clues = generateClues(truth, roles, numSuspects, mapping);
      if (clues.some((c) => c.type === "SEEN_ARRIVING")) found = true;
    }
    expect(
      found,
      "Should generate at least one SEEN_ARRIVING on Calliope over 40 runs",
    ).to.be.true;
  });

  it("SEEN_ARRIVING never fires on Calliope when there are no in-game adjacency neighbours", function () {
    // Phoebe's neighbours: Iapetus, Enceladus — neither is in this 3-room game
    const mapping = makeCustomMapping(calliope, ["Titan", "Phoebe", "Dione"]);
    // Ensure Titan's adjacency list contains no rooms in this mapping
    // (Titan adj: Enceladus, Dione, Tethys — Dione IS in this mapping, so Titan has neighbours)
    // Use only Phoebe for suspect 0 and check no SEEN_ARRIVING for Phoebe
    // Phoebe neighbours: Iapetus, Enceladus — neither in mapping
    const truth = [
      { id: 0, role: "Killer", roomId: 1, itemId: 0 }, // Phoebe — no in-game adj
      { id: 1, role: "Victim", roomId: 0, itemId: 1 }, // Titan
      { id: 2, role: "Innocent", roomId: 2, itemId: 2 }, // Dione
    ];
    const roles = truth.map((t) => t.role);
    const clues = generateClues(truth, roles, 3, mapping);

    // SEEN_ARRIVING for Phoebe should not appear (no in-game neighbours)
    const phoebeSA = clues.filter(
      (c) => c.type === "SEEN_ARRIVING" && c.suspectId === 0,
    );
    expect(phoebeSA).to.be.empty;
  });
});
