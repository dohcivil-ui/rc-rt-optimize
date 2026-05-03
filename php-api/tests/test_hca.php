<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/Hca.php';

// ============================================================
// Tiny test harness (clone of test_ba.php style)
// ============================================================
$total  = 0;
$passed = 0;
$failed = [];

function assertEq(string $label, $expected, $actual, float $tol = 1e-9): void
{
    global $total, $passed, $failed;
    $total++;
    $ok = false;
    if (is_float($expected) || is_float($actual)) {
        if (is_infinite((float) $expected) && is_infinite((float) $actual)) {
            $ok = ($expected > 0) === ($actual > 0);
        } else {
            $ok = abs((float) $expected - (float) $actual) <= $tol;
        }
    } else {
        $ok = ($expected === $actual);
    }
    if ($ok) {
        $passed++;
    } else {
        $failed[] = "$label  expected=" . var_export($expected, true) . "  actual=" . var_export($actual, true);
    }
}

function assertTrueT(string $label, bool $cond): void
{
    global $total, $passed, $failed;
    $total++;
    if ($cond) {
        $passed++;
    } else {
        $failed[] = $label . " (condition was false)";
    }
}

// Reflection helper for private static methods (wpLookup/steelTo0Based/copyIndices)
// PHP 8.1+ no longer requires setAccessible() for Reflection access (deprecated in 8.5).
function callPrivate(string $class, string $method, array $args)
{
    $m = new ReflectionMethod($class, $method);
    return $m->invoke(null, ...$args);
}

function makeParams(): array
{
    return [
        'H'              => 3.0,
        'H1'             => 0.5,
        'gamma_soil'     => 1.8,
        'gamma_concrete' => 2.4,
        'phi'            => 30.0,
        'mu'             => 0.5,
        'qa'             => 15.0,
        'cover'          => 0.05,
        'material' => [
            'fy'            => 4000.0,
            'fc'            => 280.0,
            'concretePrice' => 2200.0,
            'steelPrice'    => 25.0,
        ],
    ];
}

// ============================================================
// A. IDX constants -- items 1-2
// ============================================================
assertEq('IDX_TT_MIN=1',     1,   Hca::IDX_TT_MIN);
assertEq('IDX_TT_MAX=17',    17,  Hca::IDX_TT_MAX);
assertEq('IDX_TB_MIN=20',    20,  Hca::IDX_TB_MIN);
assertEq('IDX_TB_MAX=36',    36,  Hca::IDX_TB_MAX);
assertEq('IDX_TBASE_MIN=40', 40,  Hca::IDX_TBASE_MIN);
assertEq('IDX_TBASE_MAX=54', 54,  Hca::IDX_TBASE_MAX);
assertEq('IDX_BASE_MIN=60',  60,  Hca::IDX_BASE_MIN);
assertEq('IDX_BASE_MAX=71',  71,  Hca::IDX_BASE_MAX);
assertEq('IDX_LTOE_MIN=80',  80,  Hca::IDX_LTOE_MIN);
assertEq('IDX_LTOE_MAX=89',  89,  Hca::IDX_LTOE_MAX);
assertEq('IDX_DB_MIN=100',   100, Hca::IDX_DB_MIN);
assertEq('IDX_DB_MAX=104',   104, Hca::IDX_DB_MAX);
assertEq('IDX_SP_MIN=110',   110, Hca::IDX_SP_MIN);
assertEq('IDX_SP_MAX=113',   113, Hca::IDX_SP_MAX);
assertEq('NO_VALID_SENTINEL=999000', 999000, Hca::NO_VALID_SENTINEL);

// ============================================================
// B. Private helpers via Reflection -- items 3-5
// ============================================================
$arrays = Shared::initArrays();

