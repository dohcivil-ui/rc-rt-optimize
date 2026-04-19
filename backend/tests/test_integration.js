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
var deep = integration.compareDeep(fakeMatch, vb6Loops, vb6Optimum);
assert(deep.pass === true, 'compareDeep on identical synthetic: pass === true');
assert(deep.bestCostMatch.pass === true, 'deep.bestCostMatch.pass === true');
assert(deep.allTrialsMatch.pass === true, 'deep.allTrialsMatch.pass === true');
assert(deep.loopMWU.pPass === true, 'deep.loopMWU.pPass === true (p > 0.05)');
assert(deep.loopMWU.rPass === true, 'deep.loopMWU.rPass === true (r < 0.3, here r=0)');

// ==========================================================================
// Group 5: compareSmoke synthetic cases
// ==========================================================================
section('Group 5: compareSmoke synthetic');
// Shifted loops: vb6 + 50. Mean shift relative to vb6 mean (~318) = ~16% < 20%.
var shiftedLoops = vb6Loops.map(function (l) { return l + 50; });
var fakeShift = buildFakeMatch(shiftedLoops, vb6Optimum);
var smoke = integration.compareSmoke(fakeShift, vb6Loops, vb6Optimum);
assert(smoke.pass === true, 'compareSmoke on shifted-loops fake: pass === true');
assert(smoke.loopMeanCheck.pass === true, 'smoke.loopMeanCheck.pass === true');
assert(smoke.loopMeanCheck.relDiff > 0, 'smoke.loopMeanCheck.relDiff > 0 (non-zero shift)');

// Failing case: best cost off by 10
var fakeFail = buildFakeMatch(vb6Loops, vb6Optimum + 10);
var smokeFail = integration.compareSmoke(fakeFail, vb6Loops, vb6Optimum);
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
// Summary
// ==========================================================================
console.log('');
console.log('Total: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) process.exit(1);
