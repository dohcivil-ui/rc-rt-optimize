// diag_h5_240.js -- Isolate rate vs bug at H=5 fc=240
// Runs 10 trials with maxIterations=20000 (4x default) to test whether
// Node.js HCA can reach VB6 optimum 5459.80 given more iterations.

var integration = require('../src/integration');

console.log('==========================================');
console.log('Diagnostic: H=5 fc=240');
console.log('  10 trials, maxIter=20000, deterministic seeds 1..10');
console.log('  VB6 optimum: 5459.80 (hit 3/30 trials in VB6 at maxIter=5000)');
console.log('  Node 5000-iter result: 5500.96 (0/30 hits)');
console.log('  Gap to investigate: 41.16 baht (0.75%)');
console.log('==========================================');
console.log('');

var start = Date.now();
var r = integration.runScenario(5, 240, {
  numTrials: 10,
  maxIterations: 20000,
  seedStrategy: 'deterministic',
  onProgress: function (t, bestOverall, trialMs) {
    console.log('  trial ' + t + ' done (elapsed ' + (trialMs / 1000).toFixed(1) + 's)');
  }
});
var total = Date.now() - start;

console.log('');
console.log('=== Per-trial results ===');
var i;
for (i = 0; i < r.trials.length; i++) {
  var t = r.trials[i];
  var gap = t.bestCost - 5459.80;
  var marker = (gap < 0.01) ? ' *** HIT ***' : '';
  console.log('  trial ' + t.trial + ': cost=' + t.bestCost.toFixed(2) +
    ' gap=+' + gap.toFixed(2) +
    ' bestIter=' + t.bestIter +
    marker);
}

console.log('');
console.log('=== Summary ===');
console.log('bestOverall: ' + r.bestOverall.cost.toFixed(2) +
  ' (trial ' + r.bestOverall.trial +
  ', iter ' + r.bestOverall.iter + ')');
console.log('gap from VB6 optimum: ' +
  (r.bestOverall.cost - 5459.80).toFixed(2) + ' baht');

var hits = 0;
for (i = 0; i < r.trials.length; i++) {
  if (Math.abs(r.trials[i].bestCost - 5459.80) < 0.01) hits = hits + 1;
}
console.log('hit-rate: ' + hits + '/10');

var costs = r.trials.map(function (t) { return t.bestCost; });
costs.sort(function (a, b) { return a - b; });
console.log('');
console.log('sorted costs:');
for (i = 0; i < costs.length; i++) {
  console.log('  ' + (i + 1) + ': ' + costs[i].toFixed(2));
}

console.log('');
console.log('elapsed total: ' + (total / 1000).toFixed(1) + 's');
console.log('');
console.log('=== Interpretation ===');
if (hits > 0) {
  console.log('SUCCESS: Node CAN reach 5459.80 at higher iteration counts.');
  console.log('Conclusion: H=5 fc=240 is a CONVERGENCE RATE issue, not a port bug.');
  console.log('Port is validated. Proceed to revised acceptance criteria.');
} else if (r.bestOverall.cost < 5500.96) {
  console.log('PARTIAL: Node reached ' + r.bestOverall.cost.toFixed(2) +
    ' (improved from 5500.96 but not 5459.80).');
  console.log('May need even more iterations, or HCA has known ceiling here.');
} else {
  console.log('STUCK: Node still capped at ~5500.96 even with 20000 iter.');
  console.log('Suggests a POTENTIAL PORT DISCREPANCY at this scenario.');
  console.log('Next step: inspect neighbor generation or constraint checks.');
}
