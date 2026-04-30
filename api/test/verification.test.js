var engine = require('../src/lib/engine');

var VB6_PARAMS = {
  H: 3, H1: 1.20,
  gamma_soil: 1.80, gamma_concrete: 2.40,
  phi: 30, mu: 0.60, qa: 30,
  cover: 0.075,
  material: { fy: 4000, fc: 240, concretePrice: 2430, steelPrice: 24 }
};

var VB6_DESIGN = {
  tt: 0.200, tb: 0.200,
  Base: 1.500, TBase: 0.300,
  LToe: 0.600, LHeel: 0.700
};

var VB6_STEEL = {
  stemDB_idx: 100, stemSP_idx: 113,
  toeDB_idx:  100, toeSP_idx:  113,
  heelDB_idx: 100, heelSP_idx: 113
};

var v = engine.buildVerification(VB6_PARAMS, VB6_DESIGN, VB6_STEEL, 220);

var passed = 0;
var failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log('PASS ' + name);
    passed++;
  } else {
    console.log('FAIL ' + name + ' -- ' + detail);
    failed++;
  }
}

// Group A: Byte-for-byte VB6 H3-240 (8 tests)
check('A1 Ka', Math.abs(v.earthPressures.Ka - 0.333) < 0.005,
  'expected ~0.333 got ' + v.earthPressures.Ka);
check('A2 Pa', Math.abs(v.earthPressures.Pa - 2.700) < 0.01,
  'expected ~2.700 got ' + v.earthPressures.Pa);
check('A3 Pp', Math.abs(v.earthPressures.Pp - 3.888) < 0.01,
  'expected ~3.888 got ' + v.earthPressures.Pp);
check('A4 W1', Math.abs(v.weights.W1 - 0.972) < 0.01,
  'expected ~0.972 got ' + v.weights.W1);
check('A5 W_total', Math.abs(v.weights.W_total - 6.750) < 0.01,
  'expected ~6.750 got ' + v.weights.W_total);
check('A6 toe_moment', Math.abs(v.steel.toe.moment - 0.78) < 0.01,
  'expected ~0.78 got ' + v.steel.toe.moment);
check('A7 FS_OT', Math.abs(v.safetyFactors.FS_OT.value - 5.17) < 0.05,
  'expected ~5.17 got ' + v.safetyFactors.FS_OT.value);
check('A8 q_max', Math.abs(v.bearingCapacity.q_max - 5.26) < 0.05,
  'expected ~5.26 got ' + v.bearingCapacity.q_max);

// Group B: Invariants (4 tests)
var keys = Object.keys(v).sort();
var expectedKeys = ['bearingCapacity', 'earthPressures', 'material',
  'optimization', 'safetyFactors', 'steel', 'weights'];
check('B1 shape', JSON.stringify(keys) === JSON.stringify(expectedKeys),
  'keys: ' + JSON.stringify(keys));

var allFinite = true;
function checkFiniteDeep(obj, path) {
  var k;
  var val;
  for (k in obj) {
    if (obj.hasOwnProperty(k)) {
      val = obj[k];
      if (typeof val === 'number' && !isFinite(val)) {
        allFinite = false;
      } else if (typeof val === 'object' && val !== null) {
        checkFiniteDeep(val, path + '.' + k);
      }
    }
  }
}
checkFiniteDeep(v, 'v');
check('B2 finite', allFinite, 'some values not finite');

check('B3 boolean',
  typeof v.safetyFactors.FS_OT.pass === 'boolean' &&
  typeof v.safetyFactors.FS_SL.pass === 'boolean' &&
  typeof v.safetyFactors.FS_BC.pass === 'boolean' &&
  typeof v.safetyFactors.allPass === 'boolean',
  'pass flags not all boolean');

check('B4 metadata',
  v.optimization.algorithm === 'BA' &&
  v.optimization.trialsRun === 1 &&
  v.optimization.bestIteration === 220,
  'metadata mismatch');

// Group C: Edge cases (2 tests)
check('C1 SD40', v.material.steel.grade === 'SD40',
  'expected SD40 got ' + v.material.steel.grade);

var infeasibleDesign = {
  tt: 0.150, tb: 0.150, Base: 0.500,
  TBase: 0.150, LToe: 0.100, LHeel: 0.250
};
var v2 = engine.buildVerification(VB6_PARAMS, infeasibleDesign, VB6_STEEL, 1);
check('C2 infeasible',
  v2.safetyFactors.FS_OT.pass === false && v2.safetyFactors.allPass === false,
  'tiny base should FAIL, got FS_OT=' + v2.safetyFactors.FS_OT.value);

// Group D: Integration (1 test)
var fullParams = JSON.parse(JSON.stringify(VB6_PARAMS));
fullParams.options = { seed: 42, maxIterations: 5000 };
var result = engine.runOptimize(fullParams);
check('D1 integration',
  result.verification && result.verification.optimization &&
  result.verification.safetyFactors && result.verification.earthPressures,
  'runOptimize missing verification keys');

// Summary
console.log('');
console.log('=================================');
console.log('Verification tests: ' + passed + '/' + (passed + failed));
if (failed === 0) {
  console.log('ALL 15 PASSED');
} else {
  console.log(failed + ' FAILED');
}
console.log('=================================');
if (failed > 0) {
  process.exit(1);
}
