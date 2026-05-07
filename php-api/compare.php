<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/Validator.php';
require_once __DIR__ . '/lib/Engine.php';

/**
 * Pure handler for POST /api/compare
 *
 * @param array|null $body        Decoded JSON body (or null if missing/invalid)
 * @param string $method          HTTP method
 * @param callable|null $engineFn DI seam: fn($params, $opts) => array.
 *                                Default = Engine::runMultiTrial direct.
 * @return array{status:int, json:array}
 */
function handleCompareRequest(?array $body, string $method, ?callable $engineFn = null): array {
    // --- A. Method gate ---
    if ($method !== 'POST') {
        return [
            'status' => 405,
            'json'   => ['error' => 'method_not_allowed', 'allowed' => ['POST']],
        ];
    }

    // --- B. Validation (reuse optimize validator) ---
    $v = Validator::validateOptimizeParams($body ?? []);
    if (!$v['valid']) {
        return [
            'status' => 400,
            'json'   => ['error' => 'validation_failed', 'errors' => $v['errors']],
        ];
    }
    $params = $v['params'];

    // --- C. Extract trials (mirror Node typeof === 'number') ---
    $trials = 30;
    if (isset($body['trials']) && (is_int($body['trials']) || is_float($body['trials']))) {
        $trials = (int) $body['trials'];
    }

    // --- D. Extract maxIterations: body -> params.options -> 5000 ---
    $maxIterations = 5000;
    if (isset($body['maxIterations']) && (is_int($body['maxIterations']) || is_float($body['maxIterations']))) {
        $maxIterations = (int) $body['maxIterations'];
    } elseif (isset($params['options']['maxIterations'])) {
        $maxIterations = (int) $params['options']['maxIterations'];
    }

    // --- E. Run engine via DI seam ---
    $fn = $engineFn ?? function ($p, $opts) {
        return Engine::runMultiTrial($p, $opts);
    };

    try {
        $out = $fn($params, ['trials' => $trials, 'maxIterations' => $maxIterations]);
        return ['status' => 200, 'json' => $out];
    } catch (\Throwable $e) {
        return [
            'status' => 500,
            'json'   => ['error' => 'compare_failed', 'message' => $e->getMessage()],
        ];
    }
}

// --- Entry-point guard (locked decision #15) ---
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    header('Content-Type: application/json');
    $raw    = file_get_contents('php://input');
    $body   = ($raw === '' || $raw === false) ? null : json_decode($raw, true);
    $body   = is_array($body) ? $body : null;
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    $res = handleCompareRequest($body, $method);
    http_response_code($res['status']);
    echo json_encode($res['json']);
}
