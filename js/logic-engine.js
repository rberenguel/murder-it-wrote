import { IDS } from './constants.js';

export class LogicEngine {
    constructor(roleBag) {
        // Vars: 0-4 Role, 5-9 Item, 10-14 Room
        this.numVars = 15;
        this.roleBag = roleBag;
        this.constraints = []; 
        this.initialDomains = new Int32Array(this.numVars).fill(31); 
    }

    addConstraint(fn) { this.constraints.push(fn); }

    // Unit Propagation
    restrict(varIdx, mask) {
        this.initialDomains[varIdx] &= mask;
    }

    solve(limit = 2) {
        const solutions = [];
        // Start search with full domains
        this._search(new Int32Array(this.initialDomains), solutions, limit);
        return solutions;
    }

    _search(currentDomains, solutions, limit) {
        if (solutions.length >= limit) return;

        // 1. MRV Heuristic
        let bestVar = -1, minOptions = 6;
        for (let i = 0; i < this.numVars; i++) {
            const mask = currentDomains[i];
            if (mask === 0) return; // Domain Wipeout
            
            // Count set bits
            let options = 0, m = mask;
            while (m > 0) { if (m & 1) options++; m >>= 1; }
            
            if (options === 1) continue;
            if (options < minOptions) { minOptions = options; bestVar = i; }
        }

        // 2. Base Case: Assignment Complete
        if (bestVar === -1) {
            const assignment = {};
            // Construct assignment object
            for (let i = 0; i < 5; i++) {
                const rIdx = Math.log2(currentDomains[i]);
                const iIdx = Math.log2(currentDomains[i+5]);
                const lIdx = Math.log2(currentDomains[i+10]);
                assignment[`${i}_Role`] = this.roleBag[rIdx];
                assignment[`${i}_Item`] = IDS[iIdx];
                assignment[`${i}_Room`] = IDS[lIdx];
            }
            // Check complex text constraints
            for (let fn of this.constraints) {
                if (!fn(assignment)) return;
            }
            
            // --- DEDUPLICATION FIX ---
            const json = JSON.stringify(assignment);
            const isDup = solutions.some(s => JSON.stringify(s) === json);
            if (!isDup) solutions.push(assignment);
            return;
        }

        // 3. Branching
        const originalMask = currentDomains[bestVar];
        for (let val = 0; val < 5; val++) {
            if (!((originalMask >> val) & 1)) continue;

            const nextDomains = new Int32Array(currentDomains);
            nextDomains[bestVar] = (1 << val); // Assign

            // Propagate AllDifferent for Roles (0-4) and Items (5-9)
            let possible = true;
            if (bestVar < 10) {
                const start = bestVar < 5 ? 0 : 5;
                const end = bestVar < 5 ? 5 : 10;
                const remove = ~(1 << val);
                for (let n = start; n < end; n++) {
                    if (n === bestVar) continue;
                    nextDomains[n] &= remove;
                    if (nextDomains[n] === 0) { possible = false; break; }
                }
            }

            if (possible) this._search(nextDomains, solutions, limit);
            if (solutions.length >= limit) return;
        }
    }
}
