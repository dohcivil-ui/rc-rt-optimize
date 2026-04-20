// test_ba.js -- Wave 1 + Wave 2: skeleton + initializeDesignBA
// Pattern matches tests/test_hca.js: plain Node, var only, custom assert.

var ba = require('../src/ba');
var shared = require('../src/shared');

// WP_* lookup helpers for tests (use shared.initArrays directly for explicit indexing)
var sharedLib = require('../src/shared');
var arraysForTest = sharedLib.initArrays();
function WP_tt(idx)    { return arraysForTest.tt[idx - 1]; }
function WP_tb(idx)    { return arraysForTest.tb[idx - 20]; }
function WP_TBase(idx) { return arraysForTest.TBase[idx - 40]; }
function WP_Base(idx)  { return arraysForTest.Base[idx - 60]; }
function WP_LToe(idx)  { return arraysForTest.LToe[idx - 80]; }

var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  PASS: ' + msg); passed++; }
  else      { console.log('  FAIL: ' + msg); failed++; }
}

console.log('=== Test ba.js (Wave 1) ===\n');

var testParams = {
  H: 3.0, H1: 1.20,
  gamma_soil: 1.80, gamma_concrete: 2.40,
  phi: 30, mu: 0.60, qa: 30, cover: 0.075,
  material: { fy: 4000, fc: 280, concretePrice: 2524, steelPrice: 24 }
};

// --- Test 1: top-level keys ---
console.log('[Test 1] createBAState top-level structure:');
var s1 = ba.createBAState(testParams);
var expectedKeys = ['params', 'arrays', 'wsd', 'indices', 'bisection', 'counters', 'rng'];
var allKeysPresent = true;
var i;
for (i = 0; i < expectedKeys.length; i++) {
  if (!(expectedKeys[i] in s1)) { allKeysPresent = false; break; }
}
assert(allKeysPresent, 'state has all expected top-level keys');

// --- Test 2: arrays populated from shared.initArrays ---
console.log('\n[Test 2] createBAState arrays lengths:');
assert(
  s1.arrays.tt.length === 17 &&
  s1.arrays.tb.length === 17 &&
  s1.arrays.TBase.length === 15 &&
  s1.arrays.Base.length === 12 &&
  s1.arrays.LToe.length === 10 &&
  s1.arrays.DB.length === 5 &&
  s1.arrays.SP.length === 4,
  'arrays populated with correct lengths (tt=17 tb=17 TBase=15 Base=12 LToe=10 DB=5 SP=4)'
);

// --- Test 3: wsd populated from shared.calculateWSDParams ---
console.log('\n[Test 3] createBAState wsd populated:');
var wsdKeys = Object.keys(s1.wsd);
assert(wsdKeys.length > 0 && 'fs' in s1.wsd,
  'wsd is a non-empty object containing fs (got keys: ' + wsdKeys.join(',') + ')');

// --- Test 4: indices all zero ---
console.log('\n[Test 4] createBAState indices all zero:');
var idxZero = (
  s1.indices.tt === 0 && s1.indices.tb === 0 &&
  s1.indices.TBase === 0 && s1.indices.Base === 0 && s1.indices.LToe === 0 &&
  s1.indices.stemDB === 0 && s1.indices.stemSP === 0 &&
  s1.indices.toeDB === 0  && s1.indices.toeSP === 0 &&
  s1.indices.heelDB === 0 && s1.indices.heelSP === 0
);
assert(idxZero, 'all 11 index fields initialized to 0');

// --- Test 5: bisection structure with three dims ---
console.log('\n[Test 5] createBAState bisection structure:');
function isBisZero(b) {
  return b && b.min === 0 && b.max === 0 && b.mid === 0 && b.midPrice === 0;
}
assert(
  isBisZero(s1.bisection.tb) &&
  isBisZero(s1.bisection.TBase) &&
  isBisZero(s1.bisection.Base),
  'bisection.tb / TBase / Base each have {min:0, max:0, mid:0, midPrice:0}'
);

// --- Test 6: counters zero ---
console.log('\n[Test 6] createBAState counters zero:');
assert(
  s1.counters.totalCount === 0 && s1.counters.countLoop === 0,
  'counters.totalCount=0 and counters.countLoop=0'
);

// --- Test 7: VB6 rng deterministic with same seed ---
console.log('\n[Test 7] createBAState seeded rng is deterministic:');
var sA = ba.createBAState(testParams, { seed: 42 });
var sB = ba.createBAState(testParams, { seed: 42 });
var seqMatch = true;
var k;
for (k = 0; k < 10; k++) {
  if (sA.rng() !== sB.rng()) { seqMatch = false; break; }
}
assert(seqMatch, 'two states with seed=42 produce identical 10-value sequences');

