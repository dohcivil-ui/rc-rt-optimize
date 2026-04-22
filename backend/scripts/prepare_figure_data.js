// prepare_figure_data.js -- Summarise trajectories.json to a plot-ready
// figure_data.json. Per scenario x algorithm, compute mean / p10 / p50 / p90 /
// min / max of best-so-far across the 30 trials at ~100 log-spaced iteration
// points. Values rounded to 2 decimals for compactness.
//
// Pure Node built-ins. No npm install.

var fs = require('fs');
var path = require('path');

var IN_FILE  = path.join(__dirname, '..', 'out', 'step_11', 'trajectories.json');
var OUT_FILE = path.join(__dirname, '..', 'out', 'step_11', 'figure_data.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// --- Sampling ------------------------------------------------------------
// Generate N iteration indices on a log scale from 0 to maxIter-1,
// guaranteeing iter 0, iter 1, iter maxIter-1 are included.
// Returns a sorted array of unique integer indices.
function logSampleIterations(maxIter, numPoints) {
  var set = {};
  set[0] = true;
  set[1] = true;
  set[maxIter - 1] = true;
  var i;
  var logMin = Math.log(1);
  var logMax = Math.log(maxIter - 1);
  for (i = 0; i < numPoints; i++) {
    var frac = i / (numPoints - 1);
    var idx = Math.round(Math.exp(logMin + (logMax - logMin) * frac));
    if (idx < 0) idx = 0;
    if (idx > maxIter - 1) idx = maxIter - 1;
    set[idx] = true;
  }
  var arr = [];
  var k;
  for (k in set) {
    if (Object.prototype.hasOwnProperty.call(set, k)) {
      arr.push(parseInt(k, 10));
    }
  }
  arr.sort(function (a, b) { return a - b; });
  return arr;
}

// --- Percentile helper ---------------------------------------------------
// sortedArr must be pre-sorted ascending.
// Uses linear interpolation between adjacent ranks (type-7, numpy default).
function percentile(sortedArr, p) {
  var n = sortedArr.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedArr[0];
  var rank = (p / 100) * (n - 1);
  var lo = Math.floor(rank);
  var hi = Math.ceil(rank);
  if (lo === hi) return sortedArr[lo];
  var w = rank - lo;
  return sortedArr[lo] * (1 - w) + sortedArr[hi] * w;
}

// --- Per-iteration stats across trials -----------------------------------
// trials: array of trial objects with bestSoFar: array[maxIter]
// sampledIters: array of iteration indices to compute stats at
// Returns: { iterations, mean, p10, p50, p90, min, max }
function computeStats(trials, sampledIters) {
  var numTrials = trials.length;
  var numPts = sampledIters.length;
  var mean = new Array(numPts);
  var p10  = new Array(numPts);
  var p50  = new Array(numPts);
  var p90  = new Array(numPts);
  var minV = new Array(numPts);
  var maxV = new Array(numPts);

  var i, k, iter, vals, sum;
  for (i = 0; i < numPts; i++) {
    iter = sampledIters[i];
    vals = new Array(numTrials);
    for (k = 0; k < numTrials; k++) {
      vals[k] = trials[k].bestSoFar[iter];
    }
    vals.sort(function (a, b) { return a - b; });
    sum = 0;
    for (k = 0; k < numTrials; k++) sum = sum + vals[k];
    mean[i] = sum / numTrials;
    p10[i]  = percentile(vals, 10);
    p50[i]  = percentile(vals, 50);
    p90[i]  = percentile(vals, 90);
    minV[i] = vals[0];
    maxV[i] = vals[numTrials - 1];
  }

  return {
    iterations: sampledIters,
    mean: mean,
    p10: p10, p50: p50, p90: p90,
    min: minV, max: maxV
  };
}

// --- Round to 2 decimals for compactness ---------------------------------
function round2Array(arr) {
  var out = new Array(arr.length);
  var i;
  for (i = 0; i < arr.length; i++) {
    out[i] = Math.round(arr[i] * 100) / 100;
  }
  return out;
}

function round2Stats(stats) {
  return {
    iterations: stats.iterations,
    mean: round2Array(stats.mean),
    p10:  round2Array(stats.p10),
    p50:  round2Array(stats.p50),
    p90:  round2Array(stats.p90),
    min:  round2Array(stats.min),
    max:  round2Array(stats.max)
  };
}

function main() {
  var raw = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
  var maxIter = raw.config.maxIterations;

  var sampled = logSampleIterations(maxIter, 100);
  console.log('Sampling ' + sampled.length + ' iteration points from ' + maxIter);
  console.log('  First 5: ' + sampled.slice(0, 5).join(', '));
  console.log('  Last 5:  ' + sampled.slice(-5).join(', '));

  var out = {
    runDate: new Date().toISOString(),
    sourceFile: 'trajectories.json',
    config: raw.config,
    samplingStrategy: 'log-spaced',
    numSamplePoints: sampled.length,
    scenarios: []
  };

  var s;
  for (s = 0; s < raw.scenarios.length; s++) {
    var sc = raw.scenarios[s];
    process.stdout.write('[' + (s + 1) + '/' + raw.scenarios.length + '] H=' + sc.H +
      ' fc=' + sc.fc + ' ...');
    var hcaStats = computeStats(sc.hca, sampled);
    var baStats  = computeStats(sc.ba,  sampled);
    out.scenarios.push({
      H: sc.H,
      fc: sc.fc,
      hca: round2Stats(hcaStats),
      ba:  round2Stats(baStats)
    });
    process.stdout.write(' done\n');
  }

  ensureDir(path.dirname(OUT_FILE));
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  var stats = fs.statSync(OUT_FILE);
  console.log('');
  console.log('Wrote ' + OUT_FILE);
  console.log('  Size: ' + (stats.size / 1024).toFixed(1) + ' KB');
  console.log('  Scenarios: ' + out.scenarios.length);
  console.log('  Sample points per series: ' + out.numSamplePoints);
}

main();
