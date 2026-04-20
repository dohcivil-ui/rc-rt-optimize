// ba.js -- Bisection Algorithm (BA) for RC retaining wall optimization
// Ported from modBA.bas v3.1 (RC_RT_HCA v2.8) -- Triple Bisection + HCA-style Inner Loop
//
// BA differs from HCA in 3 ways:
//   1. Mid-initial (center of range) instead of Max-initial
//   2. Outer loop with growing inner loop (20 * countLoop)
//   3. Bisection state [min, max, mid, midPrice] on tb, TBase, Base
// Reuses shared.js and rng.js 1:1 with HCA.

var shared = require('./shared');
var rngLib = require('./rng');

// VB6-style index bounds (copied from hca.js -- identical)
var IDX = {
  TT_MIN: 1,     TT_MAX: 17,
  TB_MIN: 20,    TB_MAX: 36,
  TBASE_MIN: 40, TBASE_MAX: 54,
  BASE_MIN: 60,  BASE_MAX: 71,
  LTOE_MIN: 80,  LTOE_MAX: 89,
  DB_MIN: 100,   DB_MAX: 104,
  SP_MIN: 110,   SP_MAX: 113
};

// VB6-style offsets (copied from hca.js -- identical)
var OFFSETS = { tt: 1, tb: 20, TBase: 40, Base: 60, LToe: 80 };

// Lookup VB6 index -> physical value (copied from hca.js -- identical)
function wpLookup(arrays, type, vb6Idx) {
  return arrays[type][vb6Idx - OFFSETS[type]];
}

// Factory -- creates BA state with bisection structure
// VB6 ref: modBA.bas lines 30-73 (module-level variables)
function createBAState(params, options) {
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
      toeDB:  0, toeSP:  0,
      heelDB: 0, heelSP: 0
    },
    bisection: {
      tb:    { min: 0, max: 0, mid: 0, midPrice: 0 },
      TBase: { min: 0, max: 0, mid: 0, midPrice: 0 },
      Base:  { min: 0, max: 0, mid: 0, midPrice: 0 }
    },
    counters: {
      totalCount: 0,
      countLoop: 0
    },
    rng: rng
  };
}

