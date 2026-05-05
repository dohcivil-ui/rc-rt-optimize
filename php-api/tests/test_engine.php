<?php
// test_engine.php -- Day 11.4 verification of Engine.php
//
// Test design HAND-BUILT (no engine.test.js to mirror).
// 5 groups, ~15 assertions:
//   A) decodeSteel        -- pure data transform, 3 checks
//   B) sampleCostHistory  -- downsample correctness, 3 checks
//   C) buildVerification  -- shape + spot values, 3 checks
//   D) runOptimize        -- BA/HCA dispatch + lowercase return, 3 checks
//   E) runMultiTrial      -- paired-seed shape + Wilcoxon dispatch, 3 checks
//
// Group D + E use small maxIterations (500) for fast regression. Exact
// xval ground-truth (bestCost=3014.4336) is already covered by test_ba.php
// and xval_compare.php; no need to duplicate here.

require_once __DIR__ . '/../lib/Engine.php';

$pass = 0;
$fail = 0;
$failures = [];

function check(string $name, bool $cond, string $detail = ''): void
{
    global $pass, $fail, $failures;
    if ($cond) {
        $pass++;
        echo "  [PASS] $name\n";
    } else {
        $fail++;
        $failures[] = $name . ($detail !== '' ? "  -- $detail" : '');
        echo "  [FAIL] $name" . ($detail !== '' ? "  -- $detail" : '') . "\n";
    }
}

function approx(float $a, float $b, float $tol = 1e-9): bool
{
    return abs($a - $b) <= $tol;
}

// =============================================================
// Group A: decodeSteel
// =============================================================
echo "\n[Group A] decodeSteel\n";

// A1: minimum indices (DB12, 0.10 m)
$dec = Engine::decodeSteel([
    'stemDB_idx' => 100, 'stemSP_idx' => 110,
    'toeDB_idx'  => 100, 'toeSP_idx'  => 110,
    'heelDB_idx' => 100, 'heelSP_idx' => 110,
]);
check('A1 stem.size = DB12 at idx 100',         $dec['stem']['size'] === 'DB12');
check('A1 stem.spacing_cm = 10 at idx 110',     $dec['stem']['spacing_cm'] === 10);
check('A1 stem.spacing_m = 0.10 at idx 110',    approx($dec['stem']['spacing_m'], 0.10));

// A2: full mixed indices across all 3 buckets
$dec = Engine::decodeSteel([
    'stemDB_idx' => 100, 'stemSP_idx' => 111,
    'toeDB_idx'  => 102, 'toeSP_idx'  => 112,
    'heelDB_idx' => 104, 'heelSP_idx' => 113,
]);
check('A2 stem = DB12 @ 0.15',  $dec['stem']['size'] === 'DB12' && $dec['stem']['spacing_cm'] === 15);
check('A2 toe  = DB20 @ 0.20',  $dec['toe']['size']  === 'DB20' && $dec['toe']['spacing_cm']  === 20);
check('A2 heel = DB28 @ 0.25',  $dec['heel']['size'] === 'DB28' && $dec['heel']['spacing_cm'] === 25);

// A3: max indices for all
$dec = Engine::decodeSteel([
    'stemDB_idx' => 104, 'stemSP_idx' => 113,
    'toeDB_idx'  => 104, 'toeSP_idx'  => 113,
    'heelDB_idx' => 104, 'heelSP_idx' => 113,
]);
check('A3 all = DB28 spacing_m=0.25',
    $dec['stem']['size'] === 'DB28'
    && $dec['toe']['size']  === 'DB28'
    && $dec['heel']['size'] === 'DB28'
    && approx($dec['stem']['spacing_m'], 0.25)
    && approx($dec['heel']['spacing_m'], 0.25)
);

// =============================================================
// Group B: sampleCostHistory
// =============================================================
echo "\n[Group B] sampleCostHistory\n";

// B1: short history (50 points) -- expect 49 entries (skip iter 0)
$hist = [];
for ($i = 0; $i < 50; $i++) { $hist[] = 1000.0 - $i; }
$out = Engine::sampleCostHistory($hist);
check('B1 short history (50 pts) -> 49 entries (skip iter 0)',
    count($out) === 49);
check('B1 first entry iter=1, cost=999',
    $out[0]['iter'] === 1 && approx($out[0]['cost'], 999.0));
check('B1 last entry iter=49',
    $out[count($out) - 1]['iter'] === 49);

