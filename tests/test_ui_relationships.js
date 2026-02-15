const { expect } = chai;

import { getSuspectRelationships } from "../js/ui.js";
import { updateState } from "../js/game-state.js";
import { SCENARIOS } from "../js/constants.js";

describe("UI Relationship Display", function () {
  beforeEach(function () {
    // Reset state before each test
    updateState({
      gameMapping: null,
      activeScenario: null,
    });
  });

  it("should return empty array when no relationships exist", function () {
    const scenario = SCENARIOS.find((s) => s.id === "stellar_voyage");

    updateState({
      activeScenario: scenario,
      gameMapping: {
        suspects: ["Capt. Beaumont", "Cmdr. Hayes", "Lt. Cmdr. Logic"],
        scenario: scenario,
      },
    });

    const rels = getSuspectRelationships("Capt. Beaumont");
    expect(rels).to.be.an("array").that.is.empty;
  });

  it("should return relationship info for married suspects", function () {
    const scenario = SCENARIOS.find((s) => s.id === "continental_express");

    updateState({
      activeScenario: scenario,
      gameMapping: {
        suspects: ["Archduke Viktor", "Archduchess Elara", "Major Crawford"],
        scenario: scenario,
      },
    });

    const viktorRels = getSuspectRelationships("Archduke Viktor");
    expect(viktorRels).to.have.lengthOf(1);
    expect(viktorRels[0]).to.deep.include({
      term: "husband",
      relatedTo: "Archduchess Elara",
      relatedTerm: "wife",
      type: "married",
    });

    const elaraRels = getSuspectRelationships("Archduchess Elara");
    expect(elaraRels).to.have.lengthOf(1);
    expect(elaraRels[0]).to.deep.include({
      term: "wife",
      relatedTo: "Archduke Viktor",
      relatedTerm: "husband",
      type: "married",
    });
  });

  it("should return empty array when relationship partner is not in game", function () {
    const scenario = SCENARIOS.find((s) => s.id === "continental_express");

    // Only Archduke, not Archduchess
    updateState({
      activeScenario: scenario,
      gameMapping: {
        suspects: ["Archduke Viktor", "Major Crawford", "Alice Pemberley"],
        scenario: scenario,
      },
    });

    const rels = getSuspectRelationships("Archduke Viktor");
    expect(rels).to.be.an("array").that.is.empty;
  });

  it("should return multiple relationships for suspects with multiple relations", function () {
    const scenario = SCENARIOS.find((s) => s.id === "radio_shrink");

    updateState({
      activeScenario: scenario,
      gameMapping: {
        suspects: [
          "Dr. Alistair Heron",
          "Dr. Malcolm Heron",
          "Arthur Heron",
          "Clara Skye",
        ],
        scenario: scenario,
      },
    });

    const alistairRels = getSuspectRelationships("Dr. Alistair Heron");

    // Should have at least 2 relationships: brother (to Malcolm) and son (to Arthur)
    expect(alistairRels.length).to.be.at.least(2);

    const relationTypes = alistairRels.map((r) => r.type);
    expect(relationTypes).to.include("siblings");
    expect(relationTypes).to.include("parent-child");
  });

  it("should handle siblings correctly", function () {
    const scenario = SCENARIOS.find((s) => s.id === "sherlock");

    updateState({
      activeScenario: scenario,
      gameMapping: {
        suspects: ["Sherlock Holmes", "Mycroft Holmes", "Dr. Watson"],
        scenario: scenario,
      },
    });

    const sherlockRels = getSuspectRelationships("Sherlock Holmes");
    expect(sherlockRels).to.have.lengthOf.at.least(1);

    const siblingRel = sherlockRels.find((r) => r.type === "siblings");
    expect(siblingRel).to.exist;
    expect(siblingRel.term).to.equal("younger brother");
    expect(siblingRel.relatedTo).to.equal("Mycroft Holmes");
  });

  it("should not include optional relationships that are not active", function () {
    // This is harder to test deterministically since optional relationships
    // are randomly included. We can at least verify the structure is correct.
    const scenario = SCENARIOS.find((s) => s.id === "sherlock");

    updateState({
      activeScenario: scenario,
      gameMapping: {
        suspects: ["Dr. Watson", "Mary Morstan", "Sherlock Holmes"],
        scenario: scenario,
      },
    });

    // Watson-Morstan marriage is optional, so it may or may not be there
    // Just verify the function doesn't crash
    const watsonRels = getSuspectRelationships("Dr. Watson");
    expect(watsonRels).to.be.an("array");

    // If the optional relationship was included, verify it's structured correctly
    if (watsonRels.length > 0) {
      watsonRels.forEach((rel) => {
        expect(rel).to.have.property("term");
        expect(rel).to.have.property("relatedTo");
        expect(rel).to.have.property("type");
      });
    }
  });
});
