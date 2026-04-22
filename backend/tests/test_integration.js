// test_integration.js — validate integration module (Step 9.5.3a)
// Plain Node, custom assert, console output. Smoke-tests HCA via runScenario
// at small scale (2 trials x 500 iter) to keep the test under a few seconds.

var path = require('path');
var integration = require('../src/integration');

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

console.log('=== Test integration.js (Step 9.5.3a) ===');

// ==========================================================================
// Group 1: PRIMARY_SCENARIOS structure
// ==========================================================================
section('Group 1: PRIMARY_SCENARIOS structure');
var ps = integration.PRIMARY_SCENARIOS;
assert(ps.length === 9, 'PRIMARY_SCENARIOS.length === 9');

var validH = { 3: true, 4: true, 5: true };
var validFc = { 240: true, 280: true, 320: true };
var allValid = true;
var i;
for (i = 0; i < ps.length; i++) {
  if (!validH[ps[i].H] || !validFc[ps[i].fc]) { allValid = false; break; }
}
assert(allValid, 'every item has H in {3,4,5} and fc in {240,280,320}');

var seen = {};
var noDup = true;
for (i = 0; i < ps.length; i++) {
  var key = ps[i].H + '_' + ps[i].fc;
  if (seen[key]) { noDup = false; break; }
  seen[key] = true;
}
assert(noDup, 'no duplicate (H, fc) pairs');

assert(ps[0].H === 3 && ps[0].fc === 240 && ps[8].H === 5 && ps[8].fc === 320,
  'first === {H:3,fc:240}, last === {H:5,fc:320} (lex order)');

// ==========================================================================
// Group 2: buildIntegrationParams
// ==========================================================================
section('Group 2: buildIntegrationParams');
var p1 = integration.buildIntegrationParams(3, 280);
assert(p1.H === 3, 'params.H === 3');
assert(p1.H1 === 1.20, 'params.H1 === 1.20');
assert(p1.material.fc === 280, 'params.material.fc === 280');
assert(p1.material.concretePrice === 2524, 'params.material.concretePrice === 2524 (fc=280)');
assert(p1.material.steelPrice === 24, 'params.material.steelPrice === 24 (fy=4000)');

var threwUnknownFc = false;
var errMsg = '';
try {
  integration.buildIntegrationParams(3, 999);
} catch (e) {
  threwUnknownFc = true;
  errMsg = e.message;
}
assert(threwUnknownFc && errMsg.indexOf('999') !== -1,
  'throws Error mentioning 999 for unknown fc (msg: ' + errMsg + ')');

// ==========================================================================
// Group 3: loadVB6Reference with real files
// ==========================================================================
section('Group 3: loadVB6Reference (real vb6_samples)');
var ref = integration.loadVB6Reference(3, 280);
assert(ref.loopPrice.length === 30, 'ref.loopPrice.length === 30');

var allEqOpt = true;
for (i = 0; i < ref.loopPrice.length; i++) {
  if (ref.loopPrice[i].bestPrice !== 2942.29) { allEqOpt = false; break; }
}
assert(allEqOpt, 'every loopPrice element has bestPrice === 2942.29');
assert(ref.accept !== null && ref.accept.length === 5001,
  'ref.accept.length === 5001');

var threwMissing = false;
try {
  integration.loadVB6Reference(3, 999);
} catch (e) {
  threwMissing = true;
}
assert(threwMissing, 'loadVB6Reference throws for missing scenario (H=3 fc=999)');

// ==========================================================================
// Group 4: compareDeep synthetic cases
// ==========================================================================
section('Group 4: compareDeep synthetic');
var vb6Loops = ref.loopPrice.map(function (r) { return r.loop; });
var vb6Costs = ref.loopPrice.map(function (r) { return r.bestPrice; });
var vb6Optimum = 2942.29;

