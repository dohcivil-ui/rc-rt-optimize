// extended_run.js -- Companion convergence study for deferred scenarios
// Step 9.5.4 support: runs H=5 fc=240 (and any future flagged scenarios)
// at 20000 iterations to validate that Node CAN reach VB6 global optimum
// given an adequate iteration budget.

var path = require('path');
var fs = require('fs');
var integration = require('../src/integration');
var csv = require('../src/csv');

var SCRIPT_DIR = __dirname;
var BACKEND_DIR = path.join(SCRIPT_DIR, '..');
var OUT_ROOT = path.join(BACKEND_DIR, 'out', 'step_9_5');
var OUT_EXT = path.join(OUT_ROOT, 'extended');
var VB6_DIR = path.join(BACKEND_DIR, '..', 'vb6_samples');

var EXTENDED_ITERATIONS = 20000;

// Determine which scenarios need extended runs (from getSmokeProfile)
function getExtendedScenarios() {
  var out = [];
  var i;
  for (i = 0; i < integration.PRIMARY_SCENARIOS.length; i++) {
    var sc = integration.PRIMARY_SCENARIOS[i];
    var profile = integration.getSmokeProfile(sc.H, sc.fc);
    if (profile.requiresExtendedRun) out.push(sc);
  }
  return out;
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
function fmt(n, d) {
  if (typeof d === 'undefined') d = 2;
  return Number(n).toFixed(d);
}
function fmtTime(ms) {
  var s = ms / 1000;
  if (s < 60) return fmt(s, 1) + 's';
  var m = Math.floor(s / 60);
  return m + 'm ' + fmt(s - m * 60, 1) + 's';
}

ensureDir(OUT_EXT);

var scenarios = getExtendedScenarios();
console.log('========================================');
console.log('Step 9.5.4 -- Extended Convergence Study');
console.log(scenarios.length + ' deferred scenario(s) x 30 trials x ' +
  EXTENDED_ITERATIONS + ' iterations');
console.log('Purpose: validate Node can reach VB6 global optimum with extended budget');
console.log('========================================');
console.log('');

var extendedVerdicts = [];
var runStart = Date.now();
var i;

for (i = 0; i < scenarios.length; i++) {
  var sc = scenarios[i];
  var scStart = Date.now();
  var tag = '[' + (i + 1) + '/' + scenarios.length + '] H=' + sc.H + ' fc=' + sc.fc;
  console.log(tag + ' -- extended run starting...');

  var nodeResult;
  try {
    nodeResult = integration.runScenario(sc.H, sc.fc, {
      numTrials: 30,
      maxIterations: EXTENDED_ITERATIONS,
      seedStrategy: 'deterministic',
      onProgress: function (trialNum, bestSoFar, trialMs) {
        if (trialNum % 5 === 0 || trialNum === 30) {
          var el = Date.now() - scStart;
          console.log('    trial ' + trialNum + '/30: best=' + fmt(bestSoFar) +
            ' (elapsed ' + fmtTime(el) + ')');
        }
      }
    });
  } catch (err) {
    console.log('    ERROR: ' + err.message);
    extendedVerdicts.push({ H: sc.H, fc: sc.fc, error: err.message });
    continue;
  }

  // Load VB6 reference for comparison
  var vb6Ref = integration.loadVB6Reference(sc.H, sc.fc, VB6_DIR);
  var vb6Costs = vb6Ref.loopPrice.map(function (r) { return r.bestPrice; });
  var vb6Optimum = Math.min.apply(null, vb6Costs);

  // Export CSVs
  var extVB6Path = path.join(OUT_EXT,
    'loopPrice-HCA-H' + sc.H + '-' + sc.fc + '-ext.csv');
  var loopRows = nodeResult.trials.map(function (t) {
    return { trial: t.trial, loop: t.bestIter, bestPrice: t.bestCost };
  });
  csv.exportLoopPrice(loopRows, extVB6Path);

  var extRichPath = path.join(OUT_EXT,
    'trials-HCA-H' + sc.H + '-' + sc.fc + '-ext.csv');
  csv.exportTrialsRich(nodeResult.trials, extRichPath);

  // Hit-rate analysis
  var hits = 0;
  var j;
  for (j = 0; j < nodeResult.trials.length; j++) {
    if (Math.abs(nodeResult.trials[j].bestCost - vb6Optimum) < 0.01) hits++;
  }
  var gap = nodeResult.bestOverall.cost - vb6Optimum;
  var elapsed = Date.now() - scStart;

  var hitRatePct = (hits / 30 * 100).toFixed(1);
  console.log('    done in ' + fmtTime(elapsed) + ':');
  console.log('      bestOverall: ' + fmt(nodeResult.bestOverall.cost) +
    ' (gap ' + fmt(gap) + ' baht)');
  console.log('      hit-rate: ' + hits + '/30 (' + hitRatePct + '%)');
  console.log('      bestIter among hits: see rich CSV');

  var verdict = {
    H: sc.H,
    fc: sc.fc,
    iterations: EXTENDED_ITERATIONS,
    numTrials: 30,
    nodeOptimum: nodeResult.bestOverall.cost,
    vb6Optimum: vb6Optimum,
    gap: gap,
    reachedOptimum: Math.abs(gap) < 0.01,
    hits: hits,
    hitRatePct: hits / 30 * 100,
    loopMean: nodeResult.summary.loopMean,
    loopMin: nodeResult.summary.loopMin,
    loopMax: nodeResult.summary.loopMax,
    elapsedMs: elapsed
  };
  extendedVerdicts.push(verdict);
  console.log('');
}

var totalTime = Date.now() - runStart;
console.log('========================================');
console.log('Extended study complete: ' + fmtTime(totalTime));
console.log('========================================');
var e;
for (e = 0; e < extendedVerdicts.length; e++) {
  var ev = extendedVerdicts[e];
  if (ev.error) {
    console.log('[ERR] H=' + ev.H + ' fc=' + ev.fc + ' ' + ev.error);
  } else {
    var icon = ev.reachedOptimum ? '[REACHED]' : '[PARTIAL]';
    console.log(icon + ' H=' + ev.H + ' fc=' + ev.fc +
      ' gap=' + fmt(ev.gap) + ' hits=' + ev.hits + '/30');
  }
}

// Persist for report
var extVerdictsPath = path.join(OUT_ROOT, 'extended_verdicts.json');
fs.writeFileSync(extVerdictsPath, JSON.stringify({
  runDate: new Date().toISOString(),
  iterations: EXTENDED_ITERATIONS,
  scenarios: extendedVerdicts,
  totalRuntimeMs: totalTime
}, null, 2));
console.log('');
console.log('Extended verdicts JSON: ' + extVerdictsPath);
console.log('Extended CSVs: ' + OUT_EXT);
