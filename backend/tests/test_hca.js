// test_hca.js — validate HCA infrastructure (Step 9.2 scope)
var shared = require('../src/shared');
var hca = require('../src/hca');

var passed = 0;
var failed = 0;
function assert(c, m)        { if (c) { console.log('  PASS: ' + m); passed++; } else { console.log('  FAIL: ' + m); failed++; } }
function assertClose(a, b, tol, m) { assert(Math.abs(a - b) < tol, m + ' (' + a + ' vs ' + b + ')'); }

console.log('=== Test hca.js (Step 9.2) ===\n');

// Test material (fc=240, fy=4000 SD40)
var testMaterial = {
  fc: 240,
  fy: 4000,
  concretePrice: shared.CONCRETE_PRICES[240],
  steelPrice: shared.STEEL_PRICES[4000]
};

function buildParams(H) {
  return {
    H: H, H1: H,
    gamma_soil: 1.8, gamma_concrete: 2.4,
    phi: 30, mu: 0.5, qa: 20, cover: 0.075,
    material: testMaterial
  };
}

// === createHCAState ===
console.log('[createHCAState] basic structure:');
var state1 = hca.createHCAState(buildParams(4));
assert(typeof state1 === 'object', 'state is object');
assert(typeof state1.arrays === 'object', 'state.arrays populated');
assert(state1.arrays.tb.length === 17, 'state.arrays.tb has 17 elements');
assert(typeof state1.wsd === 'object', 'state.wsd populated from calculateWSDParams');
assert(typeof state1.rng === 'function', 'state.rng is function');

// === initializeCurrentDesign with H=4m ===
console.log('\n[initializeCurrentDesign] H=4m FIXED VERSION:');
var s4 = hca.createHCAState(buildParams(4));
hca.initializeCurrentDesign(s4);

// 0.12 * 4 = 0.48m -> WP_tb: options up to 0.45 (idx 25). 0.50 > 0.48 so rejected.
assert(s4.indices.tb === 25, 'H=4: tb idx = 25 (WP_tb=0.45, max under 0.48)');
// Verify NOT VB6 buggy behavior (would be 20)
assert(s4.indices.tb !== 20, 'H=4: tb idx != 20 (fixed, not buggy VB6)');

// 0.15 * 4 = 0.60m -> WP_TBase: 0.60 exact = idx 46
assert(s4.indices.TBase === 46, 'H=4: TBase idx = 46 (WP_TBase=0.60)');
assert(s4.indices.TBase !== 40, 'H=4: TBase idx != 40 (fixed, not buggy VB6)');

// 0.70 * 4 = 2.80m -> WP_Base: 2.50 (idx 62). 3.00 > 2.80 rejected.
assert(s4.indices.Base === 62, 'H=4: Base idx = 62 (WP_Base=2.50, max under 2.80)');

// 0.20 * 4 = 0.80m -> WP_LToe: 0.80 exact = idx 85
assert(s4.indices.LToe === 85, 'H=4: LToe idx = 85 (WP_LToe=0.80)');

// tt: largest where WP_tt <= WP_tb(25)=0.45
// tt step 0.025: 0.200 + (11-1)*0.025 = 0.200 + 0.250 = 0.450 -> idx 11
assert(s4.indices.tt === 11, 'H=4: tt idx = 11 (WP_tt=0.45, <= WP_tb=0.45)');

// Steel: max DB (DB28=idx 104), min SP (0.10m=idx 110)
assert(s4.indices.stemDB === 104, 'H=4: stemDB = 104 (DB28)');
assert(s4.indices.stemSP === 110, 'H=4: stemSP = 110 (0.10m)');
assert(s4.indices.toeDB === 104,  'H=4: toeDB = 104');
assert(s4.indices.toeSP === 110,  'H=4: toeSP = 110');
assert(s4.indices.heelDB === 104, 'H=4: heelDB = 104');
assert(s4.indices.heelSP === 110, 'H=4: heelSP = 110');