// initializeDesignBA -- compute bisection bounds + set initial indices
// VB6 ref: modBA.bas lines 105-218 (InitializeCurrentDesign_BA)
// Combines "compute bisection bounds" + "set Mid initial" into one function,
// matching VB6 structure. Mutates state.indices and state.bisection.
// VB6 integer truncation `(Min+Max)/2` -> Math.floor in Node.
function initializeDesignBA(state) {
  var H = state.params.H;
  var arrays = state.arrays;
  var idx = state.indices;
  var bis = state.bisection;
  var i;

  // Round constraint limits to 3 decimals (same as hca.js initializeCurrentDesign)
  var lim_tb_hi    = shared.roundTo(0.12 * H, 3);
  var lim_TBase_hi = shared.roundTo(0.15 * H, 3);
  var lim_Base_hi  = shared.roundTo(0.70 * H, 3);
  var lim_Base_lo  = shared.roundTo(0.50 * H, 3);
  var lim_LToe_hi  = shared.roundTo(0.20 * H, 3);
  var lim_LToe_lo  = shared.roundTo(0.10 * H, 3);

  // === tb bounds: Mintb = TB_MIN, Maxtb = largest idx where WP_tb <= 0.12H ===
  // VB6 default = TB_MAX if no idx satisfies (modBA.bas line 113 "tb_max_idx = tb_max")
  var tb_max_idx = IDX.TB_MAX;
  for (i = IDX.TB_MAX; i >= IDX.TB_MIN; i--) {
    if (wpLookup(arrays, 'tb', i) <= lim_tb_hi) { tb_max_idx = i; break; }
  }
  bis.tb.min = IDX.TB_MIN;
  bis.tb.max = tb_max_idx;
  bis.tb.mid = Math.floor((bis.tb.min + bis.tb.max) / 2);
  bis.tb.midPrice = Infinity;
  idx.tb = bis.tb.mid;

  // === tt: Max-initial, scan DOWN to find largest idx where WP_tt <= WP_tb(tb) ===
  // VB6 ref: modBA.bas lines 131-149
  idx.tt = IDX.TT_MAX;
  for (i = IDX.TT_MAX; i >= IDX.TT_MIN; i--) {
    if (wpLookup(arrays, 'tt', i) <= wpLookup(arrays, 'tb', idx.tb)) {
      idx.tt = i;
      break;
    }
  }
  if (idx.tt < IDX.TT_MIN) idx.tt = IDX.TT_MIN;
  if (idx.tt > IDX.TT_MAX) idx.tt = IDX.TT_MAX;

  // Safety: constraint tt <= tb (VB6 lines 142-149)
  if (wpLookup(arrays, 'tt', idx.tt) > wpLookup(arrays, 'tb', idx.tb)) {
    for (i = IDX.TT_MAX; i >= IDX.TT_MIN; i--) {
      if (wpLookup(arrays, 'tt', i) <= wpLookup(arrays, 'tb', idx.tb)) {
        idx.tt = i;
        break;
      }
    }
  }

  // === TBase bounds: MinTBase = TBASE_MIN, MaxTBase = largest idx where WP_TBase <= 0.15H ===
  // VB6 default = TBASE_MAX if none satisfy (modBA.bas line 153 "TBase_max_idx = TBase_max")
  var TBase_max_idx = IDX.TBASE_MAX;
  for (i = IDX.TBASE_MAX; i >= IDX.TBASE_MIN; i--) {
    if (wpLookup(arrays, 'TBase', i) <= lim_TBase_hi) { TBase_max_idx = i; break; }
  }
  bis.TBase.min = IDX.TBASE_MIN;
  bis.TBase.max = TBase_max_idx;
  bis.TBase.mid = Math.floor((bis.TBase.min + bis.TBase.max) / 2);
  bis.TBase.midPrice = Infinity;
  idx.TBase = bis.TBase.mid;

  // === Base bounds: MinBase = smallest where WP_Base >= 0.5H, MaxBase = largest where <= 0.7H ===
  var Base_min_idx = IDX.BASE_MIN;
  for (i = IDX.BASE_MIN; i <= IDX.BASE_MAX; i++) {
    if (wpLookup(arrays, 'Base', i) >= lim_Base_lo) { Base_min_idx = i; break; }
  }
  var Base_max_idx = IDX.BASE_MAX;
  for (i = IDX.BASE_MAX; i >= IDX.BASE_MIN; i--) {
    if (wpLookup(arrays, 'Base', i) <= lim_Base_hi) { Base_max_idx = i; break; }
  }
  bis.Base.min = Base_min_idx;
  bis.Base.max = Base_max_idx;
  bis.Base.mid = Math.floor((bis.Base.min + bis.Base.max) / 2);
  bis.Base.midPrice = Infinity;
  idx.Base = bis.Base.mid;

  // === LToe: mid-initial within [0.1H, 0.2H] (not bisected) ===
  // VB6 ref: modBA.bas lines 190-208
  var LToe_min_idx = IDX.LTOE_MIN;
  for (i = IDX.LTOE_MIN; i <= IDX.LTOE_MAX; i++) {
    if (wpLookup(arrays, 'LToe', i) >= lim_LToe_lo) { LToe_min_idx = i; break; }
  }
  var LToe_max_idx = IDX.LTOE_MAX;
  for (i = IDX.LTOE_MAX; i >= IDX.LTOE_MIN; i--) {
    if (wpLookup(arrays, 'LToe', i) <= lim_LToe_hi) { LToe_max_idx = i; break; }
  }
  idx.LToe = Math.floor((LToe_min_idx + LToe_max_idx) / 2);

  // === Steel: all DB/SP to mid of full range (VB6 integer truncation) ===
  // VB6 ref: modBA.bas lines 211-216
  var dbMid = Math.floor((IDX.DB_MIN + IDX.DB_MAX) / 2);  // = 102
  var spMid = Math.floor((IDX.SP_MIN + IDX.SP_MAX) / 2);  // = 111
  idx.stemDB = dbMid; idx.stemSP = spMid;
  idx.toeDB  = dbMid; idx.toeSP  = spMid;
  idx.heelDB = dbMid; idx.heelSP = spMid;
}

