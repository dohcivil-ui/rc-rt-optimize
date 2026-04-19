// run_step_9_5.js — Full validation matrix runner (Step 9.5.3b)
// Runs 9 primary scenarios x 30 trials x 5000 iterations against VB6 reference.
// Exports VB6-compat and rich CSVs; prints verdict summary.

var path = require('path');
var fs = require('fs');
var integration = require('../src/integration');
var csv = require('../src/csv');

var SCRIPT_DIR = __dirname;
var BACKEND_DIR = path.join(SCRIPT_DIR, '..');
var OUT_ROOT = path.join(BACKEND_DIR, 'out', 'step_9_5');
var OUT_VB6 = path.join(OUT_ROOT, 'vb6_compat');
var OUT_RICH = path.join(OUT_ROOT, 'rich');
var VB6_DIR = path.join(BACKEND_DIR, '..', 'vb6_samples');

// --- helpers -------------------------------------------------------------
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
function meanOf(arr) {
  if (arr.length === 0) return 0;
  var s = 0, i;
  for (i = 0; i < arr.length; i++) s = s + arr[i];
  return s / arr.length;
}

ensureDir(OUT_VB6);
ensureDir(OUT_RICH);

// --- run -----------------------------------------------------------------
var scenarios = integration.PRIMARY_SCENARIOS;
var verdicts = [];
var runStart = Date.now();

console.log('========================================');
console.log('Step 9.5.3b -- Full Validation Matrix');
console.log('9 scenarios x 30 trials x 5000 iter');
console.log('VB6 ref dir: ' + VB6_DIR);
console.log('Output dir:  ' + OUT_ROOT);
console.log('========================================');
console.log('');

var i;
for (i = 0; i < scenarios.length; i++) {
  var sc = scenarios[i];
  var scStart = Date.now();
  var tag = '[' + (i + 1) + '/9] H=' + sc.H + ' fc=' + sc.fc;
  console.log(tag + ' -- starting...');

  // 1) Run Node.js optimization
  var nodeResult;
  try {
    nodeResult = integration.runScenario(sc.H, sc.fc, {
      numTrials: 30,
      maxIterations: 5000,
      seedStrategy: 'deterministic',
      onProgress: function (trialNum, bestSoFar, trialMs) {
        if (trialNum % 10 === 0 || trialNum === 30) {
          var elapsed = Date.now() - scStart;
          console.log('    trial ' + trialNum + '/30: best=' + fmt(bestSoFar) +
            ' (elapsed ' + fmtTime(elapsed) + ')');
        }
      }
    });
  } catch (err) {
    console.log('    ERROR runScenario: ' + err.message);
    verdicts.push({ H: sc.H, fc: sc.fc, mode: '-', pass: false, error: err.message });
    console.log('');
    continue;
  }

  // 2) Load VB6 reference
  var vb6Ref;
  try {
    vb6Ref = integration.loadVB6Reference(sc.H, sc.fc, VB6_DIR);
  } catch (err) {
    console.log('    ERROR loadVB6Reference: ' + err.message);
    verdicts.push({ H: sc.H, fc: sc.fc, mode: '-', pass: false, error: err.message });
    console.log('');
    continue;
  }

  var vb6Loops = vb6Ref.loopPrice.map(function (r) { return r.loop; });
  var vb6Prices = vb6Ref.loopPrice.map(function (r) { return r.bestPrice; });
  var vb6Optimum = Math.min.apply(null, vb6Prices);
  var vb6LoopMean = meanOf(vb6Loops);

  // 3) Compare (deep for fc=280, smoke otherwise)
  var isDeep = (sc.fc === 280);
  var compareOpts;
  var verdict;
  if (isDeep) {
    compareOpts = { vb6Costs: vb6Prices };
    verdict = integration.compareDeep(nodeResult, vb6Loops, vb6Optimum, compareOpts);
  } else {
    var smokeProfile = integration.getSmokeProfile(sc.H, sc.fc);
    compareOpts = {
      vb6Costs: vb6Prices,
      meanTolerance: smokeProfile.meanTolerance,
      requiresExtendedRun: smokeProfile.requiresExtendedRun
    };
    verdict = integration.compareSmoke(nodeResult, vb6Loops, vb6Optimum, compareOpts);
  }

  // 4) Export CSVs
  var vb6OutPath = path.join(OUT_VB6,
    'loopPrice-HCA-H' + sc.H + '-' + sc.fc + '.csv');
  var loopRows = nodeResult.trials.map(function (t) {
    return { trial: t.trial, loop: t.bestIter, bestPrice: t.bestCost };
  });
  csv.exportLoopPrice(loopRows, vb6OutPath);

  var richOutPath = path.join(OUT_RICH,
    'trials-HCA-H' + sc.H + '-' + sc.fc + '.csv');
  csv.exportTrialsRich(nodeResult.trials, richOutPath);

  // 5) Print verdict line
  var elapsed = Date.now() - scStart;
  var mode = isDeep ? 'DEEP ' : 'SMOKE';
  var icon;
  if (verdict.pass && verdict.deferred) {
    icon = 'PASS*';
  } else if (verdict.pass) {
    icon = 'PASS ';
  } else {
    icon = 'FAIL ';
  }
  var nodeHits = verdict.hitRate.nodeHits;
  var vb6Hits = verdict.hitRate.vb6Hits;
  var fisherP = verdict.hitRate.fisherP;

  var line = '    [' + icon + '] ' + mode +
    ' node=' + fmt(nodeResult.bestOverall.cost) +
    ' vb6=' + fmt(vb6Optimum) +
    ' hits N/V=' + nodeHits + '/' + vb6Hits + '/30' +
    ' fisherP=' + fmt(fisherP, 3);
  if (isDeep) {
    line += ' MWU p=' + fmt(verdict.loopMWU.p, 3) +
            ' r=' + fmt(verdict.loopMWU.r, 3);
  } else {
    line += ' loopMean relDiff=' +
            fmt(verdict.loopMeanCheck.relDiff * 100, 1) + '%';
  }
  line += ' (' + fmtTime(elapsed) + ')';
  console.log(line);

  if (!verdict.pass) {
    console.log('    FAIL reasons:');
    var r;
    for (r = 0; r < verdict.reasons.length; r++) {
      console.log('      - ' + verdict.reasons[r]);
    }
  }

  verdicts.push({
    H: sc.H, fc: sc.fc, mode: mode.trim(), pass: verdict.pass,
    deferred: verdict.deferred === true,
    nodeCost: nodeResult.bestOverall.cost, vb6Cost: vb6Optimum,
    nodeHits: nodeHits, vb6Hits: vb6Hits, trials: 30,
    fisherP: fisherP, fisherOR: verdict.hitRate.oddsRatio,
    nodeLoopMean: nodeResult.summary.loopMean,
    vb6LoopMean: vb6LoopMean,
    mwuP: isDeep ? verdict.loopMWU.p : null,
    mwuR: isDeep ? verdict.loopMWU.r : null,
    loopRelDiff: !isDeep ? verdict.loopMeanCheck.relDiff : null,
    meanTolerance: !isDeep ? (compareOpts.meanTolerance || 0.20) : null,
    elapsedMs: elapsed
  });
  console.log('');
}

