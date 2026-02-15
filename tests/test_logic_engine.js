const { expect } = chai;

import { LogicEngine } from "../js/logic-engine.js";

describe("LogicEngine", function () {
  describe("Basic CSP Solving", function () {
    it("should solve a simple 3-suspect problem with no constraints", function () {
      const roles = ["Killer", "Victim", "Innocent"];
      const engine = new LogicEngine(3, roles);

      const solutions = engine.solve(10);

      // Should find multiple solutions (no constraints)
      expect(solutions.length).to.be.greaterThan(0);

      // Each solution should have all variables assigned
      solutions.forEach((sol) => {
        expect(sol).to.have.property("0_Role");
        expect(sol).to.have.property("0_Item");
        expect(sol).to.have.property("0_Room");
        expect(sol).to.have.property("1_Role");
        expect(sol).to.have.property("1_Item");
        expect(sol).to.have.property("1_Room");
        expect(sol).to.have.property("2_Role");
        expect(sol).to.have.property("2_Item");
        expect(sol).to.have.property("2_Room");
      });
    });

    it("should enforce role uniqueness constraint", function () {
      const roles = ["Killer", "Victim", "Innocent"];
      const engine = new LogicEngine(3, roles);

      const solutions = engine.solve(10);

      solutions.forEach((sol) => {
        const roleValues = [sol["0_Role"], sol["1_Role"], sol["2_Role"]];
        // All roles should be different (set size = array size)
        expect(new Set(roleValues).size).to.equal(3);
      });
    });

    it("should enforce item uniqueness constraint", function () {
      const roles = ["Killer", "Victim", "Innocent"];
      const engine = new LogicEngine(3, roles);

      const solutions = engine.solve(10);

      solutions.forEach((sol) => {
        const itemValues = [sol["0_Item"], sol["1_Item"], sol["2_Item"]];
        // All items should be different
        expect(new Set(itemValues).size).to.equal(3);
      });
    });

    it("should respect domain restrictions", function () {
      const roles = ["Killer", "Victim", "Innocent"];
      const engine = new LogicEngine(3, roles);

      // Restrict suspect 0 to room 1 only (bitmask: 0b010 = 2)
      engine.restrict(2 * 3 + 0, 0b010);

      const solutions = engine.solve(10);

      solutions.forEach((sol) => {
        expect(sol["0_Room"]).to.equal(1);
      });
    });

    it("should handle functional constraints", function () {
      const roles = ["Killer", "Victim", "Innocent"];
      const engine = new LogicEngine(3, roles);

      // Add constraint: Suspect 0 and Suspect 1 must be in different rooms
      engine.addConstraint((assignment) => {
        return assignment["0_Room"] !== assignment["1_Room"];
      });

      const solutions = engine.solve(10);

      solutions.forEach((sol) => {
        expect(sol["0_Room"]).to.not.equal(sol["1_Room"]);
      });
    });

    it("should return empty array when no solution exists", function () {
      const roles = ["Killer", "Victim", "Innocent"];
      const engine = new LogicEngine(3, roles);

      // Create impossible constraint: suspect 0 must be in room 0 AND room 1
      engine.restrict(2 * 3 + 0, 0b001); // Room 0 only
      engine.addConstraint((assignment) => {
        return assignment["0_Room"] === 1; // But also must be room 1
      });

      const solutions = engine.solve(10);

      expect(solutions).to.be.an("array").that.is.empty;
    });

    it("should respect solution limit", function () {
      const roles = ["Killer", "Victim", "Innocent"];
      const engine = new LogicEngine(3, roles);

      const solutions = engine.solve(2);

      expect(solutions.length).to.be.at.most(2);
    });
  });

  describe("Complex Constraints", function () {
    it("should solve with multiple overlapping constraints", function () {
      const roles = ["Killer", "Victim", "Witness", "Innocent"];
      const engine = new LogicEngine(4, roles);

      // Constraint 1: Killer has item 0
      engine.addConstraint((a) => {
        const killerIdx = [0, 1, 2, 3].find((i) => a[`${i}_Role`] === "Killer");
        return killerIdx !== undefined && a[`${killerIdx}_Item`] === 0;
      });

      // Constraint 2: Victim is in room 2
      engine.addConstraint((a) => {
        const victimIdx = [0, 1, 2, 3].find((i) => a[`${i}_Role`] === "Victim");
        return victimIdx !== undefined && a[`${victimIdx}_Room`] === 2;
      });

      const solutions = engine.solve(10);

      expect(solutions.length).to.be.greaterThan(0);

      solutions.forEach((sol) => {
        // Verify constraints
        const killerIdx = [0, 1, 2, 3].find((i) => sol[`${i}_Role`] === "Killer");
        const victimIdx = [0, 1, 2, 3].find((i) => sol[`${i}_Role`] === "Victim");

        expect(sol[`${killerIdx}_Item`]).to.equal(0);
        expect(sol[`${victimIdx}_Room`]).to.equal(2);
      });
    });
  });
});
