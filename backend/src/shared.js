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
// Safety Factor Limits (VB6 constants)
// =============================================
var FS_OT_MIN = 2.0;   // Overturning
var FS_SL_MIN = 1.5;   // Sliding
var FS_BC_MIN = 2.0;   // Bearing Capacity

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
// Moment Calculations (ported from modShared.bas SECTION 9)
// =============================================

// MR: Resisting Moment about toe (ton-m/m)
// MR = W1*x1 + W2*x2 + W3*x3 + W4*x4
function calculateMR(d, H, H1, gamma_soil, gamma_concrete) {
  var r = calculateWTotal(d, H, H1, gamma_soil, gamma_concrete);
  return r.W1 * r.x1 + r.W2 * r.x2 + r.W3 * r.x3 + r.W4 * r.x4;
}

// MO: Overturning Moment about toe (ton-m/m)
// MO = Pa*(H/3) - Pp*(H1/3)
function calculateMO(Pa, H, Pp, H1) {
  return Pa * (H / 3) - Pp * (H1 / 3);
}

// =============================================
// Moment at Stem Base (Section 9 — stem design)
// =============================================
// M_stem = 0.5 * gamma_soil * Ka * H1^3 / 3
// H1 = embedment depth (m), phi in degrees
// =============================================

function calculateMomentStem(H1, gamma_soil, phi) {
  var Ka = calculateKa(phi);
  return 0.5 * gamma_soil * Ka * H1 * H1 * H1 / 3;
}

// =============================================
// Moment at Toe — 1:1 port from VB6 CalculateMomentToe (line 390-432)
// =============================================
// NOTE: VB6 M_bearing triangle term uses (LToe/2)*(2*LToe/3)
// instead of 0.5*LToe*(2*LToe/3). Ported as-is for research parity.
// =============================================

function calculateMomentToe(d, H, H1, gamma_soil, gamma_concrete, phi) {
  var Ka = calculateKa(phi);
  var Kp = calculateKp(phi);
  var Pa = calculatePa(gamma_soil, Ka, H);
  var Pp = calculatePp(gamma_soil, Kp, H1);

  var r = calculateWTotal(d, H, H1, gamma_soil, gamma_concrete);
  var W_total = r.WTotal;
  var MR = r.W1 * r.x1 + r.W2 * r.x2 + r.W3 * r.x3 + r.W4 * r.x4;
  var MO = calculateMO(Pa, H, Pp, H1);

  var e, q_max, q_min;
  var q_toe, q_junction;
  var M_bearing, M_self, w_self, L_eff;

  if (W_total > 0.1 && d.Base > 0.1) {
    e = Math.abs((d.Base / 2) - ((MR - MO) / W_total));
    if (e <= d.Base / 6) {
      q_max = (W_total / d.Base) * (1 + (6 * e / d.Base));
      q_min = (W_total / d.Base) * (1 - (6 * e / d.Base));
    } else {
      L_eff = 3 * (d.Base / 2 - e);
      if (L_eff > 0.1) {
        q_max = 2 * W_total / L_eff;
      } else {
        q_max = W_total / d.Base * 2;
      }
      q_min = 0;
    }
  } else {
    q_max = 1;
    q_min = 1;
  }

  q_toe = q_max;
  if (d.Base > 0.01) {
    q_junction = q_max - (q_max - q_min) * (d.LToe / d.Base);
  } else {
    q_junction = q_max;
  }

  M_bearing = q_junction * d.LToe * (d.LToe / 2) +
              (q_toe - q_junction) * (d.LToe / 2) * (2 * d.LToe / 3);
  w_self = gamma_concrete * d.TBase;
  M_self = w_self * d.LToe * d.LToe / 2;

  return Math.abs(M_bearing - M_self);
}

// =============================================
// Moment at Heel — 1:1 port from VB6 CalculateMomentHeel (line 437-481)
// =============================================
// NOTE: VB6 M_bearing triangle term uses (LHeel/2)*(LHeel/3)
// instead of 0.5*LHeel*(LHeel/3). Ported as-is for research parity.
// =============================================

