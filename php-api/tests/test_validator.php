<?php
declare(strict_types=1);

/**
 * test_validator.php -- coverage for php-api/lib/Validator.php
 *
 * Mirrors Node validator.js behavior. Verifies error message strings
 * verbatim where they are user-facing so cross-port behavior stays
 * identical.
 */

require_once __DIR__ . '/../lib/Validator.php';

$tests = 0;
$passed = 0;
$failures = [];

function assertEq($actual, $expected, string $msg): void
{
    global $tests, $passed, $failures;
    $tests++;
    if ($actual === $expected) {
        $passed++;
    } else {
        $failures[] = $msg;
        echo "FAIL: $msg\n";
        echo "  expected: " . var_export($expected, true) . "\n";
        echo "  actual:   " . var_export($actual, true) . "\n";
    }
}

function assertTrue(bool $cond, string $msg): void
{
    assertEq($cond, true, $msg);
}

function assertContains(array $haystack, string $needle, string $msg): void
{
    assertTrue(in_array($needle, $haystack, true), $msg . " (looking for: \"$needle\")");
}

/**
 * Helper: construct a fully valid request body. Tests modify a copy.
 */
function validBody(): array
{
    return [
        'H'              => 4.0,
        'H1'             => 1.0,
        'gamma_soil'     => 1.8,
        'gamma_concrete' => 2.4,
        'phi'            => 30,
        'mu'             => 0.5,
        'qa'             => 25,
        'cover'          => 0.07,
        'material'       => [
            'fy'            => 4000,
            'fc'            => 280,
            'concretePrice' => 2524,
            'steelPrice'    => 24,
        ],
    ];
}

// ===========================================================================
// Group A: Valid input
// ===========================================================================

$r = Validator::validateOptimizeParams(validBody());
assertEq($r['valid'], true, 'A1: valid full body returns valid=true');
assertTrue(isset($r['params']), 'A2: params present on valid');
assertEq($r['params']['H'], 4.0, 'A3: params.H preserved');
assertEq($r['params']['H1'], 1.0, 'A4: params.H1 preserved');
assertEq($r['params']['gamma_soil'], 1.8, 'A5: params.gamma_soil preserved');
assertEq($r['params']['gamma_concrete'], 2.4, 'A6: params.gamma_concrete preserved');
assertEq($r['params']['phi'], 30, 'A7: params.phi preserved');
assertEq($r['params']['mu'], 0.5, 'A8: params.mu preserved');
assertEq($r['params']['qa'], 25, 'A9: params.qa preserved');
assertEq($r['params']['cover'], 0.07, 'A10: params.cover preserved');
assertEq($r['params']['material']['fc'], 280, 'A11: params.material.fc preserved');
assertEq($r['params']['material']['steelPrice'], 24, 'A12: params.material.steelPrice preserved');
assertEq($r['params']['options']['maxIterations'], 5000, 'A13: default maxIterations applied');
assertTrue(!array_key_exists('seed', $r['params']['options']), 'A14: seed absent when not provided');

// ===========================================================================
// Group B: Body shape rejection
// ===========================================================================

$r = Validator::validateOptimizeParams(null);
assertEq($r['valid'], false, 'B1: null body invalid');
assertEq($r['errors'], ['request body must be a JSON object'], 'B2: null body single error');

$r = Validator::validateOptimizeParams("not an object");
assertEq($r['valid'], false, 'B3: string body invalid');
assertEq($r['errors'], ['request body must be a JSON object'], 'B4: string body single error');

$r = Validator::validateOptimizeParams(42);
assertEq($r['valid'], false, 'B5: int body invalid');
assertEq($r['errors'], ['request body must be a JSON object'], 'B6: int body single error');

$r = Validator::validateOptimizeParams([1, 2, 3]);
assertEq($r['valid'], false, 'B7: list array body invalid');
assertEq($r['errors'], ['request body must be a JSON object'], 'B8: list body single error');

// ===========================================================================
// Group C: Empty object → all required missing
// ===========================================================================

$r = Validator::validateOptimizeParams([]);
assertEq($r['valid'], false, 'C1: empty body invalid');
// 8 top required + 1 material required = 9 errors
assertEq(count($r['errors']), 9, 'C2: empty body 9 errors');
assertContains($r['errors'], 'H is required', 'C3: H required');
assertContains($r['errors'], 'H1 is required', 'C4: H1 required');
assertContains($r['errors'], 'gamma_soil is required', 'C5: gamma_soil required');
assertContains($r['errors'], 'gamma_concrete is required', 'C6: gamma_concrete required');
assertContains($r['errors'], 'phi is required', 'C7: phi required');
assertContains($r['errors'], 'mu is required', 'C8: mu required');
assertContains($r['errors'], 'qa is required', 'C9: qa required');
assertContains($r['errors'], 'cover is required', 'C10: cover required');
assertContains($r['errors'], 'material is required', 'C11: material required');

