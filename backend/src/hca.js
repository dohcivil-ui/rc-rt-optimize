// hca.js — Hill Climbing Algorithm for RC retaining wall optimization
// Ported from modHillClimbing.bas v5.1 (RC_RT_HCA v2.8)
//
// STEP 9.2 SCOPE: state factory + initializeCurrentDesign + getDesignFromCurrent
// Note: initializeCurrentDesign is FIXED version (VB6 had variable shadowing bug
// that caused tb/TBase to initialize at MIN instead of MAX). This implementation
// matches the stated methodology: "start from max, HCA climbs down".

var shared = require('./shared');
var rngLib = require('./rng');

// VB6-style index bounds (modShared.bas lines 63-69)
// Using VB6-style indices internally keeps neighbor generation 1:1 with VB6
var IDX = {
  TT_MIN: 1,     TT_MAX: 17,
  TB_MIN: 20,    TB_MAX: 36,
  TBASE_MIN: 40, TBASE_MAX: 54,
  BASE_MIN: 60,  BASE_MAX: 71,
  LTOE_MIN: 80,  LTOE_MAX: 89,
  DB_MIN: 100,   DB_MAX: 104,
  SP_MIN: 110,   SP_MAX: 113
};

// VB6-style index offsets for array lookup
var OFFSETS = { tt: 1, tb: 20, TBase: 40, Base: 60, LToe: 80 };

// Lookup VB6 index -> physical value from shared.initArrays() result
function wpLookup(arrays, type, vb6Idx) {
  return arrays[type][vb6Idx - OFFSETS[type]];
}

// Factory — closure state (no module globals for concurrency safety)
function createHCAState(params, options) {
  options = options || {};
  var mat = params.material;

  var rng;
  if (options.rng) {
    rng = options.rng;
  } else if (typeof options.seed !== 'undefined') {
    rng = rngLib.createVB6Rng(options.seed);
  } else {
    rng = Math.random;
  }

  return {
    params: params,
    arrays: shared.initArrays(),
    wsd: shared.calculateWSDParams(mat.fy, mat.fc),
    indices: {
      tt: 0, tb: 0, TBase: 0, Base: 0, LToe: 0,
      stemDB: 0, stemSP: 0,
      toeDB: 0,  toeSP: 0,
      heelDB: 0, heelSP: 0
    },
    rng: rng
  };
}

// initializeCurrentDesign — FIXED VERSION (no shadow bug)
// VB6 ref: modHillClimbing.bas lines 44-114
// Methodology: start from largest indices whose physical value <= constraint,
// then HCA climbs down iteratively.
function initializeCurrentDesign(state) {
  var H = state.params.H;
  var arrays = state.arrays;
  var idx = state.indices;
  var i;

  // Round constraint limits to 3 decimals to match array precision (roundTo in initArrays)
  // and avoid IEEE 754 mismatch (e.g. 0.15*6 = 0.8999... vs stored 0.900)
  var lim_tb    = shared.roundTo(0.12 * H, 3);
  var lim_TBase = shared.roundTo(0.15 * H, 3);
  var lim_Base  = shared.roundTo(0.7  * H, 3);
  var lim_LToe  = shared.roundTo(0.2  * H, 3);

  // tb: largest idx where WP_tb(idx) <= 0.12*H
  idx.tb = IDX.TB_MIN;
  for (i = IDX.TB_MAX; i >= IDX.TB_MIN; i--) {
    if (wpLookup(arrays, 'tb', i) <= lim_tb) { idx.tb = i; break; }
  }

  // tt: largest idx where WP_tt(idx) <= WP_tb(tb) (tt <= tb)
  idx.tt = IDX.TT_MAX;
  for (i = IDX.TT_MAX; i >= IDX.TT_MIN; i--) {
    if (wpLookup(arrays, 'tt', i) <= wpLookup(arrays, 'tb', idx.tb)) {
      idx.tt = i;
      break;
    }
  }

  // Fixup: ensure tb >= tt after selection
  if (wpLookup(arrays, 'tb', idx.tb) < wpLookup(arrays, 'tt', idx.tt)) {
    for (i = IDX.TB_MIN; i <= IDX.TB_MAX; i++) {
      if (wpLookup(arrays, 'tb', i) >= wpLookup(arrays, 'tt', idx.tt)) {
        idx.tb = i;
        break;
      }
    }
  }

  // TBase: largest idx where WP_TBase(idx) <= 0.15*H
  idx.TBase = IDX.TBASE_MIN;
  for (i = IDX.TBASE_MAX; i >= IDX.TBASE_MIN; i--) {
    if (wpLookup(arrays, 'TBase', i) <= lim_TBase) { idx.TBase = i; break; }
  }

  // Base: largest idx where WP_Base(idx) <= 0.7*H
  idx.Base = IDX.BASE_MIN;
  for (i = IDX.BASE_MAX; i >= IDX.BASE_MIN; i--) {
    if (wpLookup(arrays, 'Base', i) <= lim_Base) { idx.Base = i; break; }
  }

  // LToe: largest idx where WP_LToe(idx) <= 0.2*H
  idx.LToe = IDX.LTOE_MIN;
  for (i = IDX.LTOE_MAX; i >= IDX.LTOE_MIN; i--) {
    if (wpLookup(arrays, 'LToe', i) <= lim_LToe) { idx.LToe = i; break; }
  }

  // Steel: max DB (DB28=104), min SP (0.10m=110)
  idx.stemDB = IDX.DB_MAX; idx.stemSP = IDX.SP_MIN;
  idx.toeDB  = IDX.DB_MAX; idx.toeSP  = IDX.SP_MIN;
  idx.heelDB = IDX.DB_MAX; idx.heelSP = IDX.SP_MIN;
}