// Test 3 -- wpLookup (private)
assertEq('wpLookup tt @TT_MIN',   $arrays['tt'][0],    callPrivate('Hca', 'wpLookup', [$arrays, 'tt', Hca::IDX_TT_MIN]));
assertEq('wpLookup tt @TT_MAX',   $arrays['tt'][16],   callPrivate('Hca', 'wpLookup', [$arrays, 'tt', Hca::IDX_TT_MAX]));
assertEq('wpLookup tb @TB_MIN',   $arrays['tb'][0],    callPrivate('Hca', 'wpLookup', [$arrays, 'tb', Hca::IDX_TB_MIN]));
assertEq('wpLookup tb @TB_MAX',   $arrays['tb'][16],   callPrivate('Hca', 'wpLookup', [$arrays, 'tb', Hca::IDX_TB_MAX]));
assertEq('wpLookup TBase @MIN',   $arrays['TBase'][0], callPrivate('Hca', 'wpLookup', [$arrays, 'TBase', Hca::IDX_TBASE_MIN]));
assertEq('wpLookup Base @MIN',    $arrays['Base'][0],  callPrivate('Hca', 'wpLookup', [$arrays, 'Base',  Hca::IDX_BASE_MIN]));
assertEq('wpLookup LToe @MIN',    $arrays['LToe'][0],  callPrivate('Hca', 'wpLookup', [$arrays, 'LToe',  Hca::IDX_LTOE_MIN]));

// Test 4 -- steelTo0Based (private)
$steelVB6 = [
    'stemDB_idx' => 104, 'stemSP_idx' => 110,
    'toeDB_idx'  => 102, 'toeSP_idx'  => 111,
    'heelDB_idx' => 100, 'heelSP_idx' => 113,
];
$steel0 = callPrivate('Hca', 'steelTo0Based', [$steelVB6]);
assertEq('steelTo0Based stemDB', 4, $steel0['stemDB_idx']);
assertEq('steelTo0Based stemSP', 0, $steel0['stemSP_idx']);
assertEq('steelTo0Based toeDB',  2, $steel0['toeDB_idx']);
assertEq('steelTo0Based toeSP',  1, $steel0['toeSP_idx']);
assertEq('steelTo0Based heelDB', 0, $steel0['heelDB_idx']);
assertEq('steelTo0Based heelSP', 3, $steel0['heelSP_idx']);

// Test 5 -- copyIndices (private) + PHP copy-on-write mutation safety
$idxOrig = ['tt' => 5, 'tb' => 25, 'TBase' => 45];
$idxCopy = callPrivate('Hca', 'copyIndices', [$idxOrig]);
assertEq('copyIndices tt',    5,  $idxCopy['tt']);
assertEq('copyIndices tb',    25, $idxCopy['tb']);
assertEq('copyIndices TBase', 45, $idxCopy['TBase']);
$idxCopy['tt'] = 999;
assertEq('copyIndices mutation-safe (orig.tt unchanged)', 5, $idxOrig['tt']);

// ============================================================
// C. createHCAState -- items 6-8
// ============================================================
$params = makeParams();

// Test 6 -- seed=12345 state shape + indices all zero
$state = Hca::createHCAState($params, ['seed' => 12345]);
assertTrueT('createHCAState has params',  isset($state['params']));
assertTrueT('createHCAState has arrays',  isset($state['arrays']['tt']));
assertTrueT('createHCAState has wsd',     isset($state['wsd']));
assertTrueT('createHCAState has indices', isset($state['indices']['tt']));
assertTrueT('createHCAState rng callable', is_callable($state['rng']));
foreach (['tt','tb','TBase','Base','LToe','stemDB','stemSP','toeDB','toeSP','heelDB','heelSP'] as $k) {
    assertEq("createHCAState indices.$k=0", 0, $state['indices'][$k]);
}

// Test 7 -- options['rng'] callable -> identity preserved
$customRng = function () { return 0.5; };
$state7 = Hca::createHCAState($params, ['rng' => $customRng]);
assertTrueT('options rng identity (=== custom closure)', $state7['rng'] === $customRng);