// --- Test 8: IDX bounds match hca.js ---
console.log('\n[Test 8] IDX bounds match hca.js:');
assert(
  ba.IDX.TT_MIN === 1     && ba.IDX.TT_MAX === 17 &&
  ba.IDX.TB_MIN === 20    && ba.IDX.TB_MAX === 36 &&
  ba.IDX.TBASE_MIN === 40 && ba.IDX.TBASE_MAX === 54 &&
  ba.IDX.BASE_MIN === 60  && ba.IDX.BASE_MAX === 71 &&
  ba.IDX.LTOE_MIN === 80  && ba.IDX.LTOE_MAX === 89 &&
  ba.IDX.DB_MIN === 100   && ba.IDX.DB_MAX === 104 &&
  ba.IDX.SP_MIN === 110   && ba.IDX.SP_MAX === 113,
  'IDX exports match hca.js bounds'
);

// ==========================================================================
// Wave 2: initializeDesignBA
// ==========================================================================

function buildAndInit(H) {
  var p = {
    H: H, H1: 1.20,
    gamma_soil: 1.80, gamma_concrete: 2.40,
    phi: 30, mu: 0.60, qa: 30, cover: 0.075,
    material: { fy: 4000, fc: 280, concretePrice: 2524, steelPrice: 24 }
  };
  var s = ba.createBAState(p, { seed: 1 });
  ba.initializeDesignBA(s);
  return s;
}

// --- Test 9: tb bisection bounds for H=3 ---
console.log('\n[Test 9] initializeDesignBA tb bounds for H=3:');
(function () {
  var s = buildAndInit(3);
  var lim = shared.roundTo(0.12 * 3, 3);
  var ok =
    s.bisection.tb.min === ba.IDX.TB_MIN &&
    ba.wpLookup(s.arrays, 'tb', s.bisection.tb.max) <= lim &&
    (s.bisection.tb.max === ba.IDX.TB_MAX ||
      ba.wpLookup(s.arrays, 'tb', s.bisection.tb.max + 1) > lim) &&
    s.bisection.tb.mid === Math.floor((s.bisection.tb.min + s.bisection.tb.max) / 2) &&
    s.bisection.tb.midPrice === Infinity;
  assert(ok, 'tb bounds valid for H=3 (min=20, max satisfies <= 0.36, mid=floor, midPrice=Inf)');
})();

// --- Test 10: TBase bisection bounds for H=3 ---
console.log('\n[Test 10] initializeDesignBA TBase bounds for H=3:');
(function () {
  var s = buildAndInit(3);
  var lim = shared.roundTo(0.15 * 3, 3);
  var ok =
    s.bisection.TBase.min === ba.IDX.TBASE_MIN &&
    ba.wpLookup(s.arrays, 'TBase', s.bisection.TBase.max) <= lim &&
    (s.bisection.TBase.max === ba.IDX.TBASE_MAX ||
      ba.wpLookup(s.arrays, 'TBase', s.bisection.TBase.max + 1) > lim) &&
    s.bisection.TBase.mid === Math.floor((s.bisection.TBase.min + s.bisection.TBase.max) / 2) &&
    s.bisection.TBase.midPrice === Infinity;
  assert(ok, 'TBase bounds valid for H=3 (min=40, max satisfies <= 0.45, mid=floor, midPrice=Inf)');
})();

// --- Test 11: Base bisection bounds for H=3 ---
console.log('\n[Test 11] initializeDesignBA Base bounds for H=3:');
(function () {
  var s = buildAndInit(3);
  var limHi = shared.roundTo(0.70 * 3, 3);
  var limLo = shared.roundTo(0.50 * 3, 3);
  var ok =
    ba.wpLookup(s.arrays, 'Base', s.bisection.Base.min) >= limLo &&
    (s.bisection.Base.min === ba.IDX.BASE_MIN ||
      ba.wpLookup(s.arrays, 'Base', s.bisection.Base.min - 1) < limLo) &&
    ba.wpLookup(s.arrays, 'Base', s.bisection.Base.max) <= limHi &&
    (s.bisection.Base.max === ba.IDX.BASE_MAX ||
      ba.wpLookup(s.arrays, 'Base', s.bisection.Base.max + 1) > limHi) &&
    s.bisection.Base.mid === Math.floor((s.bisection.Base.min + s.bisection.Base.max) / 2) &&
    s.bisection.Base.midPrice === Infinity;
  assert(ok, 'Base bounds valid for H=3 (WP in [1.5, 2.1], mid=floor, midPrice=Inf)');
})();

// --- Test 12: Current indices = Mid values for bisected dims ---
console.log('\n[Test 12] indices == bisection.mid for bisected dims:');
(function () {
  var s = buildAndInit(3);
  assert(
    s.indices.tb === s.bisection.tb.mid &&
    s.indices.TBase === s.bisection.TBase.mid &&
    s.indices.Base === s.bisection.Base.mid,
    'indices.tb/TBase/Base initialized to bisection mid values'
  );
})();