// getDesignFromCurrent — return { design, steel } for shared.calculateCost
function getDesignFromCurrent(state) {
  var arrays = state.arrays;
  var idx = state.indices;

  var tt    = wpLookup(arrays, 'tt',    idx.tt);
  var tb    = wpLookup(arrays, 'tb',    idx.tb);
  var TBase = wpLookup(arrays, 'TBase', idx.TBase);
  var Base  = wpLookup(arrays, 'Base',  idx.Base);
  var LToe  = wpLookup(arrays, 'LToe',  idx.LToe);
  var LHeel = shared.calculateLHeel(Base, LToe, tb);

  return {
    design: {
      tt: tt, tb: tb, TBase: TBase,
      Base: Base, LToe: LToe, LHeel: LHeel
    },
    steel: {
      stemDB_idx: idx.stemDB, stemSP_idx: idx.stemSP,
      toeDB_idx:  idx.toeDB,  toeSP_idx:  idx.toeSP,
      heelDB_idx: idx.heelDB, heelSP_idx: idx.heelSP
    }
  };
}

// Internal helper — convert VB6-style steel indices to 0-based for shared.checkDesignValid
function steelTo0Based(steel) {
  return {
    stemDB_idx: steel.stemDB_idx - IDX.DB_MIN,
    stemSP_idx: steel.stemSP_idx - IDX.SP_MIN,
    toeDB_idx:  steel.toeDB_idx  - IDX.DB_MIN,
    toeSP_idx:  steel.toeSP_idx  - IDX.SP_MIN,
    heelDB_idx: steel.heelDB_idx - IDX.DB_MIN,
    heelSP_idx: steel.heelSP_idx - IDX.SP_MIN
  };
}

// Internal helper — shallow copy indices object for backup/restore
function copyIndices(idx) {
  return {
    tt: idx.tt, tb: idx.tb, TBase: idx.TBase, Base: idx.Base, LToe: idx.LToe,
    stemDB: idx.stemDB, stemSP: idx.stemSP,
    toeDB:  idx.toeDB,  toeSP:  idx.toeSP,
    heelDB: idx.heelDB, heelSP: idx.heelSP
  };
}

