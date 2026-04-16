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

// === initializeCurrentDesign with H=5m ===
console.log('\n[initializeCurrentDesign] H=5m:');
var s5 = hca.createHCAState(buildParams(5));
hca.initializeCurrentDesign(s5);

// 0.12 * 5 = 0.60m -> WP_tb: 0.60 exact = idx 28
assert(s5.indices.tb === 28, 'H=5: tb idx = 28 (WP_tb=0.60, exact match at 0.12*5)');
assert(s5.indices.tb !== 20, 'H=5: tb idx != 20 (fixed, not buggy VB6)');

// 0.15 * 5 = 0.75m -> WP_TBase: 0.75 exact = idx 49
assert(s5.indices.TBase === 49, 'H=5: TBase idx = 49 (WP_TBase=0.75)');
assert(s5.indices.TBase !== 40, 'H=5: TBase idx != 40 (fixed, not buggy VB6)');

// 0.7 * 5 = 3.50m -> WP_Base: 3.50 exact = idx 64
assert(s5.indices.Base === 64, 'H=5: Base idx = 64 (WP_Base=3.50, exact match at 0.7*5)');

// 0.2 * 5 = 1.00m -> WP_LToe: 1.00 exact = idx 87
assert(s5.indices.LToe === 87, 'H=5: LToe idx = 87 (WP_LToe=1.00)');

// tt: largest where WP_tt <= WP_tb(28)=0.60. WP_tt(17)=0.600 <= 0.60 -> idx 17
assert(s5.indices.tt === 17, 'H=5: tt idx = 17 (WP_tt=0.600, max idx since 0.60 <= WP_tb=0.60)');

// Steel: max DB (DB28=idx 104), min SP (0.10m=idx 110)
assert(s5.indices.stemDB === 104, 'H=5: stemDB = 104 (DB28)');
assert(s5.indices.stemSP === 110, 'H=5: stemSP = 110 (0.10m)');
assert(s5.indices.toeDB === 104,  'H=5: toeDB = 104');
assert(s5.indices.toeSP === 110,  'H=5: toeSP = 110');
assert(s5.indices.heelDB === 104, 'H=5: heelDB = 104');
assert(s5.indices.heelSP === 110, 'H=5: heelSP = 110');

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

// === initializeCurrentDesign with H=7m ===
console.log('\n[initializeCurrentDesign] H=7m:');
var s7 = hca.createHCAState(buildParams(7));
hca.initializeCurrentDesign(s7);

// 0.12 * 7 = 0.84m -> WP_tb: 0.80 (idx 32). 0.85 > 0.84 rejected.
assert(s7.indices.tb === 32, 'H=7: tb idx = 32 (WP_tb=0.80, max under 0.84)');
assert(s7.indices.tb !== 20, 'H=7: tb idx != 20 (fixed, not buggy VB6)');

// 0.15 * 7 = 1.05m -> WP_TBase: 1.00 (idx 54), max since arrays capped at 1.00
assert(s7.indices.TBase === 54, 'H=7: TBase idx = 54 (WP_TBase=1.00, max under 1.05)');
assert(s7.indices.TBase !== 40, 'H=7: TBase idx != 40 (fixed, not buggy VB6)');

// 0.7 * 7 = 4.90m -> WP_Base: 4.50 (idx 66). 5.00 > 4.90 rejected.
assert(s7.indices.Base === 66, 'H=7: Base idx = 66 (WP_Base=4.50, max under 4.90)');

// 0.2 * 7 = 1.40m -> WP_LToe: 1.20 (idx 89), max since arrays capped at 1.20
assert(s7.indices.LToe === 89, 'H=7: LToe idx = 89 (WP_LToe=1.20, max under 1.40)');

// tt: largest where WP_tt <= WP_tb(32)=0.80. WP_tt(17)=0.600 <= 0.80 -> idx 17
assert(s7.indices.tt === 17, 'H=7: tt idx = 17 (WP_tt=0.600, max idx since 0.600 <= WP_tb=0.80)');