// === initializeCurrentDesign with H=6m ===
console.log('\n[initializeCurrentDesign] H=6m:');
var s6 = hca.createHCAState(buildParams(6));
hca.initializeCurrentDesign(s6);
// 0.12 * 6 = 0.72m -> WP_tb: 0.70 (idx 30). 0.75 > 0.72 rejected.
assert(s6.indices.tb === 30, 'H=6: tb idx = 30 (WP_tb=0.70, max under 0.72)');
// 0.15 * 6 = 0.90m -> WP_TBase: 0.90 exact = idx 52
assert(s6.indices.TBase === 52, 'H=6: TBase idx = 52 (WP_TBase=0.90)');
// 0.7 * 6 = 4.20m -> WP_Base: 4.00 (idx 65). 4.50 > 4.20 rejected.
assert(s6.indices.Base === 65, 'H=6: Base idx = 65 (WP_Base=4.00)');
// 0.2 * 6 = 1.20m -> WP_LToe: 1.20 exact = idx 89
assert(s6.indices.LToe === 89, 'H=6: LToe idx = 89 (WP_LToe=1.20)');

// === initializeCurrentDesign with H=3m (edge case, small wall) ===
console.log('\n[initializeCurrentDesign] H=3m edge:');
var s3 = hca.createHCAState(buildParams(3));
hca.initializeCurrentDesign(s3);
// 0.12 * 3 = 0.36m -> WP_tb: 0.35 (idx 23). 0.40 > 0.36 rejected.
assert(s3.indices.tb === 23, 'H=3: tb idx = 23 (WP_tb=0.35)');
// All indices within valid VB6 range
assert(s3.indices.tb >= 20 && s3.indices.tb <= 36, 'H=3: tb in valid range [20,36]');
assert(s3.indices.TBase >= 40 && s3.indices.TBase <= 54, 'H=3: TBase in valid range');
assert(s3.indices.Base >= 60 && s3.indices.Base <= 71, 'H=3: Base in valid range');
assert(s3.indices.LToe >= 80 && s3.indices.LToe <= 89, 'H=3: LToe in valid range');

// === getDesignFromCurrent ===
console.log('\n[getDesignFromCurrent] H=4m:');
var result4 = hca.getDesignFromCurrent(s4);
assert(typeof result4.design === 'object', 'result has design object');
assert(typeof result4.steel === 'object', 'result has steel object');

// Physical values
assertClose(result4.design.tt, 0.45, 0.001, 'design.tt = 0.45m');
assertClose(result4.design.tb, 0.45, 0.001, 'design.tb = 0.45m');
assertClose(result4.design.TBase, 0.60, 0.001, 'design.TBase = 0.60m');
assertClose(result4.design.Base, 2.50, 0.001, 'design.Base = 2.50m');
assertClose(result4.design.LToe, 0.80, 0.001, 'design.LToe = 0.80m');
// LHeel = Base - LToe - tb = 2.50 - 0.80 - 0.45 = 1.25
assertClose(result4.design.LHeel, 1.25, 0.001, 'design.LHeel = 1.25m');

// Steel passes through as VB6-style indices
assert(result4.steel.stemDB_idx === 104, 'steel.stemDB_idx = 104');
assert(result4.steel.stemSP_idx === 110, 'steel.stemSP_idx = 110');

// === Integration smoke test: feed result to shared.calculateCost ===
console.log('\n[Integration] getDesignFromCurrent -> shared.calculateCost:');
var costResult = shared.calculateCost(
  result4.design, s4.params.H, s4.params.gamma_concrete,
  testMaterial.concretePrice, testMaterial.steelPrice, result4.steel
);
assert(typeof costResult.cost === 'number', 'cost is number');
assert(costResult.cost > 0, 'cost > 0');
assert(costResult.V_total > 0, 'V_total > 0');
assert(costResult.W_total_steel > 0, 'W_total_steel > 0');

// === Summary ===
console.log('\n=============================');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed);
console.log('=============================');
if (failed > 0) process.exit(1);
