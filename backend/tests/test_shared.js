// test_shared.js — validate initArrays() against VB6 spec
var shared = require('../src/shared');

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log('  PASS: ' + msg);
    passed++;
  } else {
    console.log('  FAIL: ' + msg);
    failed++;
  }
}

function assertClose(a, b, tol, msg) {
  assert(Math.abs(a - b) < tol, msg + ' (' + a + ' vs ' + b + ')');
}

console.log('=== Test initArrays() ===\n');

var arr = shared.initArrays();

// --- DB ---
console.log('[DB] Rebar diameters (mm):');
assert(arr.DB.length === 5, 'DB has 5 elements');
assert(arr.DB[0] === 12, 'DB[0] = 12');
assert(arr.DB[1] === 16, 'DB[1] = 16');
assert(arr.DB[2] === 20, 'DB[2] = 20');
assert(arr.DB[3] === 25, 'DB[3] = 25');
assert(arr.DB[4] === 28, 'DB[4] = 28');

// --- SP ---
console.log('\n[SP] Rebar spacing (m):');
assert(arr.SP.length === 4, 'SP has 4 elements');
assertClose(arr.SP[0], 0.10, 0.001, 'SP[0] = 0.10');
assertClose(arr.SP[1], 0.15, 0.001, 'SP[1] = 0.15');
assertClose(arr.SP[2], 0.20, 0.001, 'SP[2] = 0.20');
assertClose(arr.SP[3], 0.25, 0.001, 'SP[3] = 0.25');

// --- tt ---
console.log('\n[tt] Stem top thickness (m):');
assert(arr.tt.length === 17, 'tt has 17 elements');
assertClose(arr.tt[0], 0.200, 0.001, 'tt[0] = 0.200');
assertClose(arr.tt[8], 0.400, 0.001, 'tt[8] = 0.400 (mid)');
assertClose(arr.tt[16], 0.600, 0.001, 'tt[16] = 0.600 (last)');
// Check step = 0.025
assertClose(arr.tt[1] - arr.tt[0], 0.025, 0.001, 'tt step = 0.025');

// --- tb ---
console.log('\n[tb] Stem bottom thickness (m):');
assert(arr.tb.length === 17, 'tb has 17 elements');
assertClose(arr.tb[0], 0.200, 0.001, 'tb[0] = 0.200');
assertClose(arr.tb[8], 0.600, 0.001, 'tb[8] = 0.600 (mid)');
assertClose(arr.tb[16], 1.000, 0.001, 'tb[16] = 1.000 (last)');
assertClose(arr.tb[1] - arr.tb[0], 0.050, 0.001, 'tb step = 0.050');

// --- TBase ---
console.log('\n[TBase] Base slab thickness (m):');
assert(arr.TBase.length === 15, 'TBase has 15 elements');
assertClose(arr.TBase[0], 0.300, 0.001, 'TBase[0] = 0.300');
assertClose(arr.TBase[7], 0.650, 0.001, 'TBase[7] = 0.650 (mid)');
assertClose(arr.TBase[14], 1.000, 0.001, 'TBase[14] = 1.000 (last)');
assertClose(arr.TBase[1] - arr.TBase[0], 0.050, 0.001, 'TBase step = 0.050');

// --- Base ---
console.log('\n[Base] Total base width (m):');
assert(arr.Base.length === 12, 'Base has 12 elements');
assertClose(arr.Base[0], 1.500, 0.001, 'Base[0] = 1.500');
assertClose(arr.Base[5], 4.000, 0.001, 'Base[5] = 4.000 (mid)');
assertClose(arr.Base[11], 7.000, 0.001, 'Base[11] = 7.000 (last)');
assertClose(arr.Base[1] - arr.Base[0], 0.500, 0.001, 'Base step = 0.500');

