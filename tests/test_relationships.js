const { expect } = chai;

import { generateTruth, generateClues } from "../js/generator.js";
import { SCENARIOS } from "../js/constants.js";

// Helper function to generate truth with retry on corruption
function generateTruthWithRetry(numSuspects, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = generateTruth(numSuspects);
      const hasInvalid = result.truth.some(
        (p) =>
          p.id === undefined ||
          p.roomId === undefined ||
          p.itemId === undefined ||
          p.role === undefined,
      );
      if (!hasInvalid) return result;
    } catch (e) {
      if (i === maxRetries - 1) throw e;
    }
  }
  throw new Error("Failed to generate valid truth after retries");
}

function generateCluesWithRetry(truth, roles, numSuspects, mapping, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return generateClues(truth, roles, numSuspects, mapping);
    } catch (e) {
      if (e.message === "CORRUPT_TRUTH_DATA") {
        const newResult = generateTruthWithRetry(numSuspects);
        truth = newResult.truth;
        roles = newResult.roles;
        continue;
      }
      throw e;
    }
  }
  throw new Error("Failed to generate valid clues after retries");
}

describe("Relationship Clues", function () {
  describe("Scenario Relationships", function () {
    it("Continental Express should have relationships defined", function () {
      const scenario = SCENARIOS.find((s) => s.id === "continental_express");
      expect(scenario).to.exist;
      expect(scenario.relationships).to.be.an("array");
      expect(scenario.relationships.length).to.be.greaterThan(0);

      // Check structure
      scenario.relationships.forEach((rel) => {
        expect(rel).to.have.property("type");
        expect(rel).to.have.property("suspects");
        expect(rel.suspects).to.be.an("array");

        rel.suspects.forEach((suspect) => {
          expect(suspect).to.have.property("name");
          expect(suspect).to.have.property("term");
        });
      });
    });

    it("Gatsby should have relationships defined", function () {
      const scenario = SCENARIOS.find((s) => s.id === "gatsby");
      expect(scenario).to.exist;
      expect(scenario.relationships).to.be.an("array");
      expect(scenario.relationships.length).to.be.greaterThan(0);
    });

    it("relationship suspects should be in scenario suspects list", function () {
      const scenariosWithRelationships = SCENARIOS.filter(
        (s) => s.relationships && s.relationships.length > 0,
      );

      scenariosWithRelationships.forEach((scenario) => {
        scenario.relationships.forEach((rel) => {
          rel.suspects.forEach((relSuspect) => {
            expect(scenario.suspects).to.include(relSuspect.name);
          });
        });
      });
    });
  });

  describe("Relationship Fact Generation", function () {
    it("should generate relationship facts when related suspects are in game", function () {
      const scenario = SCENARIOS.find((s) => s.id === "continental_express");

      // Create a game with both Archduke and Archduchess
      const suspectList = [
        "Archduke Viktor",
        "Archduchess Elara",
        "Major Crawford",
        "Alice Pemberley",
      ];

      const mapping = {
        suspects: suspectList,
        rooms: scenario.rooms.slice(0, 4),
        items: scenario.items.slice(0, 4),
        scenario: scenario,
      };

      let { truth, roles } = generateTruthWithRetry(4);
      const clues = generateCluesWithRetry(truth, roles, 4, mapping);

      // Should have relationship facts
      const relationshipFacts = clues.filter(
        (c) =>
          c.type === "RELATIONSHIP_LOCATION" ||
          c.type === "RELATIONSHIP_ITEM" ||
          c.type === "RELATIONSHIP_HAS_TRAIT",
      );

      expect(relationshipFacts.length).to.be.greaterThan(0);
    });

    it("should not generate relationship facts when related suspects are not all in game", function () {
      const scenario = SCENARIOS.find((s) => s.id === "continental_express");

      // Create a game with only one of the married couple
      const suspectList = [
        "Archduke Viktor",
        "Major Crawford",
        "Alice Pemberley",
        "Edmund Blackwell",
      ];

      const mapping = {
        suspects: suspectList,
        rooms: scenario.rooms.slice(0, 4),
        items: scenario.items.slice(0, 4),
        scenario: scenario,
      };

      let { truth, roles } = generateTruthWithRetry(4);
      const clues = generateCluesWithRetry(truth, roles, 4, mapping);

      // Should NOT have relationship facts (Archduchess not in game)
      const relationshipFacts = clues.filter(
        (c) =>
          c.type === "RELATIONSHIP_LOCATION" ||
          c.type === "RELATIONSHIP_ITEM" ||
          c.type === "RELATIONSHIP_HAS_TRAIT",
      );

      expect(relationshipFacts.length).to.equal(0);
    });

    it("should generate different types of relationship facts", function () {
      const scenario = SCENARIOS.find((s) => s.id === "gatsby");

      // Tom and Daisy Buchanan
      const suspectList = [
        "Tom Buchanan",
        "Daisy Buchanan",
        "Jay Gatsby",
        "Nick Carraway",
      ];

      const mapping = {
        suspects: suspectList,
        rooms: scenario.rooms.slice(0, 4),
        items: scenario.items.slice(0, 4),
        scenario: scenario,
      };

      let { truth, roles } = generateTruthWithRetry(4);
      const clues = generateCluesWithRetry(truth, roles, 4, mapping);

      const locationFacts = clues.filter((c) => c.type === "RELATIONSHIP_LOCATION");
      const itemFacts = clues.filter((c) => c.type === "RELATIONSHIP_ITEM");
      const traitFacts = clues.filter((c) => c.type === "RELATIONSHIP_HAS_TRAIT");

      expect(locationFacts.length).to.be.greaterThan(0);
      expect(itemFacts.length).to.be.greaterThan(0);
      expect(traitFacts.length).to.be.greaterThan(0);
    });

    it("should include relationship type and term in facts", function () {
      const scenario = SCENARIOS.find((s) => s.id === "continental_express");

      const suspectList = [
        "Archduke Viktor",
        "Archduchess Elara",
        "Major Crawford",
        "Alice Pemberley",
      ];

      const mapping = {
        suspects: suspectList,
        rooms: scenario.rooms.slice(0, 4),
        items: scenario.items.slice(0, 4),
        scenario: scenario,
      };

      let { truth, roles } = generateTruthWithRetry(4);
      const clues = generateCluesWithRetry(truth, roles, 4, mapping);

      const relationshipFacts = clues.filter(
        (c) =>
          c.type === "RELATIONSHIP_LOCATION" ||
          c.type === "RELATIONSHIP_ITEM" ||
          c.type === "RELATIONSHIP_HAS_TRAIT",
      );

      relationshipFacts.forEach((fact) => {
        expect(fact.relationshipType).to.exist;
        expect(fact.relationshipTerm).to.exist;
        expect(["husband", "wife"]).to.include(fact.relationshipTerm);
        // Should NOT have suspectId - this is resolved at solve time
        expect(fact.suspectId).to.be.undefined;
      });
    });
  });

  describe("Multiple Relationships", function () {
    it("should NOT generate ambiguous clues when multiple people share a term", function () {
      const scenario = SCENARIOS.find((s) => s.id === "gatsby");

      // Include both married couples - creates TWO husbands and TWO wives
      const suspectList = [
        "Tom Buchanan",
        "Daisy Buchanan",
        "George Wilson",
        "Myrtle Wilson",
        "Jay Gatsby",
      ];

      const mapping = {
        suspects: suspectList,
        rooms: scenario.rooms.slice(0, 5),
        items: scenario.items.slice(0, 5),
        scenario: scenario,
      };

      let { truth, roles } = generateTruthWithRetry(5);
      const clues = generateCluesWithRetry(truth, roles, 5, mapping);

      const relationshipFacts = clues.filter(
        (c) =>
          c.type === "RELATIONSHIP_LOCATION" ||
          c.type === "RELATIONSHIP_ITEM" ||
          c.type === "RELATIONSHIP_HAS_TRAIT",
      );

      // Should NOT generate any relationship facts because terms are ambiguous
      // (two husbands, two wives)
      expect(relationshipFacts.length).to.equal(0);
    });

    it("should generate clues when only one couple is in the game", function () {
      const scenario = SCENARIOS.find((s) => s.id === "gatsby");

      // Only one married couple - terms are unique
      const suspectList = [
        "Tom Buchanan",
        "Daisy Buchanan",
        "Jay Gatsby",
        "Nick Carraway",
        "Jordan Baker",
      ];

      const mapping = {
        suspects: suspectList,
        rooms: scenario.rooms.slice(0, 5),
        items: scenario.items.slice(0, 5),
        scenario: scenario,
      };

      let { truth, roles } = generateTruthWithRetry(5);
      const clues = generateCluesWithRetry(truth, roles, 5, mapping);

      const relationshipFacts = clues.filter(
        (c) =>
          c.type === "RELATIONSHIP_LOCATION" ||
          c.type === "RELATIONSHIP_ITEM" ||
          c.type === "RELATIONSHIP_HAS_TRAIT",
      );

      // Should have relationship facts because terms are unique
      expect(relationshipFacts.length).to.be.greaterThan(0);

      // Check terms are unique in generated facts
      const terms = relationshipFacts.map((f) => f.relationshipTerm);
      const uniqueTerms = new Set(terms);
      expect(uniqueTerms.size).to.equal(2); // husband and wife
    });
  });

  describe("Optional Relationships", function () {
    it("should have optional relationships defined in scenarios", function () {
      const scenariosWithOptional = SCENARIOS.filter((s) =>
        s.relationships?.some((r) => r.optional === true),
      );

      expect(scenariosWithOptional.length).to.be.greaterThan(0);

      scenariosWithOptional.forEach((scenario) => {
        const optionalRels = scenario.relationships.filter((r) => r.optional);
        optionalRels.forEach((rel) => {
          expect(rel).to.have.property("optional", true);
          expect(rel).to.have.property("probability");
          expect(rel.probability).to.be.at.least(0).and.at.most(1);
        });
      });
    });

    it("should sometimes include optional relationships", function () {
      // Run multiple times to test probability
      const scenario = SCENARIOS.find((s) => s.id === "sherlock");
      let timesIncluded = 0;
      const trials = 20;

      for (let i = 0; i < trials; i++) {
        // Use Dr. Watson and Mary Morstan (optional married couple)
        const suspectList = [
          "Dr. Watson",
          "Mary Morstan",
          "Sherlock Holmes",
          "Inspector Lestrade",
        ];

        const mapping = {
          suspects: suspectList,
          rooms: scenario.rooms.slice(0, 4),
          items: scenario.items.slice(0, 4),
          scenario: scenario,
        };

        let { truth, roles } = generateTruthWithRetry(4);
        const clues = generateCluesWithRetry(truth, roles, 4, mapping);

        const watsonMorstanFacts = clues.filter(
          (c) =>
            (c.type === "RELATIONSHIP_LOCATION" ||
              c.type === "RELATIONSHIP_ITEM" ||
              c.type === "RELATIONSHIP_HAS_TRAIT") &&
            c.relationshipType === "married",
        );

        if (watsonMorstanFacts.length > 0) {
          timesIncluded++;
        }
      }

      // With 70% probability, we expect it to be included sometimes but not always
      expect(timesIncluded).to.be.greaterThan(0);
      expect(timesIncluded).to.be.lessThan(trials);
    });

    it("should always include mandatory relationships", function () {
      const scenario = SCENARIOS.find((s) => s.id === "sherlock");
      let allIncluded = true;

      for (let i = 0; i < 10; i++) {
        // Sherlock and Mycroft Holmes (mandatory siblings)
        const suspectList = [
          "Sherlock Holmes",
          "Mycroft Holmes",
          "Dr. Watson",
          "Inspector Lestrade",
        ];

        const mapping = {
          suspects: suspectList,
          rooms: scenario.rooms.slice(0, 4),
          items: scenario.items.slice(0, 4),
          scenario: scenario,
        };

        let { truth, roles } = generateTruthWithRetry(4);
        const clues = generateCluesWithRetry(truth, roles, 4, mapping);

        const siblingFacts = clues.filter(
          (c) =>
            (c.type === "RELATIONSHIP_LOCATION" ||
              c.type === "RELATIONSHIP_ITEM" ||
              c.type === "RELATIONSHIP_HAS_TRAIT") &&
            c.relationshipType === "siblings",
        );

        if (siblingFacts.length === 0) {
          allIncluded = false;
          break;
        }
      }

      expect(allIncluded).to.be.true;
    });

    it("should handle multiple relationship types in same scenario", function () {
      const scenario = SCENARIOS.find((s) => s.id === "radio_shrink");

      // Dr. Alistair and Dr. Malcolm Heron (siblings), Arthur Heron (father)
      const suspectList = [
        "Dr. Alistair Heron",
        "Dr. Malcolm Heron",
        "Arthur Heron",
        "Clara Skye",
        "Ruby Reed",
      ];

      const mapping = {
        suspects: suspectList,
        rooms: scenario.rooms.slice(0, 5),
        items: scenario.items.slice(0, 5),
        scenario: scenario,
      };

      let { truth, roles } = generateTruthWithRetry(5);
      const clues = generateCluesWithRetry(truth, roles, 5, mapping);

      const relationshipFacts = clues.filter(
        (c) =>
          c.type === "RELATIONSHIP_LOCATION" ||
          c.type === "RELATIONSHIP_ITEM" ||
          c.type === "RELATIONSHIP_HAS_TRAIT",
      );

      // Should have facts for multiple relationship types
      const relationshipTypes = new Set(
        relationshipFacts.map((f) => f.relationshipType),
      );
      expect(relationshipTypes.size).to.be.greaterThan(0);
    });
  });
});