// ==========================================================================
// generateNeighbor — Hill Climbing neighbor generation (Step 9.3)
// VB6 ref: modHillClimbing.bas lines 145-252 (Private Sub GenerateNeighbor)
//
// Returns NEW indices object; does NOT mutate state.indices.
// ==========================================================================
function generateNeighbor(state) {
  var arrays = state.arrays;
  var cur = state.indices;
  var H = state.params.H;
  var rng = state.rng;

  var lim_tb      = shared.roundTo(0.12 * H, 3);
  var lim_TBase   = shared.roundTo(0.15 * H, 3);
  var lim_LToe_hi = shared.roundTo(0.20 * H, 3);
  var lim_LToe_lo = shared.roundTo(0.10 * H, 3);
  var lim_Base_hi = shared.roundTo(0.70 * H, 3);
  var lim_Base_lo = shared.roundTo(0.50 * H, 3);

  var step;

  // 1) tt: step = Rand(-2, 2), clamp only
  step = rngLib.rand(-2, 2, rng);
  var newTt = cur.tt + step;
  if (newTt < IDX.TT_MIN) newTt = IDX.TT_MIN;
  if (newTt > IDX.TT_MAX) newTt = IDX.TT_MAX;

  // 2) tb: step = Rand(-1, 1), clamp, then tb>=tt (walk UP), then tb<=0.12H (walk DOWN)
  step = rngLib.rand(-1, 1, rng);
  var newTb = cur.tb + step;
  if (newTb < IDX.TB_MIN) newTb = IDX.TB_MIN;
  if (newTb > IDX.TB_MAX) newTb = IDX.TB_MAX;
  if (wpLookup(arrays, 'tb', newTb) < wpLookup(arrays, 'tt', newTt)) {
    newTb = IDX.TB_MIN;
    while (newTb <= IDX.TB_MAX) {
      if (wpLookup(arrays, 'tb', newTb) >= wpLookup(arrays, 'tt', newTt)) break;
      newTb = newTb + 1;
    }
    if (newTb > IDX.TB_MAX) newTb = IDX.TB_MAX;
  }
  while (newTb > IDX.TB_MIN && wpLookup(arrays, 'tb', newTb) > lim_tb) {
    newTb = newTb - 1;
  }

  // 3) TBase: step = Rand(-1, 1), clamp, then <=0.15H (walk DOWN)
  step = rngLib.rand(-1, 1, rng);
  var newTBase = cur.TBase + step;
  if (newTBase < IDX.TBASE_MIN) newTBase = IDX.TBASE_MIN;
  if (newTBase > IDX.TBASE_MAX) newTBase = IDX.TBASE_MAX;
  while (newTBase > IDX.TBASE_MIN && wpLookup(arrays, 'TBase', newTBase) > lim_TBase) {
    newTBase = newTBase - 1;
  }

  // 4) LToe: step = Rand(-2, 2), clamp, then <=0.2H (DOWN), then >=0.1H (UP)
  step = rngLib.rand(-2, 2, rng);
  var newLToe = cur.LToe + step;
  if (newLToe < IDX.LTOE_MIN) newLToe = IDX.LTOE_MIN;
  if (newLToe > IDX.LTOE_MAX) newLToe = IDX.LTOE_MAX;
  while (newLToe > IDX.LTOE_MIN && wpLookup(arrays, 'LToe', newLToe) > lim_LToe_hi) {
    newLToe = newLToe - 1;
  }
  while (newLToe < IDX.LTOE_MAX && wpLookup(arrays, 'LToe', newLToe) < lim_LToe_lo) {
    newLToe = newLToe + 1;
  }

  // 5) Base: step = Rand(-1, 1), clamp, then >=0.5H (UP), then <=0.7H (DOWN)
  step = rngLib.rand(-1, 1, rng);
  var newBase = cur.Base + step;
  if (newBase < IDX.BASE_MIN) newBase = IDX.BASE_MIN;
  if (newBase > IDX.BASE_MAX) newBase = IDX.BASE_MAX;
  while (newBase < IDX.BASE_MAX && wpLookup(arrays, 'Base', newBase) < lim_Base_lo) {
    newBase = newBase + 1;
  }
  while (newBase > IDX.BASE_MIN && wpLookup(arrays, 'Base', newBase) > lim_Base_hi) {
    newBase = newBase - 1;
  }

  // 6-11) Steel: step = Rand(-2, 2) each, clamp only
  step = rngLib.rand(-2, 2, rng);
  var newStemDB = cur.stemDB + step;
  if (newStemDB < IDX.DB_MIN) newStemDB = IDX.DB_MIN;
  if (newStemDB > IDX.DB_MAX) newStemDB = IDX.DB_MAX;

  step = rngLib.rand(-2, 2, rng);
  var newStemSP = cur.stemSP + step;
  if (newStemSP < IDX.SP_MIN) newStemSP = IDX.SP_MIN;
  if (newStemSP > IDX.SP_MAX) newStemSP = IDX.SP_MAX;

  step = rngLib.rand(-2, 2, rng);
  var newToeDB = cur.toeDB + step;
  if (newToeDB < IDX.DB_MIN) newToeDB = IDX.DB_MIN;
  if (newToeDB > IDX.DB_MAX) newToeDB = IDX.DB_MAX;

  step = rngLib.rand(-2, 2, rng);
  var newToeSP = cur.toeSP + step;
  if (newToeSP < IDX.SP_MIN) newToeSP = IDX.SP_MIN;
  if (newToeSP > IDX.SP_MAX) newToeSP = IDX.SP_MAX;

  step = rngLib.rand(-2, 2, rng);
  var newHeelDB = cur.heelDB + step;
  if (newHeelDB < IDX.DB_MIN) newHeelDB = IDX.DB_MIN;
  if (newHeelDB > IDX.DB_MAX) newHeelDB = IDX.DB_MAX;

  step = rngLib.rand(-2, 2, rng);
  var newHeelSP = cur.heelSP + step;
  if (newHeelSP < IDX.SP_MIN) newHeelSP = IDX.SP_MIN;
  if (newHeelSP > IDX.SP_MAX) newHeelSP = IDX.SP_MAX;

  return {
    tt: newTt, tb: newTb, TBase: newTBase, Base: newBase, LToe: newLToe,
    stemDB: newStemDB, stemSP: newStemSP,
    toeDB:  newToeDB,  toeSP:  newToeSP,
    heelDB: newHeelDB, heelSP: newHeelSP
  };
}

