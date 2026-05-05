<?php
declare(strict_types=1);

/**
 * test_health.php -- unit tests for the GET /health handler.
 *
 * Exercises handleHealthRequest() in isolation (no HTTP layer).
 * Mirrors test_optimize.php style: numbered Group A-B, hand-rolled
 * check() helper with a simple counter, no PHPUnit dependency.
 *
 * The handler entry-point in health.php is guarded by a realpath()
 * compare of SCRIPT_FILENAME vs __FILE__, so this require_once does
 * NOT trigger any HTTP-side echo / header() calls.
 *
 * Run from project root:
 *   php php-api/tests/test_health.php
 *
 * Expected: 7/7 PASS.
 */

require_once __DIR__ . '/../health.php';

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

echo "\n=== Group A: Method gating ===\n";

$resp = handleHealthRequest('GET');
check('A1 GET returns 200',
    $resp['status'] === 200);

$resp = handleHealthRequest('POST');
check('A2 POST returns 405 method_not_allowed',
    $resp['status'] === 405
    && $resp['json']['error'] === 'method_not_allowed');

$resp = handleHealthRequest('DELETE');
check('A3 DELETE returns 405',
    $resp['status'] === 405);

echo "\n=== Group B: Response shape (GET) ===\n";

$resp = handleHealthRequest('GET');

check('B1 status === "ok"',
    isset($resp['json']['status'])
    && $resp['json']['status'] === 'ok');

check('B2 version === "0.1.0"',
    isset($resp['json']['version'])
    && $resp['json']['version'] === '0.1.0');

check('B3 timestamp parses as valid date',
    isset($resp['json']['timestamp'])
    && is_string($resp['json']['timestamp'])
    && strtotime($resp['json']['timestamp']) !== false);

check('B4 timestamp matches ISO 8601 prefix /YYYY-MM-DDTHH:MM:SS/',
    isset($resp['json']['timestamp'])
    && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $resp['json']['timestamp']) === 1);

echo "\n";
echo "================================\n";
echo "  health.php: {$pass}/{$total} PASS\n";
echo "================================\n";

exit($pass === $total ? 0 : 1);
