// shared.js — ported from modShared.bas (RC_RT_HCA v2.8)
// Phase 1: RC Retaining Wall Optimization

// =============================================
// Pricing (Nov 2568 — Maha Sarakham)
// =============================================
var CONCRETE_PRICES = {
  180: 2337,
  210: 2384,
  240: 2430,
  280: 2524,
  300: 2570,
  320: 2617,
  350: 2783,
  400: 2850
};

var STEEL_PRICES = {
  4000: 24,   // SD40 (fy=4000 ksc) baht/kg
  3000: 28    // SD30 (fy=3000 ksc) baht/kg
};

// =============================================
// initArrays()
// =============================================
// VB6 used 1D array with index ranges:
//   DB(100-104), SP(110-113), tt(1-17), tb(20-36),
//   TBase(40-54), Base(60-71), LToe(80-89)
//
// Node.js: ใช้ 0-based arrays แยกตัวแปร
// =============================================

function initArrays() {
  // --- DB: Rebar diameter (mm) ---
  // VB6 index 100-104
  var DB = [12, 16, 20, 25, 28];

  // --- SP: Rebar spacing (m) ---
  // VB6 index 110-113
  var SP = [0.10, 0.15, 0.20, 0.25];

  // --- tt: Stem top thickness (m) ---
  // VB6 index 1-17: 0.200 to 0.600, step 0.025
  var tt = [];
  for (var i = 0; i <= 16; i++) {
    tt.push(roundTo(0.200 + i * 0.025, 3));
  }
  // tt.length = 17 (index 0-16)

  // --- tb: Stem bottom thickness (m) ---
  // VB6 index 20-36: 0.200 to 1.000, step 0.050
  var tb = [];
  for (var i = 0; i <= 16; i++) {
    tb.push(roundTo(0.200 + i * 0.050, 3));
  }
  // tb.length = 17 (index 0-16)

  // --- TBase: Base slab thickness (m) ---
  // VB6 index 40-54: 0.300 to 1.000, step 0.050
  var TBase = [];
  for (var i = 0; i <= 14; i++) {
    TBase.push(roundTo(0.300 + i * 0.050, 3));
  }
  // TBase.length = 15 (index 0-14)

  // --- Base: Total base width (m) ---
  // VB6 index 60-71: 1.500 to 7.000, step 0.500
  var Base = [];
  for (var i = 0; i <= 11; i++) {
    Base.push(roundTo(1.500 + i * 0.500, 3));
  }
  // Base.length = 12 (index 0-11)

  // --- LToe: Toe length (m) ---
  // VB6 index 80-89: 0.300 to 1.200, step 0.100
  var LToe = [];
  for (var i = 0; i <= 9; i++) {
    LToe.push(roundTo(0.300 + i * 0.100, 3));
  }
  // LToe.length = 10 (index 0-9)

  return {
    DB: DB,
    SP: SP,
    tt: tt,
    tb: tb,
    TBase: TBase,
    Base: Base,
    LToe: LToe
  };
}

// =============================================
// Utility: round to N decimal places
// =============================================
function roundTo(value, decimals) {
  var factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// =============================================
// Steel weight: 0.00617 * db(mm)^2 kg/m
// =============================================
function steelUnitWeight(db_mm) {
  return 0.00617 * db_mm * db_mm;
}

// =============================================
// Exports
// =============================================
module.exports = {
  CONCRETE_PRICES: CONCRETE_PRICES,
  STEEL_PRICES: STEEL_PRICES,
  initArrays: initArrays,
  roundTo: roundTo,
  steelUnitWeight: steelUnitWeight
};
