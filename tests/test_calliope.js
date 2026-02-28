const { expect } = chai;

import { generateTruth } from "../js/generator.js";

describe("Calliope — forcedItem mechanic", function () {
  describe("generateTruth with forcedConstraints", function () {
    it("suspect at suspectIdx always receives itemIdx (mid position, 100 runs)", function () {
      for (let i = 0; i < 100; i++) {
        const { truth } = generateTruth(5, [{ suspectIdx: 2, itemIdx: 0 }]);
        expect(
          truth[2].itemId,
          `run ${i}: suspect 2 should have item 0, got ${truth[2].itemId}`,
        ).to.equal(0);
      }
    });

    it("suspect at suspectIdx 0 always receives itemIdx (edge: first, 100 runs)", function () {
      for (let i = 0; i < 100; i++) {
        const { truth } = generateTruth(4, [{ suspectIdx: 0, itemIdx: 2 }]);
        expect(
          truth[0].itemId,
          `run ${i}: suspect 0 should have item 2, got ${truth[0].itemId}`,
        ).to.equal(2);
      }
    });

    it("suspect at suspectIdx N-1 always receives itemIdx (edge: last, 100 runs)", function () {
      for (let i = 0; i < 100; i++) {
        const { truth } = generateTruth(6, [{ suspectIdx: 5, itemIdx: 0 }]);
        expect(
          truth[5].itemId,
          `run ${i}: suspect 5 should have item 0, got ${truth[5].itemId}`,
        ).to.equal(0);
      }
    });

    it("item assignment remains a valid permutation after forcing (100 runs)", function () {
      for (let i = 0; i < 100; i++) {
        const numSuspects = 5;
        const { truth } = generateTruth(numSuspects, [
          { suspectIdx: 2, itemIdx: 0 },
        ]);
        const itemIds = truth.map((t) => t.itemId).sort((a, b) => a - b);
        expect(
          itemIds,
          `run ${i}: item assignment is not a valid permutation: [${itemIds}]`,
        ).to.deep.equal([0, 1, 2, 3, 4]);
      }
    });

    it("no constraint leaves item assignment unchanged (baseline, 100 runs)", function () {
      for (let i = 0; i < 100; i++) {
        const numSuspects = 4;
        const { truth } = generateTruth(numSuspects, []);
        const itemIds = truth.map((t) => t.itemId).sort((a, b) => a - b);
        expect(itemIds).to.deep.equal([0, 1, 2, 3]);
      }
    });
  });
});