// ==========================================================================
// hcaOptimize — Main Hill Climbing Algorithm optimization loop (Step 9.4)
// VB6 ref: modHillClimbing.bas lines 259-468 (HillClimbingOptimization)
// ==========================================================================
function hcaOptimize(params, options) {
  options = options || {};
  var maxIterations = options.maxIterations || 10000;

  var state = createHCAState(params, { seed: options.seed, rng: options.rng });
  initializeCurrentDesign(state);

  var mat = params.material;
  var logArr = [];
  var costHistory = new Array(maxIterations + 1);

  var initial = getDesignFromCurrent(state);
  var initialCost = shared.calculateCost(
    initial.design, params.H, params.gamma_concrete,
    mat.concretePrice, mat.steelPrice, initial.steel
  ).cost;
  var initialValidity = shared.checkDesignValid(
    initial.design, params.H, params.H1, params.gamma_soil, params.gamma_concrete,
    params.phi, params.mu, params.qa, params.cover,
    state.wsd, steelTo0Based(initial.steel), state.arrays
  );

  var best, bestSteel, bestCost, bestIteration;
  var currentCost;

  if (initialValidity.valid) {
    best = initial.design;
    bestSteel = initial.steel;
    bestCost = initialCost;
    bestIteration = 1;
    currentCost = initialCost;
    pushLog(logArr, 0, initialCost, true, true, true, '', bestCost, bestIteration, options.onIteration);
  } else {
    best = null;
    bestSteel = null;
    bestCost = Infinity;
    bestIteration = 0;
    currentCost = Infinity;
    pushLog(logArr, 0, initialCost, false, false, false, initialValidity.reason, bestCost, bestIteration, options.onIteration);
  }

  for (var iter = 1; iter <= maxIterations; iter++) {
    var backup = copyIndices(state.indices);

    var newIndices = generateNeighbor(state);
    state.indices = newIndices;

    var neighbor = getDesignFromCurrent(state);
    var neighborCost = shared.calculateCost(
      neighbor.design, params.H, params.gamma_concrete,
      mat.concretePrice, mat.steelPrice, neighbor.steel
    ).cost;
    var validity = shared.checkDesignValid(
      neighbor.design, params.H, params.H1, params.gamma_soil, params.gamma_concrete,
      params.phi, params.mu, params.qa, params.cover,
      state.wsd, steelTo0Based(neighbor.steel), state.arrays
    );

    var accepted = false;
    var isBetter = false;
    var reason = '';

    if (validity.valid) {
      if (neighborCost < bestCost) {
        best = neighbor.design;
        bestSteel = neighbor.steel;
        bestCost = neighborCost;
        bestIteration = iter;
        currentCost = neighborCost;
        accepted = true;
        isBetter = true;
      } else if (neighborCost < currentCost) {
        currentCost = neighborCost;
        accepted = true;
      } else {
        state.indices = backup;
      }
    } else {
      state.indices = backup;
      reason = validity.reason;
    }

    if (bestIteration > 0) {
      costHistory[iter] = bestCost;
    } else {
      costHistory[iter] = 999000;
    }

    pushLog(logArr, iter, neighborCost, validity.valid, isBetter, accepted, reason, bestCost, bestIteration, options.onIteration);
  }

  return {
    bestDesign: best,
    bestSteel: bestSteel,
    bestCost: bestCost,
    bestIteration: bestIteration,
    costHistory: costHistory,
    log: logArr,
    finalState: state
  };
}

function pushLog(logArr, iter, cost, valid, isBetter, accepted, reason, bestSoFar, bestIter, onIteration) {
  var entry = {
    iter: iter,
    cost: cost,
    valid: valid,
    isBetter: isBetter,
    accepted: accepted,
    reason: reason,
    bestSoFar: bestSoFar,
    bestIter: bestIter
  };
  logArr.push(entry);
  if (typeof onIteration === 'function') onIteration(entry);
}

module.exports = {
  IDX: IDX,
  wpLookup: wpLookup,
  createHCAState: createHCAState,
  initializeCurrentDesign: initializeCurrentDesign,
  getDesignFromCurrent: getDesignFromCurrent,
  generateNeighbor: generateNeighbor,
  hcaOptimize: hcaOptimize
};
