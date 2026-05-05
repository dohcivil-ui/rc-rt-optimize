<?php
// php-api/tests/test_explain.php -- Tests for explain.php handler.
//
// All tests run handleExplainRequest in-process. NO real Anthropic
// API calls -- $claudeFn DI hook returns canned responses; $apiKeyLoader
// DI hook forces MOCK fallback without touching a real .env file.
//
// Run: php php-api/tests/test_explain.php
// Expects ALL PASS, exit 0.

require_once __DIR__ . '/../explain.php';

$assertions = 0;
$failures   = [];

function check($cond, $msg) {
    global $assertions, $failures;
    $assertions++;
    if (!$cond) {
        $failures[] = 'FAIL: ' . $msg;
    }
}

// Build a minimal valid body once -- reused across tests that need to
// pass validation.
$validBody = [
    'result' => [
        'bestCost'   => 2992.45,
        'bestDesign' => ['B' => 2.10, 't1' => 0.20],
        'bestSteel'  => ['stem' => ['size' => 'DB16']],
    ],
];

// =========================================================================
// Group A -- Method gating
// =========================================================================

$resp = handleExplainRequest(null, 'GET');
check($resp['status'] === 405,                              'A1.GET_returns_405');
check($resp['json']['error'] === 'method_not_allowed',      'A1.error_name');

$resp = handleExplainRequest(null, 'DELETE');
check($resp['status'] === 405,                              'A2.DELETE_returns_405');

// =========================================================================
// Group B -- Validation (cumulative; mirror Node validateBody)
// =========================================================================

// B1: null body
$resp = handleExplainRequest(null, 'POST');
check($resp['status'] === 400,                              'B1.null_body_400');
check($resp['json']['error'] === 'validation_failed',       'B1.error_name');
check(is_array($resp['json']['details']) && count($resp['json']['details']) >= 1, 'B1.has_details');
check($resp['json']['details'][0]['field'] === 'body',      'B1.first_error_body');

// B2: result is a string (not object)
$resp = handleExplainRequest(['result' => 'not-object'], 'POST');
check($resp['status'] === 400,                              'B2.string_result_400');
check($resp['json']['details'][0]['field'] === 'result',    'B2.result_field');

// B3: result missing bestCost (but has bestDesign + bestSteel)
$resp = handleExplainRequest([
    'result' => ['bestDesign' => [], 'bestSteel' => []],
], 'POST');
check($resp['status'] === 400,                              'B3.missing_bestCost_400');
$fields = array_column($resp['json']['details'], 'field');
check(in_array('result.bestCost', $fields, true),           'B3.bestCost_in_fields');

// B4: bestCost is a string -> rejected
$resp = handleExplainRequest([
    'result' => ['bestCost' => 'not-a-number', 'bestDesign' => [], 'bestSteel' => []],
], 'POST');
check($resp['status'] === 400,                              'B4.string_bestCost_400');
$fields = array_column($resp['json']['details'], 'field');
check(in_array('result.bestCost', $fields, true),           'B4.bestCost_field');

// B5: missing bestDesign (cumulative -- also missing bestSteel here)
$resp = handleExplainRequest([
    'result' => ['bestCost' => 100.0],
], 'POST');
check($resp['status'] === 400,                              'B5.missing_bestDesign_400');
$fields = array_column($resp['json']['details'], 'field');
check(in_array('result.bestDesign', $fields, true),         'B5.bestDesign_in_fields');
check(in_array('result.bestSteel',  $fields, true),         'B5.bestSteel_in_fields');
check(count($resp['json']['details']) >= 2,                 'B5.cumulative_errors');

// B6: input present but null -> rejected
$resp = handleExplainRequest([
    'result' => ['bestCost' => 100.0, 'bestDesign' => [], 'bestSteel' => []],
    'input'  => null,
], 'POST');
check($resp['status'] === 400,                              'B6.null_input_400');
$fields = array_column($resp['json']['details'], 'field');
check(in_array('input', $fields, true),                     'B6.input_in_fields');

// B7: valid body with just the 3 required fields -> NO validation errors
//     (We don't run the full handler here -- that needs claudeFn or
//     apiKeyLoader to avoid real .env. Just check the validator alone.)
$noErrors = explainValidateBody($validBody);
check(count($noErrors) === 0,                               'B7.valid_body_no_errors');

