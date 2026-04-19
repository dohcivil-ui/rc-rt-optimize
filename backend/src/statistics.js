// statistics.js — Non-parametric and descriptive statistics for RC_RT_HCA Step 9.5
//
// Provides:
//   erf(x), normCdf(z), twoTailedP(z)
//   rankData(values)                            (1-based ranks, ties averaged)
//   mannWhitneyU(x, y)                          (with tie correction, normal approx)
//   exactMatch(a, b, tol)
//   allMatch(arr, target, tol)
//   meanWithinTolerance(sample, ref, relTol)
//   mean(arr), stdDev(arr)                      (sample stdev, divisor n-1)
//
// Pure Node built-ins; no external dependencies.

// ==========================================================================
// A) Normal distribution helpers
// ==========================================================================

// erf — Abramowitz & Stegun 7.1.26 (max abs error ~1.5e-7)
// Short-circuit at x=0 to honor odd-symmetry exactly (formula leaves ~1e-7 residual otherwise).
function erf(x) {
  if (x === 0) return 0;
  var sign = x < 0 ? -1 : 1;
  var ax = Math.abs(x);
  var a1 =  0.254829592;
  var a2 = -0.284496736;
  var a3 =  1.421413741;
  var a4 = -1.453152027;
  var a5 =  1.061405429;
  var p  =  0.3275911;
  var t = 1 / (1 + p * ax);
  var y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

// normCdf — standard normal CDF
function normCdf(z) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

// twoTailedP — two-tailed p-value, clamped to [0,1]
function twoTailedP(z) {
  var p = 2 * (1 - normCdf(Math.abs(z)));
  if (p < 0) p = 0;
  if (p > 1) p = 1;
  return p;
}

// ==========================================================================
// B) Ranking — 1-based, tied values get average rank
// ==========================================================================

function rankData(values) {
  var n = values.length;
  if (n === 0) return [];
  var indexed = new Array(n);
  var i;
  for (i = 0; i < n; i++) {
    indexed[i] = { v: values[i], idx: i };
  }
  indexed.sort(function (a, b) { return a.v - b.v; });

  var ranks = new Array(n);
  i = 0;
  while (i < n) {
    var j = i;
    // Find run of ties [i .. j]
    while (j + 1 < n && indexed[j + 1].v === indexed[i].v) {
      j = j + 1;
    }
    // Average of 1-based positions (i+1) .. (j+1) = ((i+1)+(j+1))/2
    var avg = ((i + 1) + (j + 1)) / 2;
    var k;
    for (k = i; k <= j; k++) {
      ranks[indexed[k].idx] = avg;
    }
    i = j + 1;
  }
  return ranks;
}

// Helper: compute sum of (t^3 - t) over tied groups in a (sorted-or-unsorted) numeric array
function tieCorrectionSum(values) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  var n = sorted.length;
  var sum = 0;
  var i = 0;
  while (i < n) {
    var j = i;
    while (j + 1 < n && sorted[j + 1] === sorted[i]) j = j + 1;
    var t = j - i + 1;
    if (t > 1) sum = sum + (t * t * t - t);
    i = j + 1;
  }
  return sum;
}

// ==========================================================================
// C) Mann-Whitney U test (large-sample normal approximation, tie corrected)
// ==========================================================================

function mannWhitneyU(x, y) {
  var n1 = x.length;
  var n2 = y.length;
  var combined = x.concat(y);
  var ranks = rankData(combined);

  var R1 = 0;
  var i;
  for (i = 0; i < n1; i++) R1 = R1 + ranks[i];

  var U1 = R1 - n1 * (n1 + 1) / 2;
  var U2 = n1 * n2 - U1;
  var U = Math.min(U1, U2);

  var meanU = n1 * n2 / 2;
  var N = n1 + n2;

  var tieSum = tieCorrectionSum(combined);
  var tieCorrected = tieSum > 0;
  var varU;
  if (!tieCorrected) {
    varU = n1 * n2 * (N + 1) / 12;
  } else {
    varU = (n1 * n2 / 12) * ((N + 1) - tieSum / (N * (N - 1)));
  }
  var sdU = Math.sqrt(varU);

  var Z, p, r;
  if (sdU === 0 || !isFinite(sdU)) {
    Z = 0;
    p = 1;
    r = 0;
  } else {
    Z = (U - meanU) / sdU;
    p = twoTailedP(Z);
    r = Math.abs(Z) / Math.sqrt(N);
  }

  return {
    U: U, U1: U1, U2: U2,
    Z: Z, p: p, r: r,
    n1: n1, n2: n2,
    meanU: meanU, sdU: sdU,
    tieCorrected: tieCorrected
  };
}

// ==========================================================================
// D) Acceptance-criterion helpers
// ==========================================================================

function exactMatch(a, b, tolerance) {
  if (typeof tolerance === 'undefined') tolerance = 0.01;
  return Math.abs(a - b) < tolerance;
}

function allMatch(arr, target, tolerance) {
  if (typeof tolerance === 'undefined') tolerance = 0.01;
  var mismatches = [];
  var i;
  for (i = 0; i < arr.length; i++) {
    var diff = arr[i] - target;
    if (Math.abs(diff) >= tolerance) {
      mismatches.push({ index: i, value: arr[i], diff: diff });
    }
  }
  return { pass: mismatches.length === 0, mismatches: mismatches };
}

function meanWithinTolerance(sample, reference, relativeTol) {
  if (typeof relativeTol === 'undefined') relativeTol = 0.20;
  var sampleMean = mean(sample);
  var refMean = mean(reference);
  var relDiff;
  if (refMean === 0) {
    relDiff = Infinity;
    return {
      pass: false,
      sampleMean: sampleMean,
      refMean: refMean,
      relDiff: relDiff,
      tolerance: relativeTol
    };
  }
  relDiff = Math.abs(sampleMean - refMean) / Math.abs(refMean);
  return {
    pass: relDiff <= relativeTol,
    sampleMean: sampleMean,
    refMean: refMean,
    relDiff: relDiff,
    tolerance: relativeTol
  };
}

// ==========================================================================
// E) Basic descriptive stats
// ==========================================================================

function mean(arr) {
  var n = arr.length;
  if (n === 0) return 0;
  var s = 0;
  var i;
  for (i = 0; i < n; i++) s = s + arr[i];
  return s / n;
}

function stdDev(arr) {
  var n = arr.length;
  if (n < 2) return 0;
  var m = mean(arr);
  var s = 0;
  var i;
  for (i = 0; i < n; i++) {
    var d = arr[i] - m;
    s = s + d * d;
  }
  return Math.sqrt(s / (n - 1));
}

module.exports = {
  erf: erf,
  normCdf: normCdf,
  twoTailedP: twoTailedP,
  rankData: rankData,
  mannWhitneyU: mannWhitneyU,
  exactMatch: exactMatch,
  allMatch: allMatch,
  meanWithinTolerance: meanWithinTolerance,
  mean: mean,
  stdDev: stdDev
};