// --- Test 13: tt is Max-initial with WP_tt(tt) <= WP_tb(tb) ---
console.log('\n[Test 13] tt is Max-initial constrained by tb:');
(function () {
  var s = buildAndInit(3);
  var wpTt = ba.wpLookup(s.arrays, 'tt', s.indices.tt);
  var wpTb = ba.wpLookup(s.arrays, 'tb', s.indices.tb);
  var inRange = s.indices.tt >= ba.IDX.TT_MIN && s.indices.tt <= ba.IDX.TT_MAX;
  var constrained = wpTt <= wpTb;
  var isMax = (s.indices.tt === ba.IDX.TT_MAX) ||
    (ba.wpLookup(s.arrays, 'tt', s.indices.tt + 1) > wpTb);
  assert(inRange && constrained && isMax,
    'tt in [1,17], WP_tt <= WP_tb, and tt is largest such index');
})();

// --- Test 14: LToe is mid-initial within [0.1H, 0.2H] ---
console.log('\n[Test 14] LToe mid-initial within [0.1H, 0.2H]:');
(function () {
  var s = buildAndInit(3);
  var H = 3;
  var wpLToe = ba.wpLookup(s.arrays, 'LToe', s.indices.LToe);
  var inRange = s.indices.LToe >= ba.IDX.LTOE_MIN && s.indices.LToe <= ba.IDX.LTOE_MAX;
  var withinPhys = wpLToe >= shared.roundTo(0.1 * H, 3) &&
                   wpLToe <= shared.roundTo(0.2 * H, 3);
  assert(inRange && withinPhys,
    'LToe index in bounds and WP in [0.3, 0.6] for H=3 (got WP=' + wpLToe + ')');
})();

// --- Test 15: Steel indices are mid of full DB/SP range ---
console.log('\n[Test 15] Steel indices at mid of full range:');
(function () {
  var s = buildAndInit(3);
  var expectedDB = Math.floor((ba.IDX.DB_MIN + ba.IDX.DB_MAX) / 2);
  var expectedSP = Math.floor((ba.IDX.SP_MIN + ba.IDX.SP_MAX) / 2);
  var ok =
    expectedDB === 102 && expectedSP === 111 &&
    s.indices.stemDB === expectedDB &&
    s.indices.toeDB  === expectedDB &&
    s.indices.heelDB === expectedDB &&
    s.indices.stemSP === expectedSP &&
    s.indices.toeSP  === expectedSP &&
    s.indices.heelSP === expectedSP;
  assert(ok, 'stem/toe/heel DB=102 and SP=111 (floor of full range)');
})();

// --- Test 16: VB6 integer truncation parity ---
console.log('\n[Test 16] VB6 integer truncation parity (hard-coded H=3 expected bounds):');
(function () {
  // Expected for H=3:
  //   tb: WP_tb(23)=0.350 <= 0.36, WP_tb(24)=0.400 > 0.36 -> max=23
  //   min=20, mid=floor((20+23)/2)=floor(21.5)=21
  var s = buildAndInit(3);
  assert(
    s.bisection.tb.min === 20 &&
    s.bisection.tb.max === 23 &&
    s.bisection.tb.mid === 21,
    'H=3 tb bisection hard-coded: {min:20, max:23, mid:21}'
  );
})();

// --- Test 17: different H produces different (monotonic) bounds ---
console.log('\n[Test 17] Bounds monotonic in H (H=5 >= H=3):');
(function () {
  var s3 = buildAndInit(3);
  var s5 = buildAndInit(5);
  assert(
    s5.bisection.tb.max    >= s3.bisection.tb.max &&
    s5.bisection.TBase.max >= s3.bisection.TBase.max &&
    s5.bisection.Base.max  >= s3.bisection.Base.max,
    'H=5 bounds.max >= H=3 bounds.max for tb, TBase, Base'
  );
})();

// --- Test 18: initializeDesignBA is idempotent ---
console.log('\n[Test 18] initializeDesignBA idempotency:');
(function () {
  var s = buildAndInit(3);
  var snap1 = JSON.stringify({ indices: s.indices, bisection: s.bisection });
  ba.initializeDesignBA(s);
  var snap2 = JSON.stringify({ indices: s.indices, bisection: s.bisection });
  assert(snap1 === snap2, 'second call produces identical indices + bisection state');
})();

// ==========================================================================
// Wave 3: getDesignFromCurrentBA
// ==========================================================================

// --- Test 19: design shape ---
console.log('\n[Test 19] getDesignFromCurrentBA shape:');
(function () {
  var s = buildAndInit(3);
  var r = ba.getDesignFromCurrentBA(s);
  var designKeys = ['tt', 'tb', 'TBase', 'Base', 'LToe', 'LHeel'];
  var steelKeys  = ['stemDB_idx', 'stemSP_idx', 'toeDB_idx', 'toeSP_idx', 'heelDB_idx', 'heelSP_idx'];
  var ok = (typeof r === 'object' && r !== null);
  var k;
  for (k = 0; k < designKeys.length; k++) if (!(designKeys[k] in r.design)) ok = false;
  for (k = 0; k < steelKeys.length;  k++) if (!(steelKeys[k]  in r.steel))  ok = false;
  assert(ok, 'r.design has 6 dim keys; r.steel has 6 steel index keys');
})();