// =========================================================================
// Group C -- MOCK fallback (no API key)
// =========================================================================

$noKeyLoader = function () { return null; };
$resp = handleExplainRequest($validBody, 'POST', null, $noKeyLoader);
check($resp['status'] === 200,                              'C1.mock_fallback_200');
check(isset($resp['json']['summary']) && is_string($resp['json']['summary']), 'C1.mock_summary_string');
check(strpos($resp['json']['summary'], 'mock fallback') !== false, 'C1.mock_label_present');
check(isset($resp['json']['key_points']) && is_array($resp['json']['key_points']) && count($resp['json']['key_points']) >= 1, 'C1.mock_key_points');
check(isset($resp['json']['warnings']) && $resp['json']['warnings'] === [], 'C2.mock_warnings_empty_array');
check(isset($resp['json']['recommendations']) && is_array($resp['json']['recommendations']), 'C2.mock_recs_array');

// Empty-string API key also triggers mock
$emptyKeyLoader = function () { return ''; };
$resp = handleExplainRequest($validBody, 'POST', null, $emptyKeyLoader);
check($resp['status'] === 200,                              'C3.empty_key_mock');
check(strpos($resp['json']['summary'], 'mock fallback') !== false, 'C3.empty_key_mock_label');

// =========================================================================
// Group D -- Success path with mocked Claude
// =========================================================================

$cannedSuccess = [
    'id'      => 'msg_test_xyz',
    'content' => [
        [
            'type'  => 'tool_use',
            'id'    => 'toolu_live',
            'name'  => 'format_design_explanation',
            'input' => [
                'summary' => 'test summary',
                'key_points' => ['kp1', 'kp2'],
                'warnings' => ['warn1'],
                'recommendations' => ['rec1', 'rec2'],
            ],
        ],
    ],
];

$capturedPayload = null;
$claudeFnSuccess = function (array $payload) use (&$capturedPayload, $cannedSuccess) {
    $capturedPayload = $payload;
    return $cannedSuccess;
};

$resp = handleExplainRequest($validBody, 'POST', $claudeFnSuccess);
check($resp['status'] === 200,                                  'D1.success_status');
check($resp['json']['summary'] === 'test summary',              'D1.summary_passthrough');
check($resp['json']['key_points'] === ['kp1', 'kp2'],           'D1.key_points_passthrough');
check($resp['json']['warnings'] === ['warn1'],                  'D1.warnings_passthrough');
check($resp['json']['recommendations'] === ['rec1', 'rec2'],    'D1.recs_passthrough');

// D2: payload sent to Claude has correct constants
check($capturedPayload['model'] === ClaudeClient::DEFAULT_MODEL, 'D2.model_constant');
check($capturedPayload['max_tokens'] === ClaudeClient::DEFAULT_MAX_TOKENS, 'D2.max_tokens_constant');
check(is_string($capturedPayload['system']) && strlen($capturedPayload['system']) > 100, 'D2.system_prompt_present');
check(is_array($capturedPayload['tools']) && count($capturedPayload['tools']) === 1, 'D2.one_tool');
check($capturedPayload['tools'][0]['name'] === ExplainResultTool::TOOL_NAME, 'D2.tool_name');
check($capturedPayload['tool_choice']['name'] === ExplainResultTool::TOOL_NAME, 'D2.tool_choice_name');
check($capturedPayload['tool_choice']['disable_parallel_tool_use'] === true, 'D2.tool_choice_disable_parallel');

// D3: messages = 6 few-shot + 1 live = 7
check(count($capturedPayload['messages']) === 7,                'D3.seven_messages');
$liveTurn = end($capturedPayload['messages']);
check($liveTurn['role'] === 'user',                             'D3.live_role_user');
check(is_array($liveTurn['content']) && count($liveTurn['content']) === 2, 'D3.live_two_blocks');
check($liveTurn['content'][0]['type'] === 'tool_result',        'D3.live_tool_result_first');
check($liveTurn['content'][0]['tool_use_id'] === ExplainResultPrompt::LAST_TOOL_USE_ID, 'D3.live_pairs_last_id');
check($liveTurn['content'][1]['type'] === 'text',               'D3.live_text_second');
check(strpos($liveTurn['content'][1]['text'], '"bestCost":2992.45') !== false, 'D3.live_payload_inlined');