// Build fake node result that perfectly matches VB6
function buildFakeMatch(loops, cost) {
  var trials = loops.map(function (loop, idx) {
    return {
      trial: idx + 1,
      seed: idx + 1,
      bestCost: cost,
      bestIter: loop,
      totalIter: 5000,
      validCount: 100, betterCount: 5, acceptedCount: 50,
      timeMs: 100, log: null
    };
  });
  return {
    H: 3, fc: 280,
    numTrials: trials.length, maxIterations: 5000,
    seedStrategy: 'deterministic',
    trials: trials,
    bestOverall: { cost: cost, trial: 1, iter: loops[0] },
    summary: {
      costMean: cost, costStd: 0, costMin: cost, costMax: cost,
      loopMean: 0, loopStd: 0, loopMin: 0, loopMax: 0,
      totalTimeMs: trials.length * 100
    }
  };
}

var fakeMatch = buildFakeMatch(vb6Loops, vb6Optimum);
var deep = integration.compareDeep(fakeMatch, vb6Loops, vb6Optimum, { vb6Costs: vb6Costs });
assert(deep.pass === true, 'compareDeep on identical synthetic: pass === true');
assert(deep.bestCostMatch.pass === true, 'deep.bestCostMatch.pass === true');
assert(deep.hitRate.pass === true, 'deep.hitRate.pass === true (30/30 vs 30/30)');
assert(deep.loopMWU.pPass === true, 'deep.loopMWU.pPass === true (p > 0.05)');
assert(deep.loopMWU.rPass === true, 'deep.loopMWU.rPass === true (r < 0.3, here r=0)');

// ==========================================================================
// Group 5: compareSmoke synthetic cases
// ==========================================================================
section('Group 5: compareSmoke synthetic');
// Shifted loops: vb6 + 50. Mean shift relative to vb6 mean (~318) = ~16% < 20%.
var shiftedLoops = vb6Loops.map(function (l) { return l + 50; });
var fakeShift = buildFakeMatch(shiftedLoops, vb6Optimum);
var smoke = integration.compareSmoke(fakeShift, vb6Loops, vb6Optimum, { vb6Costs: vb6Costs });
assert(smoke.pass === true, 'compareSmoke on shifted-loops fake: pass === true');
assert(smoke.loopMeanCheck.pass === true, 'smoke.loopMeanCheck.pass === true');
assert(smoke.loopMeanCheck.relDiff > 0, 'smoke.loopMeanCheck.relDiff > 0 (non-zero shift)');

// Failing case: best cost off by 10
var fakeFail = buildFakeMatch(vb6Loops, vb6Optimum + 10);
var smokeFail = integration.compareSmoke(fakeFail, vb6Loops, vb6Optimum, { vb6Costs: vb6Costs });
assert(smokeFail.pass === false, 'compareSmoke fails when bestCost off by 10');

// ==========================================================================
// Group 6: E2E small smoke (actually runs HCA)
// ==========================================================================
section('Group 6: E2E small smoke (2 trials x 500 iter, deterministic)');
var t0 = Date.now();
var result = integration.runScenario(3, 280, {
  numTrials: 2,
  maxIterations: 500,
  seedStrategy: 'deterministic'
});
var elapsed = Date.now() - t0;

assert(result.trials.length === 2, 'result.trials.length === 2');
assert(result.trials[0].seed === 1, 'trials[0].seed === 1');
assert(result.trials[1].seed === 2, 'trials[1].seed === 2');
assert(result.trials[0].bestCost > 0 && isFinite(result.trials[0].bestCost),
  'trials[0].bestCost > 0 and finite (got ' + result.trials[0].bestCost + ')');
assert(result.bestOverall.cost <= result.trials[0].bestCost,
  'bestOverall.cost <= trials[0].bestCost');
assert(result.summary.totalTimeMs < 10000,
  'summary.totalTimeMs < 10000ms (got ' + result.summary.totalTimeMs + ')');
assert(elapsed < 10000, 'wall-clock smoke under 10s (got ' + elapsed + 'ms)');

// ==========================================================================
// Group 7: Fisher hit-rate in compareDeep / compareSmoke
// ==========================================================================
section('Group 7: Fisher hit-rate in comparators');

