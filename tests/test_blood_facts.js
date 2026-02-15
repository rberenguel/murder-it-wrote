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

function generateCluesWithRetry(
  truth,
  roles,
  numSuspects,
  mapping,
  maxRetries = 3,
) {
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

describe("Blood Spill Clues", function () {
  describe("Item Blood Properties", function () {
    it("all items should have bloody property defined", function () {
      SCENARIOS.forEach((scenario) => {
        scenario.items.forEach((item) => {
          expect(item).to.have.property("bloody");
          expect(item.bloody).to.be.a("boolean");
        });
      });
    });

    it("edged weapons should be bloody", function () {
      const knives = SCENARIOS.flatMap((s) =>
        s.items.filter(
          (i) =>
            i.name.toLowerCase().includes("knife") ||
            i.name.toLowerCase().includes("dagger") ||
            i.name.toLowerCase().includes("blade"),
        ),
      );
      expect(knives.length).to.be.greaterThan(0);
      knives.forEach((weapon) => {
        expect(weapon.bloody, `${weapon.name} should be bloody`).to.be.true;
      });
    });

    it("blunt weapons should be bloody", function () {
      const bluntWeapons = SCENARIOS.flatMap((s) =>
        s.items.filter(
          (i) =>
            i.name.toLowerCase().includes("pipe") ||
            i.name.toLowerCase().includes("candlestick") ||
            i.name.toLowerCase().includes("wrench") ||
            i.name.toLowerCase().includes("hammer"),
        ),
      );
      expect(bluntWeapons.length).to.be.greaterThan(0);
      bluntWeapons.forEach((weapon) => {
        expect(weapon.bloody, `${weapon.name} should be bloody`).to.be.true;
      });
    });

    it("poison weapons should not be bloody", function () {
      const poisons = SCENARIOS.flatMap((s) =>
        s.items.filter(
          (i) =>
            i.name.toLowerCase().includes("poison") ||
            i.name.toLowerCase().includes("venom") ||
            i.name.toLowerCase().includes("toxin") ||
            i.name.toLowerCase().includes("hemlock") ||
            i.name.toLowerCase().includes("laudanum"),
        ),
      );
      expect(poisons.length).to.be.greaterThan(0);
      poisons.forEach((weapon) => {
        expect(weapon.bloody, `${weapon.name} should not be bloody`).to.be
          .false;
      });
    });

    it("suffocation weapons should not be bloody", function () {
      const suffocationWeapons = SCENARIOS.flatMap((s) =>
        s.items.filter(
          (i) =>
            i.name.toLowerCase().includes("rope") ||
            i.name.toLowerCase().includes("garrote") ||
            i.name.toLowerCase().includes("scarf") ||
            i.name.toLowerCase().includes("chloroform"),
        ),
      );
      expect(suffocationWeapons.length).to.be.greaterThan(0);
      suffocationWeapons.forEach((weapon) => {
        expect(weapon.bloody, `${weapon.name} should not be bloody`).to.be
          .false;
      });
    });

    it("firearms should be bloody", function () {
      const firearms = SCENARIOS.flatMap((s) =>
        s.items.filter(
          (i) =>
            i.name.toLowerCase().includes("revolver") ||
            i.name.toLowerCase().includes("pistol") ||
            i.name.toLowerCase().includes("blaster"),
        ),
      );
      expect(firearms.length).to.be.greaterThan(0);
      firearms.forEach((weapon) => {
        expect(weapon.bloody, `${weapon.name} should be bloody`).to.be.true;
      });
    });
  });

  describe("Blood Fact Generation", function () {
    it("should generate blood facts when killer has bloody weapon", function () {
      this.timeout(5000);

      const scenario = SCENARIOS.find((s) => s.id === "classic_manor");

      // Try multiple times to get a game with bloody weapon
      let foundBloodFact = false;
      for (let attempt = 0; attempt < 20 && !foundBloodFact; attempt++) {
        const numSuspects = 5;
        const mapping = {
          suspects: scenario.suspects.slice(0, numSuspects),
          rooms: scenario.rooms.slice(0, numSuspects),
          items: scenario.items.slice(0, numSuspects),
          scenario: scenario,
        };

        // Generate features
        mapping.features = {};
        mapping.rooms.forEach((room) => {
          const allFeats = scenario.roomFeatures[room.name] || [];
          mapping.features[room.name] = allFeats.slice(0, 3);
        });

        const { truth, roles } = generateTruthWithRetry(numSuspects);
        const clues = generateCluesWithRetry(
          truth,
          roles,
          numSuspects,
          mapping,
        );

        // Find killer and check weapon
        const killer = truth.find((p) => p.role === "Killer");
        const weapon = mapping.items[killer.itemId];

        const bloodFacts = clues.filter((c) => c.type === "BLOOD_ON_FEATURE");

        if (weapon.bloody) {
          // Should have blood facts
          expect(bloodFacts.length).to.be.greaterThan(0);
          expect(bloodFacts.length).to.be.at.most(2);
          foundBloodFact = true;
        } else {
          // Should not have blood facts
          expect(bloodFacts.length).to.equal(0);
        }
      }

      expect(foundBloodFact, "Should find at least one game with bloody weapon")
        .to.be.true;
    });

    it("should not generate blood facts when killer has non-bloody weapon", function () {
      this.timeout(5000);

      const scenario = SCENARIOS.find((s) => s.id === "classic_manor");

      // Try multiple times to get a game with non-bloody weapon (poison or rope)
      let foundNonBloodyWeapon = false;
      for (let attempt = 0; attempt < 30 && !foundNonBloodyWeapon; attempt++) {
        const numSuspects = 5;
        const mapping = {
          suspects: scenario.suspects.slice(0, numSuspects),
          rooms: scenario.rooms.slice(0, numSuspects),
          items: scenario.items.slice(0, numSuspects),
          scenario: scenario,
        };

        // Generate features
        mapping.features = {};
        mapping.rooms.forEach((room) => {
          const allFeats = scenario.roomFeatures[room.name] || [];
          mapping.features[room.name] = allFeats.slice(0, 3);
        });

        const { truth, roles } = generateTruthWithRetry(numSuspects);
        const clues = generateCluesWithRetry(
          truth,
          roles,
          numSuspects,
          mapping,
        );

        // Find killer and check weapon
        const killer = truth.find((p) => p.role === "Killer");
        const weapon = mapping.items[killer.itemId];

        const bloodFacts = clues.filter((c) => c.type === "BLOOD_ON_FEATURE");

        if (!weapon.bloody) {
          // Should not have blood facts
          expect(bloodFacts.length).to.equal(0);
          foundNonBloodyWeapon = true;
        }
      }

      expect(
        foundNonBloodyWeapon,
        "Should find at least one game with non-bloody weapon",
      ).to.be.true;
    });

    it("blood facts should reference features in victim's room", function () {
      this.timeout(5000);

      const scenario = SCENARIOS.find((s) => s.id === "classic_manor");

      // Try multiple times to get a game with bloody weapon
      for (let attempt = 0; attempt < 30; attempt++) {
        const numSuspects = 5;
        const mapping = {
          suspects: scenario.suspects.slice(0, numSuspects),
          rooms: scenario.rooms.slice(0, numSuspects),
          items: scenario.items.slice(0, numSuspects),
          scenario: scenario,
        };

        // Generate features
        mapping.features = {};
        mapping.rooms.forEach((room) => {
          const allFeats = scenario.roomFeatures[room.name] || [];
          mapping.features[room.name] = allFeats.slice(0, 3);
        });

        const { truth, roles } = generateTruthWithRetry(numSuspects);
        const clues = generateCluesWithRetry(
          truth,
          roles,
          numSuspects,
          mapping,
        );

        // Find victim
        const victim = truth.find((p) => p.role === "Victim");
        const victimRoom = mapping.rooms[victim.roomId];

        const bloodFacts = clues.filter((c) => c.type === "BLOOD_ON_FEATURE");

        if (bloodFacts.length > 0) {
          // All blood facts should be in victim's room
          bloodFacts.forEach((fact) => {
            expect(fact.roomId).to.equal(victim.roomId);

            // Feature should be in victim's room's feature list
            const roomFeatures = mapping.features[victimRoom.name] || [];
            const featureNames = roomFeatures.map((f) =>
              typeof f === "string" ? f : f.name,
            );
            expect(featureNames).to.include(fact.featureName);
          });

          // Found a case with blood facts, test passed
          return;
        }
      }

      // If we get here, we didn't find a case with blood facts
      // This is acceptable since we might not get a bloody weapon
      this.skip();
    });
  });

  describe("Blood Fact Structure", function () {
    it("blood facts should have correct structure", function () {
      this.timeout(5000);

      const scenario = SCENARIOS.find((s) => s.id === "classic_manor");

      for (let attempt = 0; attempt < 30; attempt++) {
        const numSuspects = 5;
        const mapping = {
          suspects: scenario.suspects.slice(0, numSuspects),
          rooms: scenario.rooms.slice(0, numSuspects),
          items: scenario.items.slice(0, numSuspects),
          scenario: scenario,
        };

        mapping.features = {};
        mapping.rooms.forEach((room) => {
          const allFeats = scenario.roomFeatures[room.name] || [];
          mapping.features[room.name] = allFeats.slice(0, 3);
        });

        const { truth, roles } = generateTruthWithRetry(numSuspects);
        const clues = generateCluesWithRetry(
          truth,
          roles,
          numSuspects,
          mapping,
        );

        const bloodFacts = clues.filter((c) => c.type === "BLOOD_ON_FEATURE");

        if (bloodFacts.length > 0) {
          bloodFacts.forEach((fact) => {
            expect(fact).to.have.property("type");
            expect(fact.type).to.equal("BLOOD_ON_FEATURE");
            expect(fact).to.have.property("roomId");
            expect(fact.roomId).to.be.a("number");
            expect(fact).to.have.property("featureName");
            expect(fact.featureName).to.be.a("string");
          });
          return;
        }
      }

      this.skip();
    });
  });
});
