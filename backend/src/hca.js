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

module.exports = {
  IDX: IDX,
  wpLookup: wpLookup,
  createHCAState: createHCAState,
  initializeCurrentDesign: initializeCurrentDesign,
  getDesignFromCurrent: getDesignFromCurrent
};