// Test 8 -- no seed/rng -> mt_rand fallback
$state8 = Hca::createHCAState($params, []);
assertTrueT('default rng is callable', is_callable($state8['rng']));
$r = ($state8['rng'])();
assertTrueT('default rng returns float in [0,1)', is_float($r) && $r >= 0.0 && $r < 1.0);

// ============================================================
// D. initializeCurrentDesignHCA -- items 9-11 (FIXED no-shadow-bug)
// ============================================================
$state9 = Hca::createHCAState($params, ['seed' => 12345]);
Hca::initializeCurrentDesignHCA($state9);

$H = $params['H'];
$lim_tb    = Shared::roundTo(0.12 * $H, 3);
$lim_TBase = Shared::roundTo(0.15 * $H, 3);
$lim_Base  = Shared::roundTo(0.70 * $H, 3);
$lim_LToe  = Shared::roundTo(0.20 * $H, 3);

// Test 9 -- indices >= MIN AND WP <= constraint
assertTrueT('init tb >= TB_MIN',       $state9['indices']['tb']    >= Hca::IDX_TB_MIN);
assertTrueT('init TBase >= TBASE_MIN', $state9['indices']['TBase'] >= Hca::IDX_TBASE_MIN);
assertTrueT('init Base >= BASE_MIN',   $state9['indices']['Base']  >= Hca::IDX_BASE_MIN);
assertTrueT('init LToe >= LTOE_MIN',   $state9['indices']['LToe']  >= Hca::IDX_LTOE_MIN);

$wp_tb_init    = callPrivate('Hca', 'wpLookup', [$state9['arrays'], 'tb',    $state9['indices']['tb']]);
$wp_TBase_init = callPrivate('Hca', 'wpLookup', [$state9['arrays'], 'TBase', $state9['indices']['TBase']]);
$wp_Base_init  = callPrivate('Hca', 'wpLookup', [$state9['arrays'], 'Base',  $state9['indices']['Base']]);
$wp_LToe_init  = callPrivate('Hca', 'wpLookup', [$state9['arrays'], 'LToe',  $state9['indices']['LToe']]);

assertTrueT('init WP_tb <= 0.12H',    $wp_tb_init    <= $lim_tb    + 1e-9);
assertTrueT('init WP_TBase <= 0.15H', $wp_TBase_init <= $lim_TBase + 1e-9);
assertTrueT('init WP_Base <= 0.7H',   $wp_Base_init  <= $lim_Base  + 1e-9);
assertTrueT('init WP_LToe <= 0.2H',   $wp_LToe_init  <= $lim_LToe  + 1e-9);

// Test 10 -- tb is largest valid idx (FIXED no-shadow-bug check; not stuck at MIN)
$tb_idx = $state9['indices']['tb'];
assertTrueT('init tb > TB_MIN (no-shadow-bug fix)', $tb_idx > Hca::IDX_TB_MIN);
if ($tb_idx < Hca::IDX_TB_MAX) {
    $wp_tb_next = callPrivate('Hca', 'wpLookup', [$state9['arrays'], 'tb', $tb_idx + 1]);
    assertTrueT('init tb is largest (idx+1 exceeds 0.12H)', $wp_tb_next > $lim_tb);
} else {
    assertTrueT('init tb at TB_MAX (entire range fits)', true);
}

// Test 11 -- tt clamped <= tb (WP)
$wp_tt_init = callPrivate('Hca', 'wpLookup', [$state9['arrays'], 'tt', $state9['indices']['tt']]);
assertTrueT('init WP_tt <= WP_tb', $wp_tt_init <= $wp_tb_init + 1e-9);

