<?php
// php-api/tests/test_claude_client.php -- Unit tests for ClaudeClient.
//
// All tests use mocked http clients and temp .env files -- NO real
// Anthropic API calls. Real wire-test happens in Day 13.2 Step 2.5
// ad-hoc smoke (NOT committed, NOT in regression).
//
// Run: php php-api/tests/test_claude_client.php
// Expects ALL PASS, exit 0.

require_once __DIR__ . '/../lib/ClaudeClient.php';

$assertions = 0;
$failures   = [];

function check($cond, $msg) {
    global $assertions, $failures;
    $assertions++;
    if (!$cond) {
        $failures[] = 'FAIL: ' . $msg;
    }
}

function expectThrow(callable $fn, string $needle, string $label) {
    global $assertions, $failures;
    $assertions++;
    $threw = false;
    $msg   = '';
    try {
        $fn();
    } catch (RuntimeException $e) {
        $threw = true;
        $msg   = $e->getMessage();
    }
    if (!$threw) {
        $failures[] = 'FAIL: ' . $label . ' -- expected throw, got none';
        return;
    }
    if ($needle !== '' && strpos($msg, $needle) === false) {
        $failures[] = 'FAIL: ' . $label . ' -- threw but message missing "' . $needle . '" (got: ' . $msg . ')';
    }
}

// =========================================================================
// Group A -- buildPayload (pure)
// =========================================================================

// A1: full payload with all optional fields populated
$payloadFull = ClaudeClient::buildPayload(
    [['role' => 'user', 'content' => 'hi']],
    'sys prompt',
    [['name' => 'mytool', 'description' => 'd', 'input_schema' => ['type' => 'object']]],
    ['type' => 'tool', 'name' => 'mytool'],
    'claude-sonnet-4-6',
    1024
);
check($payloadFull['model']      === 'claude-sonnet-4-6',                    'A1.model');
check($payloadFull['max_tokens'] === 1024,                                   'A1.max_tokens');
check($payloadFull['system']     === 'sys prompt',                           'A1.system');
check(is_array($payloadFull['tools']) && count($payloadFull['tools']) === 1, 'A1.tools');
check($payloadFull['tool_choice']['name']      === 'mytool',                 'A1.tool_choice.name');
check($payloadFull['messages'][0]['content']   === 'hi',                     'A1.messages');

// A2: minimal payload omits null fields cleanly
$payloadMin = ClaudeClient::buildPayload([['role' => 'user', 'content' => 'hi']]);
check(!array_key_exists('system',      $payloadMin), 'A2.no_system_when_null');
check(!array_key_exists('tools',       $payloadMin), 'A2.no_tools_when_null');
check(!array_key_exists('tool_choice', $payloadMin), 'A2.no_tool_choice_when_null');
check($payloadMin['model']      === ClaudeClient::DEFAULT_MODEL,      'A2.default_model');
check($payloadMin['max_tokens'] === ClaudeClient::DEFAULT_MAX_TOKENS, 'A2.default_max_tokens');

// =========================================================================
// Group B -- parseResponse (pure)
// =========================================================================

// B1: valid JSON object decodes
$parsed = ClaudeClient::parseResponse('{"id":"msg_1","content":[{"type":"text","text":"hi"}]}');
check($parsed['id'] === 'msg_1',                          'B1.id');
check($parsed['content'][0]['type'] === 'text',           'B1.content_type');

// B2: invalid JSON throws
expectThrow(
    function () { ClaudeClient::parseResponse('not json'); },
    'JSON',
    'B2.invalid_json_throws'
);

// B3: non-object root throws (e.g., bare array? bare null?)
//     Note: bare JSON array decodes to PHP array, which IS an array,
//     so we accept that. Test the "literal null" case which decodes
//     to PHP null.
expectThrow(
    function () { ClaudeClient::parseResponse('null'); },
    'not a JSON object',
    'B3.null_root_throws'
);

// =========================================================================
// Group C -- extractToolUse (pure)
// =========================================================================

// C1: happy path -- tool_use block found among mixed content
$contentOk = [
    ['type' => 'text',     'text' => 'thinking...'],
    ['type' => 'tool_use', 'id' => 'tu_1', 'name' => 'my_tool', 'input' => ['x' => 42, 'y' => 'hello']],
];
$inputOk = ClaudeClient::extractToolUse($contentOk, 'my_tool');
check($inputOk['x'] === 42,         'C1.input.x');
check($inputOk['y'] === 'hello',    'C1.input.y');

// C2a: empty content -> throws "missing tool_use block"
expectThrow(
    function () { ClaudeClient::extractToolUse([], 'my_tool'); },
    'missing tool_use',
    'C2a.empty_content'
);

// C2b: only text blocks (no tool_use) -> throws "missing tool_use block"
expectThrow(
    function () {
        ClaudeClient::extractToolUse(
            [['type' => 'text', 'text' => 'just talking']],
            'my_tool'
        );
    },
    'missing tool_use',
    'C2b.no_tool_use'
);

// C2c: tool_use with wrong name -> throws "unexpected tool"
expectThrow(
    function () {
        ClaudeClient::extractToolUse(
            [['type' => 'tool_use', 'name' => 'wrong_tool', 'input' => ['x' => 1]]],
            'my_tool'
        );
    },
    'unexpected tool',
    'C2c.wrong_tool_name'
);

// C2d: tool_use with non-array input -> throws "missing input object"
expectThrow(
    function () {
        ClaudeClient::extractToolUse(
            [['type' => 'tool_use', 'name' => 'my_tool', 'input' => 'not an object']],
            'my_tool'
        );
    },
    'missing input',
    'C2d.non_object_input'
);