// --- LToe ---
console.log('\n[LToe] Toe length (m):');
assert(arr.LToe.length === 10, 'LToe has 10 elements');
assertClose(arr.LToe[0], 0.300, 0.001, 'LToe[0] = 0.300');
assertClose(arr.LToe[4], 0.700, 0.001, 'LToe[4] = 0.700 (mid)');
assertClose(arr.LToe[9], 1.200, 0.001, 'LToe[9] = 1.200 (last)');
assertClose(arr.LToe[1] - arr.LToe[0], 0.100, 0.001, 'LToe step = 0.100');

// --- steelUnitWeight ---
console.log('\n[steelUnitWeight] Formula: 0.00617 * db^2');
assertClose(shared.steelUnitWeight(12), 0.00617 * 144, 0.01, 'DB12 = 0.888 kg/m');
assertClose(shared.steelUnitWeight(16), 0.00617 * 256, 0.01, 'DB16 = 1.580 kg/m');
assertClose(shared.steelUnitWeight(20), 0.00617 * 400, 0.01, 'DB20 = 2.468 kg/m');
assertClose(shared.steelUnitWeight(25), 0.00617 * 625, 0.01, 'DB25 = 3.856 kg/m');
assertClose(shared.steelUnitWeight(28), 0.00617 * 784, 0.01, 'DB28 = 4.837 kg/m');

// --- Pricing ---
console.log('\n[Pricing] Concrete & Steel:');
assert(shared.CONCRETE_PRICES[240] === 2430, 'fc240 = 2430 baht/m3');
assert(shared.CONCRETE_PRICES[180] === 2337, 'fc180 = 2337 baht/m3');
assert(shared.CONCRETE_PRICES[400] === 2850, 'fc400 = 2850 baht/m3');
assert(shared.STEEL_PRICES[4000] === 24, 'SD40 = 24 baht/kg');
assert(shared.STEEL_PRICES[3000] === 28, 'SD30 = 28 baht/kg');

// --- calculateKa / calculateKp ---
console.log('\n[Ka/Kp] Earth pressure coefficients:');

// phi=25: Ka = (1-sin25)/(1+sin25)
// sin(25deg) = 0.42262
// Ka = 0.57738 / 1.42262 = 0.40585
// Kp = 1/Ka = 2.46404
assertClose(shared.calculateKa(25), 0.4059, 0.001, 'Ka(25) = 0.4059');
assertClose(shared.calculateKp(25), 2.4639, 0.001, 'Kp(25) = 2.4639');

// phi=30: Ka = 0.3333, Kp = 3.0000
assertClose(shared.calculateKa(30), 0.3333, 0.001, 'Ka(30) = 0.3333');
assertClose(shared.calculateKp(30), 3.0000, 0.001, 'Kp(30) = 3.0000');

// Ka * Kp should always = 1.0
var Ka25 = shared.calculateKa(25);
var Kp25 = shared.calculateKp(25);
assertClose(Ka25 * Kp25, 1.0, 0.0001, 'Ka(25) * Kp(25) = 1.0');

// --- calculatePa / calculatePp ---
console.log('\n[Pa/Pp] Earth pressure forces:');

// Default: gamma=1.8, phi=25, H=3.0, H1=0.9
// Pa = 0.5 * 1.8 * 0.4059 * 3.0^2 = 0.5 * 1.8 * 0.4059 * 9 = 3.2876
var Ka = shared.calculateKa(25);
var Kp = shared.calculateKp(25);
var Pa = shared.calculatePa(1.8, Ka, 3.0);
var Pp = shared.calculatePp(1.8, Kp, 0.9);

assertClose(Pa, 3.2876, 0.01, 'Pa(H=3.0) = 3.2876 ton/m');
// Pp = 0.5 * 1.8 * 2.4639 * 0.81 = 1.7945
assertClose(Pp, 1.7945, 0.01, 'Pp(H1=0.9) = 1.7945 ton/m');

