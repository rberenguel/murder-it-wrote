/**
 * Pure JavaScript Haptic Feedback
 * MIT Licensed
 *
 * This module is adapted from the MIT-licensed React hook `use-haptic`.
 * It provides a simple way to trigger haptic feedback on mobile devices.
 * Original repository: https://github.com/posaune0423/use-haptic
 */

let hapticLabel = null;

/**
 * Detects if the current device is running iOS.
 * @returns {boolean}
 */
const detectiOS = () => {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * Initializes the haptic feedback elements.
 * Call this function once when your application loads.
 */
function initHaptic() {
  if (hapticLabel || typeof document === "undefined") return;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = "haptic-switch";
  input.setAttribute("switch", "");
  input.style.display = "none";
  document.body.appendChild(input);

  const label = document.createElement("label");
  label.htmlFor = "haptic-switch";
  label.style.display = "none";
  document.body.appendChild(label);

  hapticLabel = label;
}

/**
 * Triggers haptic feedback.
 * @param {number} [duration=100] - Vibration duration in ms for non-iOS devices.
 */
function triggerHaptic(duration = 100) {
  if (!hapticLabel) {
    console.warn("Haptic feedback not initialized. Call initHaptic() first.");
    return;
  }

  if (detectiOS()) {
    hapticLabel.click();
  } else if (navigator?.vibrate) {
    window?.navigator?.vibrate(duration) || navigator.vibrate(duration);
  } else {
    hapticLabel.click(); // Fallback
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHaptic);
} else {
  initHaptic();
}

export { triggerHaptic as haptic };
