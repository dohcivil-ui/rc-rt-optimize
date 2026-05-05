<?php
declare(strict_types=1);

/**
 * test_optimize.php -- unit tests for the POST /optimize handler.
 *
 * Exercises handleOptimizeRequest() in isolation (no HTTP layer).
 * Mirrors the test_engine.php style: numbered Group A-D, hand-rolled
 * check() helper with a simple counter, no PHPUnit dependency.
 *
 * The handler entry-point in optimize.php is guarded by a realpath()
 * compare of SCRIPT_FILENAME vs __FILE__, so this require_once does
 * NOT trigger any HTTP-side echo / header() calls.
 *
 * Run from project root:
 *   php php-api/tests/test_optimize.php
 *
 * Expected: 12/12 PASS.
 */

require_once __DIR__ . '/../optimize.php';

$total = 0;
$pass  = 0;

function check(string $label, bool $cond): void
{
    global $total, $pass;
    $total++;
    if ($cond) {
        $pass++;
        echo "  PASS  {$label}\n";
    } else {
        echo "  FAIL  {$label}\n";
    }
}

// ---------------------------------------------------------------
// Fixture: H3-280 paper-authentic body (valid).
// Matches the seed-42 BA preset ground truth from Day 10 Commit 1
// (mu=0.60, qa=30, fc=280 -> concretePrice=2524, steelPrice=24).
// maxIterations=100 (Validator MIN) -- we do NOT assert exact cost,
// only that the engine returns a positive cost and the algorithm
// is correctly threaded through.
// ---------------------------------------------------------------
function validBody(): array
{
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
        'maxIterations' => 100,
    ];
}

echo "\n=== Group A: Method & body shape ===\n";

$resp = handleOptimizeRequest(validBody(), 'GET');
check('A1 GET method returns 405',
    $resp['status'] === 405
    && $resp['json']['error'] === 'method_not_allowed');

$resp = handleOptimizeRequest(null, 'POST');
check('A2 null body returns 400 validation_failed',
    $resp['status'] === 400
    && $resp['json']['error'] === 'validation_failed');

$resp = handleOptimizeRequest([], 'POST');
check('A3 empty array body returns 400',
    $resp['status'] === 400
    && $resp['json']['error'] === 'validation_failed');

echo "\n=== Group B: Validation errors ===\n";

$badBody = validBody();
unset($badBody['H']);
$resp = handleOptimizeRequest($badBody, 'POST');
check('B1 missing H returns 400 with non-empty details',
    $resp['status'] === 400
    && isset($resp['json']['details'])
    && is_array($resp['json']['details'])
    && count($resp['json']['details']) > 0);

$badBody = validBody();
$badBody['H'] = 10; // out of range [2, 6]
$resp = handleOptimizeRequest($badBody, 'POST');
check('B2 H=10 out of range returns 400 with details',
    $resp['status'] === 400
    && isset($resp['json']['details'])
    && is_array($resp['json']['details'])
    && count($resp['json']['details']) > 0);

echo "\n=== Group C: Success path (H3-280, BA default) ===\n";

$resp = handleOptimizeRequest(validBody(), 'POST');
check('C1 valid body returns 200',
    $resp['status'] === 200);

check('C2 response has bestCost > 0',
    isset($resp['json']['bestCost'])
    && is_numeric($resp['json']['bestCost'])
    && $resp['json']['bestCost'] > 0);

check('C3 response has bestDesign array',
    isset($resp['json']['bestDesign'])
    && is_array($resp['json']['bestDesign']));

check('C4 verification.optimization.algorithm === BA',
    isset($resp['json']['verification']['optimization']['algorithm'])
    && $resp['json']['verification']['optimization']['algorithm'] === 'BA');

echo "\n=== Group D: Algorithm switch ===\n";

// D1: omitted -> defaults to BA
$body = validBody();
$resp = handleOptimizeRequest($body, 'POST');
check('D1 algorithm omitted defaults to BA',
    $resp['status'] === 200
    && isset($resp['json']['verification']['optimization']['algorithm'])
    && $resp['json']['verification']['optimization']['algorithm'] === 'BA');

// D2: explicit HCA
$body = validBody();
$body['algorithm'] = 'HCA';
$resp = handleOptimizeRequest($body, 'POST');
check('D2 algorithm=HCA returns HCA',
    $resp['status'] === 200
    && isset($resp['json']['verification']['optimization']['algorithm'])
    && $resp['json']['verification']['optimization']['algorithm'] === 'HCA');

// D3: garbage -> falls back to BA
$body = validBody();
$body['algorithm'] = 'xyz';
$resp = handleOptimizeRequest($body, 'POST');
check('D3 algorithm=xyz falls back to BA',
    $resp['status'] === 200
    && isset($resp['json']['verification']['optimization']['algorithm'])
    && $resp['json']['verification']['optimization']['algorithm'] === 'BA');

echo "\n";
echo "================================\n";
echo "  optimize.php: {$pass}/{$total} PASS\n";
echo "================================\n";

exit($pass === $total ? 0 : 1);