// --- calculateLHeel ---
console.log('\n[LHeel] Base - LToe - tb:');
assertClose(shared.calculateLHeel(2.0, 0.4, 0.3), 1.3, 0.001, 'LHeel(2.0, 0.4, 0.3) = 1.3');
assertClose(shared.calculateLHeel(1.5, 0.3, 0.2), 1.0, 0.001, 'LHeel(1.5, 0.3, 0.2) = 1.0');

// --- W1-W4 + WTotal ---
console.log('\n[W1-W4] Weight calculations (H=3, H1=0.9):');

// Test design: use mid-range values for H=3m wall
// tt=0.200, tb=0.300, TBase=0.350, Base=2.000, LToe=0.400
// LHeel = 2.000 - 0.400 - 0.300 = 1.300
var d = {
  tt: 0.200,
  tb: 0.300,
  TBase: 0.350,
  Base: 2.000,
  LToe: 0.400,
  LHeel: shared.calculateLHeel(2.000, 0.400, 0.300)
};
var H_test = 3.0;
var H1_test = 0.9;
var gs = 1.8;   // gamma_soil
var gc = 2.4;   // gamma_concrete

assertClose(d.LHeel, 1.3, 0.001, 'LHeel = 1.3');

// W1: Soil on Toe
// H_stem = 3.0 - 0.35 = 2.65
// H1_toe = 0.9 - 0.35 = 0.55
// base_triangle = (0.3 - 0.2) * 0.55 / 2.65 = 0.02075
// A_rect = 0.4 * 0.55 = 0.22
// A_tri = 0.5 * 0.02075 * 0.55 = 0.005706
// W1 = (0.22 + 0.005706) * 1.8 = 0.40627
var w1 = shared.calculateW1(d, H_test, H1_test, gs);
assertClose(w1.W, 0.4063, 0.01, 'W1 = 0.4063 ton/m');
assertClose(w1.x, 0.200, 0.001, 'x1 = LToe/2 = 0.200');

// W2: Soil on Heel
// H_wall = 3.0 - 0.35 = 2.65
// W2 = 1.3 * 2.65 * 1.8 = 6.201
var w2 = shared.calculateW2(d, H_test, gs);
assertClose(w2.W, 6.201, 0.01, 'W2 = 6.201 ton/m');
// x2 = 0.4 + 0.3 + 1.3/2 = 1.35
assertClose(w2.x, 1.35, 0.001, 'x2 = 1.35');

// W3: Stem (Concrete)
// H_stem = 2.65
// W3 = 0.5 * (0.2 + 0.3) * 2.65 * 2.4 = 1.59
var w3 = shared.calculateW3(d, H_test, gc);
assertClose(w3.W, 1.59, 0.01, 'W3 = 1.59 ton/m');
// centroid: A_rect = 0.2*2.65=0.53, x_rect=0.1
//           A_tri = 0.5*0.1*2.65=0.1325, x_tri=0.2+0.1/3=0.2333
//           centroid = (0.53*0.1 + 0.1325*0.2333) / 0.6625 = 0.1267
//           x3 = (0.4+0.3) - 0.1267 = 0.5733
assertClose(w3.x, 0.5733, 0.01, 'x3 = 0.5733');

// W4: Base Slab (Concrete)
// W4 = 2.0 * 0.35 * 2.4 = 1.68
var w4 = shared.calculateW4(d, gc);
assertClose(w4.W, 1.68, 0.01, 'W4 = 1.68 ton/m');
// x4 = 2.0/2 = 1.0
assertClose(w4.x, 1.0, 0.001, 'x4 = 1.0');

// WTotal
var wt = shared.calculateWTotal(d, H_test, H1_test, gs, gc);
var expectedTotal = w1.W + w2.W + w3.W + w4.W;
assertClose(wt.WTotal, expectedTotal, 0.01, 'WTotal = sum of W1-W4');
assertClose(wt.WTotal, 9.877, 0.05, 'WTotal ~ 9.877 ton/m');

// --- calculateMR ---
console.log('\n[MR] Resisting Moment (ton-m/m):');

