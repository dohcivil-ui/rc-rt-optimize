// run_comparison.js -- HCA vs BA paired comparison across primary 9-scenario matrix.
// Runs both algorithms with identical seeds (30 trials each, 5000 iter),
// computes paired statistics per scenario, per-height stratum, and pooled,
// and writes the result to backend/out/comparison/comparison_results.json
// for the downstream report generator.
//
// Pure Node built-ins + project modules. No npm install.

var fs = require('fs');
var path = require('path');
var integration = require('../src/integration');
var statistics = require('../src/statistics');

// --- Config --------------------------------------------------------------
var OUT_DIR = path.join(__dirname, '..', 'out', 'comparison');
var OUT_FILE = path.join(OUT_DIR, 'comparison_results.json');
var COST_TOLERANCE = 0.01;

// --- Helpers -------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isHit(cost, optimum) {
  return Math.abs(cost - optimum) < COST_TOLERANCE;
}

// Extract VB6 global optimum from parseLoopPrice output.
// parseLoopPrice returns Array<{trial, loop, bestPrice}> (see csv.js).
// Prefer named field if the shape ever grows; otherwise take min(bestPrice).
function extractVB6Optimum(loopPrice) {
  if (loopPrice && typeof loopPrice.globalOptimum === 'number') {
    return loopPrice.globalOptimum;
  }
  if (loopPrice && Array.isArray(loopPrice.bestCosts)) {
    return Math.min.apply(null, loopPrice.bestCosts);
  }
  if (Array.isArray(loopPrice) && loopPrice.length > 0) {
    var mn = Infinity;
    var i;
    for (i = 0; i < loopPrice.length; i++) {
      var bp = loopPrice[i].bestPrice;
      if (typeof bp === 'number' && bp < mn) mn = bp;
    }
    if (isFinite(mn)) return mn;
  }
  throw new Error('extractVB6Optimum: cannot locate VB6 best cost array');
}

// --- Paired statistics for an arbitrary HCA/BA trial pair set ------------
// Accepts a per-trial optimum array so it can be used for single-scenario
// (constant optimum) or cross-scenario pooled/stratified (per-trial optimum).
function computePaired(hcaArr, baArr, optArr) {
  var n = hcaArr.length;
  if (baArr.length !== n || optArr.length !== n) {
    throw new Error('computePaired: length mismatch (hca=' + n +
      ', ba=' + baArr.length + ', opt=' + optArr.length + ')');
  }

  // 1) Wilcoxon on bestIter
  var pairs = new Array(n);
  var i;
  for (i = 0; i < n; i++) {
    pairs[i] = { x: hcaArr[i].bestIter, y: baArr[i].bestIter };
  }
  var w = statistics.wilcoxonSignedRank(pairs);

  // 2) McNemar on hit/miss (paired 2x2 discordant)
  var b = 0; // HCA hit, BA miss
  var c = 0; // HCA miss, BA hit
  var bh = 0;
  var bm = 0;
  for (i = 0; i < n; i++) {
    var hh = isHit(hcaArr[i].bestCost, optArr[i]);
    var bah = isHit(baArr[i].bestCost, optArr[i]);
    if (hh && bah) bh++;
    else if (hh && !bah) b++;
    else if (!hh && bah) c++;
    else bm++;
  }
  var m = statistics.mcnemarTest(b, c);

  // 3) Paired cost delta with 95% CI (normal approx)
  var deltas = new Array(n);
  for (i = 0; i < n; i++) deltas[i] = hcaArr[i].bestCost - baArr[i].bestCost;
  var md = statistics.mean(deltas);
  var sd = statistics.stdDev(deltas);
  var se = (n > 0) ? sd / Math.sqrt(n) : 0;
  var ci = 1.96 * se;

  return {
    n: n,
    wilcoxon: {
      Wplus: w.Wplus, Wminus: w.Wminus, W: w.W,
      Z: w.Z, p: w.p, r: w.r,
      nNonZero: w.nNonZero, tieCorrected: w.tieCorrected,
      // Direction: Wplus > Wminus means HCA.bestIter > BA.bestIter overall
      // -> BA converges in fewer iterations -> BA_FASTER.
      direction: (w.Wplus > w.Wminus) ? 'BA_FASTER'
               : (w.Wplus < w.Wminus) ? 'HCA_FASTER'
               : 'TIED'
    },
    mcnemar: {
      b: b, c: c, bothHit: bh, bothMiss: bm,
      p: m.p, chi2: m.chi2, Z: m.Z, exact: m.exact,
      direction: (c > b) ? 'BA_MORE_RELIABLE'
               : (c < b) ? 'HCA_MORE_RELIABLE'
               : 'TIED'
    },
    costDelta: {
      mean: md, sd: sd, se: se,
      ci95lo: md - ci, ci95hi: md + ci, n: n
    }
  };
}