(function () {
  // Synthetic case: Node 10/10 hits, VB6 10/10 hits, identical loops -> PASS
  // (use identical loop sequences so MWU also passes alongside the new hit-rate check)
  var synthNodeResult = {
    bestOverall: { cost: 1000.00, trial: 1, iter: 50 },
    trials: []
  };
  var i;
  for (i = 1; i <= 10; i++) {
    synthNodeResult.trials.push({
      trial: i, bestCost: 1000.00, bestIter: 40 + i
    });
  }
  var vCosts = [];
  var vLoops = [];
  for (i = 1; i <= 10; i++) {
    vCosts.push(1000.00);
    vLoops.push(40 + i);
  }
  var v = integration.compareDeep(synthNodeResult, vLoops, 1000.00,
    { vb6Costs: vCosts });
  assert(v.pass === true, 'compareDeep synthetic 10/10 vs 10/10 passes');
  assert(v.hitRate.nodeHits === 10, 'nodeHits=10');
  assert(v.hitRate.vb6Hits === 10, 'vb6Hits=10');
  assert(v.hitRate.fisherP === 1.0, 'fisherP=1.0 identical');
})();

(function () {
  // Synthetic: Node 0/10, VB6 10/10 -> FAIL (extreme difference)
  var synthNodeResult = {
    bestOverall: { cost: 1050.00, trial: 1, iter: 50 },
    trials: []
  };
  var i;
  for (i = 1; i <= 10; i++) {
    synthNodeResult.trials.push({
      trial: i, bestCost: 1050.00, bestIter: 40 + i
    });
  }
  var vCosts = [];
  var vLoops = [];
  for (i = 0; i < 10; i++) {
    vCosts.push(1000.00);
    vLoops.push(45 + i);
  }
  var v = integration.compareSmoke(synthNodeResult, vLoops, 1000.00,
    { vb6Costs: vCosts });
  assert(v.pass === false, 'compareSmoke extreme (Node 0/10, VB6 10/10) fails');
  assert(v.bestCostMatch.pass === false, 'bestCostMatch fails');
  assert(v.hitRate.pass === false, 'hitRate fails');
})();

(function () {
  // Synthetic: Node 3/10 hits, VB6 4/10 hits (compatible via Fisher)
  // Simulates the H=5 fc=240 scenario pattern
  var synthNodeResult = {
    bestOverall: { cost: 1000.00, trial: 1, iter: 50 },
    trials: []
  };
  var i;
  // 3 hits, 7 misses at 1010
  synthNodeResult.trials.push({ trial: 1, bestCost: 1000.00, bestIter: 30 });
  synthNodeResult.trials.push({ trial: 2, bestCost: 1000.00, bestIter: 35 });
  synthNodeResult.trials.push({ trial: 3, bestCost: 1000.00, bestIter: 40 });
  for (i = 4; i <= 10; i++) {
    synthNodeResult.trials.push({ trial: i, bestCost: 1010.00, bestIter: 45 });
  }
  // VB6: 4 hits, 6 misses at 1010
  var vCosts = [1000.00, 1000.00, 1000.00, 1000.00, 1010.00, 1010.00,
                1010.00, 1010.00, 1010.00, 1010.00];
  var vLoops = [30, 35, 40, 50, 42, 43, 44, 45, 46, 47];
  var v = integration.compareDeep(synthNodeResult, vLoops, 1000.00,
    { vb6Costs: vCosts });
  assert(v.hitRate.nodeHits === 3, 'nodeHits=3');
  assert(v.hitRate.vb6Hits === 4, 'vb6Hits=4');
  assert(v.hitRate.fisherP > 0.5, 'fisherP > 0.5 compatible, got ' + v.hitRate.fisherP);
})();

(function () {
  // Missing vb6Costs -> throws
  var synthResult = {
    bestOverall: { cost: 1000, trial: 1, iter: 50 },
    trials: [{ trial: 1, bestCost: 1000, bestIter: 50 }]
  };
  var threw = false;
  try {
    integration.compareDeep(synthResult, [50], 1000);
  } catch (e) { threw = true; }
  assert(threw, 'compareDeep throws when vb6Costs missing');
})();