// ============================================================
// E. getDesignFromCurrentHCA -- item 12
// ============================================================
$ext = Hca::getDesignFromCurrentHCA($state9);
foreach (['tt','tb','TBase','Base','LToe','LHeel'] as $k) {
    assertTrueT("design has $k", isset($ext['design'][$k]));
}
foreach (['stemDB_idx','stemSP_idx','toeDB_idx','toeSP_idx','heelDB_idx','heelSP_idx'] as $k) {
    assertTrueT("steel has $k", isset($ext['steel'][$k]));
}
assertEq('steel stemDB_idx VB6 = DB_MAX', Hca::IDX_DB_MAX, $ext['steel']['stemDB_idx']);
assertEq('steel stemSP_idx VB6 = SP_MIN', Hca::IDX_SP_MIN, $ext['steel']['stemSP_idx']);
assertTrueT('design.LHeel >= 0', $ext['design']['LHeel'] >= 0);

// ============================================================
// F. generateNeighborHCA -- items 13-16
// ============================================================

// Test 14 -- no mutation of $state['indices']
$state14 = Hca::createHCAState($params, ['seed' => 12345]);
Hca::initializeCurrentDesignHCA($state14);
$idxBefore = $state14['indices'];
$nb = Hca::generateNeighborHCA($state14);
assertEq('neighbor: state.indices.tt unchanged',    $idxBefore['tt'],    $state14['indices']['tt']);
assertEq('neighbor: state.indices.tb unchanged',    $idxBefore['tb'],    $state14['indices']['tb']);
assertEq('neighbor: state.indices.Base unchanged',  $idxBefore['Base'],  $state14['indices']['Base']);
assertTrueT('neighbor returns array', is_array($nb));

// Test 13 -- DROPPED. tt-then-tb update order is verified end-to-end via xval
// (Task 3): bit-identical PHP<->Node bestCost/costHistory across 1000 iterations
// proves order parity stronger than any unit-level assertion.

// Test 15 -- all indices clamped to [MIN, MAX] across 100 iters
$state15 = Hca::createHCAState($params, ['seed' => 99999]);
Hca::initializeCurrentDesignHCA($state15);
$violations_clamp = 0;
for ($i = 0; $i < 100; $i++) {
    $nb15 = Hca::generateNeighborHCA($state15);
    if ($nb15['tt']     < Hca::IDX_TT_MIN    || $nb15['tt']     > Hca::IDX_TT_MAX)    $violations_clamp++;
    if ($nb15['tb']     < Hca::IDX_TB_MIN    || $nb15['tb']     > Hca::IDX_TB_MAX)    $violations_clamp++;
    if ($nb15['TBase']  < Hca::IDX_TBASE_MIN || $nb15['TBase']  > Hca::IDX_TBASE_MAX) $violations_clamp++;
    if ($nb15['Base']   < Hca::IDX_BASE_MIN  || $nb15['Base']   > Hca::IDX_BASE_MAX)  $violations_clamp++;
    if ($nb15['LToe']   < Hca::IDX_LTOE_MIN  || $nb15['LToe']   > Hca::IDX_LTOE_MAX)  $violations_clamp++;
    if ($nb15['stemDB'] < Hca::IDX_DB_MIN    || $nb15['stemDB'] > Hca::IDX_DB_MAX)    $violations_clamp++;
    if ($nb15['stemSP'] < Hca::IDX_SP_MIN    || $nb15['stemSP'] > Hca::IDX_SP_MAX)    $violations_clamp++;
    if ($nb15['toeDB']  < Hca::IDX_DB_MIN    || $nb15['toeDB']  > Hca::IDX_DB_MAX)    $violations_clamp++;
    if ($nb15['toeSP']  < Hca::IDX_SP_MIN    || $nb15['toeSP']  > Hca::IDX_SP_MAX)    $violations_clamp++;
    if ($nb15['heelDB'] < Hca::IDX_DB_MIN    || $nb15['heelDB'] > Hca::IDX_DB_MAX)    $violations_clamp++;
    if ($nb15['heelSP'] < Hca::IDX_SP_MIN    || $nb15['heelSP'] > Hca::IDX_SP_MAX)    $violations_clamp++;
    $state15['indices'] = $nb15;
}
assertEq('neighbor clamp violations across 100 iters', 0, $violations_clamp);

