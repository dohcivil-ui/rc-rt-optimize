<?php
declare(strict_types=1);

/**
 * health.php -- GET /health.
 *
 * Liveness probe -- mirrors api/src/routes/health.js (Node).
 * Returns {status, version, timestamp} suitable for uptime checks
 * and smoke tests. Hardcoded RCOPT_API_VERSION (kept in sync with
 * the Node package.json; PHP unified stack pins the same value).
 *
 * NOTE on uptime_seconds (Node has it, PHP does not):
 *   The Node version exposes process.uptime(). PHP under Apache /
 *   PHP-FPM is per-request -- there is no persistent process whose
 *   uptime would be meaningful to clients. The field is deliberately
 *   omitted rather than faked with request-scoped timings.
 *
 * Pure handler handleHealthRequest($method) is exposed for unit
 * tests (no echo, no header() calls -- returns
 * ['status' => int, 'json' => array]). The thin entry-point at the
 * bottom of this file only runs when this file is the main script
 * (skipped when tests `require_once` this file from the CLI).
 *
 * PHP 7.4+ compat target (Hestia VPS).
 */

const RCOPT_API_VERSION = '0.1.0';

/**
 * Pure handler -- testable in isolation.
 *
 * @param string $method Uppercase HTTP method.
 * @return array         ['status' => int, 'json' => array]
 */
function handleHealthRequest(string $method): array
{
    if ($method !== 'GET') {
        return ['status' => 405, 'json' => ['error' => 'method_not_allowed']];
    }

    return [
        'status' => 200,
        'json'   => [
            'status'    => 'ok',
            'version'   => RCOPT_API_VERSION,
            'timestamp' => gmdate('c'),  // ISO 8601 UTC, e.g. 2026-05-05T18:30:00+00:00
        ],
    ];
}

// ----------------------------------------------------------------
// Thin entry point -- only runs when this file IS the main script.
// realpath() compare is safe across CLI tests that include this
// file via require_once: SCRIPT_FILENAME stays as the test file.
// ----------------------------------------------------------------
if (realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    header('Content-Type: application/json; charset=utf-8');

    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $resp   = handleHealthRequest($method);
    http_response_code($resp['status']);
    echo json_encode($resp['json']);
    exit;
}
