// test_shared.js — validate initArrays() against VB6 spec
var shared = require('./src/shared');

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

// --- Summary ---
console.log('\n=============================');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed);
console.log('=============================');

if (failed > 0) {
  process.exit(1);
}
