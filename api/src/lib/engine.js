// engine.js -- thin wrapper around backend/src/ba.js.
//
// The backend/ engine is FROZEN (668 tests, VB6-validated at Step 10.2).
// This file is the only sanctioned bridge between api/ and backend/.
// Do NOT modify backend/src/ba.js to accommodate the API; adapt here if
// the engine interface ever needs translation.
//
// The require is resolved ONCE at module load time and cached by Node,
// so subsequent requests reuse the same module instance.

var ba = require('../../../backend/src/ba');

// Day 8.3a: import shared for steel idx -> human-readable decoder.
// initArrays is called ONCE at module load (cached, like ba require).
var shared = require('../../../backend/src/shared');
var arrays = shared.initArrays();


// decodeSteel -- map raw bestSteel _idx values to human-readable.
// DB_idx: 100-104 (arrays.DB[0..4]) = 12, 16, 20, 25, 28 mm
// SP_idx: 110-113 (arrays.SP[0..3]) = 0.10, 0.15, 0.20, 0.25 m
function decodeSteel(s) {
  function one(dbIdx, spIdx) {
    var db = arrays.DB[dbIdx - 100];
    var sp = arrays.SP[spIdx - 110];
    return {
      size: 'DB' + db,
      spacing_cm: Math.round(sp * 100),
      spacing_m: sp
    };
  }
  return {
    stem: one(s.stemDB_idx, s.stemSP_idx),
    toe:  one(s.toeDB_idx,  s.toeSP_idx),
    heel: one(s.heelDB_idx, s.heelSP_idx)
  };
}

// sampleCostHistory -- downsample costHistory to ~maxPoints for chart.
// Skips null/Infinity entries. Always includes last valid point.
function sampleCostHistory(history, maxPoints) {
  if (!maxPoints) { maxPoints = 200; }
  var out = [];
  var i;
  var denseEnd = Math.min(100, history.length);
  for (i = 1; i < denseEnd; i++) {
    if (history[i] !== null && history[i] !== undefined && isFinite(history[i])) {
      out.push({ iter: i, cost: history[i] });
    }
  }
  var remaining = maxPoints - out.length;
  var step = Math.max(1, Math.floor((history.length - denseEnd) / remaining));
  for (i = denseEnd; i < history.length; i += step) {
    if (history[i] !== null && history[i] !== undefined && isFinite(history[i])) {
      out.push({ iter: i, cost: history[i] });
    }
  }
  var last = history.length - 1;
  if (out.length === 0 || out[out.length - 1].iter !== last) {
    if (history[last] !== null && history[last] !== undefined && isFinite(history[last])) {
      out.push({ iter: last, cost: history[last] });
    }
  }
  return out;
}

// runOptimize -- call BA with validated params, strip large internal
// state (log, costHistory, finalState) before returning to the HTTP
// layer. Wall-clock runtime is measured here, not inside the engine.
//
// validatedParams: the "params" field of a successful validator result.
// Expected shape: { H, H1, gamma_soil, gamma_concrete, phi, mu, qa,
//   cover, material, options } where options is an object that may
//   contain seed and maxIterations.
//
// Errors from the engine propagate; the caller (route handler) is
// responsible for try/catch.
function runOptimize(validatedParams) {
  var options = validatedParams.options || {};

  // Build engine params with EXACTLY the keys the BA engine expects.
  // Do not forward api-layer concerns like options into params.
  var engineParams = {
    H:              validatedParams.H,
    H1:             validatedParams.H1,
    gamma_soil:     validatedParams.gamma_soil,
    gamma_concrete: validatedParams.gamma_concrete,
    phi:            validatedParams.phi,
    mu:             validatedParams.mu,
    qa:             validatedParams.qa,
    cover:          validatedParams.cover,
    material:       validatedParams.material
  };

  // Engine options: maxIterations is required by the engine with a
  // default of 10000 (already applied by the validator). seed is only
  // forwarded when the caller supplied one.
  var engineOptions = {
    maxIterations: typeof options.maxIterations === 'number'
      ? options.maxIterations
      : 5000
  };
  if (typeof options.seed !== 'undefined') {
    engineOptions.seed = options.seed;
  }

  var startTime = Date.now();
  var result = ba.baOptimize(engineParams, engineOptions);
  var endTime = Date.now();

  // Return the slim response shape. bestDesign and bestSteel are
  // passed through as-is (small objects with numeric fields).
  // costHistory, log, and finalState are deliberately omitted.
  return {
    bestCost:      result.bestCost,
    bestIteration: result.bestIteration,
    bestDesign:    result.bestDesign,
    bestSteel:     result.bestSteel,
    bestSteelDecoded: decodeSteel(result.bestSteel),
    runtime_ms:    endTime - startTime,
    algorithm:     'ba',
    costHistorySampled: sampleCostHistory(result.costHistory)
  };
}

module.exports = {
  runOptimize: runOptimize
};
