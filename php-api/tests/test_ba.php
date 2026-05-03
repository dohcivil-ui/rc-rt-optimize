<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/Ba.php';

// ============================================================
// Tiny test harness (matches test_shared.php style)
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

// Standard test params (H=3, fc=280, seed=12345)
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
// Test 1 -- wpLookup
// ============================================================
$arrays = Shared::initArrays();

// tt at index 1 (TT_MIN) -> arrays['tt'][0]; at 17 (TT_MAX) -> arrays['tt'][16]
assertEq('wpLookup tt @TT_MIN',  $arrays['tt'][0],  Ba::wpLookup($arrays, 'tt', Ba::TT_MIN));
assertEq('wpLookup tt @TT_MAX',  $arrays['tt'][16], Ba::wpLookup($arrays, 'tt', Ba::TT_MAX));
assertEq('wpLookup tb @TB_MIN',  $arrays['tb'][0],  Ba::wpLookup($arrays, 'tb', Ba::TB_MIN));
assertEq('wpLookup tb @TB_MAX',  $arrays['tb'][16], Ba::wpLookup($arrays, 'tb', Ba::TB_MAX));
assertEq('wpLookup TBase @MIN',  $arrays['TBase'][0],  Ba::wpLookup($arrays, 'TBase', Ba::TBASE_MIN));
assertEq('wpLookup Base  @MIN',  $arrays['Base'][0],   Ba::wpLookup($arrays, 'Base',  Ba::BASE_MIN));
assertEq('wpLookup LToe  @MIN',  $arrays['LToe'][0],   Ba::wpLookup($arrays, 'LToe',  Ba::LTOE_MIN));

// ============================================================
// Test 2 -- createBAState shape
// ============================================================
$params = makeParams();
$state = Ba::createBAState($params, ['seed' => 12345]);

assertTrueT('createBAState has params',     isset($state['params']));
assertTrueT('createBAState has arrays',     isset($state['arrays']['tt']));
assertTrueT('createBAState has wsd',        isset($state['wsd']));
assertTrueT('createBAState has indices',    isset($state['indices']['tt']));
assertTrueT('createBAState has bisection',  isset($state['bisection']['tb']));
assertTrueT('createBAState has counters',   isset($state['counters']));
assertTrueT('createBAState rng callable',   is_callable($state['rng']));
assertEq('createBAState totalCount=0',     0, $state['counters']['totalCount']);
assertEq('createBAState countLoop=0',      0, $state['counters']['countLoop']);

// Pre-init: bisection.midPrice should be 0.0 (overwritten to INF in initializeDesignBA)
assertEq('pre-init tb.midPrice=0',    0.0, (float) $state['bisection']['tb']['midPrice']);
assertEq('pre-init Base.midPrice=0',  0.0, (float) $state['bisection']['Base']['midPrice']);

// ============================================================
// Test 3 -- initializeDesignBA for H=3
// ============================================================
Ba::initializeDesignBA($state);

// midPrice should now be INF for all 3 dims
assertTrueT('post-init tb.midPrice=INF',    is_infinite($state['bisection']['tb']['midPrice']));
assertTrueT('post-init TBase.midPrice=INF', is_infinite($state['bisection']['TBase']['midPrice']));
assertTrueT('post-init Base.midPrice=INF',  is_infinite($state['bisection']['Base']['midPrice']));

// Bisection min/max sanity: min <= mid <= max
foreach (['tb', 'TBase', 'Base'] as $dim) {
    $b = $state['bisection'][$dim];
    assertTrueT("post-init $dim min<=mid", $b['min'] <= $b['mid']);
    assertTrueT("post-init $dim mid<=max", $b['mid'] <= $b['max']);
}

// Steel indices -- all at mids of full IDX range
assertEq('post-init stemDB=102', 102, $state['indices']['stemDB']);
assertEq('post-init stemSP=111', 111, $state['indices']['stemSP']);
assertEq('post-init toeDB=102',  102, $state['indices']['toeDB']);
assertEq('post-init heelSP=111', 111, $state['indices']['heelSP']);

// Indices match bisection mids initially
assertEq('post-init idx.tb=mid',    $state['bisection']['tb']['mid'],    $state['indices']['tb']);
assertEq('post-init idx.TBase=mid', $state['bisection']['TBase']['mid'], $state['indices']['TBase']);
assertEq('post-init idx.Base=mid',  $state['bisection']['Base']['mid'],  $state['indices']['Base']);

// tt <= tb constraint must hold
$wp_tt = Ba::wpLookup($state['arrays'], 'tt', $state['indices']['tt']);
$wp_tb = Ba::wpLookup($state['arrays'], 'tb', $state['indices']['tb']);
assertTrueT('post-init WP_tt <= WP_tb', $wp_tt <= $wp_tb);

// ============================================================
// Test 4 -- getDesignFromCurrentBA shape
// ============================================================
$ext = Ba::getDesignFromCurrentBA($state);
assertTrueT('design has tt',        isset($ext['design']['tt']));
assertTrueT('design has LHeel',     isset($ext['design']['LHeel']));
assertTrueT('steel has stemDB_idx', isset($ext['steel']['stemDB_idx']));
assertEq('steel stemDB_idx VB6',  102, $ext['steel']['stemDB_idx']);
assertEq('steel stemSP_idx VB6',  111, $ext['steel']['stemSP_idx']);
assertTrueT('design.LHeel >= 0',    $ext['design']['LHeel'] >= 0);

// ============================================================
// Test 5 -- generateNeighborBA respects bisection bounds
// ============================================================
// Run 50 neighbor generations with seeded rng; verify clamping.
$state2 = Ba::createBAState($params, ['seed' => 12345]);
Ba::initializeDesignBA($state2);
$bis = $state2['bisection'];

