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

// buildVerification -- deterministic geotech + WSD snapshot from shared.js
// (VB6-parity formulas only; no duplicate math here).
function buildVerification(params, bestDesign, bestSteel, bestIteration) {
  var fy = params.material.fy;
  var fcPrime = params.material.fc;
  var gradeStr;
  if (fy === 4000) {
    gradeStr = 'SD40';
  } else if (fy === 3000) {
    gradeStr = 'SD30';
  } else {
    gradeStr = 'OTHER';
  }

  var wsd = shared.calculateWSDParams(fy, fcPrime);

  var optimization = {
    algorithm: 'BA',
    trialsRun: 1,
    bestIteration: bestIteration
  };

  var material = {
    steel: {
      grade: gradeStr,
      fy: fy
    },
    fs: wsd.fs,
    fc_prime: fcPrime,
    fc_allow: wsd.fc,
    wsd: {
      n: wsd.n,
      k: wsd.k,
      j: wsd.j,
      R: wsd.R
    },
    prices: {
      concretePrice: params.material.concretePrice,
      steelPrice: params.material.steelPrice
    }
  };

  var Ka = shared.calculateKa(params.phi);
  var Kp = shared.calculateKp(params.phi);
  var Pa = shared.calculatePa(params.gamma_soil, Ka, params.H);
  var Pp = shared.calculatePp(params.gamma_soil, Kp, params.H1);

  var earthPressures = {
    Ka: Ka,
    Kp: Kp,
    Pa: Pa,
    Pp: Pp
  };

  var wtot = shared.calculateWTotal(bestDesign, params.H, params.H1, params.gamma_soil, params.gamma_concrete);
  var w1r = shared.calculateW1(bestDesign, params.H, params.H1, params.gamma_soil);
  var w2r = shared.calculateW2(bestDesign, params.H, params.gamma_soil);
  var w3r = shared.calculateW3(bestDesign, params.H, params.gamma_concrete);
  var w4r = shared.calculateW4(bestDesign, params.gamma_concrete);

  var weights = {
    W1: w1r.W,
    W2: w2r.W,
    W3: w3r.W,
    W4: w4r.W,
    W_total: wtot.WTotal
  };

  var cover = params.cover;
  var dStem = bestDesign.tb - cover;
  var dToe = bestDesign.TBase - cover;
  var dHeel = bestDesign.TBase - cover;
  if (dStem <= 0.05) {
    dStem = 0.05;
  }
  if (dToe <= 0.05) {
    dToe = 0.05;
  }
  if (dHeel <= 0.05) {
    dHeel = 0.05;
  }

  var MStem = shared.calculateMomentStem(params.H1, params.gamma_soil, params.phi);
  var MToe = shared.calculateMomentToe(bestDesign, params.H, params.H1, params.gamma_soil, params.gamma_concrete, params.phi);
  var MHeel = shared.calculateMomentHeel(bestDesign, params.H, params.H1, params.gamma_soil, params.gamma_concrete, params.phi);

  function oneSteel(dbIdxVb, spIdxVb, momentVal, dEff) {
    var db0 = dbIdxVb - 100;
    var sp0 = spIdxVb - 110;
    var dbMm = arrays.DB[db0];
    var barLabel = 'DB' + dbMm;
    var spv = arrays.SP[sp0];
    var AsReq = shared.calculateAsRequired(momentVal, wsd.fs, wsd.j, dEff);
    var AsProv = shared.calculateAsProvided(db0, sp0, arrays);
    return {
      moment: momentVal,
      d_effective: dEff,
      bar: barLabel,
      spacing_m: spv,
      As_required: AsReq,
      As_provided: AsProv,
      adequate: AsProv >= AsReq
    };
  }

  var steel = {
    stem: oneSteel(bestSteel.stemDB_idx, bestSteel.stemSP_idx, MStem, dStem),
    toe: oneSteel(bestSteel.toeDB_idx, bestSteel.toeSP_idx, MToe, dToe),
    heel: oneSteel(bestSteel.heelDB_idx, bestSteel.heelSP_idx, MHeel, dHeel)
  };

  var fsOtResult = shared.checkFS_OT(bestDesign, params.H, params.H1, params.gamma_soil, params.gamma_concrete, params.phi);
  var fsSlResult = shared.checkFS_SL(bestDesign, params.H, params.H1, params.gamma_soil, params.gamma_concrete, params.phi, params.mu);
  var fsBcResult = shared.checkFS_BC(bestDesign, params.H, params.H1, params.gamma_soil, params.gamma_concrete, params.phi, params.qa);

  var safetyFactors = {
    FS_OT: {
      value: fsOtResult.FS_OT,
      required: shared.FS_OT_MIN,
      pass: fsOtResult.pass
    },
    FS_SL: {
      value: fsSlResult.FS_SL,
      required: shared.FS_SL_MIN,
      pass: fsSlResult.pass
    },
    FS_BC: {
      value: fsBcResult.FS_BC,
      required: shared.FS_BC_MIN,
      pass: fsBcResult.pass
    },
    allPass: fsOtResult.pass && fsSlResult.pass && fsBcResult.pass
  };

  var bearingCapacity = {
    eccentricity: fsBcResult.e,
    q_max: fsBcResult.q_max,
    q_min: fsBcResult.q_min,
    q_allow: params.qa
  };

  return {
    optimization: optimization,
    material: material,
    earthPressures: earthPressures,
    weights: weights,
    steel: steel,
    safetyFactors: safetyFactors,
    bearingCapacity: bearingCapacity
  };
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

  var verification = buildVerification(validatedParams, result.bestDesign, result.bestSteel, result.bestIteration);

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
    costHistorySampled: sampleCostHistory(result.costHistory),
    verification:  verification
  };
}

module.exports = {
  runOptimize: runOptimize,
  buildVerification: buildVerification
};
