// run_trajectories.js -- per-iteration best-so-far trajectories for HCA vs BA.
// Runs the 9-scenario matrix with keepIterationLogs=true, builds a
// running-min array per trial (best valid cost seen in iterations 0..i),
// and writes a single JSON to out/step_11/trajectories.json for
// convergence-curve plotting.
//
// Pure Node built-ins. No npm install.

var fs = require('fs');
var path = require('path');
var integration = require('../src/integration');

var OUT_DIR = path.join(__dirname, '..', 'out', 'step_11');
var OUT_FILE = path.join(OUT_DIR, 'trajectories.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Extract best-so-far array from one trial's log.
// Input: log -- res.log (each entry has {iter, cost, valid, ...})
//        maxIter -- target length (pad with last value if log is shorter).
// Output: Array of length maxIter where bestSoFar[i] = min cost seen in
// iterations 0..i among VALID designs. Before the first valid design is
// encountered, the value stays Infinity (sentinel); downstream plotting
// code should clamp or skip these leading Infinities as appropriate.
function buildBestSoFar(log, maxIter) {
  var out = new Array(maxIter);
  var best = Infinity;
  var i;
  var n = log.length;
  for (i = 0; i < maxIter; i++) {
    if (i < n) {
      var entry = log[i];
      if (entry.valid) {
        var c = entry.cost;
        if (typeof c === 'number' && c < best) best = c;
      }
    }
    out[i] = best;
  }
  return out;
}

function runScenarioTrajectories(H, fc, algoName) {
  var runner = (algoName === 'HCA')
    ? integration.runScenario
    : integration.runScenarioBA;

  var res = runner(H, fc, {
    numTrials: 30,
    maxIterations: 5000,
    seedStrategy: 'deterministic',
    keepIterationLogs: true
  });

  var trialsOut = new Array(res.trials.length);
  var k;
  for (k = 0; k < res.trials.length; k++) {
    var t = res.trials[k];
    var log = t.log || [];
    trialsOut[k] = {
      trial: t.trial,
      seed: t.seed,
      bestCost: t.bestCost,
      bestIter: t.bestIter,
      bestSoFar: buildBestSoFar(log, 5000)
    };
  }

  return {
    algo: algoName,
    H: H,
    fc: fc,
    trials: trialsOut
  };
}

function main() {
  ensureDir(OUT_DIR);

  var config = {
    numTrials: 30,
    maxIterations: 5000,
    seedStrategy: 'deterministic'
  };

  var scenarios = integration.PRIMARY_SCENARIOS;
  var out = {
    runDate: new Date().toISOString(),
    config: config,
    scenarios: []
  };

  var totalStart = Date.now();
  var s;
  for (s = 0; s < scenarios.length; s++) {
    var H = scenarios[s].H;
    var fc = scenarios[s].fc;

    process.stdout.write('[' + (s + 1) + '/9] H=' + H + ' fc=' + fc + ' ');

    var scenStart = Date.now();
    var hca = runScenarioTrajectories(H, fc, 'HCA');
    process.stdout.write('HCA ');
    var ba = runScenarioTrajectories(H, fc, 'BA');
    process.stdout.write('BA ');
    var scenMs = Date.now() - scenStart;

    out.scenarios.push({
      H: H,
      fc: fc,
      hca: hca.trials,
      ba: ba.trials,
      elapsedMs: scenMs
    });

    process.stdout.write('done (' + scenMs + 'ms)\n');
  }
  out.totalRuntimeMs = Date.now() - totalStart;

  // Write single JSON. Expected size ~15-25 MB -- acceptable for git.
  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  var stats = fs.statSync(OUT_FILE);
  console.log('');
  console.log('Wrote ' + OUT_FILE);
  console.log('  Size: ' + (stats.size / 1024 / 1024).toFixed(2) + ' MB');
  console.log('  Total runtime: ' + out.totalRuntimeMs + 'ms');
}

main();