// Steel: max DB (DB28=idx 104), min SP (0.10m=idx 110)
assert(s7.indices.stemDB === 104, 'H=7: stemDB = 104 (DB28)');
assert(s7.indices.stemSP === 110, 'H=7: stemSP = 110 (0.10m)');
assert(s7.indices.toeDB === 104,  'H=7: toeDB = 104');
assert(s7.indices.toeSP === 110,  'H=7: toeSP = 110');
assert(s7.indices.heelDB === 104, 'H=7: heelDB = 104');
assert(s7.indices.heelSP === 110, 'H=7: heelSP = 110');

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

// === getDesignFromCurrent H=5m ===
console.log('\n[getDesignFromCurrent] H=5m:');
var result5 = hca.getDesignFromCurrent(s5);
assert(typeof result5.design === 'object', 'H=5: result has design object');
assert(typeof result5.steel === 'object', 'H=5: result has steel object');
assertClose(result5.design.tt, 0.600, 0.001, 'H=5: design.tt = 0.600m');
assertClose(result5.design.tb, 0.60, 0.001, 'H=5: design.tb = 0.60m');
assertClose(result5.design.TBase, 0.75, 0.001, 'H=5: design.TBase = 0.75m');
assertClose(result5.design.Base, 3.50, 0.001, 'H=5: design.Base = 3.50m');
assertClose(result5.design.LToe, 1.00, 0.001, 'H=5: design.LToe = 1.00m');
// LHeel = 3.50 - 1.00 - 0.60 = 1.90
assertClose(result5.design.LHeel, 1.90, 0.001, 'H=5: design.LHeel = 1.90m');
assert(result5.steel.stemDB_idx === 104, 'H=5: steel.stemDB_idx = 104');
assert(result5.steel.stemSP_idx === 110, 'H=5: steel.stemSP_idx = 110');

// Integration: H=5m cost
var costResult5 = shared.calculateCost(
  result5.design, s5.params.H, s5.params.gamma_concrete,
  testMaterial.concretePrice, testMaterial.steelPrice, result5.steel
);
assert(costResult5.cost > 0, 'H=5: cost > 0');
assert(costResult5.V_total > 0, 'H=5: V_total > 0');
assert(costResult5.W_total_steel > 0, 'H=5: W_total_steel > 0');

// === getDesignFromCurrent H=7m ===
console.log('\n[getDesignFromCurrent] H=7m:');
var result7 = hca.getDesignFromCurrent(s7);
assert(typeof result7.design === 'object', 'H=7: result has design object');
assert(typeof result7.steel === 'object', 'H=7: result has steel object');
assertClose(result7.design.tt, 0.600, 0.001, 'H=7: design.tt = 0.600m');
assertClose(result7.design.tb, 0.80, 0.001, 'H=7: design.tb = 0.80m');
assertClose(result7.design.TBase, 1.00, 0.001, 'H=7: design.TBase = 1.00m');
assertClose(result7.design.Base, 4.50, 0.001, 'H=7: design.Base = 4.50m');
assertClose(result7.design.LToe, 1.20, 0.001, 'H=7: design.LToe = 1.20m');
// LHeel = 4.50 - 1.20 - 0.80 = 2.50
assertClose(result7.design.LHeel, 2.50, 0.001, 'H=7: design.LHeel = 2.50m');
assert(result7.steel.stemDB_idx === 104, 'H=7: steel.stemDB_idx = 104');
assert(result7.steel.stemSP_idx === 110, 'H=7: steel.stemSP_idx = 110');

// Integration: H=7m cost
var costResult7 = shared.calculateCost(
  result7.design, s7.params.H, s7.params.gamma_concrete,
  testMaterial.concretePrice, testMaterial.steelPrice, result7.steel
);
assert(costResult7.cost > 0, 'H=7: cost > 0');
assert(costResult7.V_total > 0, 'H=7: V_total > 0');
assert(costResult7.W_total_steel > 0, 'H=7: W_total_steel > 0');

// ============================================================================
// Step 9.3: generateNeighbor tests
// ============================================================================
var rng = require('../src/rng');

console.log('\n\n=== Test generateNeighbor (Step 9.3) ===\n');