function calculateMomentHeel(d, H, H1, gamma_soil, gamma_concrete, phi) {
  var Ka = calculateKa(phi);
  var Kp = calculateKp(phi);
  var Pa = calculatePa(gamma_soil, Ka, H);
  var Pp = calculatePp(gamma_soil, Kp, H1);

  var r = calculateWTotal(d, H, H1, gamma_soil, gamma_concrete);
  var W_total = r.WTotal;
  var MR = r.W1 * r.x1 + r.W2 * r.x2 + r.W3 * r.x3 + r.W4 * r.x4;
  var MO = calculateMO(Pa, H, Pp, H1);

  var e, q_max, q_min;
  var q_junction, q_heel;
  var M_downward, M_bearing;
  var H_soil, w_down, L_eff;

  if (W_total > 0.1 && d.Base > 0.1) {
    e = Math.abs((d.Base / 2) - ((MR - MO) / W_total));
    if (e <= d.Base / 6) {
      q_max = (W_total / d.Base) * (1 + (6 * e / d.Base));
      q_min = (W_total / d.Base) * (1 - (6 * e / d.Base));
    } else {
      L_eff = 3 * (d.Base / 2 - e);
      if (L_eff > 0.1) {
        q_max = 2 * W_total / L_eff;
      } else {
        q_max = W_total / d.Base * 2;
      }
      q_min = 0;
    }
  } else {
    q_max = 1;
    q_min = 1;
  }

  if (d.Base > 0.01) {
    q_junction = q_max - (q_max - q_min) * ((d.LToe + d.tb) / d.Base);
  } else {
    q_junction = q_max;
  }
  q_heel = q_min;
  H_soil = H - d.TBase;
  w_down = (d.TBase * gamma_concrete) + (H_soil * gamma_soil);
  M_downward = w_down * d.LHeel * d.LHeel / 2;
  M_bearing = q_heel * d.LHeel * (d.LHeel / 2) +
              (q_junction - q_heel) * (d.LHeel / 2) * (d.LHeel / 3);

  return Math.abs(M_downward - M_bearing);
}

// =============================================
// Safety Factor Checks (ported from modShared.bas SECTION 10)
// =============================================

// CheckFS_OT — Overturning (line 490-503)
function checkFS_OT(d, H, H1, gamma_soil, gamma_concrete, phi) {
  var Ka = calculateKa(phi);
  var Kp = calculateKp(phi);
  var Pa = calculatePa(gamma_soil, Ka, H);
  var Pp = calculatePp(gamma_soil, Kp, H1);

  var MR = calculateMR(d, H, H1, gamma_soil, gamma_concrete);
  var MO = calculateMO(Pa, H, Pp, H1);

  if (MO <= 0.001) {
    return { FS_OT: 999, pass: true };
  }

  var FS_OT = MR / MO;
  return { FS_OT: FS_OT, pass: FS_OT >= FS_OT_MIN };
}

// CheckFS_SL — Sliding (line 508-528)
function checkFS_SL(d, H, H1, gamma_soil, gamma_concrete, phi, mu) {
  var Ka = calculateKa(phi);
  var Kp = calculateKp(phi);
  var Pa = calculatePa(gamma_soil, Ka, H);
  var Pp = calculatePp(gamma_soil, Kp, H1);

  var W_total = calculateWTotal(d, H, H1, gamma_soil, gamma_concrete).WTotal;

  var Resistance = Pp + mu * W_total;

  if (Pa <= 0.001) {
    return { FS_SL: 999, pass: true };
  }

  var FS_SL = Resistance / Pa;
  return { FS_SL: FS_SL, pass: FS_SL >= FS_SL_MIN };
}

