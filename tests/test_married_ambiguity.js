const { expect } = chai;

import { generateTruth, generateClues, renderFact } from "../js/generator.js";
import { SCENARIOS } from "../js/constants.js";

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

describe("Married couple clue ambiguity (regression)", function () {
  // Continental Express has exactly one married couple: Viktor (husband) + Elara (wife).
  // The bug: renderFact randomly picks the generic "[type] person" form 50% of the time,
  // making "The married person was in X" appear for two different suspects —
  // indistinguishable to a human even though the CSP solver tracks them separately.
  const scenario = SCENARIOS.find((s) => s.id === "continental_express");

  const mapping = {
    suspects: [
      "Archduke Viktor",
      "Archduchess Elara",
      "Major Crawford",
      "Alice Pemberley",
    ],
    rooms: scenario.rooms.slice(0, 4),
    items: scenario.items.slice(0, 4),
    scenario,
  };

  it("relationship location clues should never use generic type text", function () {
    const { truth, roles } = generateTruthWithRetry(4);
    const facts = generateClues(truth, roles, 4, mapping);

    facts
      .filter((f) => f.type === "RELATIONSHIP_LOCATION")
      .forEach((fact) => {
        const { text } = renderFact(fact, mapping, roles);
        expect(text).to.not.include(
          `${fact.relationshipType} person`,
          `clue for "${fact.relationshipTerm}" rendered with ambiguous generic type: "${text}"`,
        );
      });
  });

  it("relationship item clues should never use generic type text", function () {
    const { truth, roles } = generateTruthWithRetry(4);
    const facts = generateClues(truth, roles, 4, mapping);

    facts
      .filter((f) => f.type === "RELATIONSHIP_ITEM")
      .forEach((fact) => {
        const { text } = renderFact(fact, mapping, roles);
        expect(text).to.not.include(
          `${fact.relationshipType} person`,
          `clue for "${fact.relationshipTerm}" rendered with ambiguous generic type: "${text}"`,
        );
      });
  });

  it("relationship trait clues should never say 'One suspect is [type]'", function () {
    const { truth, roles } = generateTruthWithRetry(4);
    const facts = generateClues(truth, roles, 4, mapping);

    facts
      .filter((f) => f.type === "RELATIONSHIP_HAS_TRAIT")
      .forEach((fact) => {
        const { text } = renderFact(fact, mapping, roles);
        expect(text).to.not.match(
          /^One suspect is /,
          `RELATIONSHIP_HAS_TRAIT for "${fact.relationshipTerm}" said "One suspect is…": "${text}"`,
        );
      });
  });
});