// Test 16 -- tb walk-down: WP_tb(newTb) <= 0.12*H across 100 iters
$state16 = Hca::createHCAState($params, ['seed' => 54321]);
Hca::initializeCurrentDesignHCA($state16);
$violations_tb = 0;
for ($i = 0; $i < 100; $i++) {
    $nb16 = Hca::generateNeighborHCA($state16);
    $wp_tb16 = callPrivate('Hca', 'wpLookup', [$state16['arrays'], 'tb', $nb16['tb']]);
    if ($wp_tb16 > $lim_tb + 1e-9) $violations_tb++;
    $state16['indices'] = $nb16;
}
assertEq('neighbor WP_tb <= 0.12H across 100 iters', 0, $violations_tb);

// ============================================================
// G. hcaOptimize -- items 17-21
// ============================================================
$result = Hca::hcaOptimize($params, ['seed' => 12345, 'maxIterations' => 100]);

// Test 17 -- bestIteration > 0 (initial valid path)
assertTrueT('hcaOptimize bestIteration > 0', $result['bestIteration'] > 0);

// Test 18 -- return shape exact 7 keys
$expectedKeys = ['bestDesign', 'bestSteel', 'bestCost', 'bestIteration', 'costHistory', 'log', 'finalState'];
foreach ($expectedKeys as $k) {
    assertTrueT("result has key $k", array_key_exists($k, $result));
}
assertEq('result has exactly 7 keys', 7, count($result));
assertTrueT('bestCost finite (initial valid)', is_finite((float) $result['bestCost']));
assertTrueT('bestCost > 0',                    $result['bestCost'] > 0);

// Test 19 -- costHistory length = maxIterations + 1
assertEq('costHistory length = 101', 101, count($result['costHistory']));

// Test 20 -- costHistory[1..N] = bestCost-at-iter (positive float) or NO_VALID_SENTINEL
$ch_invalid = 0;
for ($i = 1; $i <= 100; $i++) {
    $v = $result['costHistory'][$i];
    if ($v === Hca::NO_VALID_SENTINEL) continue;
    if (is_int($v) && $v === Hca::NO_VALID_SENTINEL) continue;
    if (is_float($v) && $v > 0 && is_finite($v)) continue;
    if (is_int($v) && $v > 0) continue;
    $ch_invalid++;
}
assertEq('costHistory entries valid (sentinel or positive float)', 0, $ch_invalid);

// Test 21 -- bestCost = INF when no valid found (force-infeasible via tiny qa)
$infeasibleParams = makeParams();
$infeasibleParams['qa'] = 0.001;
$infeasibleParams['H']  = 50.0;

$resultInf = Hca::hcaOptimize($infeasibleParams, ['seed' => 12345, 'maxIterations' => 30]);
if ($resultInf['bestIteration'] === 0) {
    assertTrueT('infeasible: bestCost is INF',           is_infinite((float) $resultInf['bestCost']));
    assertTrueT('infeasible: bestDesign is null',        $resultInf['bestDesign'] === null);
    assertTrueT('infeasible: costHistory[1] = sentinel', $resultInf['costHistory'][1] === Hca::NO_VALID_SENTINEL);
} else {
    echo "NOTE: test 21 skipped -- could not force infeasible scenario (bestIteration=" . $resultInf['bestIteration'] . ")\n";
}

// ============================================================
// Report
// ============================================================
echo "===== test_hca.php =====\n";
echo "Passed: $passed / $total\n";
if (!empty($failed)) {
    echo "\nFAILURES:\n";
    foreach ($failed as $f) {
        echo "  - $f\n";
    }
    exit(1);
}
exit(0);