console.log('compare*/Fisher hit-rate: 4 cases checked');

// ==========================================================================
// Group 8: scenario-specific smoke profile + deferred bestCostMatch
// ==========================================================================
section('Group 8: getSmokeProfile + deferred bestCostMatch');

(function () {
  var p1 = integration.getSmokeProfile(3, 240);
  assert(p1.meanTolerance === 0.20, 'smoke profile H=3 mean tol=0.20');
  assert(p1.requiresExtendedRun === false, 'smoke profile H=3 no extended');

  var p2 = integration.getSmokeProfile(4, 320);
  assert(p2.meanTolerance === 0.20, 'smoke profile H=4 mean tol=0.20');
  assert(p2.requiresExtendedRun === false, 'smoke profile H=4 no extended');

  var p3 = integration.getSmokeProfile(5, 240);
  assert(p3.meanTolerance === 0.30, 'smoke profile H=5 fc=240 tol=0.30');
  assert(p3.requiresExtendedRun === true, 'smoke profile H=5 fc=240 extended');

  var p4 = integration.getSmokeProfile(5, 320);
  assert(p4.meanTolerance === 0.30, 'smoke profile H=5 fc=320 tol=0.30');
  assert(p4.requiresExtendedRun === false, 'smoke profile H=5 fc=320 no extended');
})();

(function () {
  // Synthetic: Node 0/10 hit, VB6 3/10 hit, bestCost gap exists
  // With requiresExtendedRun=true -> bestCostMatch deferred, overall may pass
  var synthNode = {
    bestOverall: { cost: 1050, trial: 1, iter: 5000 },
    trials: []
  };
  var i;
  for (i = 1; i <= 10; i++) {
    synthNode.trials.push({ trial: i, bestCost: 1050, bestIter: 1000 + i * 100 });
  }
  var vCosts = [1000, 1000, 1000, 1050, 1050, 1050, 1050, 1050, 1050, 1050];
  var vLoops = [1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400];

  // Without deferral: should fail bestCostMatch
  var vStrict = integration.compareSmoke(synthNode, vLoops, 1000,
    { vb6Costs: vCosts });
  assert(vStrict.bestCostMatch.pass === false, 'strict smoke fails bestCost');
  assert(vStrict.bestCostMatch.deferred === false, 'strict not deferred');

  // With deferral: bestCostMatch passes (deferred), overall decision depends on others
  var vDeferred = integration.compareSmoke(synthNode, vLoops, 1000,
    { vb6Costs: vCosts, requiresExtendedRun: true });
  assert(vDeferred.bestCostMatch.pass === true, 'deferred smoke bestCost passes');
  assert(vDeferred.bestCostMatch.deferred === true, 'deferred flag set');
  assert(vDeferred.deferred === true, 'top-level deferred flag set');
})();

console.log('smoke scenario profile: 2 case-blocks checked');

// ==========================================================================
// Step 10.2 Wave 1 -- loadVB6Reference algo param
// ==========================================================================
section('Step 10.2 Wave 1: loadVB6Reference algo param');

// T-W1-01: no algo arg -> defaults to HCA (backward compat)
(function () {
  var result = integration.loadVB6Reference(3, 280, path.join(__dirname, '..', '..', 'vb6_samples'));
  assert(Array.isArray(result.loopPrice), 'W1-01: loopPrice is array');
  assert(result.loopPrice.length === 30, 'W1-01: 30 HCA trials');
  assert(result.loopPrice[0].trial === 1, 'W1-01: first row trial=1');
  console.log('PASS: W1-01 no algo arg defaults to HCA');
})();

