function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _seed = 0;
let _rng = Math.random; // safe default before init

export function initRng(seed) {
  if (seed == null) {
    seed = Math.floor(Math.random() * 0xffffffff);
  }
  _seed = seed >>> 0; // coerce to 32-bit unsigned
  _rng = mulberry32(_seed);
  return _seed;
}

export function getSeed() {
  return _seed;
}
export function random() {
  return _rng();
}

// Human-readable seed codes: 6 chars from a-zA-Z (52^6 ≈ 19.8B > 2^32 ✓)
const CODE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_BASE = CODE_CHARS.length; // 52
const CODE_LEN = 6;

export function seedToCode(seed) {
  let n = seed >>> 0;
  let code = "";
  for (let i = 0; i < CODE_LEN; i++) {
    code = CODE_CHARS[n % CODE_BASE] + code;
    n = Math.floor(n / CODE_BASE);
  }
  return code;
}

export function codeToSeed(code) {
  if (typeof code !== "string" || code.length !== CODE_LEN) return null;
  let n = 0;
  for (const ch of code) {
    const idx = CODE_CHARS.indexOf(ch);
    if (idx === -1) return null;
    n = n * CODE_BASE + idx;
  }
  return n >>> 0;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