function copyIndices(idx) {
  return {
    tt: idx.tt, tb: idx.tb, TBase: idx.TBase, Base: idx.Base, LToe: idx.LToe,
    stemDB: idx.stemDB, stemSP: idx.stemSP,
    toeDB: idx.toeDB, toeSP: idx.toeSP,
    heelDB: idx.heelDB, heelSP: idx.heelSP
  };
}

function indicesEqual(a, b) {
  return a.tt === b.tt && a.tb === b.tb && a.TBase === b.TBase &&
         a.Base === b.Base && a.LToe === b.LToe &&
         a.stemDB === b.stemDB && a.stemSP === b.stemSP &&
         a.toeDB === b.toeDB && a.toeSP === b.toeSP &&
         a.heelDB === b.heelDB && a.heelSP === b.heelSP;
}

// ============================================================================
// Part 1: Statistical tests (5 heights x 1000 iterations each)
// ============================================================================
console.log('[Part 1] Statistical invariants (5 heights x 1000 iter):');

var testHeights = [3, 4, 5, 6, 7];
var EPS = 1e-9;

for (var h = 0; h < testHeights.length; h++) {
  var H = testHeights[h];
  console.log('\n  H=' + H + 'm:');

  var state = hca.createHCAState(buildParams(H), {
    rng: rng.createSeededRng('stat-H' + H)
  });
  hca.initializeCurrentDesign(state);

  var allInRange = true;
  var allTbLim = true;
  var allTBaseLim = true;
  var allLToeInBand = true;
  var allBaseInBand = true;
  var allSteelInRange = true;
  var changeCount = 0;

  for (var iter = 0; iter < 1000; iter++) {
    var n = hca.generateNeighbor(state);

    if (n.tt < hca.IDX.TT_MIN || n.tt > hca.IDX.TT_MAX) allInRange = false;
    if (n.tb < hca.IDX.TB_MIN || n.tb > hca.IDX.TB_MAX) allInRange = false;
    if (n.TBase < hca.IDX.TBASE_MIN || n.TBase > hca.IDX.TBASE_MAX) allInRange = false;
    if (n.Base < hca.IDX.BASE_MIN || n.Base > hca.IDX.BASE_MAX) allInRange = false;
    if (n.LToe < hca.IDX.LTOE_MIN || n.LToe > hca.IDX.LTOE_MAX) allInRange = false;

    var wpTt = hca.wpLookup(state.arrays, 'tt', n.tt);
    var wpTb = hca.wpLookup(state.arrays, 'tb', n.tb);
    var wpTBase = hca.wpLookup(state.arrays, 'TBase', n.TBase);
    var wpBase = hca.wpLookup(state.arrays, 'Base', n.Base);
    var wpLToe = hca.wpLookup(state.arrays, 'LToe', n.LToe);

    if (wpTb > 0.12 * H + EPS) allTbLim = false;
    if (wpTBase > 0.15 * H + EPS) allTBaseLim = false;
    if (wpLToe < 0.10 * H - EPS || wpLToe > 0.20 * H + EPS) allLToeInBand = false;
    if (wpBase < 0.50 * H - EPS || wpBase > 0.70 * H + EPS) allBaseInBand = false;

    if (n.stemDB < hca.IDX.DB_MIN || n.stemDB > hca.IDX.DB_MAX) allSteelInRange = false;
    if (n.stemSP < hca.IDX.SP_MIN || n.stemSP > hca.IDX.SP_MAX) allSteelInRange = false;
    if (n.toeDB < hca.IDX.DB_MIN || n.toeDB > hca.IDX.DB_MAX) allSteelInRange = false;
    if (n.toeSP < hca.IDX.SP_MIN || n.toeSP > hca.IDX.SP_MAX) allSteelInRange = false;
    if (n.heelDB < hca.IDX.DB_MIN || n.heelDB > hca.IDX.DB_MAX) allSteelInRange = false;
    if (n.heelSP < hca.IDX.SP_MIN || n.heelSP > hca.IDX.SP_MAX) allSteelInRange = false;

    if (!indicesEqual(n, state.indices)) changeCount++;

    state.indices = n;
  }

  assert(allInRange,       'H=' + H + ': all 5 dims within VB6 index ranges (1000 iter)');
  // NOTE: tb>=tt is NOT guaranteed by generateNeighbor — VB6 relies on
  // checkDesignValid to filter neighbors where 0.12H limit conflicts with tt.
  assert(allTbLim,         'H=' + H + ': WP_tb <= 0.12H always (1000 iter)');
  assert(allTBaseLim,      'H=' + H + ': WP_TBase <= 0.15H always (1000 iter)');
  assert(allLToeInBand,    'H=' + H + ': 0.1H <= WP_LToe <= 0.2H always (1000 iter)');
  assert(allBaseInBand,    'H=' + H + ': 0.5H <= WP_Base <= 0.7H always (1000 iter)');
  assert(allSteelInRange,  'H=' + H + ': all steel indices in valid ranges (1000 iter)');
  assert(changeCount > 500, 'H=' + H + ': changeCount > 500 (randomness working) — got ' + changeCount);
}