// =========================================================================
// Group D -- loadApiKey (file I/O via temp file)
// =========================================================================

// D1: reads ANTHROPIC_API_KEY from a well-formed .env
$tmp = tempnam(sys_get_temp_dir(), 'rcopt_env_');
file_put_contents($tmp, "# rcopt test env\nOTHER=ignored\nANTHROPIC_API_KEY=sk-test-12345\n# trailing comment\n");
$key = ClaudeClient::loadApiKey($tmp);
check($key === 'sk-test-12345', 'D1.reads_key');
unlink($tmp);

// D1b: handles surrounding double quotes
$tmp = tempnam(sys_get_temp_dir(), 'rcopt_env_');
file_put_contents($tmp, 'ANTHROPIC_API_KEY="sk-quoted-67890"' . "\n");
$key = ClaudeClient::loadApiKey($tmp);
check($key === 'sk-quoted-67890', 'D1b.strips_double_quotes');
unlink($tmp);

// D2a: missing file -> null
$key = ClaudeClient::loadApiKey('/no/such/file/path/.env');
check($key === null, 'D2a.missing_file_null');

// D2b: file exists but no ANTHROPIC_API_KEY line -> null
$tmp = tempnam(sys_get_temp_dir(), 'rcopt_env_');
file_put_contents($tmp, "OTHER=value\n# nothing relevant\n");
$key = ClaudeClient::loadApiKey($tmp);
check($key === null, 'D2b.no_key_in_file');
unlink($tmp);

// D2c: empty value -> null
$tmp = tempnam(sys_get_temp_dir(), 'rcopt_env_');
file_put_contents($tmp, "ANTHROPIC_API_KEY=\n");
$key = ClaudeClient::loadApiKey($tmp);
check($key === null, 'D2c.empty_value_null');
unlink($tmp);

// =========================================================================
// Group E -- sendMessage (mocked httpClient, NO real network)
// =========================================================================

$capturedHeaders = null;
$capturedBody    = null;
$capturedUrl     = null;

// E1: 200 success -- returns parsed body, sends correct headers
$fakeHttp200 = function ($url, $headers, $body) use (&$capturedUrl, &$capturedHeaders, &$capturedBody) {
    $capturedUrl     = $url;
    $capturedHeaders = $headers;
    $capturedBody    = $body;
    return [
        'status' => 200,
        'body'   => '{"id":"msg_xyz","content":[{"type":"text","text":"ok"}]}',
    ];
};
$resp = ClaudeClient::sendMessage(
    ['model' => 'claude-sonnet-4-6', 'max_tokens' => 100, 'messages' => []],
    'sk-fake-key',
    $fakeHttp200
);
check($resp['id'] === 'msg_xyz',                       'E1.parsed_response');
check($capturedUrl === ClaudeClient::API_URL,          'E1.url');
check(in_array('x-api-key: sk-fake-key', $capturedHeaders, true), 'E1.api_key_header');
check(
    in_array('anthropic-version: ' . ClaudeClient::ANTHROPIC_VERSION, $capturedHeaders, true),
    'E1.version_header'
);
check(in_array('content-type: application/json', $capturedHeaders, true), 'E1.content_type_header');
check(
    in_array('user-agent: ' . ClaudeClient::USER_AGENT, $capturedHeaders, true),
    'E1.user_agent_header'
);
$decoded = json_decode($capturedBody, true);
check(is_array($decoded) && $decoded['model'] === 'claude-sonnet-4-6', 'E1.body_encoded');

// E2: 401 unauthorized -> throws with status in message
$fakeHttp401 = function () {
    return ['status' => 401, 'body' => '{"error":"unauthorized"}'];
};
expectThrow(
    function () use ($fakeHttp401) {
        ClaudeClient::sendMessage(['messages' => []], 'sk-bad-key', $fakeHttp401);
    },
    '401',
    'E2.401_throws_with_status'
);

// E3: 500 server error -> throws with status in message
$fakeHttp500 = function () {
    return ['status' => 500, 'body' => 'internal error'];
};
expectThrow(
    function () use ($fakeHttp500) {
        ClaudeClient::sendMessage(['messages' => []], 'sk-key', $fakeHttp500);
    },
    '500',
    'E3.500_throws_with_status'
);

// E4: empty API key -> throws before any HTTP call
$httpCalled = false;
$fakeHttpNeverCalled = function () use (&$httpCalled) {
    $httpCalled = true;
    return ['status' => 200, 'body' => '{}'];
};
expectThrow(
    function () use ($fakeHttpNeverCalled) {
        ClaudeClient::sendMessage(['messages' => []], '', $fakeHttpNeverCalled);
    },
    'empty',
    'E4.empty_key_throws'
);
check($httpCalled === false, 'E4.no_http_call_on_empty_key');

// E5: malformed httpClient return -> throws
$fakeHttpBad = function () {
    return ['weird' => 'shape'];
};
expectThrow(
    function () use ($fakeHttpBad) {
        ClaudeClient::sendMessage(['messages' => []], 'sk-key', $fakeHttpBad);
    },
    'malformed',
    'E5.malformed_return_throws'
);

// =========================================================================
// Summary
// =========================================================================

echo 'test_claude_client.php: ' . $assertions . ' assertions';
if (count($failures) === 0) {
    echo ' ALL PASS' . PHP_EOL;
    exit(0);
}
echo ' WITH ' . count($failures) . ' FAILURES:' . PHP_EOL;
foreach ($failures as $f) {
    echo $f . PHP_EOL;
}
exit(1);