// CheckFS_BC — Bearing Capacity (line 533-586)
function checkFS_BC(d, H, H1, gamma_soil, gamma_concrete, phi, qa) {
  var Ka = calculateKa(phi);
  var Kp = calculateKp(phi);
  var Pa = calculatePa(gamma_soil, Ka, H);
  var Pp = calculatePp(gamma_soil, Kp, H1);

  var r = calculateWTotal(d, H, H1, gamma_soil, gamma_concrete);
  var W_total = r.WTotal;

  if (W_total < 0.1) {
    return { FS_BC: 0, e: 0, q_max: 0, q_min: 0, pass: false };
  }

  if (d.Base < 0.1) {
    return { FS_BC: 0, e: 0, q_max: 0, q_min: 0, pass: false };
  }

  var MR = r.W1 * r.x1 + r.W2 * r.x2 + r.W3 * r.x3 + r.W4 * r.x4;
  var MO = calculateMO(Pa, H, Pp, H1);

  var e = Math.abs((d.Base / 2) - ((MR - MO) / W_total));

  if (e > d.Base / 3) {
    return { FS_BC: 0, e: e, q_max: 0, q_min: 0, pass: false };
  }

  var q_max, q_min, L_eff;

  if (e <= d.Base / 6) {
    q_max = (W_total / d.Base) * (1 + (6 * e / d.Base));
    q_min = (W_total / d.Base) * (1 - (6 * e / d.Base));
  } else {
    L_eff = 3 * (d.Base / 2 - e);
    if (L_eff > 0.01) {
      q_max = 2 * W_total / L_eff;
    } else {
      q_max = W_total / d.Base * 2;
    }
    q_min = 0;
  }

  if (q_min < 0 || q_max <= 0.001) {
    return { FS_BC: 0, e: e, q_max: q_max, q_min: q_min, pass: false };
  }

  var FS_BC = qa / q_max;
  return { FS_BC: FS_BC, e: e, q_max: q_max, q_min: q_min, pass: FS_BC >= FS_BC_MIN };
}

// =============================================
// Steel Weight helper (VB6 CalculateSteelWeight, line 685-704)
// =============================================
// DB_idx: 100-104 (maps to arrays.DB[0..4])
// SP_idx: 110-113 (maps to arrays.SP[0..3])
// =============================================

function calculateSteelWeight(DB_idx, SP_idx, length, arrays) {
  if (DB_idx < 100 || DB_idx > 104) return 0;
  if (SP_idx < 110 || SP_idx > 113) return 0;

  var db_mm = arrays.DB[DB_idx - 100];
  var spacing_m = arrays.SP[SP_idx - 110];
  var n_bars = 1 / spacing_m;
  var weight_per_m = 0.00617 * db_mm * db_mm;
  return n_bars * weight_per_m * length;
}

// =============================================
// Cost Calculation (VB6 CalculateCostFull, line 651-680)
// =============================================

function calculateCost(d, H, gamma_concrete, concretePrice, steelPrice, steel) {
  var arrays = initArrays();
  var H_stem = H - d.TBase;

  var V_stem = 0.5 * (d.tt + d.tb) * H_stem;
  var V_base = d.Base * d.TBase;
  var V_total = V_stem + V_base;

  var L_stem = H_stem + 0.4;
  var L_toe = d.LToe + 0.4;
  var L_heel = d.LHeel + 0.4;

  var W_stem = calculateSteelWeight(steel.stemDB_idx, steel.stemSP_idx, L_stem, arrays);
  var W_toe = calculateSteelWeight(steel.toeDB_idx, steel.toeSP_idx, L_toe, arrays);
  var W_heel = calculateSteelWeight(steel.heelDB_idx, steel.heelSP_idx, L_heel, arrays);
  var W_total_steel = W_stem + W_toe + W_heel;

  var cost = V_total * concretePrice + W_total_steel * steelPrice;

  return { V_total: V_total, W_total_steel: W_total_steel, cost: cost };
}

// =============================================
// WSD Functions (ported from modWSD.bas)
// =============================================

// CalculateWSDParameters (line 22-50)
function calculateWSDParams(fy, fc_prime) {
  var n = 9;
  var fs = fy <= 3000 ? 1500 : 1700;
  var fc = 0.45 * fc_prime;
  var k = 1 / (1 + fs / (n * fc));
  var j = 1 - k / 3;
  var R = 0.5 * fc * k * j;
  return { n: n, fs: fs, fc: fc, k: k, j: j, R: R };
}

// CalculateAsRequired (line 73-89)
function calculateAsRequired(M, fs, j, d) {
  var M_kg_cm = M * 1000 * 100;
  var d_cm = d * 100;
  if (M_kg_cm <= 0 || d_cm <= 0 || fs <= 0 || j <= 0) return 0;
  return M_kg_cm / (fs * j * d_cm);
}

