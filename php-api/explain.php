<?php
// php-api/explain.php -- POST /api/explain endpoint
//
// Day 13.2: ports api/src/routes/explainResult.js. Calls Claude via
// tool_use to format an /api/optimize result envelope into a 4-field
// Thai explanation: { summary, key_points, warnings, recommendations }.
// Without an API key, returns explainMockExplanation() fallback (keeps
// dev + tests working without network/API budget).
//
// Pure handler pattern (locked decision #15 + Day 12.x precedent).
// Two DI hooks for testability:
//   - $claudeFn:      replaces the HTTP call (tests pass canned response
//                     or throwers for failure-mode tests)
//   - $apiKeyLoader:  replaces .env lookup (tests force MOCK fallback
//                     without touching real .env)
//
// Handler returns ['status' => int, 'json' => array]. Entry-point
// guard via realpath() forwards to HTTP only when invoked as the
// script itself (skipped when require'd by tests).
//
// Response codes:
//   200  success (Claude live response or MOCK fallback)
//   400  validation_failed (cumulative; mirrors Node validateBody)
//   405  method_not_allowed
//   502  claude_api_failed (HTTP/transport/extraction failure)

require_once __DIR__ . '/lib/ClaudeClient.php';
require_once __DIR__ . '/lib/ExplainResultPrompt.php';
require_once __DIR__ . '/lib/ExplainResultTool.php';

/**
 * Pure handler. Returns response envelope.
 *
 * @param mixed         $body          Decoded JSON body (or null)
 * @param string        $method        Uppercase HTTP method
 * @param callable|null $claudeFn      (array $payload): array  -- canned
 *                                     response or thrower for tests
 * @param callable|null $apiKeyLoader  (): ?string  -- override .env read
 * @return array                       ['status' => int, 'json' => array]
 */
function handleExplainRequest(
    $body,
    string $method,
    ?callable $claudeFn = null,
    ?callable $apiKeyLoader = null
): array {
    if ($method !== 'POST') {
        return ['status' => 405, 'json' => ['error' => 'method_not_allowed']];
    }

    $errors = explainValidateBody($body);
    if (count($errors) > 0) {
        return [
            'status' => 400,
            'json'   => ['error' => 'validation_failed', 'details' => $errors],
        ];
    }

    // No injection -> check API key, MOCK fallback when absent.
    // If $claudeFn IS injected, skip key check entirely (test mode).
    if ($claudeFn === null) {
        if ($apiKeyLoader === null) {
            $apiKeyLoader = function () {
                return ClaudeClient::loadApiKey();
            };
        }
        $apiKey = $apiKeyLoader();
        if ($apiKey === null || $apiKey === '') {
            return ['status' => 200, 'json' => explainMockExplanation()];
        }
        $claudeFn = function (array $payload) use ($apiKey) {
            return ClaudeClient::sendMessage($payload, $apiKey);
        };
    }

    try {
        $payload = explainBuildClaudeRequest($body);
        $response = $claudeFn($payload);

        $content = (isset($response['content']) && is_array($response['content']))
            ? $response['content']
            : [];
        $toolInput = ClaudeClient::extractToolUse($content, ExplainResultTool::TOOL_NAME);

        // Schema-specific defaults: Claude sometimes omits warnings or
        // recommendations despite the required-fields schema. Frontend
        // assumes the 4-field shape -- fill defaults here rather than
        // null-check downstream. Mirror Node extractToolInput tail.
        if (!isset($toolInput['warnings']) || !is_array($toolInput['warnings'])) {
            $toolInput['warnings'] = [];
        }
        if (!isset($toolInput['recommendations']) || !is_array($toolInput['recommendations'])) {
            $toolInput['recommendations'] = [];
        }

        return ['status' => 200, 'json' => $toolInput];
    } catch (RuntimeException $e) {
        return [
            'status' => 502,
            'json'   => [
                'error'   => 'claude_api_failed',
                'message' => $e->getMessage(),
            ],
        ];
    }
}

/**
 * Cumulative validation -- collect all errors and return them so the
 * client can fix everything in one pass. Mirror Node validateBody.
 *
 * Number check: accept int or float, reject NaN. JSON has no NaN
 * literal so NaN will never come from json_decode in practice; the
 * is_nan guard is defensive only.
 *
 * @param mixed $body
 * @return array  list of {field, message} pairs
 */
