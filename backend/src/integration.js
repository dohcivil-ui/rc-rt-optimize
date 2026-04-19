// integration.js — Wires HCA + csv + statistics for VB6 vs Node.js comparison
// Step 9.5.3a: module + smoke test only. The full 270-optimization matrix
// runner lives in 9.5.3b (scripts/, not here).

var fs = require('fs');
var path = require('path');

var shared = require('./shared');
var hca = require('./hca');
var csv = require('./csv');
var statistics = require('./statistics');

// ==========================================================================
// A) Constants
// ==========================================================================

// Primary scenario matrix (9 cells), lexicographic order by H then fc.
var PRIMARY_SCENARIOS = [
  { H: 3, fc: 240 }, { H: 3, fc: 280 }, { H: 3, fc: 320 },
  { H: 4, fc: 240 }, { H: 4, fc: 280 }, { H: 4, fc: 320 },
  { H: 5, fc: 240 }, { H: 5, fc: 280 }, { H: 5, fc: 320 }
];

// Default integration config — matches VB6 reference run parameters.
var DEFAULT_CONFIG = {
  maxIterations: 5000,
  numTrials: 30,
  H1: 1.20,
  gamma_soil: 1.80,
  gamma_concrete: 2.40,
  phi: 30,
  mu: 0.60,
  qa: 30,
  cover: 0.075,
  fy: 4000
};

// ==========================================================================
// B) Parameter builder
// ==========================================================================

function buildIntegrationParams(H, fc, config) {
  var cfg = config || DEFAULT_CONFIG;
  var concretePrice = shared.CONCRETE_PRICES[fc];
  var steelPrice = shared.STEEL_PRICES[cfg.fy];
  if (typeof concretePrice === 'undefined') {
    throw new Error('buildIntegrationParams: unknown concrete fc=' + fc +
      ' (no entry in shared.CONCRETE_PRICES)');
  }
  if (typeof steelPrice === 'undefined') {
    throw new Error('buildIntegrationParams: unknown steel fy=' + cfg.fy +
      ' (no entry in shared.STEEL_PRICES)');
  }
  return {
    H: H,
    H1: cfg.H1,
    gamma_soil: cfg.gamma_soil,
    gamma_concrete: cfg.gamma_concrete,
    phi: cfg.phi,
    mu: cfg.mu,
    qa: cfg.qa,
    cover: cfg.cover,
    material: {
      fc: fc,
      fy: cfg.fy,
      concretePrice: concretePrice,
      steelPrice: steelPrice
    }
  };
}

// ==========================================================================
// C) Scenario runner
// ==========================================================================

// Internal helper: count log entries by category in one pass.
function summarizeLog(log) {
  var validCount = 0;
  var betterCount = 0;
  var acceptedCount = 0;
  var i;
  for (i = 0; i < log.length; i++) {
    if (log[i].valid) validCount++;
    if (log[i].isBetter) betterCount++;
    if (log[i].accepted) acceptedCount++;
  }
  return {
    validCount: validCount,
    betterCount: betterCount,
    acceptedCount: acceptedCount
  };
}