// ===========================================================================
// Group D: Wrong type per top field (string instead of number)
// ===========================================================================

$b = validBody(); $b['H'] = "5";
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], false, 'D1: H=string invalid');
assertContains($r['errors'], 'H must be a number', 'D2: H string error');

$b = validBody(); $b['mu'] = true;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'mu must be a number', 'D3: mu=bool error');

$b = validBody(); $b['qa'] = null;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'qa must be a number', 'D4: qa=null error');

$b = validBody(); $b['cover'] = NAN;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'cover must be a number', 'D5: cover=NaN error');

// ===========================================================================
// Group E: Range checks per top field (boundaries + over/under)
// ===========================================================================

// H: [2, 6]
$b = validBody(); $b['H'] = 2.0;
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'E1: H=2.0 boundary OK');

$b = validBody(); $b['H'] = 6.0;
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'E2: H=6.0 boundary OK');

$b = validBody(); $b['H'] = 1.999;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'H must be in range [2, 6]', 'E3: H below min');

$b = validBody(); $b['H'] = 6.001;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'H must be in range [2, 6]', 'E4: H above max');

// gamma_soil: [1.4, 2.2]
$b = validBody(); $b['gamma_soil'] = 1.3;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'gamma_soil must be in range [1.4, 2.2]', 'E5: gamma_soil below min');

// mu: [0.3, 0.7]
$b = validBody(); $b['mu'] = 0.71;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'mu must be in range [0.3, 0.7]', 'E6: mu above max');

// cover: [0.04, 0.15]
$b = validBody(); $b['cover'] = 0.039;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'cover must be in range [0.04, 0.15]', 'E7: cover below min');

$b = validBody(); $b['cover'] = 0.04;
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'E8: cover=0.04 boundary OK');

$b = validBody(); $b['cover'] = 0.15;
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'E9: cover=0.15 boundary OK');

// ===========================================================================
// Group F: Material edge cases
// ===========================================================================

$b = validBody(); $b['material'] = "not an object";
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'material must be an object', 'F1: material=string error');

$b = validBody(); $b['material'] = [1, 2, 3];
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'material must be an object', 'F2: material=list error');

$b = validBody(); $b['material'] = null;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'material must be an object', 'F3: material=null error');

$b = validBody(); unset($b['material']['fc']);
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'material.fc is required', 'F4: material.fc missing');

$b = validBody(); $b['material']['fc'] = "280";
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'material.fc must be a number', 'F5: material.fc string');

$b = validBody(); $b['material']['fc'] = 100;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'material.fc must be in range [180, 400]', 'F6: material.fc below min');

$b = validBody(); $b['material']['fc'] = 500;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'material.fc must be in range [180, 400]', 'F7: material.fc above max');

$b = validBody(); $b['material']['steelPrice'] = 14;
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'material.steelPrice must be in range [15, 60]', 'F8: steelPrice below min');

// ===========================================================================
// Group G: Options block
// ===========================================================================

// G.1 — options not object
$b = validBody(); $b['options'] = "not object";
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'options must be an object', 'G1: options=string error');

$b = validBody(); $b['options'] = [1, 2];
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'options must be an object', 'G2: options=list error');

// G.2 — options empty (valid; default applied)
$b = validBody(); $b['options'] = [];
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'G3: empty options valid');
assertEq($r['params']['options']['maxIterations'], 5000, 'G4: empty options → default 5000');

// G.3 — seed validation
$b = validBody(); $b['options'] = ['seed' => 3.14];
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'options.seed must be an integer', 'G5: seed=3.14 error');

$b = validBody(); $b['options'] = ['seed' => "42"];
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'options.seed must be an integer', 'G6: seed=string error');

$b = validBody(); $b['options'] = ['seed' => 42];
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'G7: seed=42 valid');
assertEq($r['params']['options']['seed'], 42, 'G8: seed=42 preserved');

$b = validBody(); $b['options'] = ['seed' => 0];
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'G9: seed=0 valid');

$b = validBody(); $b['options'] = ['seed' => -1];
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'G10: seed=-1 (negative int) valid');