// --- Test 20: physical values match WP_* lookups (and hard-coded H=3 values) ---
console.log('\n[Test 20] getDesignFromCurrentBA physical values:');
(function () {
  var s = buildAndInit(3);
  var r = ba.getDesignFromCurrentBA(s);
  var match =
    r.design.tt    === WP_tt(s.indices.tt) &&
    r.design.tb    === WP_tb(s.indices.tb) &&
    r.design.TBase === WP_TBase(s.indices.TBase) &&
    r.design.Base  === WP_Base(s.indices.Base) &&
    r.design.LToe  === WP_LToe(s.indices.LToe);
  var hardCoded =
    r.design.tt    === 0.250 &&
    r.design.tb    === 0.250 &&
    r.design.TBase === 0.350 &&
    r.design.Base  === 1.500 &&
    r.design.LToe  === 0.400;
  assert(match && hardCoded,
    'WP lookups match + H=3 hard-coded: tt=0.250 tb=0.250 TBase=0.350 Base=1.500 LToe=0.400');
})();

// --- Test 21: LHeel = Base - LToe - tb ---
console.log('\n[Test 21] getDesignFromCurrentBA LHeel = Base - LToe - tb:');
(function () {
  var s = buildAndInit(3);
  var r = ba.getDesignFromCurrentBA(s);
  var expected = r.design.Base - r.design.LToe - r.design.tb;
  assert(Math.abs(r.design.LHeel - expected) < 1e-9 &&
    Math.abs(r.design.LHeel - 0.85) < 1e-9,
    'LHeel == Base - LToe - tb (H=3: 1.5 - 0.4 - 0.25 = 0.85)');
})();

// ==========================================================================
// Wave 4: generateNeighborBA
// ==========================================================================

// --- Test 22: neighbor has all 11 keys ---
console.log('\n[Test 22] generateNeighborBA returns all 11 index fields:');
(function () {
  var s = buildAndInit(3);
  var n = ba.generateNeighborBA(s);
  var keys = ['tt', 'tb', 'TBase', 'Base', 'LToe',
              'stemDB', 'stemSP', 'toeDB', 'toeSP', 'heelDB', 'heelSP'];
  var ok = true;
  var k;
  for (k = 0; k < keys.length; k++) if (!(keys[k] in n)) ok = false;
  assert(ok, 'neighbor has all 11 index keys');
})();

// --- Test 23: generateNeighborBA does NOT mutate state.indices ---
console.log('\n[Test 23] generateNeighborBA does not mutate state.indices:');
(function () {
  var s = buildAndInit(3);
  var before = JSON.stringify(s.indices);
  ba.generateNeighborBA(s);
  var after = JSON.stringify(s.indices);
  assert(before === after, 'state.indices unchanged after generateNeighborBA call');
})();

// --- Test 24: tb stays within bisection bounds across 200 iter ---
console.log('\n[Test 24] tb stays within bisection bounds:');
(function () {
  var s = buildAndInit(3);
  var lo = s.bisection.tb.min, hi = s.bisection.tb.max;
  var ok = true;
  var k;
  for (k = 0; k < 200; k++) {
    var n = ba.generateNeighborBA(s);
    if (n.tb < lo || n.tb > hi) { ok = false; break; }
    s.indices = n;
  }
  assert(ok, '200 iter: tb always in [' + lo + ', ' + hi + ']');
})();

// --- Test 25: TBase stays within bisection bounds across 200 iter ---
console.log('\n[Test 25] TBase stays within bisection bounds:');
(function () {
  var s = buildAndInit(3);
  var lo = s.bisection.TBase.min, hi = s.bisection.TBase.max;
  var ok = true;
  var k;
  for (k = 0; k < 200; k++) {
    var n = ba.generateNeighborBA(s);
    if (n.TBase < lo || n.TBase > hi) { ok = false; break; }
    s.indices = n;
  }
  assert(ok, '200 iter: TBase always in [' + lo + ', ' + hi + ']');
})();

// --- Test 26: Base stays within bisection bounds across 200 iter ---
console.log('\n[Test 26] Base stays within bisection bounds:');
(function () {
  var s = buildAndInit(3);
  var lo = s.bisection.Base.min, hi = s.bisection.Base.max;
  var ok = true;
  var k;
  for (k = 0; k < 200; k++) {
    var n = ba.generateNeighborBA(s);
    if (n.Base < lo || n.Base > hi) { ok = false; break; }
    s.indices = n;
  }
  assert(ok, '200 iter: Base always in [' + lo + ', ' + hi + ']');
})();

