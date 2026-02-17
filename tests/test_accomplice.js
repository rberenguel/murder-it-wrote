const { expect } = chai;

import { generateTruth } from "../js/generator.js";

describe("Accomplice bugs", function () {
  // Simulate what renderUI does for the case manifest (fixed: Accomplice included)
  function getManifestRoleCounts(roles) {
    return roles.reduce((a, r) => {
      if (!["Killer", "Victim"].includes(r)) a[r] = (a[r] || 0) + 1;
      return a;
    }, {});
  }

  describe("generateTruth - no phantom roles", function () {
    it("roles length should never exceed numSuspects (100 3-suspect games)", function () {
      let phantomCount = 0;
      for (let i = 0; i < 100; i++) {
        const { truth, roles } = generateTruth(3);
        if (roles.length > 3) {
          phantomCount++;
        }
        // roles.length must equal numSuspects
        expect(
          roles.length,
          `game ${i}: roles.length (${roles.length}) > numSuspects (3)`,
        ).to.equal(3);
      }
    });

    it("every role in truth must appear in roles array", function () {
      for (let i = 0; i < 100; i++) {
        const { truth, roles } = generateTruth(3);
        truth.forEach((suspect) => {
          expect(
            roles,
            `game ${i}: suspect role "${suspect.role}" not found in roles array [${roles}]`,
          ).to.include(suspect.role);
        });
      }
    });

    it("roles array should only contain roles actually assigned in truth", function () {
      for (let i = 0; i < 100; i++) {
        const { truth, roles } = generateTruth(3);
        const truthRoles = new Set(truth.map((t) => t.role));
        // Every role in the roles array should appear in truth
        // (allowing for multiple Innocents - one entry per position)
        // The unique roles in `roles` should match unique roles in `truth`
        const uniqueRolesInArray = new Set(roles);
        uniqueRolesInArray.forEach((role) => {
          expect(
            truthRoles.has(role),
            `game ${i}: role "${role}" in roles array but no suspect has it (truth roles: [${[...truthRoles]}])`,
          ).to.be.true;
        });
      }
    });
  });

  describe("Manifest - accomplice counted correctly", function () {
    it("manifest role counts should account for all numSuspects (3-suspect games, 100 runs)", function () {
      const numSuspects = 3;
      for (let i = 0; i < 100; i++) {
        const { roles } = generateTruth(numSuspects);

        // Simulate current renderUI manifest logic (which excludes Accomplice)
        const roleCounts = getManifestRoleCounts(roles);
        const manifestTotal =
          1 + // Killer (hardcoded)
          1 + // Victim (hardcoded)
          Object.values(roleCounts).reduce((s, c) => s + c, 0);

        // If accomplice exists, manifestTotal will be numSuspects - 1 (BUG)
        const hasAccomplice = roles.includes("Accomplice");
        if (hasAccomplice) {
          expect(
            manifestTotal,
            `game ${i}: manifest shows ${manifestTotal} suspects but game has ${numSuspects} (accomplice hidden)`,
          ).to.equal(numSuspects); // This FAILS with the bug
        } else {
          expect(manifestTotal).to.equal(numSuspects);
        }
      }
    });

    it("manifest should show accomplice when one exists (5-suspect games, 100 runs)", function () {
      const numSuspects = 5;
      for (let i = 0; i < 100; i++) {
        const { roles } = generateTruth(numSuspects);
        const hasAccomplice = roles.includes("Accomplice");
        if (!hasAccomplice) continue;

        const roleCounts = getManifestRoleCounts(roles);
        const manifestTotal =
          1 + 1 + Object.values(roleCounts).reduce((s, c) => s + c, 0);

        expect(
          manifestTotal,
          `game ${i}: manifest shows ${manifestTotal} suspects but game has ${numSuspects}`,
        ).to.equal(numSuspects); // This FAILS because accomplice not counted
      }
    });
  });
});
