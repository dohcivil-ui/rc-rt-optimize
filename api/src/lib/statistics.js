// statistics.js -- pure-JS statistical primitives for Day 9.7 paired
// BA-vs-HCA comparison. No external dependencies. All inputs assumed to
// be plain Number arrays of the same length (validated by caller).
//
// Public surface:
//   wilcoxonSignedRank(samplesA, samplesB, options?)
//     options.alternative: 'two-sided' (default) | 'less' | 'greater'
//       'less'    -> H1: median(A - B) < 0   (A tends to be smaller)
//       'greater' -> H1: median(A - B) > 0   (A tends to be larger)
//     returns { W, Wplus, Wminus, z, pValue, pTwoSided, pLess, pGreater,
//               n, alternative, conclusion, note }
//   descriptiveStats(arr)                    -> { n, mean, median, std,
//                                                  min, max, q1, q3 }
//   normalCDF(z)                             -> approx P(Z <= z)
//   buildPairs(samplesA, samplesB)           -> [{ d, absD, sign }]
//                                              (exposed for tests only)

// Abramowitz & Stegun 26.2.17 approximation for the standard normal
// cumulative distribution function. Max error ~7.5e-8 over the range,
// adequate for 4-decimal p-values.
function normalCDF(z) {
  if (z === 0) return 0.5;
  var sign = z < 0 ? -1 : 1;
  var az = Math.abs(z);

  var a1 =  0.254829592;
  var a2 = -0.284496736;
  var a3 =  1.421413741;
  var a4 = -1.453152027;
  var a5 =  1.061405429;
  var p  =  0.3275911;

  var t = 1.0 / (1.0 + p * az / Math.SQRT2);
  var erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-(az * az) / 2);

  return 0.5 * (1.0 + sign * erf);
}

// Quicksort-based percentile (linear interpolation, matches NumPy's
// "linear" method). p is a float in [0, 1].
function percentile(sortedArr, p) {
  var n = sortedArr.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedArr[0];
  var idx = p * (n - 1);
  var lo = Math.floor(idx);
  var hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  var frac = idx - lo;
  return sortedArr[lo] * (1 - frac) + sortedArr[hi] * frac;
}

function descriptiveStats(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return { n: 0, mean: NaN, median: NaN, std: NaN, min: NaN, max: NaN, q1: NaN, q3: NaN };
  }
  var n = arr.length;
  var sum = 0;
  var i;
  for (i = 0; i < n; i++) sum += arr[i];
  var mean = sum / n;

  var sqSum = 0;
  for (i = 0; i < n; i++) {
    var d = arr[i] - mean;
    sqSum += d * d;
  }
  // Sample standard deviation (n-1) when n > 1; population (n) for n=1.
  var std = n > 1 ? Math.sqrt(sqSum / (n - 1)) : 0;

  var sorted = arr.slice().sort(function (a, b) { return a - b; });
  var min = sorted[0];
  var max = sorted[n - 1];
  var median = percentile(sorted, 0.5);
  var q1 = percentile(sorted, 0.25);
  var q3 = percentile(sorted, 0.75);

  return {
    n: n,
    mean: mean,
    median: median,
    std: std,
    min: min,
    max: max,
    q1: q1,
    q3: q3
  };
}

// Compute paired differences and discard zeros. Returns the array
// shape Wilcoxon downstream code expects.
function buildPairs(samplesA, samplesB) {
  var pairs = [];
  var i;
  var n = Math.min(samplesA.length, samplesB.length);
  for (i = 0; i < n; i++) {
    var d = samplesA[i] - samplesB[i];
    if (d === 0) continue;
    pairs.push({
      d: d,
      absD: Math.abs(d),
      sign: d > 0 ? 1 : -1
    });
  }
  return pairs;
}

// Average-rank tie handling. Returns ranks parallel to `values` (which
// must be ascending). Ties get the mean of the rank slots they occupy.
// Also returns the per-tie-group sizes for the Wilcoxon variance
// correction.
function rankWithTies(values) {
  var n = values.length;
  var ranks = new Array(n);
  var tieSizes = [];
  var i = 0;
  while (i < n) {
    var j = i;
    while (j + 1 < n && values[j + 1] === values[i]) j++;
    // Slots i..j (1-indexed: i+1..j+1) -> mean rank = ((i+1)+(j+1))/2.
    var groupSize = j - i + 1;
    var meanRank = ((i + 1) + (j + 1)) / 2;
    var k;
    for (k = i; k <= j; k++) ranks[k] = meanRank;
    if (groupSize > 1) tieSizes.push(groupSize);
    i = j + 1;
  }
  return { ranks: ranks, tieSizes: tieSizes };
}