// MR = W1*x1 + W2*x2 + W3*x3 + W4*x4
// = 0.4063*0.2 + 6.201*1.35 + 1.59*0.5733 + 1.68*1.0 = 11.0442
var MR = shared.calculateMR(d, H_test, H1_test, gs, gc);
assertClose(MR, 11.0442, 0.01, 'MR(default) = 11.0442');
assert(MR > 0, 'MR is positive');

// wider base => larger MR
var d_wide = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 2.500, LToe: 0.400, LHeel: 1.800
};
var MR_wide = shared.calculateMR(d_wide, H_test, H1_test, gs, gc);
assert(MR_wide > MR, 'wider base => larger MR (' + MR_wide + ' > ' + MR + ')');

// higher H1 => larger MR
var MR_lowH1 = shared.calculateMR(d, H_test, 0.5, gs, gc);
var MR_highH1 = shared.calculateMR(d, H_test, 1.2, gs, gc);
assert(MR_highH1 > MR_lowH1, 'higher H1 => larger MR');

// --- calculateMO ---
console.log('\n[MO] Overturning Moment (ton-m/m):');

// MO = Pa*(H/3) - Pp*(H1/3) = 3.2875*1.0 - 1.7962*0.3 = 2.7486
var MO = shared.calculateMO(Pa, H_test, Pp, H1_test);
assertClose(MO, 2.7486, 0.01, 'MO(default) = 2.7486');
assert(MO > 0, 'MO is positive');

// larger Pa => larger MO
var MO1 = shared.calculateMO(3.0, H_test, Pp, H1_test);
var MO2 = shared.calculateMO(5.0, H_test, Pp, H1_test);
assert(MO2 > MO1, 'larger Pa => larger MO');

// larger Pp => smaller MO
var MO3 = shared.calculateMO(Pa, H_test, 1.0, H1_test);
var MO4 = shared.calculateMO(Pa, H_test, 3.0, H1_test);
assert(MO4 < MO3, 'larger Pp => smaller MO');

// balanced => MO ~0
var Pp_cancel = Pa * H_test / H1_test;
var MO_zero = shared.calculateMO(Pa, H_test, Pp_cancel, H1_test);
assertClose(MO_zero, 0, 0.001, 'balanced Pa/Pp => MO ~0');

// Pp=0 => MO = Pa*(H/3)
var MO_noPp = shared.calculateMO(Pa, H_test, 0, H1_test);
assertClose(MO_noPp, Pa * (H_test / 3), 0.001, 'Pp=0 => MO = Pa*(H/3)');

// --- calculateMomentStem ---
console.log('\n[M_stem] Moment at stem base (ton-m/m):');

// M_stem = 0.5 * gamma_soil * Ka(phi) * H1^3 / 3
// H1=0.9, gs=1.8, phi=30 => Ka=0.3333
// = 0.5 * 1.8 * 0.3333 * 0.729 / 3 = 0.0729
var M_stem = shared.calculateMomentStem(0.9, 1.8, 30);
assertClose(M_stem, 0.0729, 0.001, 'M_stem(H1=0.9, gs=1.8, phi=30) = 0.0729');

assert(M_stem > 0, 'M_stem is positive');

// H1 cubic relationship: M_stem(1.5) > 20x M_stem(0.5)
// ratio = (1.5/0.5)^3 = 27 > 20
var M_stem_low = shared.calculateMomentStem(0.5, 1.8, 30);
var M_stem_high = shared.calculateMomentStem(1.5, 1.8, 30);
assert(M_stem_high > 20 * M_stem_low,
  'H1 cubic: M_stem(1.5) > 20x M_stem(0.5) (' + M_stem_high + ' > ' + (20 * M_stem_low) + ')');

