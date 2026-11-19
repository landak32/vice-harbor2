// Deterministic pseudo-randomness: one mulberry32 stream per seed, so the same seed always
// rebuilds the same city, the same traffic and the same screenshot frame. Nothing in the game
// ever calls Math.random.

export function createSeededRandom(seed) {
  let state = (seed | 0) || 0x9e3779b9;

  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    /** A float in [0, 1). */
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max], both ends included. */
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** One element of a non-empty array. */
    pick(list) {
      return list[Math.min(list.length - 1, Math.floor(next() * list.length))];
    },
    /** A random direction in radians. */
    angle() {
      return next() * Math.PI * 2;
    },
    /** A fresh stream, for a subsystem that should not disturb this one's sequence. */
    fork(salt) {
      return createSeededRandom((state ^ Math.imul(salt | 0, 0x85ebca6b)) | 0);
    },
  };
}
