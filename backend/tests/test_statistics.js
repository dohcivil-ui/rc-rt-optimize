// test_statistics.js — validate statistics module (Step 9.5.2)
// Plain Node, custom assert, console output.

var path = require('path');
var stats = require('../src/statistics');
var csv = require('../src/csv');

var passCount = 0;
var failCount = 0;

function assert(cond, msg) {
  if (cond) {
    passCount = passCount + 1;
  } else {
    failCount = failCount + 1;
    console.log('  FAIL: ' + msg);
  }
}

function section(title) {
  console.log('');
  console.log('=== ' + title + ' ===');
}

function arrEq(a, b, eps) {
  if (a.length !== b.length) return false;
  var i;
  for (i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > eps) return false;
  }
  return true;
}

console.log('=== Test statistics.js (Step 9.5.2) ===');

// ==========================================================================
// Group 1 — erf accuracy
// ==========================================================================
section('Group 1: erf accuracy');
assert(stats.erf(0) === 0, 'erf(0) === 0 exactly');
assert(Math.abs(stats.erf(0.5)  -  0.5204998778) < 1e-4, 'erf(0.5) ~ 0.52050');
assert(Math.abs(stats.erf(1.0)  -  0.8427007929) < 1e-4, 'erf(1.0) ~ 0.84270');
assert(Math.abs(stats.erf(2.0)  -  0.9953222650) < 1e-4, 'erf(2.0) ~ 0.99532');
assert(Math.abs(stats.erf(-1.0) - (-0.8427007929)) < 1e-4, 'erf(-1.0) ~ -0.84270 (odd symmetry)');

// ==========================================================================
// Group 2 — normCdf and twoTailedP
// ==========================================================================
section('Group 2: normCdf and twoTailedP');
assert(Math.abs(stats.normCdf(0)      - 0.5)   < 1e-4, 'normCdf(0) ~ 0.5');
assert(Math.abs(stats.normCdf(1.645)  - 0.95)  < 1e-4, 'normCdf(1.645) ~ 0.95');
assert(Math.abs(stats.normCdf(1.96)   - 0.975) < 1e-4, 'normCdf(1.96) ~ 0.975');
assert(Math.abs(stats.normCdf(-1.96)  - 0.025) < 1e-4, 'normCdf(-1.96) ~ 0.025');
assert(Math.abs(stats.twoTailedP(0)    - 1.0)  < 1e-4, 'twoTailedP(0) ~ 1.0');
assert(Math.abs(stats.twoTailedP(1.96) - 0.05) < 1e-4, 'twoTailedP(1.96) ~ 0.05');

// ==========================================================================
// Group 3 — rankData
// ==========================================================================
section('Group 3: rankData');
assert(arrEq(stats.rankData([3, 1, 4, 2, 5]), [3, 1, 4, 2, 5], 1e-9),
  'rankData([3,1,4,2,5]) === [3,1,4,2,5] (no ties)');
assert(arrEq(stats.rankData([10, 20, 30]), [1, 2, 3], 1e-9),
  'rankData([10,20,30]) === [1,2,3]');
assert(arrEq(stats.rankData([1, 2, 2, 3]), [1, 2.5, 2.5, 4], 1e-9),
  'rankData([1,2,2,3]) === [1,2.5,2.5,4]');
assert(arrEq(stats.rankData([5, 5, 5]), [2, 2, 2], 1e-9),
  'rankData([5,5,5]) === [2,2,2]');
assert(arrEq(stats.rankData([7, 3, 7, 3, 3]), [4.5, 2, 4.5, 2, 2], 1e-9),
  'rankData([7,3,7,3,3]) === [4.5,2,4.5,2,2]');
assert(arrEq(stats.rankData([]), [], 1e-9),
  'rankData([]) === []');

// Bonus: does not mutate input
var origIn = [3, 1, 4, 1, 5];
var origCopy = origIn.slice();
stats.rankData(origIn);
assert(arrEq(origIn, origCopy, 1e-9), 'rankData does not mutate input');