$violations = 0;
for ($i = 0; $i < 50; $i++) {
    $nb = Ba::generateNeighborBA($state2);
    if ($nb['tb']    < $bis['tb']['min']    || $nb['tb']    > $bis['tb']['max'])    $violations++;
    if ($nb['TBase'] < $bis['TBase']['min'] || $nb['TBase'] > $bis['TBase']['max']) $violations++;
    if ($nb['Base']  < $bis['Base']['min']  || $nb['Base']  > $bis['Base']['max'])  $violations++;
    if ($nb['stemDB'] < Ba::DB_MIN || $nb['stemDB'] > Ba::DB_MAX) $violations++;
    if ($nb['stemSP'] < Ba::SP_MIN || $nb['stemSP'] > Ba::SP_MAX) $violations++;
    // Mutate state to advance neighbor-gen state
    $state2['indices'] = $nb;
}
assertEq('neighbor bound violations = 0', 0, $violations);

// ============================================================
// Test 6 -- doBisectionStep logic
// ============================================================
$state3 = Ba::createBAState($params, ['seed' => 12345]);
Ba::initializeDesignBA($state3);

// Capture initial bounds
$tb_min0 = $state3['bisection']['tb']['min'];
$tb_max0 = $state3['bisection']['tb']['max'];
$mid0    = $state3['bisection']['tb']['mid'];

// Move idx.tb away from mid, then call doBisectionStep with cheaper price -> max should shrink
$state3['indices']['tb'] = $tb_min0 + 1;
Ba::doBisectionStep($state3, 1000.0); // 1000 < INF
assertEq('after cheap step: tb.max=curIdx',    $tb_min0 + 1, $state3['bisection']['tb']['max']);
assertEq('after cheap step: tb.midPrice=1000', 1000.0,       (float) $state3['bisection']['tb']['midPrice']);

// Next step with EQUAL price -> min should shrink (because !(curr < mid) at equality)
$state3['indices']['tb'] = $state3['bisection']['tb']['mid'];
$prev_max = $state3['bisection']['tb']['max'];
Ba::doBisectionStep($state3, 1000.0); // not less than midPrice=1000
assertEq('equal price: tb.max unchanged',   $prev_max, $state3['bisection']['tb']['max']);
assertTrueT('equal price: tb.min advanced', $state3['bisection']['tb']['min'] >= $tb_min0);

// ============================================================
// Test 7 -- baOptimize sanity (small run)
// ============================================================
$result = Ba::baOptimize($params, ['seed' => 12345, 'maxIterations' => 200]);

assertTrueT('result has bestDesign key',    array_key_exists('bestDesign', $result));
assertTrueT('result has bestSteel key',     array_key_exists('bestSteel', $result));
assertTrueT('result has bestCost',          isset($result['bestCost']));
assertTrueT('result has bestIteration',     isset($result['bestIteration']));
assertTrueT('result has costHistory',       isset($result['costHistory']));
assertTrueT('result has log',               isset($result['log']));
assertTrueT('result has finalState',        isset($result['finalState']));

assertTrueT('bestCost is finite',           is_finite((float) $result['bestCost']));
assertTrueT('bestCost > 0',                 $result['bestCost'] > 0);
assertTrueT('bestIteration >= 1',           $result['bestIteration'] >= 1);
assertEq('costHistory length',              201, count($result['costHistory']));
assertTrueT('log non-empty',                count($result['log']) > 0);
assertEq('finalState totalCount=200',       200, $result['finalState']['counters']['totalCount']);

// ============================================================
// Test 8 -- Cross-validation export
// Write JSON of deterministic run for diff vs Node side.
// ============================================================
$xvalParams = makeParams();
$xvalResult = Ba::baOptimize($xvalParams, ['seed' => 12345, 'maxIterations' => 1000]);

$summary = [
    'params'        => $xvalParams,
    'options'       => ['seed' => 12345, 'maxIterations' => 1000],
    'bestCost'      => $xvalResult['bestCost'],
    'bestIteration' => $xvalResult['bestIteration'],
    'bestDesign'    => $xvalResult['bestDesign'],
    'bestSteel'     => $xvalResult['bestSteel'],
    'finalCounters' => $xvalResult['finalState']['counters'],
    // Sample costHistory at iters [1, 100, 250, 500, 750, 1000] for spot-check
    'costHistorySample' => [
        '1'    => $xvalResult['costHistory'][1]    ?? null,
        '100'  => $xvalResult['costHistory'][100]  ?? null,
        '250'  => $xvalResult['costHistory'][250]  ?? null,
        '500'  => $xvalResult['costHistory'][500]  ?? null,
        '750'  => $xvalResult['costHistory'][750]  ?? null,
        '1000' => $xvalResult['costHistory'][1000] ?? null,
    ],
];

$xvalPath = __DIR__ . '/xval_ba_php.json';
file_put_contents($xvalPath, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// ============================================================
// Report
// ============================================================
echo "===== test_ba.php =====\n";
echo "Passed: $passed / $total\n";
if (!empty($failed)) {
    echo "\nFAILURES:\n";
    foreach ($failed as $f) {
        echo "  - $f\n";
    }
    exit(1);
}
echo "\nCross-validation export written to: $xvalPath\n";
echo "  bestCost      = " . sprintf('%.4f', (float) $xvalResult['bestCost']) . "\n";
echo "  bestIteration = " . (int) $xvalResult['bestIteration'] . "\n";
echo "\nNext: run Node side and diff the JSON.\n";
exit(0);