// larger phi => smaller Ka => smaller M_stem
var M_stem_phi25 = shared.calculateMomentStem(0.9, 1.8, 25);
var M_stem_phi35 = shared.calculateMomentStem(0.9, 1.8, 35);
assert(M_stem_phi35 < M_stem_phi25,
  'larger phi => smaller M_stem (' + M_stem_phi35 + ' < ' + M_stem_phi25 + ')');

// --- calculateMomentToe ---
console.log('\n[M_toe] Moment at toe (ton-m/m):');

var M_toe = shared.calculateMomentToe(d, H_test, H1_test, gs, gc, 25);
assert(M_toe >= 0, 'M_toe >= 0 (' + M_toe + ')');
assert(!isNaN(M_toe) && isFinite(M_toe), 'M_toe is a valid number');

// wider toe => larger M_toe
var d_narrowToe = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 2.000, LToe: 0.300,
  LHeel: shared.calculateLHeel(2.000, 0.300, 0.300)
};
var d_wideToe = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 2.000, LToe: 0.700,
  LHeel: shared.calculateLHeel(2.000, 0.700, 0.300)
};
var M_toe_narrow = shared.calculateMomentToe(d_narrowToe, H_test, H1_test, gs, gc, 25);
var M_toe_wide = shared.calculateMomentToe(d_wideToe, H_test, H1_test, gs, gc, 25);
assert(M_toe_wide > M_toe_narrow,
  'wider toe => larger M_toe (' + M_toe_wide + ' > ' + M_toe_narrow + ')');

// near-zero toe => near-zero M_toe
var d_tinyToe = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 2.000, LToe: 0.001,
  LHeel: shared.calculateLHeel(2.000, 0.001, 0.300)
};
var M_toe_tiny = shared.calculateMomentToe(d_tinyToe, H_test, H1_test, gs, gc, 25);
assert(M_toe_tiny < 0.01,
  'near-zero toe => near-zero M_toe (' + M_toe_tiny + ' < 0.01)');

// --- calculateMomentHeel ---
console.log('\n[M_heel] Moment at heel (ton-m/m):');

var M_heel = shared.calculateMomentHeel(d, H_test, H1_test, gs, gc, 25);
assert(M_heel >= 0, 'M_heel >= 0 (' + M_heel + ')');
assert(!isNaN(M_heel) && isFinite(M_heel), 'M_heel is a valid number');

// wider heel => larger M_heel
var d_narrowHeel = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 2.000, LToe: 0.400,
  LHeel: shared.calculateLHeel(2.000, 0.400, 0.300)
};
var d_wideHeel = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 3.500, LToe: 0.400,
  LHeel: shared.calculateLHeel(3.500, 0.400, 0.300)
};
var M_heel_narrow = shared.calculateMomentHeel(d_narrowHeel, H_test, H1_test, gs, gc, 25);
var M_heel_wide = shared.calculateMomentHeel(d_wideHeel, H_test, H1_test, gs, gc, 25);
assert(M_heel_wide > M_heel_narrow,
  'wider heel => larger M_heel (' + M_heel_wide + ' > ' + M_heel_narrow + ')');

// higher H => larger M_heel (more soil weight)
var M_heel_lowH = shared.calculateMomentHeel(d, 2.0, H1_test, gs, gc, 25);
var M_heel_highH = shared.calculateMomentHeel(d, 4.0, H1_test, gs, gc, 25);
assert(M_heel_highH > M_heel_lowH,
  'higher H => larger M_heel (' + M_heel_highH + ' > ' + M_heel_lowH + ')');

// --- checkFS_OT ---
console.log('\n[FS_OT] Overturning safety factor:');

// FS_OT(default) = MR/MO = 11.0442/2.7486 = 4.018
var fsOT = shared.checkFS_OT(d, H_test, H1_test, gs, gc, 25);
assertClose(fsOT.FS_OT, 4.018, 0.01, 'FS_OT(default) = 4.018');
assert(fsOT.pass === true, 'pass = true when FS_OT >= 2.0');