// T-W1-02: algo="HCA" -> same as no arg
(function () {
  var a = integration.loadVB6Reference(3, 280, path.join(__dirname, '..', '..', 'vb6_samples'));
  var b = integration.loadVB6Reference(3, 280, path.join(__dirname, '..', '..', 'vb6_samples'), 'HCA');
  assert(a.loopPrice.length === b.loopPrice.length, 'W1-02: same row count');
  assert(a.loopPrice[0].bestPrice === b.loopPrice[0].bestPrice, 'W1-02: same first price');
  assert(a.loopPrice[29].bestPrice === b.loopPrice[29].bestPrice, 'W1-02: same last price');
  console.log('PASS: W1-02 algo=HCA matches default');
})();

// T-W1-03: algo="BA" + H=3 fc=280 -> loads BA file, correct optimum
(function () {
  var result = integration.loadVB6Reference(3, 280, path.join(__dirname, '..', '..', 'vb6_samples'), 'BA');
  assert(Array.isArray(result.loopPrice), 'W1-03: loopPrice array');
  assert(result.loopPrice.length === 30, 'W1-03: 30 BA trials');
  var prices = result.loopPrice.map(function (r) { return r.bestPrice; });
  var minPrice = Math.min.apply(null, prices);
  assert(Math.abs(minPrice - 2942.29) < 0.01, 'W1-03: BA optimum = 2942.29 (got ' + minPrice + ')');
  console.log('PASS: W1-03 algo=BA loads H3 fc280 with optimum 2942.29');
})();

// T-W1-04: algo="BA" + all 9 scenarios exist (prerequisite check)
(function () {
  var H_values = [3, 4, 5];
  var fc_values = [240, 280, 320];
  var count = 0;
  var i, j;
  for (i = 0; i < H_values.length; i++) {
    for (j = 0; j < fc_values.length; j++) {
      var r = integration.loadVB6Reference(H_values[i], fc_values[j],
        path.join(__dirname, '..', '..', 'vb6_samples'), 'BA');
      assert(r.loopPrice.length === 30,
        'W1-04: BA H=' + H_values[i] + ' fc=' + fc_values[j] + ' has 30 trials');
      count = count + 1;
    }
  }
  assert(count === 9, 'W1-04: all 9 BA scenarios loaded');
  console.log('PASS: W1-04 all 9 BA scenarios load successfully');
})();

// T-W1-05: unknown algo throws clear error
(function () {
  var threw = false;
  var errMsg = '';
  try {
    integration.loadVB6Reference(3, 280, path.join(__dirname, '..', '..', 'vb6_samples'), 'XYZ');
  } catch (err) {
    threw = true;
    errMsg = err.message;
  }
  assert(threw, 'W1-05: unknown algo should throw');
  assert(errMsg.indexOf('unknown algo') !== -1, 'W1-05: error mentions unknown algo');
  assert(errMsg.indexOf('XYZ') !== -1, 'W1-05: error includes the bad value');
  console.log('PASS: W1-05 unknown algo throws clear error');
})();

// T-W1-06: missing BA file throws "missing loopPrice" error
(function () {
  var threw = false;
  var errMsg = '';
  try {
    // H=99 does not exist in vb6_samples -> BA file missing
    integration.loadVB6Reference(99, 280, path.join(__dirname, '..', '..', 'vb6_samples'), 'BA');
  } catch (err) {
    threw = true;
    errMsg = err.message;
  }
  assert(threw, 'W1-06: missing BA file should throw');
  assert(errMsg.indexOf('missing loopPrice') !== -1, 'W1-06: error mentions missing loopPrice');
  assert(errMsg.indexOf('BA') !== -1, 'W1-06: error filename includes algo prefix BA');
  console.log('PASS: W1-06 missing BA file throws clear error');
})();

// ==========================================================================
// Step 10.2 Wave 2 -- runScenarioBA
// ==========================================================================
section('Step 10.2 Wave 2: runScenarioBA');

