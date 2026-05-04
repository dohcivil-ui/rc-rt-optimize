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

// Group D1: Integration (1 test)
var fullParams = JSON.parse(JSON.stringify(VB6_PARAMS));
fullParams.options = { seed: 42, maxIterations: 5000 };
var result = engine.runOptimize(fullParams);
check('D1 integration',
  result.verification && result.verification.optimization &&
  result.verification.safetyFactors && result.verification.earthPressures,
  'runOptimize missing verification keys');

// Group D2: H4-280 BA paper-authentic verification snapshot (10 tests)
//
// Locks numeric verification output for a deterministic Node@seed=42
// snapshot at H=4 / fc=280 with paper-authentic config (mu=0.60,
// qa=30, concretePrice=2524, steelPrice=24, maxIterations=10000).
//
// DISTINCT from optimize.test.js T2 which uses legacy convention
// (mu=0.5, qa=20, concretePrice=2500, steelPrice=28). T2 covers
// legacy regression; D2 covers paper-authentic regression. Both are
// kept frozen.
//
// Captured 2026-05-04 via tmp/capture-h4280-ba.js. seed=42 AND
// maxIterations=10000 are PART OF the ground truth contract;
// changing either invalidates all 10 D2 locked values.
var H4_280_BA_PAPER_PARAMS = {
  H: 4,
  H1: 1.2,
  gamma_soil: 1.80,
  gamma_concrete: 2.40,
  phi: 30,
  mu: 0.60,
  qa: 30,
  cover: 0.075,
  material: { fy: 4000, fc: 280, concretePrice: 2524, steelPrice: 24 },
  options: { seed: 42, maxIterations: 10000 }
};

(function () {
  var result2 = engine.runOptimize(H4_280_BA_PAPER_PARAMS, { algorithm: 'BA' });
  var v2 = result2.verification;

  check('D2.1 bestCost === 4101.473408',
    Math.abs(result2.bestCost - 4101.473408) < 1e-9,
    'expected 4101.473408 got ' + result2.bestCost);

  check('D2.2 bestIteration === 672',
    result2.bestIteration === 672,
    'expected 672 got ' + result2.bestIteration);

  check('D2.3 earthPressures.Ka === 0.3333333333333333',
    Math.abs(v2.earthPressures.Ka - 0.3333333333333333) < 1e-9,
    'expected 0.3333333333333333 got ' + v2.earthPressures.Ka);

  check('D2.4 earthPressures.Pa === 4.8',
    Math.abs(v2.earthPressures.Pa - 4.8) < 1e-9,
    'expected 4.8 got ' + v2.earthPressures.Pa);

  check('D2.5 weights.W_total === 11.172',
    Math.abs(v2.weights.W_total - 11.172) < 1e-9,
    'expected 11.172 got ' + v2.weights.W_total);

  check('D2.6 safetyFactors.FS_OT.value === 2.796152575957728',
    Math.abs(v2.safetyFactors.FS_OT.value - 2.796152575957728) < 1e-9,
    'expected 2.796152575957728 got ' + v2.safetyFactors.FS_OT.value);

  check('D2.7 safetyFactors.FS_SL.value === 2.2065',
    Math.abs(v2.safetyFactors.FS_SL.value - 2.2065) < 1e-9,
    'expected 2.2065 got ' + v2.safetyFactors.FS_SL.value);

  check('D2.8 safetyFactors.FS_BC.value === 3.228931223764933',
    Math.abs(v2.safetyFactors.FS_BC.value - 3.228931223764933) < 1e-9,
    'expected 3.228931223764933 got ' + v2.safetyFactors.FS_BC.value);

  check('D2.9 safetyFactors.allPass === true',
    v2.safetyFactors.allPass === true,
    'expected true got ' + v2.safetyFactors.allPass);

  check('D2.10 bearingCapacity.q_max === 9.291000000000002',
    Math.abs(v2.bearingCapacity.q_max - 9.291000000000002) < 1e-9,
    'expected 9.291000000000002 got ' + v2.bearingCapacity.q_max);
})();

// Summary
console.log('');
console.log('=================================');
console.log('Verification tests: ' + passed + '/' + (passed + failed));
if (failed === 0) {
  console.log('ALL 25 PASSED');
} else {
  console.log(failed + ' FAILED');
}
console.log('=================================');
if (failed > 0) {
  process.exit(1);
}