function runScenario(H, fc, options) {
  options = options || {};
  var cfg = options.config || DEFAULT_CONFIG;
  var numTrials = (typeof options.numTrials === 'number') ? options.numTrials : cfg.numTrials;
  var maxIterations = (typeof options.maxIterations === 'number') ? options.maxIterations : cfg.maxIterations;
  var seedStrategy = options.seedStrategy || 'deterministic';
  var keepIterationLogs = options.keepIterationLogs === true;
  var onProgress = (typeof options.onProgress === 'function') ? options.onProgress : null;

  var params = buildIntegrationParams(H, fc, cfg);

  var trials = new Array(numTrials);
  var bestOverallCost = Infinity;
  var bestOverallTrial = 0;
  var bestOverallIter = 0;

  var totalStart = Date.now();
  var k;
  for (k = 1; k <= numTrials; k++) {
    var seed;
    var hcaOpts = { maxIterations: maxIterations };
    if (seedStrategy === 'deterministic') {
      seed = k;
      hcaOpts.seed = k;
    } else {
      seed = null; // random
      // hcaOpts.seed left undefined -> hcaOptimize falls back to Math.random
    }

    var trialStart = Date.now();
    var res = hca.hcaOptimize(params, hcaOpts);
    var trialMs = Date.now() - trialStart;

    var counts = summarizeLog(res.log);

    var trialEntry = {
      trial: k,
      seed: seed,
      bestCost: res.bestCost,
      bestIter: res.bestIteration,
      totalIter: maxIterations,
      validCount: counts.validCount,
      betterCount: counts.betterCount,
      acceptedCount: counts.acceptedCount,
      timeMs: trialMs,
      log: keepIterationLogs ? res.log : null
    };
    trials[k - 1] = trialEntry;

    if (res.bestCost < bestOverallCost) {
      bestOverallCost = res.bestCost;
      bestOverallTrial = k;
      bestOverallIter = res.bestIteration;
    }

    if (onProgress) onProgress(k, bestOverallCost, trialMs);
  }
  var totalTimeMs = Date.now() - totalStart;

  // Summary stats over trials
  var costs = trials.map(function (t) { return t.bestCost; });
  var loops = trials.map(function (t) { return t.bestIter; });

  var summary = {
    costMean: statistics.mean(costs),
    costStd:  statistics.stdDev(costs),
    costMin:  costs.length ? Math.min.apply(null, costs) : 0,
    costMax:  costs.length ? Math.max.apply(null, costs) : 0,
    loopMean: statistics.mean(loops),
    loopStd:  statistics.stdDev(loops),
    loopMin:  loops.length ? Math.min.apply(null, loops) : 0,
    loopMax:  loops.length ? Math.max.apply(null, loops) : 0,
    totalTimeMs: totalTimeMs
  };

  return {
    H: H, fc: fc,
    numTrials: numTrials,
    maxIterations: maxIterations,
    seedStrategy: seedStrategy,
    trials: trials,
    bestOverall: {
      cost: bestOverallCost,
      trial: bestOverallTrial,
      iter: bestOverallIter
    },
    summary: summary
  };
}

// ==========================================================================
// D) VB6 reference loader
// ==========================================================================

function loadVB6Reference(H, fc, dirPath) {
  var dir = dirPath || path.join('..', 'vb6_samples');
  var loopFile = path.join(dir, 'loopPrice-HCA-H' + H + '-' + fc + '.csv');
  var acceptFile = path.join(dir, 'accept-HCA-H' + H + '-' + fc + '.csv');

  if (!fs.existsSync(loopFile)) {
    throw new Error('loadVB6Reference: missing loopPrice file: ' + loopFile);
  }
  var loopPrice = csv.parseLoopPrice(loopFile);
  var accept = null;
  if (fs.existsSync(acceptFile)) {
    accept = csv.parseAccept(acceptFile);
  }
  return { loopPrice: loopPrice, accept: accept };
}

// ==========================================================================
// E) Comparators
// ==========================================================================