// Wilcoxon signed-rank with average-rank tie handling and continuity
// correction on the normal approximation. Designed for n >= 6; for
// very small n the p-value is approximate (note returned).
//
// Statistic convention (matches R / Hollander-Wolfe):
//   W = Wplus = sum of ranks of |d_i| over pairs where d_i = a_i - b_i > 0.
//   E[Wplus] = mu = n(n+1)/4. Var[Wplus] = n(n+1)(2n+1)/24 with tie
//   correction. The signed z is (Wplus - mu) / sigma so that:
//     - z << 0  <=>  A tends to be smaller than B
//     - z >> 0  <=>  A tends to be larger than B
//
// One-sided p-values use a half continuity correction biased away from
// the alternative (matches scipy.stats.wilcoxon mode='approx').
//
// `options.alternative`: 'two-sided' (default) | 'less' | 'greater'.
function wilcoxonSignedRank(samplesA, samplesB, options) {
  if (!Array.isArray(samplesA) || !Array.isArray(samplesB)) {
    throw new Error('wilcoxonSignedRank: both inputs must be arrays');
  }
  if (samplesA.length !== samplesB.length) {
    throw new Error('wilcoxonSignedRank: arrays must have equal length');
  }
  options = options || {};
  var alternative = options.alternative || 'two-sided';
  if (alternative !== 'two-sided' && alternative !== 'less' && alternative !== 'greater') {
    throw new Error('wilcoxonSignedRank: invalid alternative ' + alternative);
  }

  var pairs = buildPairs(samplesA, samplesB);
  var n = pairs.length;

  // Edge case: every paired difference is zero -> no signal.
  if (n === 0) {
    return {
      W: 0,
      Wplus: 0,
      Wminus: 0,
      z: 0,
      pValue: 1,
      pTwoSided: 1,
      pLess: 0.5,
      pGreater: 0.5,
      n: 0,
      alternative: alternative,
      conclusion: 'ไม่แตกต่างอย่างมีนัยสำคัญ',
      note: 'all paired differences are zero'
    };
  }

  // Sort by |d| ascending; ties handled by average rank.
  pairs.sort(function (a, b) { return a.absD - b.absD; });
  var absVals = pairs.map(function (p) { return p.absD; });
  var ranked = rankWithTies(absVals);
  var ranks = ranked.ranks;

  var Wplus = 0;
  var Wminus = 0;
  var i;
  for (i = 0; i < n; i++) {
    if (pairs[i].sign > 0) Wplus += ranks[i];
    else Wminus += ranks[i];
  }
  var W = Wplus;

  // Normal approximation with tie correction (cf. Hollander & Wolfe).
  var mu = n * (n + 1) / 4;
  var varW = n * (n + 1) * (2 * n + 1) / 24;
  var k;
  for (k = 0; k < ranked.tieSizes.length; k++) {
    var t = ranked.tieSizes[k];
    varW -= (t * t * t - t) / 48;
  }
  var sigma = Math.sqrt(varW);

  var diff = Wplus - mu;
  var pTwoSided;
  var pLess;
  var pGreater;
  var zReturned;
  if (sigma === 0) {
    zReturned = 0;
    pTwoSided = 1;
    pLess = 0.5;
    pGreater = 0.5;
  } else {
    // Two-sided continuity correction: shrink |diff| by 0.5 toward 0.
    var corrTwo = diff > 0 ? -0.5 : (diff < 0 ? 0.5 : 0);
    var zTwo = (diff + corrTwo) / sigma;
    pTwoSided = 2 * normalCDF(-Math.abs(zTwo));
    if (pTwoSided > 1) pTwoSided = 1;

    // One-sided 'less' (H1: A < B  =>  Wplus < mu): z = (Wplus - mu + 0.5) / sigma
    var zLess = (diff + 0.5) / sigma;
    pLess = normalCDF(zLess);

    // One-sided 'greater' (H1: A > B  =>  Wplus > mu).
    var zGreater = (diff - 0.5) / sigma;
    pGreater = 1 - normalCDF(zGreater);

    // The z reported back follows the requested alternative so it can
    // be displayed alongside the p-value without confusion.
    if (alternative === 'less') zReturned = zLess;
    else if (alternative === 'greater') zReturned = zGreater;
    else zReturned = (diff + corrTwo) / sigma;
  }

  var pValue;
  if (alternative === 'less') pValue = pLess;
  else if (alternative === 'greater') pValue = pGreater;
  else pValue = pTwoSided;

  var note = '';
  if (n < 6) note = 'n < 6: normal approximation may be inaccurate';

  return {
    W: W,
    Wplus: Wplus,
    Wminus: Wminus,
    z: zReturned,
    pValue: pValue,
    pTwoSided: pTwoSided,
    pLess: pLess,
    pGreater: pGreater,
    n: n,
    alternative: alternative,
    conclusion: pValue < 0.05
      ? 'แตกต่างอย่างมีนัยสำคัญ'
      : 'ไม่แตกต่างอย่างมีนัยสำคัญ',
    note: note
  };
}

module.exports = {
  wilcoxonSignedRank: wilcoxonSignedRank,
  descriptiveStats: descriptiveStats,
  normalCDF: normalCDF,
  buildPairs: buildPairs,
  rankWithTies: rankWithTies
};