// ============================================================================
// Part 2: Fixed-seed spot checks (3 cases)
// ============================================================================
console.log('\n[Part 2] Fixed-seed spot checks:');

// --- Spot 1: H=4, seed='spot-1', after 1 call ---
console.log('\n  Spot 1: H=4, seed=spot-1, 1 call:');
var sp1 = hca.createHCAState(buildParams(4), { rng: rng.createSeededRng('spot-1') });
hca.initializeCurrentDesign(sp1);
var n1 = hca.generateNeighbor(sp1);
assert(n1.tt === 12,      'Spot 1: n1.tt');
assert(n1.tb === 25,      'Spot 1: n1.tb');
assert(n1.TBase === 46,   'Spot 1: n1.TBase');
assert(n1.Base === 62,    'Spot 1: n1.Base');
assert(n1.LToe === 85,    'Spot 1: n1.LToe');
assert(n1.stemDB === 104, 'Spot 1: n1.stemDB');
assert(n1.stemSP === 110, 'Spot 1: n1.stemSP');
assert(n1.toeDB === 103,  'Spot 1: n1.toeDB');
assert(n1.toeSP === 112,  'Spot 1: n1.toeSP');
assert(n1.heelDB === 104, 'Spot 1: n1.heelDB');
assert(n1.heelSP === 112, 'Spot 1: n1.heelSP');

// --- Spot 2: H=5, seed='spot-2', after 10 calls ---
console.log('\n  Spot 2: H=5, seed=spot-2, 10 calls:');
var sp2 = hca.createHCAState(buildParams(5), { rng: rng.createSeededRng('spot-2') });
hca.initializeCurrentDesign(sp2);
var n2;
for (var i = 0; i < 10; i++) {
  n2 = hca.generateNeighbor(sp2);
  sp2.indices = n2;
}
assert(n2.tt === 17,      'Spot 2: n2.tt');
assert(n2.tb === 28,      'Spot 2: n2.tb');
assert(n2.TBase === 48,   'Spot 2: n2.TBase');
assert(n2.Base === 64,    'Spot 2: n2.Base');
assert(n2.LToe === 85,    'Spot 2: n2.LToe');
assert(n2.stemDB === 101, 'Spot 2: n2.stemDB');
assert(n2.stemSP === 110, 'Spot 2: n2.stemSP');
assert(n2.toeDB === 100,  'Spot 2: n2.toeDB');
assert(n2.toeSP === 111,  'Spot 2: n2.toeSP');
assert(n2.heelDB === 104, 'Spot 2: n2.heelDB');
assert(n2.heelSP === 113, 'Spot 2: n2.heelSP');