function explainValidateBody($body): array
{
    $errors = [];

    if (!is_array($body)) {
        $errors[] = ['field' => 'body', 'message' => 'must be a JSON object'];
        return $errors;
    }

    if (!isset($body['result']) || !is_array($body['result'])) {
        $errors[] = ['field' => 'result', 'message' => 'must be an object'];
        // Cannot inspect sub-fields if result is missing.
        return $errors;
    }

    $result = $body['result'];

    $bc      = $result['bestCost'] ?? null;
    $bcIsNum = is_int($bc) || is_float($bc);
    $bcIsNan = is_float($bc) && is_nan($bc);
    if (!$bcIsNum || $bcIsNan) {
        $errors[] = ['field' => 'result.bestCost', 'message' => 'must be a finite number'];
    }

    if (!isset($result['bestDesign']) || !is_array($result['bestDesign'])) {
        $errors[] = ['field' => 'result.bestDesign', 'message' => 'must be an object'];
    }
    if (!isset($result['bestSteel']) || !is_array($result['bestSteel'])) {
        $errors[] = ['field' => 'result.bestSteel', 'message' => 'must be an object'];
    }

    // input is optional. If present, must be an object (associative
    // array). null and scalars are rejected.
    if (array_key_exists('input', $body)) {
        if (!is_array($body['input'])) {
            $errors[] = ['field' => 'input', 'message' => 'when present, must be an object'];
        }
    }

    return $errors;
}

/**
 * Build the messages.create payload from a validated body.
 * Mirror Node buildClaudeRequest. Caller is responsible for already
 * having passed explainValidateBody.
 *
 * @param array $body
 * @return array  payload ready for ClaudeClient::sendMessage
 */
function explainBuildClaudeRequest(array $body): array
{
    $livePayload = ['result' => $body['result']];
    if (isset($body['input']) && is_array($body['input'])) {
        $livePayload['input'] = $body['input'];
    }
    $liveTurn = ExplainResultPrompt::wrapLiveTurn($livePayload);
    $messages = array_merge(ExplainResultPrompt::fewShotMessages(), [$liveTurn]);

    return ClaudeClient::buildPayload(
        $messages,
        ExplainResultPrompt::systemPrompt(),
        [ExplainResultTool::toolDefinition()],
        ExplainResultTool::toolChoice(),
        ClaudeClient::DEFAULT_MODEL,         // claude-sonnet-4-6
        ClaudeClient::DEFAULT_MAX_TOKENS     // 2048
    );
}

/**
 * MOCK_EXPLANATION fallback. Returned 200 when no API key is set.
 * Distinct values from any few-shot example so that a passing happy-
 * path test in the Claude-branch suite proves the live branch was
 * exercised (not silently shadowed by the mock).
 *
 * @return array
 */
function explainMockExplanation(): array
{
    return [
        'summary' => 'ผลการออกแบบ (mock fallback) -- ANTHROPIC_API_KEY ไม่ได้ตั้งค่า ระบบส่งคำอธิบายตัวอย่างแทน',
        'key_points' => [
            'ค่า bestCost ของ result ถูกส่งกลับโดยไม่ได้แปลความหมาย (ไม่มี LLM)',
            'หากต้องการคำอธิบายภาษาไทยจริงให้ตั้งค่า ANTHROPIC_API_KEY ใน environment',
        ],
        'warnings' => [],
        'recommendations' => [
            'ตั้งค่า ANTHROPIC_API_KEY แล้ว restart server เพื่อใช้ Claude',
        ],
    ];
}

// Entry-point guard: only triggers when this file is invoked directly
// as the HTTP request script. Tests require_once this file and call
// handleExplainRequest() in-process; the guard skips this branch.
if (realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    header('Content-Type: application/json; charset=utf-8');

    $raw    = file_get_contents('php://input');
    $body   = ($raw === false || $raw === '') ? null : json_decode($raw, true);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    $resp = handleExplainRequest($body, $method);

    http_response_code($resp['status']);
    echo json_encode($resp['json'], JSON_UNESCAPED_UNICODE);
    exit;
}
