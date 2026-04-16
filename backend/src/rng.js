// rng.js — Random number generators for HCA/BA
// Ported from VB6 Rnd() + Rand() (modShared.bas line 175)

var seedrandom = require('seedrandom');

// VB6-compatible LCG (Microsoft documented, 24-bit)
// NOTE: exact bit-match with VB6 to be verified in Step 9.5 integration test.
// If sequence diverges, fall back to createSeededRng for tests and use
// statistical comparison (mean±std over N trials) for research verification.
function createVB6Rng(seed) {
  if (typeof seed === 'undefined') seed = 0x50000;
  var state = seed >>> 0;
  return function() {
    state = (Math.imul(state, 1140671485) + 12820163) & 0xFFFFFF;
    return state / 0x1000000;
  };
}

// seedrandom-based — NOT VB6-compatible but deterministic for unit tests
function createSeededRng(seed) {
  return seedrandom(String(seed));
}

// Integer in [low, high] inclusive — matches VB6:
//   Rand = Int((High - Low + 1) * Rnd) + Low
function rand(low, high, rng) {
  return Math.floor((high - low + 1) * rng()) + low;
}

module.exports = {
  createVB6Rng: createVB6Rng,
  createSeededRng: createSeededRng,
  rand: rand
};
