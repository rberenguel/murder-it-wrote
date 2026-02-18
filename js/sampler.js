// Sound effects for Murder, It Wrote using Tone.js
// Audio files live in audio/.

const _soundMap = {
  door1: "C1",
  door2: "C2",
  door3: "C3",
  keydown: "D1",
  keystroke: "D2",
  keyup: "D3",
  derase: "E1",
  ding: "E2",
  quack2: "F1",
};

let _sampler = null;
let _toneStarted = false;
let _twActive = false;
let _soundEnabled = true;

// Pre-load eagerly so files are buffered before the first user gesture.
if (typeof Tone !== "undefined") {
  const urls = {};
  for (const [name, note] of Object.entries(_soundMap)) {
    urls[note] = `${name}.mp3`;
  }
  _sampler = new Tone.Sampler({
    urls,
    baseUrl: "audio/",
    attack: 0,
    release: 1,
    onload: () => console.log("[miw] Sampler loaded"),
  }).toDestination();
}

// Called at startup with the persisted preference.
window.setSoundEnabled = (enabled) => {
  _soundEnabled = enabled;
  if (!enabled) _twActive = false; // kill any running typewriter loop
};

// Must be called from a user-gesture handler before any sound plays.
window.startAudio = async () => {
  if (!_soundEnabled || _toneStarted || typeof Tone === "undefined") return;
  await Tone.start();
  _toneStarted = true;
};

// Internal trigger — absolute Tone.js time.
const _trigger = (soundName, duration, atTime) => {
  if (!_soundEnabled || !_sampler || !_toneStarted) return;
  const note = _soundMap[soundName];
  if (!note) return;
  try {
    _sampler.triggerAttackRelease(note, duration, atTime);
  } catch (_) {}
};

// Public trigger — relative delay in seconds.
window.sampler = (soundName, duration, settings = {}) => {
  _trigger(soundName, duration, Tone.now() + (settings.delay ?? 0));
};

// Durations in seconds after 1.3× speed-up (update if files change).
const _doorDurations = { door1: 1.95, door2: 1.39, door3: 1.03 };

// Play a random door and return its duration so callers can delay accordingly.
window.playDoor = () => {
  if (!_soundEnabled || !_toneStarted) return 0;
  const n = 1 + Math.floor(Math.random() * 3);
  const name = `door${n}`;
  const dur = _doorDurations[name];
  _trigger(name, dur + 0.3, Tone.now()); // +0.3 s slack for the release tail
  return dur;
};

// ── Typewriter loop ──────────────────────────────────────────────────────────
// Each keystroke is a triplet: keydown → keystroke → keyup, scheduled ahead
// with Tone.js so they're sub-millisecond accurate regardless of JS jitter.
// The gap between keystrokes alternates between fast bursts and word-pauses.

const _twTick = () => {
  if (!_twActive) return;

  const now = Tone.now();

  // Randomise the mechanical timing slightly each key.
  const strokeAt = now + 0.022 + Math.random() * 0.022; // keydown → typehead: 22–44 ms
  const upAt = strokeAt + 0.038 + Math.random() * 0.02; // typehead → spring-back: 38–58 ms

  _trigger("keydown", 0.07, now);
  _trigger("keystroke", 0.05, strokeAt);
  _trigger("keyup", 0.06, upAt);

  // Occasional erase (derase) just after the keyup.
  if (Math.random() < 0.07) {
    _trigger("derase", 0.08, upAt + 0.04 + Math.random() * 0.03);
  }

  // Rhythm: 70 % fast-burst (within a word), 30 % longer inter-word pause.
  const gap =
    Math.random() < 0.7
      ? 65 + Math.random() * 115 // burst:  65–180 ms
      : 270 + Math.random() * 260; // pause: 270–530 ms

  setTimeout(_twTick, gap);
};

window.playTypewriter = () => {
  if (!_soundEnabled) return;
  _twActive = true;
  _twTick();
};

window.stopTypewriter = () => {
  _twActive = false;
};