// --- Test 27: tt stays within [TT_MIN, TT_MAX] and WP_tt <= WP_tb across 200 iter ---
console.log('\n[Test 27] tt in IDX range AND WP_tt <= WP_tb:');
(function () {
  var s = buildAndInit(3);
  var ok = true;
  var failMsg = '';
  var k;
  for (k = 0; k < 200; k++) {
    var n = ba.generateNeighborBA(s);
    if (n.tt < ba.IDX.TT_MIN || n.tt > ba.IDX.TT_MAX) {
      ok = false; failMsg = 'tt=' + n.tt + ' out of [1,17]'; break;
    }
    if (WP_tt(n.tt) > WP_tb(n.tb)) {
      ok = false; failMsg = 'WP_tt(' + n.tt + ')=' + WP_tt(n.tt) +
        ' > WP_tb(' + n.tb + ')=' + WP_tb(n.tb); break;
    }
    s.indices = n;
  }
  assert(ok, '200 iter: tt constraint always satisfied' + (failMsg ? ' (' + failMsg + ')' : ''));
})();

// --- Test 28: LToe WP within [0.1H, 0.2H] across 200 iter ---
console.log('\n[Test 28] LToe physical value in [0.1H, 0.2H]:');
(function () {
  var s = buildAndInit(3);
  var lo = shared.roundTo(0.10 * 3, 3);
  var hi = shared.roundTo(0.20 * 3, 3);
  var ok = true;
  var k;
  for (k = 0; k < 200; k++) {
    var n = ba.generateNeighborBA(s);
    var wp = WP_LToe(n.LToe);
    if (wp < lo || wp > hi) { ok = false; break; }
    s.indices = n;
  }
  assert(ok, '200 iter: WP_LToe always in [' + lo + ', ' + hi + '] for H=3');
})();

// --- Test 29: steel indices stay within [DB_MIN, DB_MAX] and [SP_MIN, SP_MAX] ---
console.log('\n[Test 29] steel indices stay in IDX range:');
(function () {
  var s = buildAndInit(3);
  var ok = true;
  var k;
  for (k = 0; k < 200; k++) {
    var n = ba.generateNeighborBA(s);
    if (n.stemDB < ba.IDX.DB_MIN || n.stemDB > ba.IDX.DB_MAX) ok = false;
    if (n.toeDB  < ba.IDX.DB_MIN || n.toeDB  > ba.IDX.DB_MAX) ok = false;
    if (n.heelDB < ba.IDX.DB_MIN || n.heelDB > ba.IDX.DB_MAX) ok = false;
    if (n.stemSP < ba.IDX.SP_MIN || n.stemSP > ba.IDX.SP_MAX) ok = false;
    if (n.toeSP  < ba.IDX.SP_MIN || n.toeSP  > ba.IDX.SP_MAX) ok = false;
    if (n.heelSP < ba.IDX.SP_MIN || n.heelSP > ba.IDX.SP_MAX) ok = false;
    if (!ok) break;
    s.indices = n;
  }
  assert(ok, '200 iter: all 6 steel indices in valid IDX ranges');
})();

// --- Test 30: deterministic with same seed ---
console.log('\n[Test 30] generateNeighborBA deterministic under seeded rng:');
(function () {
  var params = {
    H: 3.0, H1: 1.20,
    gamma_soil: 1.80, gamma_concrete: 2.40,
    phi: 30, mu: 0.60, qa: 30, cover: 0.075,
    material: { fy: 4000, fc: 280, concretePrice: 2524, steelPrice: 24 }
  };
  var sA = ba.createBAState(params, { seed: 42 });
  ba.initializeDesignBA(sA);
  var sB = ba.createBAState(params, { seed: 42 });
  ba.initializeDesignBA(sB);
  var nA = ba.generateNeighborBA(sA);
  var nB = ba.generateNeighborBA(sB);
  assert(JSON.stringify(nA) === JSON.stringify(nB),
    'same seed (42) -> identical first neighbor');
})();

// --- Test 31: tb step size at most +/-1 (clamp aside) ---
console.log('\n[Test 31] tb step is at most +/-1:');
(function () {
  var s = buildAndInit(3);
  var ok = true;
  var k;
  for (k = 0; k < 100; k++) {
    s.indices.tb = 22; // interior of bisection [20,23]
    var n = ba.generateNeighborBA(s);
    if (Math.abs(n.tb - 22) > 1) { ok = false; break; }
  }
  assert(ok, '100 iter from tb=22 (bisection interior): |newTb - 22| <= 1');
})();

