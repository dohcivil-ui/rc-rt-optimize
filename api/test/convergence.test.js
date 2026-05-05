// convergence.test.js -- BA vs HCA speed ratio regression guard
// Purpose: Lock the directional claim "BA converges faster than HCA"
//          on H4-280 paper-authentic config without committing to
//          exact iteration counts (which vary by seed).
// Method:  5-seed median ratio, loose threshold > 2.0x
//          (vs observed ~12x in Chat 11 single-shot at seed=42).
// Runtime: ~2s (10 direct engine calls, no HTTP layer).

var engine = require('../src/lib/engine');

var H4_280_PAPER_PARAMS = {
  H: 4,
  H1: 1.2,
  gamma_soil: 1.80,
  gamma_concrete: 2.40,
  phi: 30,
  mu: 0.60,
  qa: 30,
  cover: 0.075,
  material: {
    fy: 4000,
    fc: 280,
    concretePrice: 2524,
    steelPrice: 24
  }
};

var SEEDS = [1, 7, 42, 100, 999];
var MAX_ITER = 10000;
var THRESHOLD = 2.0;

function median(arr) {
  var sorted = arr.slice().sort(function (a, b) { return a - b; });
  var mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  // defensive (unused at len=5): even-length -> average of two middles
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

console.log('=== convergence.test.js -- BA vs HCA speed ratio ===');
console.log('Scenario:  H4-280 paper-authentic');
console.log('Seeds:     ' + SEEDS.join(', '));
console.log('Threshold: medianHCA.iter / medianBA.iter > ' + THRESHOLD + 'x');
console.log('');

var baIters = [];
var hcaIters = [];

for (var i = 0; i < SEEDS.length; i++) {
  var seed = SEEDS[i];
  var paramsBA = JSON.parse(JSON.stringify(H4_280_PAPER_PARAMS));
  paramsBA.options = { seed: seed, maxIterations: MAX_ITER };
  var paramsHCA = JSON.parse(JSON.stringify(H4_280_PAPER_PARAMS));
  paramsHCA.options = { seed: seed, maxIterations: MAX_ITER };

  var resBA = engine.runOptimize(paramsBA, { algorithm: 'BA' });
  var resHCA = engine.runOptimize(paramsHCA, { algorithm: 'HCA' });

  baIters.push(resBA.bestIteration);
  hcaIters.push(resHCA.bestIteration);

  console.log('seed=' + seed +
              '  BA.iter='  + resBA.bestIteration +
              '  HCA.iter=' + resHCA.bestIteration +
              '  ratio='   + (resHCA.bestIteration / resBA.bestIteration).toFixed(2) + 'x');
}

var medBA  = median(baIters);
var medHCA = median(hcaIters);
var ratio  = medHCA / medBA;

console.log('');
console.log('medianBA.iter  = ' + medBA);
console.log('medianHCA.iter = ' + medHCA);
console.log('ratio          = ' + ratio.toFixed(2) + 'x');
console.log('');

if (ratio > THRESHOLD) {
  console.log('PASS: ' + ratio.toFixed(2) + 'x > ' + THRESHOLD + 'x  (BA converges faster)');
  process.exit(0);
} else {
  console.log('FAIL: ' + ratio.toFixed(2) + 'x <= ' + THRESHOLD + 'x  (regression!)');
  process.exit(1);
}