// B2: long history (5000 pts). maxPoints is a SOFT target (Node engine.js
// does not hard-cap output). Dense 99 + stride 103 + last 1 = 203 entries.
$hist = [];
for ($i = 0; $i < 5000; $i++) { $hist[] = 1000.0 / ($i + 1); }
$out = Engine::sampleCostHistory($hist);
check('B2 long history (5000 pts) -> exact 203 entries (dense 99 + stride 103 + last 1)',
    count($out) === 203, 'got ' . count($out));
check('B2 long history -> dense first 99 (iters 1..99 contiguous)',
    $out[0]['iter'] === 1
    && $out[98]['iter'] === 99
);
check('B2 long history -> last entry iter=4999',
    $out[count($out) - 1]['iter'] === 4999);

// B3: history with nulls and INF -- skipped, last valid included
$hist = [1000.0, 999.0, null, 998.0, INF, 996.0, -INF, 994.0, NAN, 992.0];
$out = Engine::sampleCostHistory($hist);
$iters = array_column($out, 'iter');
check('B3 nulls/inf/nan skipped',
    !in_array(2, $iters, true)
    && !in_array(4, $iters, true)
    && !in_array(6, $iters, true)
    && !in_array(8, $iters, true)
);
check('B3 valid points included',
    in_array(1, $iters, true)
    && in_array(3, $iters, true)
    && in_array(9, $iters, true)
);

// =============================================================
// Group C: buildVerification (shape + spot values)
//
// Use REAL bestDesign + bestSteel from a fast deterministic BA run so all
// keys the optimizer produces are present (LHeel, Base, TBase, etc.).
// Hand-built designs are fragile -- they may miss schema keys consumed by
// Shared.php downstream (calculateW2/W3, calculateMomentToe/Heel,
// checkFS_BC), producing noisy but functionally-irrelevant warnings.
// =============================================================
echo "\n[Group C] buildVerification\n";

$paramsC = [
    'H' => 3.0, 'H1' => 1.2,
    'gamma_soil' => 1.8, 'gamma_concrete' => 2.4,
    'phi' => 30.0, 'mu' => 0.60, 'qa' => 30.0,
    'cover' => 0.075,
    'material' => ['fy' => 4000, 'fc' => 280, 'concretePrice' => 2524, 'steelPrice' => 24],
    'options'  => ['seed' => 42, 'maxIterations' => 200],
];
$priorRun = Engine::runOptimize($paramsC, ['algorithm' => 'BA']);
$designC = $priorRun['bestDesign'];
$steelC  = $priorRun['bestSteel'];

$verC = Engine::buildVerification($paramsC, $designC, $steelC, 250);

// C1: shape -- all 7 top-level keys
$keys = array_keys($verC);
sort($keys);
$expected = ['bearingCapacity', 'earthPressures', 'material', 'optimization', 'safetyFactors', 'steel', 'weights'];
check('C1 7 top-level keys present', $keys === $expected, implode(',', $keys));

// C2: spot values -- algorithm default='BA', grade=SD40, Ka=0.333..
check('C2 algorithm default = BA',
    $verC['optimization']['algorithm'] === 'BA');
check('C2 material.steel.grade = SD40 for fy=4000',
    $verC['material']['steel']['grade'] === 'SD40');
check('C2 earthPressures.Ka ~= 0.3333 for phi=30',
    approx($verC['earthPressures']['Ka'], 1.0/3.0, 1e-6),
    'got ' . $verC['earthPressures']['Ka']);

// C3: algorithm dispatch
$verHca = Engine::buildVerification($paramsC, $designC, $steelC, 250, 'HCA');
$verBa  = Engine::buildVerification($paramsC, $designC, $steelC, 250, 'BA');
$verUnk = Engine::buildVerification($paramsC, $designC, $steelC, 250, 'UNKNOWN');
check('C3 algorithm=HCA -> optimization.algorithm = HCA',
    $verHca['optimization']['algorithm'] === 'HCA');
check('C3 algorithm=UNKNOWN -> falls back to BA',
    $verUnk['optimization']['algorithm'] === 'BA'
    && $verBa['optimization']['algorithm'] === 'BA');

// =============================================================
// Group D: runOptimize (small maxIter for speed; deterministic seed)
// =============================================================
echo "\n[Group D] runOptimize\n";