// --- Test 32: tt step randomness sweep (at tt=9 interior, H=5 to avoid tight re-clamp) ---
console.log('\n[Test 32] tt randomness sweep (interior of TT range):');
(function () {
  // Use H=5 so WP_tb bounds are larger; starting tt=9 (WP=0.400) sits comfortably
  // below any WP_tb for tb in [20..28] worst-case (WP_tb(20)=0.200 for H=5 bisection).
  // Actually for H=5 bisection, tb in [20..28] — WP_tb range [0.200..0.600].
  // tt=9 -> WP_tt=0.400. Some neighbors may re-clamp tt down.
  // We just assert: tt stays in IDX range AND the set of observed values has size >= 2.
  var s = buildAndInit(5);
  var observed = {};
  var ok = true;
  var k;
  for (k = 0; k < 100; k++) {
    s.indices.tt = 9;
    s.indices.tb = 24; // interior of H=5 tb bisection
    var n = ba.generateNeighborBA(s);
    if (n.tt < ba.IDX.TT_MIN || n.tt > ba.IDX.TT_MAX) { ok = false; break; }
    observed[n.tt] = true;
  }
  var distinct = Object.keys(observed).length;
  assert(ok && distinct >= 2,
    '100 iter from tt=9: always in [1,17] and observed >=2 distinct values (got ' +
    distinct + ')');
})();

// --- Test 33: steel step at most +/-2 (clamp aside) ---
console.log('\n[Test 33] steel step is at most +/-2:');
(function () {
  var s = buildAndInit(3);
  var ok = true;
  var k;
  for (k = 0; k < 50; k++) {
    s.indices.stemDB = 102; // interior of [100,104]
    s.indices.stemSP = 111; // interior of [110,113]
    var n = ba.generateNeighborBA(s);
    if (Math.abs(n.stemDB - 102) > 2) { ok = false; break; }
    if (Math.abs(n.stemSP - 111) > 2) { ok = false; break; }
  }
  assert(ok, '50 iter: |newStemDB - 102| <= 2 AND |newStemSP - 111| <= 2');
})();

// ==========================================================================
// Wave 5: doBisectionStep
// ==========================================================================

// --- Test 34: mutates in place, returns undefined ---
console.log('\n[Test 34] doBisectionStep mutates in place:');
(function () {
  var s = buildAndInit(3);
  var refBefore = s.bisection;
  var result = ba.doBisectionStep(s, 5000);
  assert(typeof result === 'undefined' && s.bisection === refBefore,
    'returns undefined and mutates same bisection object');
})();

// --- Test 35: better branch -- max = curIdx, midPrice updates ---
console.log('\n[Test 35] tb better branch (currentPrice < midPrice):');
(function () {
  var s = buildAndInit(3); // bis.tb = {min:20, max:23, mid:21, midPrice:Infinity}
  s.indices.tb = 22;
  ba.doBisectionStep(s, 5000);
  assert(
    s.bisection.tb.max === 22 &&
    s.bisection.tb.midPrice === 5000 &&
    s.bisection.tb.min === 20 &&
    s.bisection.tb.mid === Math.floor((20 + 22) / 2),
    'max=22, midPrice=5000, min=20, mid=21'
  );
})();

// --- Test 36: not-better branch -- min = curIdx, midPrice unchanged ---
console.log('\n[Test 36] tb not-better branch (currentPrice >= midPrice):');
(function () {
  var s = buildAndInit(3);
  s.bisection.tb.midPrice = 4000; // pre-set lower midPrice
  s.indices.tb = 22;
  ba.doBisectionStep(s, 5000); // 5000 >= 4000 -> not better
  assert(
    s.bisection.tb.min === 22 &&
    s.bisection.tb.max === 23 &&
    s.bisection.tb.midPrice === 4000 &&
    s.bisection.tb.mid === Math.floor((22 + 23) / 2),
    'min=22, max=23, midPrice=4000, mid=22'
  );
})();

// --- Test 37: all 3 dims updated in one call ---
console.log('\n[Test 37] all 3 dims updated in one call:');
(function () {
  var s = buildAndInit(3); // tb={20,23} TBase={40,43} Base={60,61}, all midPrices=Inf
  s.indices.tb = 22;
  s.indices.TBase = 42;
  s.indices.Base = 60;
  ba.doBisectionStep(s, 5000);
  assert(
    s.bisection.tb.max === 22    && s.bisection.tb.midPrice === 5000 &&
    s.bisection.TBase.max === 42 && s.bisection.TBase.midPrice === 5000 &&
    s.bisection.Base.max === 60  && s.bisection.Base.midPrice === 5000,
    'tb, TBase, Base all shrank from top to curIdx with midPrice=5000'
  );
})();

// --- Test 38: mid = Math.floor((min+max)/2) ---
console.log('\n[Test 38] mid = Math.floor((min+max)/2):');
(function () {
  var s = ba.createBAState(testParams, { seed: 1 });
  // tb: [20, 25], midPrice=9000, curIdx=22 -> better -> max=22 -> mid=floor((20+22)/2)=21
  s.bisection.tb.min = 20; s.bisection.tb.max = 25; s.bisection.tb.midPrice = 9000;
  s.indices.tb = 22;
  // benign values for TBase/Base (so floor doesn't NaN)
  s.bisection.TBase.min = 40; s.bisection.TBase.max = 43; s.bisection.TBase.midPrice = 9000;
  s.indices.TBase = 40;
  s.bisection.Base.min = 60; s.bisection.Base.max = 61; s.bisection.Base.midPrice = 9000;
  s.indices.Base = 60;
  ba.doBisectionStep(s, 5000);
  assert(s.bisection.tb.mid === 21,
    'tb.mid = floor((20+22)/2) = 21 (got ' + s.bisection.tb.mid + ')');
})();