function compareDeep(nodeResult, vb6Loops, vb6GlobalOptimum, options) {
  options = options || {};
  var costTolerance = (typeof options.costTolerance === 'number') ? options.costTolerance : 0.01;
  var pThreshold = (typeof options.pThreshold === 'number') ? options.pThreshold : 0.05;
  var rThreshold = (typeof options.rThreshold === 'number') ? options.rThreshold : 0.3;

  var reasons = [];

  // 1) Best-overall cost match
  var diff = nodeResult.bestOverall.cost - vb6GlobalOptimum;
  var bestCostMatch = {
    pass: Math.abs(diff) < costTolerance,
    node: nodeResult.bestOverall.cost,
    vb6: vb6GlobalOptimum,
    diff: diff
  };
  if (!bestCostMatch.pass) {
    reasons.push('bestCostMatch FAIL: node=' + nodeResult.bestOverall.cost +
      ' vb6=' + vb6GlobalOptimum + ' diff=' + diff);
  }

  // 2) Per-trial cost match
  var trialCosts = nodeResult.trials.map(function (t) { return t.bestCost; });
  var allTrialsMatch = statistics.allMatch(trialCosts, vb6GlobalOptimum, costTolerance);
  if (!allTrialsMatch.pass) {
    reasons.push('allTrialsMatch FAIL: ' + allTrialsMatch.mismatches.length +
      '/' + trialCosts.length + ' trials off target');
  }

  // 3) MWU on convergence loop counts
  var nodeLoops = nodeResult.trials.map(function (t) { return t.bestIter; });
  var mwu = statistics.mannWhitneyU(nodeLoops, vb6Loops);
  var pPass = mwu.p > pThreshold;
  var rPass = mwu.r < rThreshold;
  var loopMWU = {
    U: mwu.U, Z: mwu.Z, p: mwu.p, r: mwu.r,
    n1: mwu.n1, n2: mwu.n2,
    pPass: pPass, rPass: rPass
  };
  if (!pPass) reasons.push('loopMWU pPass FAIL: p=' + mwu.p + ' <= ' + pThreshold);
  if (!rPass) reasons.push('loopMWU rPass FAIL: r=' + mwu.r + ' >= ' + rThreshold);

  return {
    pass: bestCostMatch.pass && allTrialsMatch.pass && pPass && rPass,
    bestCostMatch: bestCostMatch,
    allTrialsMatch: allTrialsMatch,
    loopMWU: loopMWU,
    reasons: reasons
  };
}

function compareSmoke(nodeResult, vb6Loops, vb6GlobalOptimum, options) {
  options = options || {};
  var costTolerance = (typeof options.costTolerance === 'number') ? options.costTolerance : 0.01;
  var meanTolerance = (typeof options.meanTolerance === 'number') ? options.meanTolerance : 0.20;

  var reasons = [];

  var diff = nodeResult.bestOverall.cost - vb6GlobalOptimum;
  var bestCostMatch = {
    pass: Math.abs(diff) < costTolerance,
    node: nodeResult.bestOverall.cost,
    vb6: vb6GlobalOptimum,
    diff: diff
  };
  if (!bestCostMatch.pass) {
    reasons.push('bestCostMatch FAIL: node=' + nodeResult.bestOverall.cost +
      ' vb6=' + vb6GlobalOptimum + ' diff=' + diff);
  }

  var trialCosts = nodeResult.trials.map(function (t) { return t.bestCost; });
  var allTrialsMatch = statistics.allMatch(trialCosts, vb6GlobalOptimum, costTolerance);
  if (!allTrialsMatch.pass) {
    reasons.push('allTrialsMatch FAIL: ' + allTrialsMatch.mismatches.length +
      '/' + trialCosts.length + ' trials off target');
  }

  var nodeLoops = nodeResult.trials.map(function (t) { return t.bestIter; });
  var loopMeanCheck = statistics.meanWithinTolerance(nodeLoops, vb6Loops, meanTolerance);
  if (!loopMeanCheck.pass) {
    reasons.push('loopMeanCheck FAIL: relDiff=' + loopMeanCheck.relDiff +
      ' > tol=' + meanTolerance);
  }

  return {
    pass: bestCostMatch.pass && allTrialsMatch.pass && loopMeanCheck.pass,
    bestCostMatch: bestCostMatch,
    allTrialsMatch: allTrialsMatch,
    loopMeanCheck: loopMeanCheck,
    reasons: reasons
  };
}

module.exports = {
  PRIMARY_SCENARIOS: PRIMARY_SCENARIOS,
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  buildIntegrationParams: buildIntegrationParams,
  runScenario: runScenario,
  loadVB6Reference: loadVB6Reference,
  compareDeep: compareDeep,
  compareSmoke: compareSmoke
};
