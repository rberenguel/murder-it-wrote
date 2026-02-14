import { IDS } from "./constants.js";

/**
 * LogicEngine is a Constraint Satisfaction Problem (CSP) solver tailored for the deduction logic of the game.
 * It uses backtracking search with heuristics to find valid assignments of Roles, Items, and Rooms to Suspects.
 *
 * Representation:
 * - We have 15 variables:
 *   - 0-4: Roles for Suspects 0-4
 *   - 5-9: Items for Suspects 0-4
 *   - 10-14: Rooms for Suspects 0-4
 * - Domains are stored as bitmasks (Int32). A bit at position 'i' being 1 means the value 'i' is still possible.
 * - Initial domain for each variable is 31 (binary 11111), indicating all 5 values (0-4) are possible.
 */
export class LogicEngine {
  constructor(numSuspects, roleBag) {
    // Vars: 0..n-1 Role, n..2n-1 Item, 2n..3n-1 Room
    this.numSuspects = numSuspects;
    this.numVars = numSuspects * 3;
    this.roleBag = roleBag;
    this.constraints = [];
    // Domain mask: if n=5, 31 (11111); if n=4, 15 (1111)
    this.fullMask = (1 << numSuspects) - 1;
    this.initialDomains = new Int32Array(this.numVars).fill(this.fullMask);
  }

  /**
   * Adds a complex functional constraint (e.g., text-based clues translated to logic).
   * @param {Function} fn - A function that takes an assignment object and returns true if valid.
   */
  addConstraint(fn) {
    this.constraints.push(fn);
  }

  /**
   * Directly restricts the domain of a variable using a bitmask.
   * Used for unit propagation of simple facts (e.g., "Person X was in Room Y").
   */
  restrict(varIdx, mask) {
    this.initialDomains[varIdx] &= mask;
  }

  /**
   * Solves the CSP and returns up to 'limit' valid solutions.
   * @param {number} limit - Maximum number of solutions to find.
   * @returns {Object[]} Array of assignment objects.
   */
  solve(limit = 2) {
    const solutions = [];
    // Start recursive backtracking search with a copy of initial domains
    this._search(new Int32Array(this.initialDomains), solutions, limit);
    return solutions;
  }

  /**
   * Internal recursive search function implementing backtracking.
   */
  _search(currentDomains, solutions, limit) {
    if (solutions.length >= limit) return;

    // 1. MRV (Minimum Remaining Values) Heuristic
    // Find the unassigned variable with the smallest domain (fewest possibilities).
    let bestVar = -1,
      minOptions = this.numSuspects + 1;
    for (let i = 0; i < this.numVars; i++) {
      const mask = currentDomains[i];
      if (mask === 0) return; // Domain Wipeout: This branch is invalid.

      // Count set bits in the mask to find the number of remaining valid values.
      let options = 0,
        m = mask;
      while (m > 0) {
        if (m & 1) options++;
        m >>= 1;
      }

      if (options === 1) continue; // Already assigned.
      if (options < minOptions) {
        minOptions = options;
        bestVar = i;
      }
    }

    // 2. Base Case: Assignment Complete
    // If all variables have only 1 option, we have a candidate assignment.
    if (bestVar === -1) {
      const assignment = {};
      const n = this.numSuspects;
      for (let i = 0; i < n; i++) {
        const rIdx = Math.log2(currentDomains[i]);
        const iIdx = Math.log2(currentDomains[i + n]);
        const lIdx = Math.log2(currentDomains[i + 2 * n]);
        assignment[`${i}_Role`] = this.roleBag[rIdx];
        assignment[`${i}_Item`] = IDS.slice(0, n)[iIdx];
        assignment[`${i}_Room`] = IDS.slice(0, n)[lIdx];
      }

      // Final check against complex functional constraints.
      for (let fn of this.constraints) {
        if (!fn(assignment)) return;
      }

      // Deduplicate and store the valid solution.
      const json = JSON.stringify(assignment);
      const isDup = solutions.some((s) => JSON.stringify(s) === json);
      if (!isDup) solutions.push(assignment);
      return;
    }

    // 3. Branching
    // Pick individual values from the domain of the chosen variable and recurse.
    const originalMask = currentDomains[bestVar];
    const n = this.numSuspects;
    for (let val = 0; val < n; val++) {
      if (!((originalMask >> val) & 1)) continue;

      const nextDomains = new Int32Array(currentDomains);
      nextDomains[bestVar] = 1 << val; // Tentative Assignment

      // Forward Checking / AllDifferent Constraint Propagation:
      // Roles and Items are unique. If we assign a value to one suspect,
      // no other suspect can have that same value.
      let possible = true;
      if (bestVar < 2 * n) {
        // Variables 0..2n-1 are Roles and Items.
        const start = bestVar < n ? 0 : n;
        const end = bestVar < n ? n : 2 * n;
        const remove = ~(1 << val);
        for (let k = start; k < end; k++) {
          if (k === bestVar) continue;
          nextDomains[k] &= remove;
          if (nextDomains[k] === 0) {
            possible = false;
            break;
          }
        }
      }

      if (possible) this._search(nextDomains, solutions, limit);
      if (solutions.length >= limit) return;
    }
  }
}