$paramsD = [
    'H' => 3.0, 'H1' => 1.2,
    'gamma_soil' => 1.8, 'gamma_concrete' => 2.4,
    'phi' => 30.0, 'mu' => 0.60, 'qa' => 30.0,
    'cover' => 0.075,
    'material' => ['fy' => 4000, 'fc' => 280, 'concretePrice' => 2524, 'steelPrice' => 24],
    'options'  => ['seed' => 42, 'maxIterations' => 500],
];

// D1: BA dispatch + return shape
$rBa = Engine::runOptimize($paramsD, ['algorithm' => 'BA']);
$expectedKeys = ['bestCost', 'bestIteration', 'bestDesign', 'bestSteel',
    'bestSteelDecoded', 'runtime_ms', 'algorithm', 'costHistorySampled', 'verification'];
$missing = array_diff($expectedKeys, array_keys($rBa));
check('D1 BA return has all 9 keys', empty($missing), 'missing: ' . implode(',', $missing));
check('D1 BA algorithm = "ba" (lowercase in return)',
    $rBa['algorithm'] === 'ba');
check('D1 BA bestCost > 0 and finite',
    is_finite((float) $rBa['bestCost']) && $rBa['bestCost'] > 0);
check('D1 BA verification.optimization.algorithm = BA (uppercase)',
    $rBa['verification']['optimization']['algorithm'] === 'BA');

// D2: HCA dispatch
$rHca = Engine::runOptimize($paramsD, ['algorithm' => 'HCA']);
check('D2 HCA algorithm = "hca" (lowercase)',
    $rHca['algorithm'] === 'hca');
check('D2 HCA verification.optimization.algorithm = HCA',
    $rHca['verification']['optimization']['algorithm'] === 'HCA');
check('D2 HCA bestCost > 0',
    is_finite((float) $rHca['bestCost']) && $rHca['bestCost'] > 0);

// D3: algorithm fallback
$rUnk = Engine::runOptimize($paramsD, ['algorithm' => 'UNKNOWN']);
check('D3 algorithm=UNKNOWN falls back to BA',
    $rUnk['algorithm'] === 'ba'
    && $rUnk['verification']['optimization']['algorithm'] === 'BA');

// =============================================================
// Group E: runMultiTrial (small N for speed)
// =============================================================
echo "\n[Group E] runMultiTrial\n";

$paramsE = [
    'H' => 3.0, 'H1' => 1.2,
    'gamma_soil' => 1.8, 'gamma_concrete' => 2.4,
    'phi' => 30.0, 'mu' => 0.60, 'qa' => 30.0,
    'cover' => 0.075,
    'material' => ['fy' => 4000, 'fc' => 280, 'concretePrice' => 2524, 'steelPrice' => 24],
];
$mt = Engine::runMultiTrial($paramsE, ['trials' => 2, 'maxIterations' => 500]);

// E1: shape + counts
check('E1 trials = 2',
    $mt['trials'] === 2);
check('E1 metric = "iteration"',
    $mt['metric'] === 'iteration');
check('E1 ba.costs and hca.costs each have 2 entries',
    count($mt['ba']['costs']) === 2 && count($mt['hca']['costs']) === 2);
check('E1 ba/hca have iterStats and costStats',
    isset($mt['ba']['iterStats'])  && isset($mt['ba']['costStats'])
    && isset($mt['hca']['iterStats']) && isset($mt['hca']['costStats']));

// E2: Wilcoxon alternative dispatch
check('E2 wilcoxon (iter test) alternative = "less"',
    isset($mt['wilcoxon']['alternative']) && $mt['wilcoxon']['alternative'] === 'less');
check('E2 wilcoxonCost (cost test) alternative = "two-sided"',
    isset($mt['wilcoxonCost']['alternative']) && $mt['wilcoxonCost']['alternative'] === 'two-sided');

// E3: baBestRun semantics
$minBaCost = min($mt['ba']['costs']);
check('E3 baBestRun.bestCost = min(ba.costs)',
    approx((float) $mt['baBestRun']['bestCost'], (float) $minBaCost));
check('E3 baBestRun.trialIndex in {1,2}',
    in_array($mt['baBestRun']['trialIndex'], [1, 2], true));
check('E3 hcaBestRun.seed in {1,2}',
    in_array($mt['hcaBestRun']['seed'], [1, 2], true));

// =============================================================
// Summary
// =============================================================
$total = $pass + $fail;
echo "\n";
echo "============================================================\n";
echo "Engine tests: $pass / $total PASS\n";
if ($fail > 0) {
    echo "FAILURES:\n";
    foreach ($failures as $f) {
        echo "  - $f\n";
    }
    exit(1);
}
echo "============================================================\n";