// --- Spot 3: H=6, seed='spot-3', after 100 calls ---
console.log('\n  Spot 3: H=6, seed=spot-3, 100 calls:');
var sp3 = hca.createHCAState(buildParams(6), { rng: rng.createSeededRng('spot-3') });
hca.initializeCurrentDesign(sp3);
var n3;
for (var i = 0; i < 100; i++) {
  n3 = hca.generateNeighbor(sp3);
  sp3.indices = n3;
}
assert(n3.tt === 17,      'Spot 3: n3.tt');
assert(n3.tb === 28,      'Spot 3: n3.tb');
assert(n3.TBase === 40,   'Spot 3: n3.TBase');
assert(n3.Base === 64,    'Spot 3: n3.Base');
assert(n3.LToe === 83,    'Spot 3: n3.LToe');
assert(n3.stemDB === 101, 'Spot 3: n3.stemDB');
assert(n3.stemSP === 113, 'Spot 3: n3.stemSP');
assert(n3.toeDB === 100,  'Spot 3: n3.toeDB');
assert(n3.toeSP === 113,  'Spot 3: n3.toeSP');
assert(n3.heelDB === 103, 'Spot 3: n3.heelDB');
assert(n3.heelSP === 110, 'Spot 3: n3.heelSP');

// ============================================================================
// Step 9.4: hcaOptimize tests
// ============================================================================
console.log('\n\n=== Test hcaOptimize (Step 9.4) ===\n');

// Optimization-specific params with realistic H1 (embedment ~ 0.3H, min 0.9)
function buildOptParams(H) {
  var H1 = Math.max(0.3 * H, 0.9);
  return {
    H: H, H1: H1,
    gamma_soil: 1.8, gamma_concrete: 2.4,
    phi: 30, mu: 0.5, qa: 20, cover: 0.075,
    material: testMaterial
  };
}

// ---------- Part 1: Basic structure (small maxIter) ----------
console.log('[Part 1] Basic structure (H=5, maxIter=100):');
var basicResult = hca.hcaOptimize(buildOptParams(5), {
  seed: 'basic-test',
  maxIterations: 100
});
assert(typeof basicResult === 'object', 'result is object');
assert(Array.isArray(basicResult.costHistory), 'costHistory is array');
assert(basicResult.costHistory.length === 101, 'costHistory length = 101 (0..100)');
assert(typeof basicResult.costHistory[0] === 'undefined', 'costHistory[0] is undefined (VB6 1-indexed)');
assert(typeof basicResult.costHistory[100] === 'number', 'costHistory[100] is number');
assert(Array.isArray(basicResult.log), 'log is array');
assert(basicResult.log.length === 101, 'log length = 101 (iter 0 init + 1..100)');
assert(typeof basicResult.bestCost === 'number', 'bestCost is number');
assert(typeof basicResult.bestIteration === 'number', 'bestIteration is number');
assert(basicResult.bestIteration >= 0 && basicResult.bestIteration <= 100, 'bestIteration in [0, 100]');
assert(typeof basicResult.finalState === 'object', 'finalState preserved');

var sampleEntry = basicResult.log[50];
assert(typeof sampleEntry.iter === 'number', 'log entry has iter');
assert(typeof sampleEntry.cost === 'number', 'log entry has cost');
assert(typeof sampleEntry.valid === 'boolean', 'log entry has valid');
assert(typeof sampleEntry.isBetter === 'boolean', 'log entry has isBetter');
assert(typeof sampleEntry.accepted === 'boolean', 'log entry has accepted');
assert(typeof sampleEntry.reason === 'string', 'log entry has reason');
assert(typeof sampleEntry.bestSoFar === 'number', 'log entry has bestSoFar');
assert(typeof sampleEntry.bestIter === 'number', 'log entry has bestIter');

// ---------- Part 2: Convergence sanity (medium maxIter) ----------
console.log('\n[Part 2] Convergence sanity (H=5, maxIter=5000):');
var convResult = hca.hcaOptimize(buildOptParams(5), {
  seed: 'convergence-test',
  maxIterations: 5000
});
assert(convResult.bestIteration > 0, 'found at least one valid design');
assert(convResult.bestCost < Infinity, 'bestCost is finite');
assert(convResult.bestDesign !== null, 'bestDesign is populated');
assert(convResult.bestSteel !== null, 'bestSteel is populated');

