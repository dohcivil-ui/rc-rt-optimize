<?php
declare(strict_types=1);

/**
 * optimize.php -- POST /optimize.
 *
 * True PHP mirror of api/src/routes/optimize.js (Node).
 * Validates the request body via Validator::validateOptimizeParams,
 * then delegates to Engine::runOptimize. Any throwable from the
 * engine produces a 500 JSON envelope (mirrors Node's next(err) path
 * through the Express default error handler).
 *
 * Pure handler `handleOptimizeRequest()` is exposed for unit tests
 * (no echo, no header() calls -- returns ['status' => int, 'json' => array]).
 * The thin entry-point at the bottom of this file only runs when
 * this file is the main script (skipped when tests `require_once`
 * this file from the CLI).
 *
 * PHP 7.4+ compat target (Hestia VPS).
 */

require_once __DIR__ . '/lib/Validator.php';
require_once __DIR__ . '/lib/Engine.php';

/**
 * Pure handler -- testable in isolation.
 *
 * @param mixed  $body   Decoded JSON body (typically array, or null if parse failed).
 * @param string $method Uppercase HTTP method (e.g. 'POST', 'GET').
 * @return array         ['status' => int, 'json' => array]
 */
function handleOptimizeRequest($body, string $method): array
{
    if ($method !== 'POST') {
        return ['status' => 405, 'json' => ['error' => 'method_not_allowed']];
    }

    $result = Validator::validateOptimizeParams($body);
    if (!$result['valid']) {
        return [
            'status' => 400,
            'json'   => [
                'error'   => 'validation_failed',
                'details' => $result['errors'],
            ],
        ];
    }

    // Day 9.6 parity: optional algorithm switch ('BA' | 'HCA'). Validator
    // does not know about this field, so read it from the raw body.
    // Anything other than the literal 'HCA' falls back to 'BA'.
    $rawAlgo = (is_array($body)
                && isset($body['algorithm'])
                && is_string($body['algorithm']))
        ? strtoupper($body['algorithm'])
        : 'BA';
    $algorithm = ($rawAlgo === 'HCA') ? 'HCA' : 'BA';

    try {
        $out = Engine::runOptimize(
            $result['params'],
            ['algorithm' => $algorithm]
        );
        return ['status' => 200, 'json' => $out];
    } catch (Throwable $e) {
        return [
            'status' => 500,
            'json'   => [
                'error'  => 'engine_error',
                'detail' => $e->getMessage(),
            ],
        ];
    }
}

// ----------------------------------------------------------------
// Thin entry point -- only runs when this file IS the main script.
// realpath() compare is safe across CLI tests that include this
// file via require_once: SCRIPT_FILENAME stays as the test file.
// ----------------------------------------------------------------
if (realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    header('Content-Type: application/json; charset=utf-8');

    $rawBody = file_get_contents('php://input');
    $body    = json_decode($rawBody, true);
    $method  = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    $resp = handleOptimizeRequest($body, $method);
    http_response_code($resp['status']);
    echo json_encode($resp['json']);
    exit;
}