// T-W2-01: runScenarioBA basic return shape
(function () {
  var r = integration.runScenarioBA(3, 280, {
    numTrials: 1,
    maxIterations: 200,
    seedStrategy: 'deterministic'
  });
  assert(typeof r === 'object' && r !== null, 'W2-01: returns object');
  assert(r.algo === 'BA', 'W2-01: algo="BA" (got ' + r.algo + ')');
  assert(r.H === 3 && r.fc === 280, 'W2-01: H and fc preserved');
  assert(Array.isArray(r.trials) && r.trials.length === 1, 'W2-01: trials length 1');
  assert(typeof r.bestOverall === 'object' && typeof r.bestOverall.cost === 'number',
    'W2-01: bestOverall.cost is number');
  assert(typeof r.summary === 'object' && typeof r.summary.costMean === 'number',
    'W2-01: summary.costMean is number');
  console.log('PASS: W2-01 basic shape');
})();

// T-W2-02: trial entry shape
(function () {
  var r = integration.runScenarioBA(3, 280, {
    numTrials: 1,
    maxIterations: 200,
    seedStrategy: 'deterministic'
  });
  var t = r.trials[0];
  assert(t.trial === 1, 'W2-02: trial === 1');
  assert(t.seed === 1, 'W2-02: deterministic seed === 1');
  assert(typeof t.bestCost === 'number', 'W2-02: bestCost is number');
  assert(typeof t.bestIter === 'number' && t.bestIter >= 0, 'W2-02: bestIter >= 0');
  assert(t.totalIter === 200, 'W2-02: totalIter === 200');
  assert(typeof t.validCount === 'number', 'W2-02: validCount is number');
  assert(typeof t.betterCount === 'number', 'W2-02: betterCount is number');
  assert(typeof t.acceptedCount === 'number', 'W2-02: acceptedCount is number');
  assert(typeof t.timeMs === 'number' && t.timeMs >= 0, 'W2-02: timeMs >= 0');
  assert(t.log === null, 'W2-02: log null when keepIterationLogs default');
  console.log('PASS: W2-02 trial entry shape');
})();

// T-W2-03: deterministic reproducibility -- same seed gives same result
(function () {
  var opts = {
    numTrials: 2,
    maxIterations: 300,
    seedStrategy: 'deterministic'
  };
  var r1 = integration.runScenarioBA(3, 280, opts);
  var r2 = integration.runScenarioBA(3, 280, opts);
  assert(r1.bestOverall.cost === r2.bestOverall.cost,
    'W2-03: bestOverall.cost reproducible (' + r1.bestOverall.cost + ' vs ' + r2.bestOverall.cost + ')');
  assert(r1.trials[0].bestCost === r2.trials[0].bestCost, 'W2-03: trial 1 bestCost reproducible');
  assert(r1.trials[0].bestIter === r2.trials[0].bestIter, 'W2-03: trial 1 bestIter reproducible');
  assert(r1.trials[1].bestCost === r2.trials[1].bestCost, 'W2-03: trial 2 bestCost reproducible');
  console.log('PASS: W2-03 deterministic reproducibility');
})();

// T-W2-04: BA reaches VB6 global optimum for H=3 fc=280 at modest iter budget
// Reference: ba.js Test 45 verified baOptimize@500 iter finds 2942.29.
// We run 3 trials at 1000 iter -- at least one should hit the optimum.
(function () {
  var r = integration.runScenarioBA(3, 280, {
    numTrials: 3,
    maxIterations: 1000,
    seedStrategy: 'deterministic'
  });
  var optimum = 2942.29;
  var hits = 0;
  var i;
  for (i = 0; i < r.trials.length; i++) {
    if (Math.abs(r.trials[i].bestCost - optimum) < 0.01) hits = hits + 1;
  }
  assert(hits >= 1, 'W2-04: at least 1/3 trials hit optimum (got ' + hits + ', costs=' +
    r.trials.map(function (t) { return t.bestCost.toFixed(2); }).join(',') + ')');
  assert(r.bestOverall.cost <= optimum + 0.01,
    'W2-04: bestOverall.cost <= optimum+0.01 (got ' + r.bestOverall.cost + ')');
  assert(isFinite(r.bestOverall.cost), 'W2-04: bestOverall.cost finite');
  console.log('PASS: W2-04 BA reaches optimum (hits=' + hits + '/3)');
})();

