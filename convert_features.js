// Script to convert room features from strings to objects with spillable property
import { SCENARIOS } from './js/constants.js';
import fs from 'fs';

// Keywords that indicate non-spillable features
const nonSpillablePatterns = [
  /\blight(s|ing)?\b/i,
  /\bglow(ing)?\b/i,
  /\bview(s|ing|ports?)?\b/i,
  /\bskyline\b/i,
  /\batmosphere\b/i,
  /\bambiance\b/i,
  /\bethereals?\b/i,
  /\bspotlight/i,
  /\bsweeping\b/i,
];

function isSpillable(featureName) {
  // Check if feature matches any non-spillable pattern
  return !nonSpillablePatterns.some(pattern => pattern.test(featureName));
}

// Process each scenario
SCENARIOS.forEach(scenario => {
  console.log(`\nScenario: ${scenario.name}`);

  if (!scenario.roomFeatures) {
    console.log('  No room features');
    return;
  }

  Object.entries(scenario.roomFeatures).forEach(([roomName, features]) => {
    features.forEach(feature => {
      const featureName = typeof feature === 'string' ? feature : feature.name;
      const spillable = isSpillable(featureName);

      if (!spillable) {
        console.log(`  ${roomName}: "${featureName}" -> NOT SPILLABLE`);
      }
    });
  });
});