// CalculateAsProvided (line 95-133)
function calculateAsProvided(DB_idx, SP_idx, arrays) {
  if (DB_idx < 0 || DB_idx >= arrays.DB.length) return 0;
  if (SP_idx < 0 || SP_idx >= arrays.SP.length) return 0;

  var db_mm = arrays.DB[DB_idx];
  var spacing_m = arrays.SP[SP_idx];
  var db_cm = db_mm / 10;
  var area_per_bar = Math.PI * (db_cm / 2) * (db_cm / 2);
  var n_bars = spacing_m > 0 ? 1 / spacing_m : 0;
  return area_per_bar * n_bars;
}

// =============================================
// Steel Adequacy Check (modShared line 618-633)
// =============================================

function checkSteelOK(M, d_eff, DB_idx, SP_idx, wsd, arrays) {
  var As_req = calculateAsRequired(M, wsd.fs, wsd.j, d_eff);
  var As_prov = calculateAsProvided(DB_idx, SP_idx, arrays);
  return As_prov >= As_req;
}

// =============================================
// Design Validity Check (modShared line 710-762)
// =============================================

function checkDesignValid(d, H, H1, gamma_soil, gamma_concrete, phi, mu, qa, cover, wsd, steel, arrays) {
  var result = { valid: false, FS_OT: 0, FS_SL: 0, FS_BC: 0, reason: '' };

  if (d.tb < d.tt) { result.reason = 'tb < tt'; return result; }
  if (d.LHeel < 0.3) { result.reason = 'LHeel < 0.3'; return result; }
  if (d.LHeel <= d.LToe) { result.reason = 'LHeel <= LToe'; return result; }

  var fsOT = checkFS_OT(d, H, H1, gamma_soil, gamma_concrete, phi);
  result.FS_OT = fsOT.FS_OT;
  if (!fsOT.pass) { result.reason = 'FS_OT < 2.0'; return result; }

  var fsSL = checkFS_SL(d, H, H1, gamma_soil, gamma_concrete, phi, mu);
  result.FS_SL = fsSL.FS_SL;
  if (!fsSL.pass) { result.reason = 'FS_SL < 1.5'; return result; }

  var fsBC = checkFS_BC(d, H, H1, gamma_soil, gamma_concrete, phi, qa);
  result.FS_BC = fsBC.FS_BC;
  if (!fsBC.pass) { result.reason = 'FS_BC < 2.0'; return result; }

  var M_stem = calculateMomentStem(H1, gamma_soil, phi);
  var M_toe = calculateMomentToe(d, H, H1, gamma_soil, gamma_concrete, phi);
  var M_heel = calculateMomentHeel(d, H, H1, gamma_soil, gamma_concrete, phi);

  var d_stem = d.tb - cover;
  var d_toe = d.TBase - cover;
  var d_heel = d.TBase - cover;
  if (d_stem <= 0.05) d_stem = 0.05;
  if (d_toe <= 0.05) d_toe = 0.05;
  if (d_heel <= 0.05) d_heel = 0.05;

  if (!checkSteelOK(M_stem, d_stem, steel.stemDB_idx, steel.stemSP_idx, wsd, arrays)) {
    result.reason = 'steel stem insufficient'; return result;
  }
  if (!checkSteelOK(M_toe, d_toe, steel.toeDB_idx, steel.toeSP_idx, wsd, arrays)) {
    result.reason = 'steel toe insufficient'; return result;
  }
  if (!checkSteelOK(M_heel, d_heel, steel.heelDB_idx, steel.heelSP_idx, wsd, arrays)) {
    result.reason = 'steel heel insufficient'; return result;
  }

  result.valid = true;
  return result;
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
  steelUnitWeight: steelUnitWeight,
  calculateMR: calculateMR,
  calculateMO: calculateMO,
  calculateMomentStem: calculateMomentStem,
  calculateMomentToe: calculateMomentToe,
  calculateMomentHeel: calculateMomentHeel,
  FS_OT_MIN: FS_OT_MIN,
  checkFS_OT: checkFS_OT,
  FS_SL_MIN: FS_SL_MIN,
  checkFS_SL: checkFS_SL,
  FS_BC_MIN: FS_BC_MIN,
  checkFS_BC: checkFS_BC,
  calculateCost: calculateCost,
  calculateWSDParams: calculateWSDParams,
  calculateAsRequired: calculateAsRequired,
  calculateAsProvided: calculateAsProvided,
  checkSteelOK: checkSteelOK,
  checkDesignValid: checkDesignValid
};