var validCount = 0, betterCount = 0, acceptedCount = 0;
for (var i = 1; i <= 5000; i++) {
  if (convResult.log[i].valid) validCount++;
  if (convResult.log[i].isBetter) betterCount++;
  if (convResult.log[i].accepted) acceptedCount++;
}
assert(validCount > 0,  'at least one valid neighbor in 5000 iterations (got ' + validCount + ')');
assert(betterCount > 0, 'at least one improvement in 5000 iterations (got ' + betterCount + ')');
assert(acceptedCount >= betterCount, 'accepted >= isBetter (all isBetter imply accepted)');

var lastBest = convResult.costHistory[1];
var monotonic = true;
for (var i = 2; i <= 5000; i++) {
  if (convResult.costHistory[i] > lastBest && convResult.costHistory[i] !== 999000 && lastBest !== 999000) {
    monotonic = false; break;
  }
  if (convResult.costHistory[i] !== 999000) lastBest = convResult.costHistory[i];
}
assert(monotonic, 'costHistory is monotonic non-increasing (best only improves)');

// ---------- Part 3: Reproducibility (same seed -> same result) ----------
console.log('\n[Part 3] Reproducibility (same seed = same result):');
var repro1 = hca.hcaOptimize(buildOptParams(5), { seed: 'repro', maxIterations: 1000 });
var repro2 = hca.hcaOptimize(buildOptParams(5), { seed: 'repro', maxIterations: 1000 });
assert(repro1.bestCost === repro2.bestCost, 'same seed -> same bestCost');
assert(repro1.bestIteration === repro2.bestIteration, 'same seed -> same bestIteration');

var logMatch = true;
for (var i = 0; i <= 1000; i++) {
  if (repro1.log[i].cost !== repro2.log[i].cost ||
      repro1.log[i].valid !== repro2.log[i].valid ||
      repro1.log[i].isBetter !== repro2.log[i].isBetter) {
    logMatch = false; break;
  }
}
assert(logMatch, 'same seed -> identical log entries');

// ---------- Part 4: Spot check (regression safety) ----------
console.log('\n[Part 4] Spot check (H=5, seed=hca-spot, maxIter=500):');
var spotResult = hca.hcaOptimize(buildOptParams(5), {
  seed: 'hca-spot',
  maxIterations: 500
});
// console.log('CAPTURE spot:', 'bestCost=' + spotResult.bestCost + ', bestIteration=' + spotResult.bestIteration);
assert(Math.abs(spotResult.bestCost - 6615.034584) < 0.01, 'Spot: bestCost');
assert(spotResult.bestIteration === 385, 'Spot: bestIteration');

// ---------- Part 5: Multi-height smoke (all heights don't crash) ----------
console.log('\n[Part 5] Multi-height smoke (H=3,4,5,6,7, maxIter=1000 each):');
var heights = [3, 4, 5, 6, 7];
for (var h = 0; h < heights.length; h++) {
  var H = heights[h];
  var r = hca.hcaOptimize(buildOptParams(H), {
    seed: 'smoke-H' + H,
    maxIterations: 1000
  });
  assert(typeof r.bestCost === 'number', 'H=' + H + ': bestCost is number');
  assert(r.log.length === 1001, 'H=' + H + ': log length = 1001');
  assert(r.costHistory.length === 1001, 'H=' + H + ': costHistory length = 1001');
  assert(r.bestIteration >= 0, 'H=' + H + ': bestIteration >= 0');
}

// ---------- Part 6: onIteration callback ----------
console.log('\n[Part 6] onIteration callback:');
var callbackCount = 0;
var lastSeenIter = -1;
hca.hcaOptimize(buildOptParams(5), {
  seed: 'callback-test',
  maxIterations: 50,
  onIteration: function(entry) {
    callbackCount++;
    lastSeenIter = entry.iter;
  }
});
assert(callbackCount === 51, 'onIteration called 51 times (iter 0 + 1..50)');
assert(lastSeenIter === 50, 'last onIteration call was iter 50');

// === Summary ===
console.log('\n=============================');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed);
console.log('=============================');
if (failed > 0) process.exit(1);