$b = validBody(); $b['options'] = ['seed' => 5.0];
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'G11: seed=5.0 (float w/ zero fractional) valid');

// G.4 — maxIterations validation
$b = validBody(); $b['options'] = ['maxIterations' => 99];
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'options.maxIterations must be in range [100, 100000]', 'G12: maxIter=99 below');

$b = validBody(); $b['options'] = ['maxIterations' => 100001];
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'options.maxIterations must be in range [100, 100000]', 'G13: maxIter=100001 above');

$b = validBody(); $b['options'] = ['maxIterations' => 100];
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'G14: maxIter=100 boundary OK');

$b = validBody(); $b['options'] = ['maxIterations' => 100000];
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'G15: maxIter=100000 boundary OK');

$b = validBody(); $b['options'] = ['maxIterations' => 5000.5];
$r = Validator::validateOptimizeParams($b);
assertContains($r['errors'], 'options.maxIterations must be an integer', 'G16: maxIter=5000.5 not integer');

$b = validBody(); $b['options'] = ['maxIterations' => 1000];
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'G17: maxIter=1000 valid');
assertEq($r['params']['options']['maxIterations'], 1000, 'G18: user maxIter preserved (no default override)');

// ===========================================================================
// Group H: Behavior — collect-all, drop unknowns, normalization
// ===========================================================================

// H.1 — collect-all (no fail-fast)
$b = [
    'H'              => 100,            // out of range
    'H1'             => "x",            // wrong type
    // gamma_soil missing
    'gamma_concrete' => 2.4,
    'phi'            => 30,
    'mu'             => 0.5,
    'qa'             => 25,
    'cover'          => 0.07,
    'material'       => [
        'fy'         => 4000,
        // fc missing
        'concretePrice' => 2524,
        'steelPrice' => 24,
    ],
];
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], false, 'H1: multi-error invalid');
assertTrue(count($r['errors']) >= 4, 'H2: multi-error collects all (>=4)');
assertContains($r['errors'], 'H must be in range [2, 6]', 'H3: H range error');
assertContains($r['errors'], 'H1 must be a number', 'H4: H1 type error');
assertContains($r['errors'], 'gamma_soil is required', 'H5: gamma_soil required');
assertContains($r['errors'], 'material.fc is required', 'H6: material.fc required');

// H.2 — drop unknown top-level fields
$b = validBody();
$b['__sneaky__'] = 'should be dropped';
$b['extraField'] = 999;
$r = Validator::validateOptimizeParams($b);
assertEq($r['valid'], true, 'H7: unknown fields do not invalidate');
assertTrue(!array_key_exists('__sneaky__', $r['params']), 'H8: __sneaky__ dropped');
assertTrue(!array_key_exists('extraField', $r['params']), 'H9: extraField dropped');

// H.3 — drop unknown material fields
$b = validBody();
$b['material']['extraMat'] = 'leak';
$r = Validator::validateOptimizeParams($b);
assertTrue(!array_key_exists('extraMat', $r['params']['material']), 'H10: unknown material field dropped');

// H.4 — params.material has exactly 4 known keys
$b = validBody();
$r = Validator::validateOptimizeParams($b);
assertEq(count($r['params']['material']), 4, 'H11: params.material has 4 keys');

// H.5 — params has exactly 8 top + material + options = 10 keys
assertEq(count($r['params']), 10, 'H12: params has 10 top-level keys');

// ===========================================================================
// Group I: Strict numeric — Infinity rejected
// ===========================================================================

$b = validBody(); $b['H'] = INF;
$r = Validator::validateOptimizeParams($b);
// INF is_float=true, !isFiniteNumber → "must be a number" path? Let's check:
// In checkNumericField, we accept any int/float that is not NaN.
// INF passes is_int||is_float=true and is_nan=false → falls through to range check.
// INF > 6 → range error. Mirror Node? Node: typeof INF === 'number', !isNaN(INF)=true,
// passes type check, then INF > 6 → range error. Same behavior. ✓
assertContains($r['errors'], 'H must be in range [2, 6]', 'I1: H=INF → range error (mirrors Node)');

// ===========================================================================
// Summary
// ===========================================================================

echo "\n";
echo "==========================================\n";
echo "Validator tests: $passed/$tests passing\n";
echo "==========================================\n";

if ($passed !== $tests) {
    echo "\nFailures:\n";
    foreach ($failures as $f) {
        echo "  - $f\n";
    }
    exit(1);
}

exit(0);
