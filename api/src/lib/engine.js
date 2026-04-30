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
// Day 9.6: HCA support added side-by-side with BA. Both optimizers
// have identical (params, options) -> { bestDesign, bestSteel, bestCost,
// bestIteration, costHistory, log, finalState } contract, so we can
// pick the function reference at request time.
var hca = require('../../../backend/src/hca');

// Day 8.3a: import shared for steel idx -> human-readable decoder.
// initArrays is called ONCE at module load (cached, like ba require).
var shared = require('../../../backend/src/shared');
var arrays = shared.initArrays();

// Day 9.7: paired multi-trial comparison + Wilcoxon signed-rank.
var statistics = require('./statistics');


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
// algorithm arg is optional; defaults to 'BA' for back-compat with
// existing callers / tests that omit it.
function buildVerification(params, bestDesign, bestSteel, bestIteration, algorithm) {
  var algoLabel = algorithm === 'HCA' ? 'HCA' : 'BA';
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
    algorithm: algoLabel,
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
//
// runOptions (optional): { algorithm: 'BA' | 'HCA' }. Defaults to 'BA'
// to preserve the pre-9.6 behavior. Anything other than 'HCA' falls
// back to 'BA' so callers cannot accidentally inject unknown engines.
function runOptimize(validatedParams, runOptions) {
  var options = validatedParams.options || {};
  runOptions = runOptions || {};
  var algorithm = runOptions.algorithm === 'HCA' ? 'HCA' : 'BA';

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
  var result;
  if (algorithm === 'HCA') {
    result = hca.hcaOptimize(engineParams, engineOptions);
  } else {
    result = ba.baOptimize(engineParams, engineOptions);
  }
  var endTime = Date.now();

  var verification = buildVerification(validatedParams, result.bestDesign, result.bestSteel, result.bestIteration, algorithm);

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
    algorithm:     algorithm.toLowerCase(),
    costHistorySampled: sampleCostHistory(result.costHistory),
    verification:  verification
  };
}

// runMultiTrial -- Day 9.7. Runs BA and HCA `trials` times each with
// paired seeds (seed = trialIndex + 1 for both algorithms), then
// summarizes both cost AND iteration distributions and runs Wilcoxon
// signed-rank tests on the paired arrays.
//
// Day 9.7-fix: the PRIMARY metric is `bestIteration` (how fast each
// algorithm finds its optimum), not bestCost. The hypothesis is that
// BA reaches its best design earlier than HCA, so the iteration test
// is one-sided ('less'). Cost is reported as a secondary stat to
// confirm both algorithms converge to the same optimum.
//
// runOptions (optional):
//   { trials: number (default 30, clamped to [2, 100]),
//     maxIterations: number (forwarded to engine; default 5000) }
//
// Each trial runs both algorithms back to back, so wall-clock time is
// dominated by the engine maxIterations.
function runMultiTrial(validatedParams, runOptions) {
  runOptions = runOptions || {};
  var trials = typeof runOptions.trials === 'number' ? Math.floor(runOptions.trials) : 30;
  if (trials < 2) trials = 2;
  if (trials > 100) trials = 100;

  var maxIterations = typeof runOptions.maxIterations === 'number'
    ? runOptions.maxIterations
    : 5000;

  var baCosts = [];
  var hcaCosts = [];
  var baIters = [];
  var hcaIters = [];
  var baRuntimes = [];
  var hcaRuntimes = [];

  var totalStart = Date.now();
  var i;
  for (i = 0; i < trials; i++) {
    var seed = i + 1;
    var pBa = Object.assign({}, validatedParams, {
      options: Object.assign({}, validatedParams.options || {}, {
        seed: seed,
        maxIterations: maxIterations
      })
    });
    var pHca = Object.assign({}, validatedParams, {
      options: Object.assign({}, validatedParams.options || {}, {
        seed: seed,
        maxIterations: maxIterations
      })
    });

    var rBa = runOptimize(pBa, { algorithm: 'BA' });
    var rHca = runOptimize(pHca, { algorithm: 'HCA' });

    baCosts.push(rBa.bestCost);
    hcaCosts.push(rHca.bestCost);
    baIters.push(rBa.bestIteration);
    hcaIters.push(rHca.bestIteration);
    baRuntimes.push(rBa.runtime_ms);
    hcaRuntimes.push(rHca.runtime_ms);
  }
  var totalRuntime = Date.now() - totalStart;

  var baCostStats = statistics.descriptiveStats(baCosts);
  var hcaCostStats = statistics.descriptiveStats(hcaCosts);
  var baIterStats = statistics.descriptiveStats(baIters);
  var hcaIterStats = statistics.descriptiveStats(hcaIters);

  // Primary: one-sided iteration test (H1: BA reaches optimum sooner).
  var wilcoxonIter = statistics.wilcoxonSignedRank(baIters, hcaIters, {
    alternative: 'less'
  });
  // Secondary: two-sided cost test (informational — confirms both
  // algorithms converge to the same answer when not significant).
  var wilcoxonCost = statistics.wilcoxonSignedRank(baCosts, hcaCosts);

  return {
    trials: trials,
    maxIterations: maxIterations,
    runtime_ms: totalRuntime,
    metric: 'iteration',
    ba: {
      costs: baCosts,
      iterations: baIters,
      runtimes_ms: baRuntimes,
      iterStats: baIterStats,
      costStats: baCostStats
    },
    hca: {
      costs: hcaCosts,
      iterations: hcaIters,
      runtimes_ms: hcaRuntimes,
      iterStats: hcaIterStats,
      costStats: hcaCostStats
    },
    wilcoxon: wilcoxonIter,
    wilcoxonCost: wilcoxonCost
  };
}

module.exports = {
  runOptimize: runOptimize,
  runMultiTrial: runMultiTrial,
  buildVerification: buildVerification
};