// MO <= 0.001 case: very high phi makes Ka tiny, large H1 makes Pp dominate
// Use phi=45, H1=2.5 so Pp*(H1/3) >> Pa*(H/3) => MO <= 0
var d_stable = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 3.000, LToe: 0.400,
  LHeel: shared.calculateLHeel(3.000, 0.400, 0.300)
};
var fsOT_zero = shared.checkFS_OT(d_stable, 3.0, 2.5, gs, gc, 45);
assert(fsOT_zero.FS_OT === 999, 'MO~0 => FS_OT = 999 (FS_OT=' + fsOT_zero.FS_OT + ')');
assert(fsOT_zero.pass === true, 'MO~0 => pass = true');

// narrow base => lower FS_OT (may fail)
var d_narrow = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 1.500, LToe: 0.400,
  LHeel: shared.calculateLHeel(1.500, 0.400, 0.300)
};
var fsOT_narrow = shared.checkFS_OT(d_narrow, H_test, H1_test, gs, gc, 25);
assert(fsOT_narrow.FS_OT < fsOT.FS_OT,
  'narrow base => lower FS_OT (' + fsOT_narrow.FS_OT + ' < ' + fsOT.FS_OT + ')');

// --- checkFS_SL ---
console.log('\n[FS_SL] Sliding safety factor:');

// FS_SL(default) = (Pp + mu*WTotal) / Pa
// Pa=3.2876, Pp=1.7945, WTotal=9.877, mu=0.6
// Resistance = 1.7945 + 0.6*9.877 = 7.7207
// FS_SL = 7.7207 / 3.2876 = 2.348
var fsSL = shared.checkFS_SL(d, H_test, H1_test, gs, gc, 25, 0.6);
var expected_resistance = Pp + 0.6 * wt.WTotal;
var expected_fsSL = expected_resistance / Pa;
assertClose(fsSL.FS_SL, expected_fsSL, 0.01,
  'FS_SL(default, mu=0.6) = ' + expected_fsSL.toFixed(3));
assert(fsSL.pass === true, 'pass = true when FS_SL >= 1.5');

// larger mu => larger FS_SL
var fsSL_lo = shared.checkFS_SL(d, H_test, H1_test, gs, gc, 25, 0.4);
var fsSL_hi = shared.checkFS_SL(d, H_test, H1_test, gs, gc, 25, 0.8);
assert(fsSL_hi.FS_SL > fsSL_lo.FS_SL,
  'larger mu => larger FS_SL (' + fsSL_hi.FS_SL + ' > ' + fsSL_lo.FS_SL + ')');

// larger Pp (higher H1) => larger FS_SL
var fsSL_lowH1 = shared.checkFS_SL(d, H_test, 0.5, gs, gc, 25, 0.6);
var fsSL_highH1 = shared.checkFS_SL(d, H_test, 1.5, gs, gc, 25, 0.6);
assert(fsSL_highH1.FS_SL > fsSL_lowH1.FS_SL,
  'larger H1 => larger FS_SL (' + fsSL_highH1.FS_SL + ' > ' + fsSL_lowH1.FS_SL + ')');

// --- checkFS_BC ---
console.log('\n[FS_BC] Bearing capacity safety factor:');

// FS_BC(default d, qa=30)
var fsBC = shared.checkFS_BC(d, H_test, H1_test, gs, gc, 25, 30);
assert(fsBC.FS_BC > 0, 'FS_BC(default, qa=30) is positive (' + fsBC.FS_BC + ')');
assert(!isNaN(fsBC.e) && isFinite(fsBC.e), 'e is a valid number');
assert(!isNaN(fsBC.q_max) && isFinite(fsBC.q_max), 'q_max is a valid number');
assert(!isNaN(fsBC.q_min) && isFinite(fsBC.q_min), 'q_min is a valid number');

// q_max > q_min
assert(fsBC.q_max > fsBC.q_min,
  'q_max > q_min (' + fsBC.q_max + ' > ' + fsBC.q_min + ')');

