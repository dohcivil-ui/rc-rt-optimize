// test_integration.js — validate integration module (Step 9.5.3a)
// Plain Node, custom assert, console output. Smoke-tests HCA via runScenario
// at small scale (2 trials x 500 iter) to keep the test under a few seconds.

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
// Summary
// ==========================================================================
console.log('');
console.log('Total: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) process.exit(1);
