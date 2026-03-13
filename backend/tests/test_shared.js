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

// --- Summary ---
console.log('\n=============================');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed);
console.log('=============================');

if (failed > 0) {
  process.exit(1);
}