// --- Test 39: mid clamped to [min, max] when range collapsed ---
console.log('\n[Test 39] mid clamped when range collapsed to single index:');
(function () {
  var s = ba.createBAState(testParams, { seed: 1 });
  s.bisection.tb.min = 22;    s.bisection.tb.max = 22;    s.bisection.tb.midPrice = 9000;
  s.indices.tb = 22;
  s.bisection.TBase.min = 40; s.bisection.TBase.max = 40; s.bisection.TBase.midPrice = 9000;
  s.indices.TBase = 40;
  s.bisection.Base.min = 60;  s.bisection.Base.max = 60;  s.bisection.Base.midPrice = 9000;
  s.indices.Base = 60;
  ba.doBisectionStep(s, 5000);
  assert(
    s.bisection.tb.mid === 22 &&
    s.bisection.tb.min === 22 &&
    s.bisection.tb.max === 22,
    'collapsed range [22,22] -> mid=22'
  );
})();

// --- Test 40: Infinity midPrice always triggers better branch for finite ---
console.log('\n[Test 40] initial Infinity midPrice always "better" for finite cost:');
(function () {
  var s = buildAndInit(3); // all midPrices=Infinity
  s.indices.tb = 20;
  s.indices.TBase = 40;
  s.indices.Base = 60;
  ba.doBisectionStep(s, 99999);
  assert(
    s.bisection.tb.midPrice === 99999 &&
    s.bisection.TBase.midPrice === 99999 &&
    s.bisection.Base.midPrice === 99999,
    'all three midPrices updated to 99999 from Infinity'
  );
})();

// --- Test 41: Infinity < Infinity === false (invalid-design sentinel parity) ---
console.log('\n[Test 41] Infinity currentPrice triggers not-better branch:');
(function () {
  var s = buildAndInit(3); // all midPrices=Infinity, tb={20,23} TBase={40,43} Base={60,61}
  s.indices.tb = 22;
  s.indices.TBase = 42;
  s.indices.Base = 61;
  ba.doBisectionStep(s, Infinity);
  assert(
    s.bisection.tb.min === 22    && s.bisection.tb.max === 23    && s.bisection.tb.midPrice === Infinity &&
    s.bisection.TBase.min === 42 && s.bisection.TBase.max === 43 && s.bisection.TBase.midPrice === Infinity &&
    s.bisection.Base.min === 61  && s.bisection.Base.max === 61  && s.bisection.Base.midPrice === Infinity,
    'Infinity < Infinity is false: mins shrank, maxes + midPrices unchanged'
  );
})();

// ==========================================================================
// Wave 6: baOptimize (integration)
// ==========================================================================

// --- Test 42: return-shape ---
console.log('\n[Test 42] baOptimize returns 7 expected keys:');
(function () {
  var r = ba.baOptimize(testParams, { seed: 1, maxIterations: 100 });
  var keys = ['bestDesign', 'bestSteel', 'bestCost', 'bestIteration',
              'costHistory', 'log', 'finalState'];
  var ok = true;
  var k;
  for (k = 0; k < keys.length; k++) if (!(keys[k] in r)) ok = false;
  assert(ok, 'baOptimize result has all 7 expected keys');
})();

// --- Test 43: log length = maxIter + 1 ---
console.log('\n[Test 43] baOptimize log length = maxIter + 1:');
(function () {
  var r = ba.baOptimize(testParams, { seed: 1, maxIterations: 200 });
  assert(
    r.log.length === 201 &&
    r.log[0].iter === 0 &&
    r.log[200].iter === 200,
    'log has 201 entries with iter[0]=0 and iter[200]=200'
  );
})();

// --- Test 44: deterministic with same seed ---
console.log('\n[Test 44] baOptimize deterministic under seeded rng:');
(function () {
  var r1 = ba.baOptimize(testParams, { seed: 42, maxIterations: 200 });
  var r2 = ba.baOptimize(testParams, { seed: 42, maxIterations: 200 });
  assert(
    r1.bestCost === r2.bestCost &&
    r1.bestIteration === r2.bestIteration &&
    r1.log.length === r2.log.length &&
    r1.log[50].cost === r2.log[50].cost &&
    r1.log[150].accepted === r2.log[150].accepted,
    'two runs with seed=42 produce identical bestCost, bestIteration, and log samples'
  );
})();