// larger qa => larger FS_BC
var fsBC_lo = shared.checkFS_BC(d, H_test, H1_test, gs, gc, 25, 20);
var fsBC_hi = shared.checkFS_BC(d, H_test, H1_test, gs, gc, 25, 50);
assert(fsBC_hi.FS_BC > fsBC_lo.FS_BC,
  'larger qa => larger FS_BC (' + fsBC_hi.FS_BC + ' > ' + fsBC_lo.FS_BC + ')');

// tipping case: very narrow base, tall wall => e > B/3 => FS_BC=0, pass=false
var d_tip = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 0.800, LToe: 0.200,
  LHeel: shared.calculateLHeel(0.800, 0.200, 0.300)
};
var fsBC_tip = shared.checkFS_BC(d_tip, 5.0, 0.5, gs, gc, 25, 30);
assert(fsBC_tip.FS_BC === 0, 'tipping => FS_BC = 0');
assert(fsBC_tip.pass === false, 'tipping => pass = false');

// --- calculateCost ---
console.log('\n[Cost] Cost calculation:');

var steel_default = {
  stemDB_idx: 101, stemSP_idx: 111,
  toeDB_idx: 100, toeSP_idx: 111,
  heelDB_idx: 100, heelSP_idx: 111
};
var costResult = shared.calculateCost(d, H_test, gc, 2337, 24, steel_default);
assert(costResult.cost > 0, 'cost > 0 (' + costResult.cost + ')');
assert(!isNaN(costResult.V_total) && isFinite(costResult.V_total),
  'V_total is a valid number (' + costResult.V_total + ')');
assert(!isNaN(costResult.W_total_steel) && isFinite(costResult.W_total_steel),
  'W_total_steel is a valid number (' + costResult.W_total_steel + ')');

// more expensive concrete => higher cost
var cost_cheap = shared.calculateCost(d, H_test, gc, 2337, 24, steel_default);
var cost_expConcrete = shared.calculateCost(d, H_test, gc, 2850, 24, steel_default);
assert(cost_expConcrete.cost > cost_cheap.cost,
  'expensive concrete => higher cost (' + cost_expConcrete.cost + ' > ' + cost_cheap.cost + ')');

// more expensive steel => higher cost
var cost_expSteel = shared.calculateCost(d, H_test, gc, 2337, 28, steel_default);
assert(cost_expSteel.cost > cost_cheap.cost,
  'expensive steel => higher cost (' + cost_expSteel.cost + ' > ' + cost_cheap.cost + ')');

// wider base => larger V_total => higher cost
var d_wideBase = {
  tt: 0.200, tb: 0.300, TBase: 0.350,
  Base: 3.000, LToe: 0.400,
  LHeel: shared.calculateLHeel(3.000, 0.400, 0.300)
};
var cost_wideBase = shared.calculateCost(d_wideBase, H_test, gc, 2337, 24, steel_default);
assert(cost_wideBase.V_total > costResult.V_total,
  'wider base => larger V_total (' + cost_wideBase.V_total + ' > ' + costResult.V_total + ')');
assert(cost_wideBase.cost > costResult.cost,
  'wider base => higher cost (' + cost_wideBase.cost + ' > ' + costResult.cost + ')');

// DB_idx out of range => W_steel = 0 for that section
var steel_bad = {
  stemDB_idx: 99, stemSP_idx: 111,
  toeDB_idx: 105, toeSP_idx: 111,
  heelDB_idx: 100, heelSP_idx: 114
};
var costBad = shared.calculateCost(d, H_test, gc, 2337, 24, steel_bad);
assert(costBad.W_total_steel === 0,
  'all out-of-range steel => W_total_steel = 0 (' + costBad.W_total_steel + ')');
assert(costBad.cost > 0, 'cost still > 0 from concrete (' + costBad.cost + ')');

// --- Summary ---
console.log('\n=============================');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed);
console.log('=============================');

if (failed > 0) {
  process.exit(1);
}
