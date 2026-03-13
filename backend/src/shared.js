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
// Earth Pressure Coefficients (Rankine)
// =============================================
// Ka = (1 - sin phi) / (1 + sin phi)
// Kp = (1 + sin phi) / (1 - sin phi)
// phi in degrees
// =============================================

function calculateKa(phi_deg) {
  var phi_rad = phi_deg * Math.PI / 180;
  return (1 - Math.sin(phi_rad)) / (1 + Math.sin(phi_rad));
}

function calculateKp(phi_deg) {
  var phi_rad = phi_deg * Math.PI / 180;
  return (1 + Math.sin(phi_rad)) / (1 - Math.sin(phi_rad));
}

// =============================================
// Active & Passive Earth Pressure Forces
// =============================================
// Pa = 0.5 * gamma_soil * Ka * H^2    (ton/m)
// Pp = 0.5 * gamma_soil * Kp * H1^2   (ton/m)
// =============================================

function calculatePa(gamma_soil, Ka, H) {
  return 0.5 * gamma_soil * Ka * H * H;
}

function calculatePp(gamma_soil, Kp, H1) {
  return 0.5 * gamma_soil * Kp * H1 * H1;
}

// =============================================
// LHeel = Base - LToe - tb
// =============================================

function calculateLHeel(Base, LToe, tb) {
  return Base - LToe - tb;
}

// =============================================
// Weight Calculations (ported from modShared.bas SECTION 8)
// =============================================
// All weights in ton/m (per unit length of wall)
// Each function returns { W: weight, x: moment arm from toe }
// Global params: H, H1, gamma_soil, gamma_concrete
// Design params: tt, tb, TBase, Base, LToe, LHeel
// =============================================

// W1: Soil on Toe
// VB6: CalculateW1 — includes rectangular + triangular area
// from stem taper above toe
function calculateW1(d, H, H1, gamma_soil) {
  var H_stem = H - d.TBase;
  var H1_toe = H1 - d.TBase;
  if (H1_toe < 0) H1_toe = 0;

  if (H1_toe < 0.001) {
    return { W: 0, x: d.LToe / 2 };
  }

  var base_triangle = 0;
  if (H_stem > 0.001) {
    base_triangle = (d.tb - d.tt) * H1_toe / H_stem;
  }

  var A_rect = d.LToe * H1_toe;
  var A_tri = 0.5 * base_triangle * H1_toe;

  return {
    W: (A_rect + A_tri) * gamma_soil,
    x: d.LToe / 2
  };
}

// W2: Soil on Heel
function calculateW2(d, H, gamma_soil) {
  var H_wall = H - d.TBase;
  return {
    W: d.LHeel * H_wall * gamma_soil,
    x: d.LToe + d.tb + d.LHeel / 2
  };
}

// W3: Stem (Concrete) — trapezoid with centroid calculation
function calculateW3(d, H, gamma_concrete) {
  var H_stem = H - d.TBase;
  var W = 0.5 * (d.tt + d.tb) * H_stem * gamma_concrete;

  var A_rect = d.tt * H_stem;
  var x_rect = d.tt / 2;
  var A_tri = 0.5 * (d.tb - d.tt) * H_stem;
  var x_tri = d.tt + (d.tb - d.tt) / 3;
  var A_total = A_rect + A_tri;

  var centroid_from_heel;
  if (A_total > 0.001) {
    centroid_from_heel = (A_rect * x_rect + A_tri * x_tri) / A_total;
  } else {
    centroid_from_heel = d.tb / 2;
  }

  return {
    W: W,
    x: (d.LToe + d.tb) - centroid_from_heel
  };
}

// W4: Base Slab (Concrete)
function calculateW4(d, gamma_concrete) {
  return {
    W: d.Base * d.TBase * gamma_concrete,
    x: d.Base / 2
  };
}

// WTotal: sum of W1+W2+W3+W4
function calculateWTotal(d, H, H1, gamma_soil, gamma_concrete) {
  var w1 = calculateW1(d, H, H1, gamma_soil);
  var w2 = calculateW2(d, H, gamma_soil);
  var w3 = calculateW3(d, H, gamma_concrete);
  var w4 = calculateW4(d, gamma_concrete);

  return {
    W1: w1.W, x1: w1.x,
    W2: w2.W, x2: w2.x,
    W3: w3.W, x3: w3.x,
    W4: w4.W, x4: w4.x,
    WTotal: w1.W + w2.W + w3.W + w4.W
  };
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
  calculateKa: calculateKa,
  calculateKp: calculateKp,
  calculatePa: calculatePa,
  calculatePp: calculatePp,
  calculateLHeel: calculateLHeel,
  calculateW1: calculateW1,
  calculateW2: calculateW2,
  calculateW3: calculateW3,
  calculateW4: calculateW4,
  calculateWTotal: calculateWTotal,
  steelUnitWeight: steelUnitWeight
};
