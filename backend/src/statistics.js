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
// D.2) Fisher's exact test (2x2 contingency table, two-sided)
// ==========================================================================
//
// Table layout:
//   Group 1 (e.g., Node): a hits, b misses  (row total = a+b)
//   Group 2 (e.g., VB6):  c hits, d misses  (row total = c+d)
//
// Returns { p, oddsRatio, a, b, c, d } with p clamped to [0,1].
// Two-sided p uses "sum of probabilities of tables with P <= P(observed)".
// Uses log-space combinations to avoid overflow at N > ~170.

// logFactorial table + on-demand extension
var LOG_FACT_CACHE = [0, 0]; // logFact[0]=0, logFact[1]=0

function logFactorial(n) {
  var k;
  if (n < 0) return NaN;
  if (n < LOG_FACT_CACHE.length) return LOG_FACT_CACHE[n];
  var last = LOG_FACT_CACHE.length - 1;
  var acc = LOG_FACT_CACHE[last];
  for (k = last + 1; k <= n; k++) {
    acc = acc + Math.log(k);
    LOG_FACT_CACHE[k] = acc;
  }
  return acc;
}

function logCombinations(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

// Probability of a specific 2x2 table under Fisher's null (hypergeometric)
function hypergeomLogProb(a, b, c, d) {
  var r1 = a + b;
  var r2 = c + d;
  var c1 = a + c;
  var n = r1 + r2;
  // P = C(r1,a)*C(r2,c) / C(n,c1)
  return logCombinations(r1, a) + logCombinations(r2, c) - logCombinations(n, c1);
}

function fisherExact(a, b, c, d) {
  if (a < 0 || b < 0 || c < 0 || d < 0) {
    throw new Error('fisherExact: all cells must be non-negative');
  }
  var r1 = a + b;
  var r2 = c + d;
  var c1 = a + c;
  var n = r1 + r2;

  // Degenerate cases
  if (r1 === 0 || r2 === 0 || c1 === 0 || c1 === n) {
    return { p: 1.0, oddsRatio: null, a: a, b: b, c: c, d: d };
  }

  var logPobs = hypergeomLogProb(a, b, c, d);
  var epsLog = 1e-9; // slack for "as extreme or more" comparison in log-space

  // Iterate over all valid tables with same marginals:
  //   a' in [max(0, c1 - r2), min(r1, c1)]
  var aMin = Math.max(0, c1 - r2);
  var aMax = Math.min(r1, c1);
  var sumP = 0;
  var ai;
  for (ai = aMin; ai <= aMax; ai++) {
    var bi = r1 - ai;
    var ci = c1 - ai;
    var di = r2 - ci;
    var logP = hypergeomLogProb(ai, bi, ci, di);
    if (logP <= logPobs + epsLog) {
      sumP = sumP + Math.exp(logP);
    }
  }

  if (sumP > 1) sumP = 1;
  if (sumP < 0) sumP = 0;

  var oddsRatio = null;
  if (b > 0 && c > 0) {
    oddsRatio = (a * d) / (b * c);
  }

  return { p: sumP, oddsRatio: oddsRatio, a: a, b: b, c: c, d: d };
}

// ==========================================================================
// D.3) Wilcoxon signed-rank test (paired, normal approximation, tie corrected)
// ==========================================================================
//
// Input: array of {x, y} objects OR [x, y] tuples.
// Tests whether median(x - y) differs from 0.
// Zero differences are discarded (standard Wilcoxon convention).
// Continuity correction applied to Wplus vs meanW.
// Returns { W, Wplus, Wminus, Z, p, r, n, nNonZero, tieCorrected }

function wilcoxonSignedRank(pairs) {
  var diffs = [];
  var i;
  for (i = 0; i < pairs.length; i++) {
    var pr = pairs[i];
    var x, y;
    if (pr && typeof pr === 'object' && !Array.isArray(pr) && 'x' in pr && 'y' in pr) {
      x = pr.x; y = pr.y;
    } else if (Array.isArray(pr) && pr.length >= 2) {
      x = pr[0]; y = pr[1];
    } else {
      throw new Error('wilcoxonSignedRank: each pair must be {x,y} or [x,y]');
    }
    var d = x - y;
    if (d !== 0) diffs.push(d);
  }
  var nNonZero = diffs.length;
  var n = pairs.length;

  if (nNonZero === 0) {
    return { W: 0, Wplus: 0, Wminus: 0, Z: 0, p: 1, r: 0,
             n: n, nNonZero: 0, tieCorrected: false };
  }

  var absDiffs = new Array(nNonZero);
  for (i = 0; i < nNonZero; i++) absDiffs[i] = Math.abs(diffs[i]);
  var ranks = rankData(absDiffs);

  var Wplus = 0;
  var Wminus = 0;
  for (i = 0; i < nNonZero; i++) {
    if (diffs[i] > 0) Wplus = Wplus + ranks[i];
    else Wminus = Wminus + ranks[i];
  }
  var W = Math.min(Wplus, Wminus);

  var meanW = nNonZero * (nNonZero + 1) / 4;
  var varW = nNonZero * (nNonZero + 1) * (2 * nNonZero + 1) / 24;

  var tieSum = tieCorrectionSum(absDiffs);
  var tieCorrected = tieSum > 0;
  if (tieCorrected) varW = varW - tieSum / 48;

  var sdW = Math.sqrt(varW);
  var Z, r;
  if (sdW === 0 || !isFinite(sdW)) {
    Z = 0; r = 0;
  } else {
    // Continuity correction: shift Wplus 0.5 toward meanW
    var raw = Wplus - meanW;
    var signedAdj;
    if (raw > 0) signedAdj = raw - 0.5;
    else if (raw < 0) signedAdj = raw + 0.5;
    else signedAdj = 0;
    Z = signedAdj / sdW;
    r = Math.abs(Z) / Math.sqrt(nNonZero);
  }
  var p = twoTailedP(Z);

  return { W: W, Wplus: Wplus, Wminus: Wminus,
           Z: Z, p: p, r: r,
           n: n, nNonZero: nNonZero, tieCorrected: tieCorrected };
}

// ==========================================================================
// D.4) McNemar's test (paired 2x2 discordant)
// ==========================================================================
//
// b = discordant count (group1 positive, group2 negative)
// c = discordant count (group1 negative, group2 positive)
// Exact two-sided binomial if b+c < 25, else continuity-corrected chi-square.
// Returns { p, chi2, Z, b, c, n, exact }. chi2/Z are null in exact regime.

function mcnemarTest(b, c) {
  if (b < 0 || c < 0) {
    throw new Error('mcnemarTest: b and c must be non-negative');
  }
  var total = b + c;
  if (total === 0) {
    return { p: 1.0, chi2: 0, Z: 0, b: b, c: c, n: 0, exact: false };
  }

  var p, chi2, Z, exact;

  if (total < 25) {
    var k = Math.min(b, c);
    var cumP = 0;
    var logHalfN = total * Math.log(0.5);
    var i;
    for (i = 0; i <= k; i++) {
      cumP = cumP + Math.exp(logCombinations(total, i) + logHalfN);
    }
    p = 2 * cumP;
    if (p > 1) p = 1;
    if (p < 0) p = 0;
    chi2 = null;
    Z = null;
    exact = true;
  } else {
    var absDiff = Math.abs(b - c) - 1;
    if (absDiff < 0) absDiff = 0;
    chi2 = (absDiff * absDiff) / total;
    Z = Math.sqrt(chi2);
    p = twoTailedP(Z);
    exact = false;
  }

  return { p: p, chi2: chi2, Z: Z, b: b, c: c, n: total, exact: exact };
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
  fisherExact: fisherExact,
  wilcoxonSignedRank: wilcoxonSignedRank,
  mcnemarTest: mcnemarTest,
  mean: mean,
  stdDev: stdDev
};
