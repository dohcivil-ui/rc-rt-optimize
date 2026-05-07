<?php
declare(strict_types=1);

require_once __DIR__ . '/../compare.php';

$tests = 0; $passed = 0;
function t(string $name, bool $cond, $detail = null): void {
    global $tests, $passed;
    $tests++;
    if ($cond) { $passed++; echo "  [OK] $name\n"; }
    else {
        echo "  [FAIL] $name\n";
        if ($detail !== null) echo "      -> " . json_encode($detail) . "\n";
    }
}

echo "test_compare.php\n";

/**
 * Minimal valid H3-280 body. Mirrors validBody() from test_optimize.php
 * (paper-authentic seed-42 BA preset) MINUS the maxIterations field, so
 * C-group can test default-behavior cleanly. C5 / E1 add it explicitly.
 */
function h3_280_body(): array {
    return [
        'H'              => 3,
        'H1'             => 0.5,
        'gamma_soil'     => 1.8,
        'gamma_concrete' => 2.4,
        'phi'            => 30,
        'mu'             => 0.60,
        'qa'             => 30,
        'cover'          => 0.05,
        'material' => [
            'fy'            => 4000,
            'fc'            => 280,
            'concretePrice' => 2524,
            'steelPrice'    => 24,
        ],
        // no maxIterations -- C-group tests default behavior (5000)
    ];
}

// ============================================================
// [A] Method gate
// ============================================================
echo "\n[A] Method gate\n";

$r = handleCompareRequest([], 'GET', null);
t('A1 GET -> 405 method_not_allowed',
    $r['status'] === 405 && ($r['json']['error'] ?? '') === 'method_not_allowed', $r);

$r = handleCompareRequest([], 'DELETE', null);
t('A2 DELETE -> 405', $r['status'] === 405, $r);

// ============================================================
// [B] Validation (cumulative)
// ============================================================
echo "\n[B] Validation\n";

$r = handleCompareRequest(null, 'POST', null);
t('B1 null body -> 400 validation_failed',
    $r['status'] === 400 && ($r['json']['error'] ?? '') === 'validation_failed', $r);

$r = handleCompareRequest(['B' => 1.5, 'D' => 0.5, 'q' => 1.5], 'POST', null);
t('B2 missing H -> 400 with errors',
    $r['status'] === 400 && !empty($r['json']['errors'] ?? []), $r);

// ============================================================
// [C] trials + maxIterations forwarding (DI mock)
// Note: C6 (params.options.maxIterations) dropped -- PHP validator
// uses flat shape, so that fallback path is unreachable in PHP port.
// ============================================================
echo "\n[C] trials + maxIterations forwarding\n";

$captured = [];
$mockFn = function ($p, $opts) use (&$captured) {
    $captured[] = ['params' => $p, 'opts' => $opts];
    return [
        'wilcoxon'     => ['p' => 0.0, 'W' => 0],
        'wilcoxonCost' => ['p' => 0.0],
        'ba'           => ['costs' => []],
        'hca'          => ['costs' => []],
        'baBestRun'    => null,
        'hcaBestRun'   => null,
        'metric'       => 'cost',
    ];
};

// C1 + C2: defaults
$r = handleCompareRequest(h3_280_body(), 'POST', $mockFn);
t('C1 mock passthrough -> 200 with wilcoxon.p',
    $r['status'] === 200 && ($r['json']['wilcoxon']['p'] ?? null) === 0.0, $r);
t('C2 trials default = 30',
    isset($captured[0]) && $captured[0]['opts']['trials'] === 30, $captured);

// C3: trials forwarded
$body = h3_280_body();
$body['trials'] = 5;
$r = handleCompareRequest($body, 'POST', $mockFn);
t('C3 trials=5 forwarded',
    isset($captured[1]) && $captured[1]['opts']['trials'] === 5, $captured[1] ?? null);

// C4: maxIterations default = 5000 (re-check first capture)
t('C4 maxIterations default = 5000',
    isset($captured[0]) && $captured[0]['opts']['maxIterations'] === 5000, $captured[0] ?? null);

// C5: maxIterations from body
$body = h3_280_body();
$body['maxIterations'] = 1500;
$r = handleCompareRequest($body, 'POST', $mockFn);
t('C5 maxIterations=1500 from body forwarded',
    isset($captured[2]) && $captured[2]['opts']['maxIterations'] === 1500, $captured[2] ?? null);

// ============================================================
// [D] Engine failure
// ============================================================
echo "\n[D] Engine failure\n";

$thrower = function ($p, $opts) {
    throw new \RuntimeException('boom');
};
$r = handleCompareRequest(h3_280_body(), 'POST', $thrower);
t('D1 throw -> 500 compare_failed',
    $r['status'] === 500
    && ($r['json']['error']   ?? '') === 'compare_failed'
    && ($r['json']['message'] ?? '') === 'boom',
    $r);

// ============================================================
// [E] Real engine integration (trials=2, maxIterations=100, ~1-3 sec)
// ============================================================
echo "\n[E] Real engine integration (trials=2, maxIterations=100)\n";

$body = h3_280_body();
$body['trials']        = 2;
$body['maxIterations'] = 100;  // keep test fast (matches optimize fixture)
$r = handleCompareRequest($body, 'POST', null);  // null = real Engine::runMultiTrial

t('E1.1 status === 200', $r['status'] === 200, $r);
t('E1.2 envelope keys (wilcoxon, ba.costs, hca.costs, baBestRun)',
    isset($r['json']['wilcoxon'])
    && isset($r['json']['ba']['costs'])
    && isset($r['json']['hca']['costs'])
    && isset($r['json']['baBestRun']));
t('E1.3 ba.costs count = 2 && hca.costs count = 2',
    isset($r['json']['ba']['costs'])
    && isset($r['json']['hca']['costs'])
    && count($r['json']['ba']['costs']) === 2
    && count($r['json']['hca']['costs']) === 2);

// ============================================================
echo "\n========================================\n";
echo "test_compare.php: $passed/$tests passed\n";
echo "========================================\n";
exit($passed === $tests ? 0 : 1);