// T-W2-05: runScenarioBA differs from runScenario (proves separate code path)
(function () {
  var opts = {
    numTrials: 2,
    maxIterations: 500,
    seedStrategy: 'deterministic'
  };
  var baRes = integration.runScenarioBA(3, 280, opts);
  var hcaRes = integration.runScenario(3, 280, opts);
  assert(baRes.algo === 'BA', 'W2-05: BA result has algo="BA"');
  assert(typeof hcaRes.algo === 'undefined',
    'W2-05: HCA result has no algo field (backward compat)');
  assert(baRes.trials.length === hcaRes.trials.length, 'W2-05: same trial count');
  // At least one trial has a different bestIter -- BA outer-loop reset pattern
  // produces very different iteration dynamics than HCA under the same seed.
  var anyDifferent = false;
  var i;
  for (i = 0; i < baRes.trials.length; i++) {
    if (baRes.trials[i].bestIter !== hcaRes.trials[i].bestIter) {
      anyDifferent = true; break;
    }
  }
  assert(anyDifferent, 'W2-05: at least one trial has different bestIter (BA vs HCA)');
  console.log('PASS: W2-05 BA differs from HCA (separate code path verified)');
})();

// T-W2-06: keepIterationLogs flag -- false => log null, true => log populated
(function () {
  var base = {
    numTrials: 1,
    maxIterations: 100,
    seedStrategy: 'deterministic'
  };
  var rOff = integration.runScenarioBA(3, 280, base);
  assert(rOff.trials[0].log === null, 'W2-06: log null when keepIterationLogs not set');

  var withLogs = {
    numTrials: 1,
    maxIterations: 100,
    seedStrategy: 'deterministic',
    keepIterationLogs: true
  };
  var rOn = integration.runScenarioBA(3, 280, withLogs);
  assert(Array.isArray(rOn.trials[0].log), 'W2-06: log is array when keepIterationLogs=true');
  assert(rOn.trials[0].log.length > 0, 'W2-06: log non-empty');
  assert(typeof rOn.trials[0].log[0].iter === 'number', 'W2-06: log entry has iter field');
  console.log('PASS: W2-06 keepIterationLogs flag');
})();

// T-W2-07: onProgress callback -- called once per trial with (trialNum, bestSoFar, trialMs)
(function () {
  var callCount = 0;
  var lastTrialNum = -1;
  var lastBestSoFar = -1;
  var lastTrialMs = -1;
  integration.runScenarioBA(3, 280, {
    numTrials: 3,
    maxIterations: 100,
    seedStrategy: 'deterministic',
    onProgress: function (trialNum, bestSoFar, trialMs) {
      callCount = callCount + 1;
      lastTrialNum = trialNum;
      lastBestSoFar = bestSoFar;
      lastTrialMs = trialMs;
    }
  });
  assert(callCount === 3, 'W2-07: onProgress called 3 times (got ' + callCount + ')');
  assert(lastTrialNum === 3, 'W2-07: last trialNum === 3');
  assert(typeof lastBestSoFar === 'number' && lastBestSoFar > 0,
    'W2-07: bestSoFar passed as positive number');
  assert(typeof lastTrialMs === 'number' && lastTrialMs >= 0, 'W2-07: trialMs passed as number');
  console.log('PASS: W2-07 onProgress callback');
})();

// T-W2-08: runScenarioBA is exported
(function () {
  assert(typeof integration.runScenarioBA === 'function',
    'W2-08: runScenarioBA is exported as function');
  // Sanity check -- exports object still includes runScenario too (backward compat)
  assert(typeof integration.runScenario === 'function',
    'W2-08: runScenario still exported');
  console.log('PASS: W2-08 runScenarioBA exported');
})();

// ==========================================================================
// Summary
// ==========================================================================
console.log('');
console.log('Total: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) process.exit(1);