// --- Per-scenario descriptive summary + paired stats ---------------------
function computeScenarioBlock(hcaTrials, baTrials, vb6Optimum) {
  var n = hcaTrials.length;
  var optArr = new Array(n);
  var i;
  for (i = 0; i < n; i++) optArr[i] = vb6Optimum;

  var paired = computePaired(hcaTrials, baTrials, optArr);

  var hcaLoops = hcaTrials.map(function (t) { return t.bestIter; });
  var baLoops  = baTrials.map(function (t)  { return t.bestIter; });
  var hcaCosts = hcaTrials.map(function (t) { return t.bestCost; });
  var baCosts  = baTrials.map(function (t)  { return t.bestCost; });

  var hcaHits = 0;
  var baHits = 0;
  for (i = 0; i < n; i++) {
    if (isHit(hcaTrials[i].bestCost, vb6Optimum)) hcaHits++;
    if (isHit(baTrials[i].bestCost, vb6Optimum)) baHits++;
  }

  return {
    n: n,
    hca: {
      hits: hcaHits,
      loopMean: statistics.mean(hcaLoops),
      loopStd:  statistics.stdDev(hcaLoops),
      costMean: statistics.mean(hcaCosts),
      costMin:  Math.min.apply(null, hcaCosts)
    },
    ba: {
      hits: baHits,
      loopMean: statistics.mean(baLoops),
      loopStd:  statistics.stdDev(baLoops),
      costMean: statistics.mean(baCosts),
      costMin:  Math.min.apply(null, baCosts)
    },
    paired: paired
  };
}

// --- Main ----------------------------------------------------------------

function main() {
  ensureDir(OUT_DIR);

  var config = {
    numTrials: 30,
    maxIterations: 5000,
    seedStrategy: 'deterministic',
    costTolerance: COST_TOLERANCE
  };

  var scenarios = integration.PRIMARY_SCENARIOS; // 9 cells

  var perScenario = [];
  var trialsByScenario = {};
  var allHcaTrials = [];
  var allBaTrials = [];
  var allVb6Opt = [];
  var perHeightHca = { 3: [], 4: [], 5: [] };
  var perHeightBa  = { 3: [], 4: [], 5: [] };
  var perHeightOpt = { 3: [], 4: [], 5: [] };

  var totalStart = Date.now();
  var s;
  for (s = 0; s < scenarios.length; s++) {
    var H = scenarios[s].H;
    var fc = scenarios[s].fc;
    var tag = 'H' + H + '_fc' + fc;

    process.stdout.write('[' + (s + 1) + '/9] H=' + H + ' fc=' + fc + ' ...');
    var scenStart = Date.now();

    var hcaRes = integration.runScenario(H, fc, {
      numTrials: config.numTrials,
      maxIterations: config.maxIterations,
      seedStrategy: 'deterministic'
    });
    var baRes = integration.runScenarioBA(H, fc, {
      numTrials: config.numTrials,
      maxIterations: config.maxIterations,
      seedStrategy: 'deterministic'
    });

    var vb6 = integration.loadVB6Reference(H, fc, null, 'HCA');
    var vb6Optimum = extractVB6Optimum(vb6.loopPrice);

    var block = computeScenarioBlock(hcaRes.trials, baRes.trials, vb6Optimum);
    var scenMs = Date.now() - scenStart;

    perScenario.push({
      H: H,
      fc: fc,
      vb6Optimum: vb6Optimum,
      n: block.n,
      hca: block.hca,
      ba: block.ba,
      paired: block.paired,
      elapsedMs: scenMs
    });

    trialsByScenario[tag] = {
      hca: hcaRes.trials.map(function (t) {
        return { trial: t.trial, seed: t.seed, bestCost: t.bestCost, bestIter: t.bestIter };
      }),
      ba: baRes.trials.map(function (t) {
        return { trial: t.trial, seed: t.seed, bestCost: t.bestCost, bestIter: t.bestIter };
      })
    };

    var k;
    for (k = 0; k < hcaRes.trials.length; k++) {
      allHcaTrials.push(hcaRes.trials[k]);
      allBaTrials.push(baRes.trials[k]);
      allVb6Opt.push(vb6Optimum);
      perHeightHca[H].push(hcaRes.trials[k]);
      perHeightBa[H].push(baRes.trials[k]);
      perHeightOpt[H].push(vb6Optimum);
    }

    process.stdout.write(' done (' + scenMs + 'ms). ' +
      'HCA ' + block.hca.hits + '/' + block.n + ' hits, ' +
      'BA ' + block.ba.hits + '/' + block.n + ' hits, ' +
      'Wilcoxon p=' + block.paired.wilcoxon.p.toFixed(4) + '\n');
  }

  var stratified = {
    H3: computePaired(perHeightHca[3], perHeightBa[3], perHeightOpt[3]),
    H4: computePaired(perHeightHca[4], perHeightBa[4], perHeightOpt[4]),
    H5: computePaired(perHeightHca[5], perHeightBa[5], perHeightOpt[5])
  };
  var pooled = computePaired(allHcaTrials, allBaTrials, allVb6Opt);

  var totalMs = Date.now() - totalStart;

  var output = {
    runDate: new Date().toISOString(),
    config: config,
    scenarios: perScenario,
    stratified: stratified,
    pooled: pooled,
    trials: trialsByScenario,
    totalRuntimeMs: totalMs
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log('');
  console.log('Wrote ' + OUT_FILE);
  console.log('Total runtime: ' + totalMs + 'ms');
  console.log('');
  console.log('=== Quick summary ===');
  console.log('Pooled (n=' + pooled.n + '):');
  console.log('  Wilcoxon: p=' + pooled.wilcoxon.p.toFixed(6) +
    '  direction=' + pooled.wilcoxon.direction);
  console.log('  McNemar:  p=' + pooled.mcnemar.p.toFixed(6) +
    '  b=' + pooled.mcnemar.b + ' c=' + pooled.mcnemar.c +
    '  direction=' + pooled.mcnemar.direction);
  console.log('  Cost delta (HCA - BA): mean=' + pooled.costDelta.mean.toFixed(4) +
    '  CI95=[' + pooled.costDelta.ci95lo.toFixed(4) +
    ', ' + pooled.costDelta.ci95hi.toFixed(4) + ']');
}

main();