// --- Test 45: finds valid best design for H=3 fc=280 at 500 iter ---
console.log('\n[Test 45] baOptimize finds valid best design:');
(function () {
  var r = ba.baOptimize(testParams, { seed: 1, maxIterations: 500 });
  var s = ba.createBAState(testParams, { seed: 1 });
  var v = shared.checkDesignValid(
    r.bestDesign, testParams.H, testParams.H1,
    testParams.gamma_soil, testParams.gamma_concrete,
    testParams.phi, testParams.mu, testParams.qa, testParams.cover,
    s.wsd, {
      stemDB_idx: r.bestSteel.stemDB_idx - ba.IDX.DB_MIN,
      stemSP_idx: r.bestSteel.stemSP_idx - ba.IDX.SP_MIN,
      toeDB_idx:  r.bestSteel.toeDB_idx  - ba.IDX.DB_MIN,
      toeSP_idx:  r.bestSteel.toeSP_idx  - ba.IDX.SP_MIN,
      heelDB_idx: r.bestSteel.heelDB_idx - ba.IDX.DB_MIN,
      heelSP_idx: r.bestSteel.heelSP_idx - ba.IDX.SP_MIN
    }, s.arrays
  );
  assert(
    r.bestDesign !== null &&
    isFinite(r.bestCost) &&
    r.bestIteration >= 1 &&
    v.valid === true,
    'bestDesign non-null, bestCost finite, bestIteration>=1, and design re-verifies valid ' +
    '(bestCost=' + r.bestCost.toFixed(2) + ', iter=' + r.bestIteration + ')'
  );
})();

// --- Test 46: costHistory non-increasing after first valid ---
console.log('\n[Test 46] baOptimize costHistory non-increasing after first valid:');
(function () {
  var r = ba.baOptimize(testParams, { seed: 1, maxIterations: 300 });
  var firstValidIdx = -1;
  var k;
  for (k = 1; k <= 300; k++) {
    if (r.costHistory[k] !== 999000) { firstValidIdx = k; break; }
  }
  var monotone = true;
  var failDetail = '';
  if (firstValidIdx > 0) {
    for (k = firstValidIdx + 1; k <= 300; k++) {
      if (r.costHistory[k] > r.costHistory[k - 1]) {
        monotone = false;
        failDetail = ' k=' + k + ' ' + r.costHistory[k] + ' > ' + r.costHistory[k - 1];
        break;
      }
    }
  }
  assert(firstValidIdx > 0 && monotone,
    'firstValidIdx=' + firstValidIdx + ', then costHistory monotone non-increasing' + failDetail);
})();

// --- Test 47: bisection bounds shrink (or stay same) ---
console.log('\n[Test 47] baOptimize bisection bounds shrink:');
(function () {
  var s0 = ba.createBAState(testParams, { seed: 1 });
  ba.initializeDesignBA(s0);
  var init = {
    tb:    { min: s0.bisection.tb.min,    max: s0.bisection.tb.max },
    TBase: { min: s0.bisection.TBase.min, max: s0.bisection.TBase.max },
    Base:  { min: s0.bisection.Base.min,  max: s0.bisection.Base.max }
  };
  var r = ba.baOptimize(testParams, { seed: 1, maxIterations: 300 });
  var fin = r.finalState.bisection;
  assert(
    fin.tb.min    >= init.tb.min    && fin.tb.max    <= init.tb.max &&
    fin.TBase.min >= init.TBase.min && fin.TBase.max <= init.TBase.max &&
    fin.Base.min  >= init.Base.min  && fin.Base.max  <= init.Base.max,
    'all 3 bisection dims non-expanded (tb: ' +
      init.tb.min + '..' + init.tb.max + ' -> ' + fin.tb.min + '..' + fin.tb.max + ')'
  );
})();

// --- Test 48: counter invariants ---
console.log('\n[Test 48] baOptimize counters totalCount and countLoop:');
(function () {
  // maxIter=100: innerIter sequence 20,40,40(capped). countLoop should end at 3.
  var r = ba.baOptimize(testParams, { seed: 1, maxIterations: 100 });
  assert(
    r.finalState.counters.totalCount === 100 &&
    r.finalState.counters.countLoop === 3,
    'totalCount=100 and countLoop=3 for maxIter=100 (20+40+40=100)'
  );
})();

// --- Test 49: tiny budget (maxIter=5) does not crash ---
console.log('\n[Test 49] baOptimize with maxIter=5 returns valid shape:');
(function () {
  var r = ba.baOptimize(testParams, { seed: 1, maxIterations: 5 });
  assert(
    r.log.length === 6 &&
    r.finalState.counters.totalCount === 5 &&
    r.finalState.counters.countLoop >= 1,
    'log=6 entries, totalCount=5, countLoop>=1 (countLoop=' +
      r.finalState.counters.countLoop + ')'
  );
})();

console.log('');
console.log('Wave 1-6 BA tests: ' + passed + '/49 passed');
if (failed > 0) process.exit(1);