// --- summary -------------------------------------------------------------
var totalTime = Date.now() - runStart;
var passCount = 0;
var v;
for (v = 0; v < verdicts.length; v++) {
  if (verdicts[v].pass) passCount = passCount + 1;
}

console.log('========================================');
console.log('SUMMARY: ' + passCount + '/9 PASS | total runtime: ' + fmtTime(totalTime));
console.log('========================================');
var anyDeferred = false;
for (v = 0; v < verdicts.length; v++) {
  var vd = verdicts[v];
  var mark;
  if (vd.pass && vd.deferred) {
    mark = '[PASS*]'; anyDeferred = true;
  } else if (vd.pass) {
    mark = '[PASS]';
  } else {
    mark = '[FAIL]';
  }
  console.log(mark + ' H=' + vd.H + ' fc=' + vd.fc + ' (' + vd.mode + ')' +
    (vd.error ? ' ERROR: ' + vd.error : ''));
}
if (anyDeferred) {
  console.log('');
  console.log('  * = bestCostMatch deferred to extended run ' +
    '(see scripts/extended_run.js)');
}
console.log('');
console.log('CSVs written to:');
console.log('  ' + OUT_VB6);
console.log('  ' + OUT_RICH);

// Persist verdicts for 9.5.4 report generation
var verdictsPath = path.join(OUT_ROOT, 'verdicts.json');
fs.writeFileSync(verdictsPath, JSON.stringify({
  runDate: new Date().toISOString(),
  config: {
    numTrials: 30,
    maxIterations: 5000,
    seedStrategy: 'deterministic'
  },
  scenarios: verdicts,
  passCount: passCount,
  totalCount: verdicts.length,
  totalRuntimeMs: totalTime
}, null, 2));
console.log('');
console.log('Verdicts JSON: ' + verdictsPath);

process.exit(passCount === 9 ? 0 : 1);