// D4: input field is forwarded into live payload when present
$bodyWithInput = $validBody;
$bodyWithInput['input'] = ['phi' => 30, 'qa' => 20];
handleExplainRequest($bodyWithInput, 'POST', $claudeFnSuccess);
$liveTurn2 = end($capturedPayload['messages']);
check(strpos($liveTurn2['content'][1]['text'], '"phi":30') !== false, 'D4.input_forwarded');

// =========================================================================
// Group E -- Schema defaults (Claude omits warnings/recommendations)
// =========================================================================

$cannedNoWarnings = [
    'content' => [
        [
            'type'  => 'tool_use',
            'name'  => 'format_design_explanation',
            'input' => [
                'summary'    => 's',
                'key_points' => ['k'],
                // intentionally no warnings, no recommendations
            ],
        ],
    ],
];
$claudeFnNoWarnings = function ($p) use ($cannedNoWarnings) { return $cannedNoWarnings; };
$resp = handleExplainRequest($validBody, 'POST', $claudeFnNoWarnings);
check($resp['status'] === 200,                              'E1.defaults_status_200');
check($resp['json']['warnings'] === [],                     'E1.warnings_defaulted_empty');
check($resp['json']['recommendations'] === [],              'E2.recs_defaulted_empty');

// E3: warnings present but wrong type -> defaulted to []
$cannedBadType = [
    'content' => [
        [
            'type' => 'tool_use',
            'name' => 'format_design_explanation',
            'input' => [
                'summary' => 's',
                'key_points' => ['k'],
                'warnings' => 'not an array',
                'recommendations' => null,
            ],
        ],
    ],
];
$resp = handleExplainRequest($validBody, 'POST', function ($p) use ($cannedBadType) { return $cannedBadType; });
check($resp['json']['warnings'] === [],                     'E3.string_warnings_defaulted');
check($resp['json']['recommendations'] === [],              'E3.null_recs_defaulted');

// =========================================================================
// Group F -- Claude failure modes
// =========================================================================

// F1: $claudeFn throws RuntimeException (mirrors HTTP 5xx / transport error)
$claudeFnThrows = function ($p) {
    throw new RuntimeException('Claude API HTTP 500: server overloaded');
};
$resp = handleExplainRequest($validBody, 'POST', $claudeFnThrows);
check($resp['status'] === 502,                              'F1.throw_returns_502');
check($resp['json']['error'] === 'claude_api_failed',       'F1.error_name');
check(strpos($resp['json']['message'], '500') !== false,    'F1.original_message_preserved');

// F2: $claudeFn returns content with no tool_use block
$claudeFnNoTool = function ($p) {
    return ['content' => [['type' => 'text', 'text' => 'I refuse to use the tool']]];
};
$resp = handleExplainRequest($validBody, 'POST', $claudeFnNoTool);
check($resp['status'] === 502,                              'F2.no_tool_use_502');
check($resp['json']['error'] === 'claude_api_failed',       'F2.error_name');

// F3: $claudeFn returns content with wrong tool name
$claudeFnWrongTool = function ($p) {
    return [
        'content' => [
            [
                'type'  => 'tool_use',
                'name'  => 'some_other_tool',
                'input' => ['x' => 1],
            ],
        ],
    ];
};
$resp = handleExplainRequest($validBody, 'POST', $claudeFnWrongTool);
check($resp['status'] === 502,                              'F3.wrong_tool_name_502');

// F4: $claudeFn returns response missing content array entirely
$claudeFnNoContent = function ($p) { return ['id' => 'msg_x']; };
$resp = handleExplainRequest($validBody, 'POST', $claudeFnNoContent);
check($resp['status'] === 502,                              'F4.no_content_502');

// =========================================================================
// Summary
// =========================================================================

echo 'test_explain.php: ' . $assertions . ' assertions';
if (count($failures) === 0) {
    echo ' ALL PASS' . PHP_EOL;
    exit(0);
}
echo ' WITH ' . count($failures) . ' FAILURES:' . PHP_EOL;
foreach ($failures as $f) {
    echo $f . PHP_EOL;
}
exit(1);