// getDesignFromCurrentBA -- extract design + steel from current indices
// VB6 ref: modBA.bas lines 224-243 (GetDesignFromCurrent_BA)
// Identical shape to hca.js getDesignFromCurrent for shared.calculateCost compatibility.
function getDesignFromCurrentBA(state) {
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

// generateNeighborBA -- BA-style neighbor generation with bisection-bounded clamping
// VB6 ref: modBA.bas lines 250-354 (GenerateNeighbor_BA)
//
// Returns NEW indices object; does NOT mutate state.indices.
//
// Key differences from hca.generateNeighbor:
//   - tb, TBase, Base clamp to BISECTION bounds (shrinking), not full IDX range
//   - tb is generated BEFORE tt (opposite order from HCA)
//   - No 0.12H walk-down for tb (bisection already enforces this via .max)
//   - No 0.15H walk-down for TBase (same reasoning)
//   - No 0.5H/0.7H walks for Base (same reasoning)
//   - LToe computes min/max indices every call (VB6 quirk, preserved for parity)
function generateNeighborBA(state) {
  var arrays = state.arrays;
  var cur = state.indices;
  var bis = state.bisection;
  var H = state.params.H;
  var rng = state.rng;
  var i, step;

  // LToe constraint indices -- recomputed every call (VB6 parity, modBA.bas 262-276)
  var lim_LToe_hi = shared.roundTo(0.20 * H, 3);
  var lim_LToe_lo = shared.roundTo(0.10 * H, 3);
  var LToe_min_idx = IDX.LTOE_MIN;
  for (i = IDX.LTOE_MIN; i <= IDX.LTOE_MAX; i++) {
    if (wpLookup(arrays, 'LToe', i) >= lim_LToe_lo) { LToe_min_idx = i; break; }
  }
  var LToe_max_idx = IDX.LTOE_MAX;
  for (i = IDX.LTOE_MAX; i >= IDX.LTOE_MIN; i--) {
    if (wpLookup(arrays, 'LToe', i) <= lim_LToe_hi) { LToe_max_idx = i; break; }
  }

  // 1) tb: step = Rand(-1, 1), clamp to BISECTION bounds [bis.tb.min, bis.tb.max]
  step = rngLib.rand(-1, 1, rng);
  var newTb = cur.tb + step;
  if (newTb < bis.tb.min) newTb = bis.tb.min;
  if (newTb > bis.tb.max) newTb = bis.tb.max;

  // 2) tt: step = Rand(-2, 2), clamp to IDX range, then re-scan if WP_tt > WP_tb(newTb)
  //    (tt comes AFTER tb in BA -- opposite order from HCA)
  step = rngLib.rand(-2, 2, rng);
  var newTt = cur.tt + step;
  if (newTt < IDX.TT_MIN) newTt = IDX.TT_MIN;
  if (newTt > IDX.TT_MAX) newTt = IDX.TT_MAX;
  if (wpLookup(arrays, 'tt', newTt) > wpLookup(arrays, 'tb', newTb)) {
    for (i = IDX.TT_MAX; i >= IDX.TT_MIN; i--) {
      if (wpLookup(arrays, 'tt', i) <= wpLookup(arrays, 'tb', newTb)) {
        newTt = i;
        break;
      }
    }
  }

  // 3) TBase: step = Rand(-1, 1), clamp to BISECTION bounds [bis.TBase.min, bis.TBase.max]
  step = rngLib.rand(-1, 1, rng);
  var newTBase = cur.TBase + step;
  if (newTBase < bis.TBase.min) newTBase = bis.TBase.min;
  if (newTBase > bis.TBase.max) newTBase = bis.TBase.max;

  // 4) LToe: step = Rand(-2, 2), clamp to [LToe_min_idx, LToe_max_idx]
  step = rngLib.rand(-2, 2, rng);
  var newLToe = cur.LToe + step;
  if (newLToe < LToe_min_idx) newLToe = LToe_min_idx;
  if (newLToe > LToe_max_idx) newLToe = LToe_max_idx;

  // 5) Base: step = Rand(-1, 1), clamp to BISECTION bounds [bis.Base.min, bis.Base.max]
  step = rngLib.rand(-1, 1, rng);
  var newBase = cur.Base + step;
  if (newBase < bis.Base.min) newBase = bis.Base.min;
  if (newBase > bis.Base.max) newBase = bis.Base.max;

  // 6-11) Steel: step = Rand(-2, 2) each, clamp to full IDX range (identical to HCA)
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

// doBisectionStep -- update bisection state for tb, TBase, Base after inner loop
// VB6 ref: modBA.bas lines 681-727 (inline code, not a separate sub)
//
// For each of the 3 bisected dims:
//   - If currentPrice < midPrice: shrink from top (max = indices[dim]),
//     update midPrice to currentPrice.
//   - Else: shrink from bottom (min = indices[dim]), midPrice unchanged.
//   - Recompute mid = floor((min+max)/2), clamped to [min, max].
//
// Mutates state.bisection. Does NOT mutate state.indices.
// NOTE: relies on caller to set currentPrice correctly:
//   - valid design: use the computed cost
//   - invalid design: use Infinity (NOT a large finite sentinel) so that
//     `Infinity < Infinity === false` matches VB6's `999999999 < 999999999 === false`.
function doBisectionStep(state, currentPrice) {
  var idx = state.indices;
  var bis = state.bisection;
  var dims = ['tb', 'TBase', 'Base'];
  var i, dim, b, curIdx;

  for (i = 0; i < dims.length; i++) {
    dim = dims[i];
    b = bis[dim];
    curIdx = idx[dim];

    if (currentPrice < b.midPrice) {
      b.max = curIdx;
      b.midPrice = currentPrice;
    } else {
      b.min = curIdx;
    }

    b.mid = Math.floor((b.min + b.max) / 2);
    if (b.mid < b.min) b.mid = b.min;
    if (b.mid > b.max) b.mid = b.max;
  }
}

// Internal helper -- convert VB6-style steel indices to 0-based for shared.checkDesignValid
// (copied from hca.js -- same pattern, same IDX offsets)
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

// Internal helper -- shallow copy indices for backup/restore
// (copied from hca.js)
function copyIndices(idx) {
  return {
    tt: idx.tt, tb: idx.tb, TBase: idx.TBase, Base: idx.Base, LToe: idx.LToe,
    stemDB: idx.stemDB, stemSP: idx.stemSP,
    toeDB:  idx.toeDB,  toeSP:  idx.toeSP,
    heelDB: idx.heelDB, heelSP: idx.heelSP
  };
}

// Internal helper -- push log entry + optional callback
// (copied from hca.js)
function pushLogBA(logArr, iter, cost, valid, isBetter, accepted, reason, bestSoFar, bestIter, onIteration) {
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

// ==========================================================================
// baOptimize -- Main Bisection Algorithm optimization (Wave 6)
// VB6 ref: modBA.bas lines 361-744 (BisectionOptimization)
//
// BA structure: outer loop runs until totalCount >= maxIterations.
// Each outer loop:
//   (1) increments countLoop, computes innerIterations = 20 * countLoop
//       (capped by remaining budget)
//   (2) resets indices.Base/TBase/tb to bisection.X.mid (tt/LToe/steel NOT reset)
//   (3) re-clamps tt to be <= newTb
//   (4) evaluates reset design; currentCost = cost if valid else Infinity
//   (5) runs inner HCA-style loop (accept valid+cheaper, reject else, restore backup)
//   (6) calls doBisectionStep(state, currentCost) to update bisection bounds
// ==========================================================================
function baOptimize(params, options) {
  options = options || {};
  var maxIterations = options.maxIterations || 10000;

  var state = createBAState(params, { seed: options.seed, rng: options.rng });
  initializeDesignBA(state);

  var mat = params.material;
  var logArr = [];
  var costHistory = new Array(maxIterations + 1);

  // === Initial design evaluation (iteration 0) ===
  var initial = getDesignFromCurrentBA(state);
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
    // VB6 quirk (modBA.bas line 529): bestIteration = 1 when initial valid
    best = initial.design;
    bestSteel = initial.steel;
    bestCost = initialCost;
    bestIteration = 1;
    currentCost = initialCost;
    pushLogBA(logArr, 0, initialCost, true, true, true, '', bestCost, bestIteration, options.onIteration);
  } else {
    best = null;
    bestSteel = null;
    bestCost = Infinity;
    bestIteration = 0;
    currentCost = Infinity;
    pushLogBA(logArr, 0, initialCost, false, false, false, initialValidity.reason, bestCost, bestIteration, options.onIteration);
  }

  // === Main outer loop ===
  while (state.counters.totalCount < maxIterations) {
    state.counters.countLoop = state.counters.countLoop + 1;
    var innerIterations = 20 * state.counters.countLoop;
    if (state.counters.totalCount + innerIterations > maxIterations) {
      innerIterations = maxIterations - state.counters.totalCount;
    }

    // --- Reset Current values to bisection Mids (VB6 lines 556-559) ---
    state.indices.Base  = state.bisection.Base.mid;
    state.indices.TBase = state.bisection.TBase.mid;
    state.indices.tb    = state.bisection.tb.mid;

    // --- Clamp tt after reset (VB6 lines 562-570) ---
    if (wpLookup(state.arrays, 'tt', state.indices.tt) > wpLookup(state.arrays, 'tb', state.indices.tb)) {
      for (var j = IDX.TT_MAX; j >= IDX.TT_MIN; j--) {
        if (wpLookup(state.arrays, 'tt', j) <= wpLookup(state.arrays, 'tb', state.indices.tb)) {
          state.indices.tt = j;
          break;
        }
      }
    }

    // --- Evaluate reset design to set currentCost (VB6 lines 572-586) ---
    var resetEval = getDesignFromCurrentBA(state);
    var resetCost = shared.calculateCost(
      resetEval.design, params.H, params.gamma_concrete,
      mat.concretePrice, mat.steelPrice, resetEval.steel
    ).cost;
    var resetValidity = shared.checkDesignValid(
      resetEval.design, params.H, params.H1, params.gamma_soil, params.gamma_concrete,
      params.phi, params.mu, params.qa, params.cover,
      state.wsd, steelTo0Based(resetEval.steel), state.arrays
    );
    // Infinity sentinel (matches VB6 999999999 semantics for doBisectionStep)
    currentCost = resetValidity.valid ? resetCost : Infinity;

    // --- Inner loop (HCA-style accept/reject, VB6 lines 589-671) ---
    for (var i = 1; i <= innerIterations; i++) {
      state.counters.totalCount = state.counters.totalCount + 1;
      if (state.counters.totalCount > maxIterations) break;

      var backup = copyIndices(state.indices);
      var newIndices = generateNeighborBA(state);
      state.indices = newIndices;

      var neighbor = getDesignFromCurrentBA(state);
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
        if (neighborCost < currentCost) {
          // valid AND cheaper -- accept
          currentCost = neighborCost;
          accepted = true;
          if (neighborCost < bestCost) {
            // also better than overall best -- update best
            best = neighbor.design;
            bestSteel = neighbor.steel;
            bestCost = neighborCost;
            bestIteration = state.counters.totalCount;
            isBetter = true;
          }
        } else {
          // valid but not cheaper -- reject (restore backup)
          state.indices = backup;
        }
      } else {
        // invalid -- reject (restore backup)
        state.indices = backup;
        reason = validity.reason;
      }

      // Update cost history (VB6 lines 663-668)
      if (bestIteration > 0) {
        costHistory[state.counters.totalCount] = bestCost;
      } else {
        costHistory[state.counters.totalCount] = 999000;
      }

      pushLogBA(logArr, state.counters.totalCount, neighborCost, validity.valid, isBetter, accepted, reason, bestCost, bestIteration, options.onIteration);
    }

    // --- Triple bisection step (VB6 lines 681-727) ---
    doBisectionStep(state, currentCost);
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

module.exports = {
  IDX: IDX,
  OFFSETS: OFFSETS,
  wpLookup: wpLookup,
  createBAState: createBAState,
  initializeDesignBA: initializeDesignBA,
  getDesignFromCurrentBA: getDesignFromCurrentBA,
  generateNeighborBA: generateNeighborBA,
  doBisectionStep: doBisectionStep,
  baOptimize: baOptimize
};