// ==========================================================================
// Group 4 — Mann-Whitney U basic cases
// ==========================================================================
section('Group 4a: complete separation');
var r4a = stats.mannWhitneyU(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
);
assert(r4a.U === 0, '4a: U === 0 (got ' + r4a.U + ')');
assert(Math.abs(r4a.Z + 3.78) < 0.01, '4a: Z ~ -3.78 (got ' + r4a.Z + ')');
assert(r4a.p < 0.001, '4a: p < 0.001 (got ' + r4a.p + ')');
assert(r4a.r > 0.84 && r4a.r < 0.85, '4a: 0.84 < r < 0.85 (got ' + r4a.r + ')');
assert(r4a.tieCorrected === false, '4a: tieCorrected === false (no ties)');

section('Group 4b: identical samples (all ties)');
var r4b = stats.mannWhitneyU([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
assert(r4b.U === 12.5, '4b: U === 12.5 (got ' + r4b.U + ')');
assert(Math.abs(r4b.Z) < 1e-9, '4b: |Z| < 1e-9 (got ' + r4b.Z + ')');
assert(Math.abs(r4b.p - 1.0) < 1e-4, '4b: p ~ 1.0 (got ' + r4b.p + ')');

// ==========================================================================
// Group 5 — Acceptance helpers
// ==========================================================================
section('Group 5: acceptance helpers');
assert(stats.exactMatch(2942.29, 2942.29) === true, 'exactMatch(2942.29, 2942.29) true');
assert(stats.exactMatch(2942.29, 2942.30, 0.001) === false, 'exactMatch within 0.001 false');

var am1 = stats.allMatch([2942.29, 2942.29, 2942.29], 2942.29);
assert(am1.pass === true, 'allMatch all-equal pass');
assert(am1.mismatches.length === 0, 'allMatch all-equal mismatches empty');

var am2 = stats.allMatch([2942.29, 2942.50, 2942.29], 2942.29);
assert(am2.pass === false, 'allMatch with one outlier fails');
assert(am2.mismatches.length === 1, 'allMatch reports exactly 1 mismatch');

var mw1 = stats.meanWithinTolerance([10, 10, 10], [10, 10, 10]);
assert(mw1.pass === true, 'meanWithinTolerance equal means pass (0% diff)');

var mw2 = stats.meanWithinTolerance([13, 13, 13], [10, 10, 10], 0.20);
assert(mw2.pass === false, 'meanWithinTolerance 30% diff fails at tol 20%');

// ==========================================================================
// Group 6 — Integration with real VB6 data
// ==========================================================================
section('Group 6: integration with vb6_samples/loopPrice-HCA-H3-280.csv');
var lpPath = path.join(__dirname, '..', '..', 'vb6_samples', 'loopPrice-HCA-H3-280.csv');
var rows = csv.parseLoopPrice(lpPath);

var prices = rows.map(function (r) { return r.bestPrice; });
var loops  = rows.map(function (r) { return r.loop; });

var matchAll = stats.allMatch(prices, 2942.29, 0.01);
assert(matchAll.pass === true, 'all 30 VB6 best prices == 2942.29 (within 0.01)');

var mwSelf = stats.mannWhitneyU(loops, loops);
assert(Math.abs(mwSelf.Z) < 1e-9, 'MWU(loops, loops): Z === 0 (within 1e-9)');
assert(Math.abs(mwSelf.p - 1.0) < 1e-4, 'MWU(loops, loops): p ~ 1.0');

assert(loops.length === 30, 'loops sample size === 30');
var loopMean = stats.mean(loops);
assert(loopMean > 0 && loopMean < 1000, 'mean(loops) in plausible range (0, 1000) — got ' + loopMean);

// ==========================================================================
// Group 7 — Descriptive stats sanity
// ==========================================================================
section('Group 7: descriptive stats');
assert(Math.abs(stats.mean([2, 4, 4, 4, 5, 5, 7, 9]) - 5) < 1e-9,
  'mean([2,4,4,4,5,5,7,9]) === 5');
assert(Math.abs(stats.stdDev([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138089935) < 1e-4,
  'stdDev([2,4,4,4,5,5,7,9]) ~ 2.138 (sample stdev)');

// Edge cases
assert(stats.mean([]) === 0, 'mean([]) === 0');
assert(stats.stdDev([42]) === 0, 'stdDev([single]) === 0');

// ==========================================================================
// Group 8 — Fisher's exact test
// ==========================================================================
section('Group 8: fisherExact');

// Identical tables -> p=1
(function () {
  var r = stats.fisherExact(30, 0, 30, 0);
  assert(Math.abs(r.p - 1.0) < 1e-9, 'fisher identical 30/30 p==1');
})();

(function () {
  var r = stats.fisherExact(23, 7, 23, 7);
  assert(Math.abs(r.p - 1.0) < 1e-9, 'fisher identical 23/30 p==1');
})();

// Our 4 scenarios (known p-values from Python reference)
// H=5 fc=280: (8,22) vs (6,24) -> p ~= 0.76
(function () {
  var r = stats.fisherExact(8, 22, 6, 24);
  assert(r.p > 0.70 && r.p < 0.80, 'fisher H5-280: p in [0.70, 0.80], got ' + r.p);
})();

// H=5 fc=240: (3,27) vs (0,30) -> p ~= 0.237
(function () {
  var r = stats.fisherExact(3, 27, 0, 30);
  assert(r.p > 0.22 && r.p < 0.26, 'fisher H5-240: p in [0.22, 0.26], got ' + r.p);
})();

// Extreme difference: (30,0) vs (0,30) -> very small p
(function () {
  var r = stats.fisherExact(30, 0, 0, 30);
  assert(r.p < 1e-10, 'fisher extreme difference p < 1e-10, got ' + r.p);
})();

// Symmetric: fisherExact(a,b,c,d) == fisherExact(c,d,a,b)
(function () {
  var r1 = stats.fisherExact(8, 22, 6, 24);
  var r2 = stats.fisherExact(6, 24, 8, 22);
  assert(Math.abs(r1.p - r2.p) < 1e-12, 'fisher symmetry p');
})();

// Zero rows -> p=1
(function () {
  var r = stats.fisherExact(0, 0, 5, 5);
  assert(r.p === 1.0, 'fisher empty row -> p=1');
})();

// Validation: negative cells -> throw
(function () {
  var threw = false;
  try { stats.fisherExact(-1, 2, 3, 4); } catch (e) { threw = true; }
  assert(threw, 'fisher throws on negative cell');
})();

// Odds ratio computation
(function () {
  var r = stats.fisherExact(10, 5, 5, 10); // OR = (10*10)/(5*5) = 4
  assert(Math.abs(r.oddsRatio - 4.0) < 1e-9, 'fisher odds ratio');
})();

// Odds ratio undefined when b=0 or c=0
(function () {
  var r = stats.fisherExact(5, 0, 3, 7);
  assert(r.oddsRatio === null, 'fisher OR null when b=0');
})();

// Large N still works (factorial cache must not overflow)
(function () {
  var r = stats.fisherExact(500, 500, 500, 500);
  assert(Math.abs(r.p - 1.0) < 1e-9, 'fisher large N identical p=1');
})();

// Logical consistency: row total = 0 -> degenerate p=1
(function () {
  var r = stats.fisherExact(0, 10, 5, 5);
  // r1=10, r2=10, c1=5. Valid table range: a in [max(0, 5-10), min(10,5)] = [0, 5]
  assert(r.p >= 0 && r.p <= 1, 'fisher probability in valid range');
})();

console.log('fisherExact: 12 tests checked');

// ==========================================================================
// Summary
// ==========================================================================
console.log('');
console.log('Total: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) process.exit(1);
