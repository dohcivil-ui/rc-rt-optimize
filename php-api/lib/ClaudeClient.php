<?php
// php-api/lib/ClaudeClient.php -- HTTP wrapper for Anthropic Messages API.
//
// Day 13.1: replaces the role of @anthropic-ai/sdk (used inline in Node's
// api/src/routes/explainResult.js) with a dedicated PHP class. Pure
// builders (buildPayload, parseResponse, extractToolUse) keep most logic
// testable without network. sendMessage is the single HTTP-side method,
// with a callable injection seam ($httpClient) so tests can run against
// canned responses without consuming live API budget or being flaky.
//
// Headers sent on every request:
//   x-api-key:           <key>
//   anthropic-version:   2023-06-01
//   content-type:        application/json
//   user-agent:          rcopt-php/1.0
//
// Defaults (parity with Node explainResult.js):
//   model:       claude-sonnet-4-6
//   max_tokens:  2048
//   timeout:     30 sec (request) + 10 sec (connect)
//
// Error policy:
//   - HTTP >= 400 -> RuntimeException carrying status + body in message.
//     Consumers (explain.php) catch and translate to a 502 envelope.
//   - cURL transport failures (DNS, TLS, timeout) -> RuntimeException.
//   - JSON parse failures (parseResponse) -> RuntimeException.
//   - extractToolUse mirrors Node's extractToolInput throw conditions
//     1:1 (missing content / missing tool_use / wrong tool name /
//     non-object input).
//
// Schema-specific defaults (e.g., warnings/recommendations = [] when
// Claude omits) are NOT applied here -- belong to the caller in
// explain.php since they are tool-specific, not generic.

class ClaudeClient
{
    const API_URL                    = 'https://api.anthropic.com/v1/messages';
    const ANTHROPIC_VERSION          = '2023-06-01';
    const DEFAULT_MODEL              = 'claude-sonnet-4-6';
    const DEFAULT_MAX_TOKENS         = 2048;
    const DEFAULT_TIMEOUT_SEC        = 30;
    const DEFAULT_CONNECT_TIMEOUT_SEC = 10;
    const USER_AGENT                 = 'rcopt-php/1.0';

    /**
     * Build the messages.create POST payload. Pure -- no I/O.
     *
     * Null fields (system / tools / tool_choice) are omitted from the
     * output rather than emitted as 'system' => null, which Anthropic
     * would reject.
     *
     * @param array  $messages    Anthropic message array
     * @param string|null $system System prompt (or null to omit)
     * @param array|null  $tools  Tool definitions (or null to omit)
     * @param array|null  $toolChoice tool_choice object (or null to omit)
     * @param string $model
     * @param int    $maxTokens
     * @return array  Payload ready for json_encode
     */
    public static function buildPayload(
        array $messages,
        ?string $system = null,
        ?array $tools = null,
        ?array $toolChoice = null,
        string $model = self::DEFAULT_MODEL,
        int $maxTokens = self::DEFAULT_MAX_TOKENS
    ): array {
        $payload = [
            'model'      => $model,
            'max_tokens' => $maxTokens,
            'messages'   => $messages,
        ];
        if ($system !== null) {
            $payload['system'] = $system;
        }
        if ($tools !== null) {
            $payload['tools'] = $tools;
        }
        if ($toolChoice !== null) {
            $payload['tool_choice'] = $toolChoice;
        }
        return $payload;
    }

    /**
     * Parse a raw HTTP response body string into a PHP array.
     * Throws RuntimeException on malformed JSON or non-object root.
     *
     * @param string $jsonString
     * @return array
     */
    public static function parseResponse(string $jsonString): array
    {
        $decoded = json_decode($jsonString, true);
        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException(
                'Failed to parse Claude response as JSON: ' . json_last_error_msg()
            );
        }
        if (!is_array($decoded)) {
            throw new RuntimeException('Claude response root is not a JSON object');
        }
        return $decoded;
    }

    /**
     * Extract the (single) tool_use block from a parsed response's
     * content array. Returns its 'input' object.
     *
     * Mirrors Node extractToolInput conditions:
     *   - content must be an array
     *   - at least one block with type === 'tool_use' must exist
     *   - that block's name must equal $expectedToolName
     *   - that block's input must be an object/array
     *
     * @param array  $content            response.content array
     * @param string $expectedToolName   tool name forced via tool_choice
     * @return array                     the tool_use block's input
     */
    public static function extractToolUse(array $content, string $expectedToolName): array
    {
        $block = null;
        foreach ($content as $b) {
            if (is_array($b) && isset($b['type']) && $b['type'] === 'tool_use') {
                $block = $b;
                break;
            }
        }
        if ($block === null) {
            throw new RuntimeException('Claude response missing tool_use block');
        }
        if (!isset($block['name']) || $block['name'] !== $expectedToolName) {
            $actual = isset($block['name']) ? (string)$block['name'] : '(missing)';
            throw new RuntimeException('Claude called unexpected tool: ' . $actual);
        }
        if (!isset($block['input']) || !is_array($block['input'])) {
            throw new RuntimeException('Claude tool_use block missing input object');
        }
        return $block['input'];
    }

    /**
     * Read ANTHROPIC_API_KEY from a .env file. Returns null if the file
     * is missing/unreadable, the key is absent, or the value is empty.
     *
     * Does NOT throw -- "no key" is a normal state that triggers the
     * MOCK_EXPLANATION fallback in explain.php (preserves test runs
     * without a key, and lets the frontend work in dev without one).
     *
     * Default path: php-api/.env (resolved relative to this file).
     *
     * .env format supported:
     *   - lines starting with '#' or whitespace+'#' are comments
     *   - empty lines ignored
     *   - ANTHROPIC_API_KEY=value (whitespace around '=' allowed)
     *   - surrounding single/double quotes on value are stripped
     *
     * @param string|null $envPath
     * @return string|null
     */
    public static function loadApiKey(?string $envPath = null): ?string
    {
        if ($envPath === null) {
            $envPath = __DIR__ . '/../.env';
        }
        if (!file_exists($envPath) || !is_readable($envPath)) {
            return null;
        }
        $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return null;
        }
        foreach ($lines as $line) {
            $trimmed = ltrim($line);
            if ($trimmed === '' || $trimmed[0] === '#') {
                continue;
            }
            if (preg_match('/^ANTHROPIC_API_KEY\s*=\s*(.*)$/', $trimmed, $m)) {
                $value = trim($m[1]);
                // Strip matching surrounding quotes (single or double).
                if (strlen($value) >= 2) {
                    $first = $value[0];
                    $last  = $value[strlen($value) - 1];
                    if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                        $value = substr($value, 1, -1);
                    }
                }
                return $value === '' ? null : $value;
            }
        }
        return null;
    }

    /**
     * Send a payload to Anthropic /v1/messages. Returns the parsed
     * response array. Throws RuntimeException on:
     *   - empty $apiKey
     *   - JSON encode failure on payload
     *   - HTTP status >= 400 (message includes status + body)
     *   - cURL transport failure (DNS, TLS, timeout)
     *   - malformed httpClient return shape
     *
     * Test seam: $httpClient is a callable (string $url, array $headers,
     * string $body): array returning ['status' => int, 'body' => string].
     * Default is the private cURL implementation.
     *
     * @param array         $payload     output of buildPayload()
     * @param string        $apiKey      output of loadApiKey() or env
     * @param callable|null $httpClient  test injection seam
     * @return array                     parsed Claude response
     */
    public static function sendMessage(
        array $payload,
        string $apiKey,
        ?callable $httpClient = null
    ): array {
        if ($apiKey === '') {
            throw new RuntimeException('ANTHROPIC_API_KEY is empty');
        }
        $body = json_encode($payload);
        if ($body === false) {
            throw new RuntimeException(
                'Failed to encode payload as JSON: ' . json_last_error_msg()
            );
        }
        $headers = [
            'x-api-key: ' . $apiKey,
            'anthropic-version: ' . self::ANTHROPIC_VERSION,
            'content-type: application/json',
            'user-agent: ' . self::USER_AGENT,
        ];
        if ($httpClient === null) {
            $httpClient = [self::class, 'curlHttpClient'];
        }
        $result = call_user_func($httpClient, self::API_URL, $headers, $body);
        if (!is_array($result) || !isset($result['status'], $result['body'])) {
            throw new RuntimeException('httpClient returned malformed result');
        }
        $status = (int)$result['status'];
        if ($status >= 400) {
            $errBody = is_string($result['body']) ? $result['body'] : '';
            throw new RuntimeException('Claude API HTTP ' . $status . ': ' . $errBody);
        }
        return self::parseResponse((string)$result['body']);
    }

    /**
     * Default cURL implementation of the httpClient seam.
     * Private -- tested indirectly through sendMessage with a fake.
     *
     * @param string $url
     * @param array  $headers  array of "Header-Name: value" strings
     * @param string $body     raw request body
     * @return array           ['status' => int, 'body' => string]
     */
    private static function curlHttpClient(string $url, array $headers, string $body): array
    {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('Failed to initialize cURL handle');
        }
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => self::DEFAULT_TIMEOUT_SEC,
            CURLOPT_CONNECTTIMEOUT => self::DEFAULT_CONNECT_TIMEOUT_SEC,
            CURLOPT_FAILONERROR    => false, // we inspect status ourselves
        ]);
        $responseBody = curl_exec($ch);
        if ($responseBody === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new RuntimeException('cURL transport error: ' . $err);
        }
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return [
            'status' => $status,
            'body'   => (string)$responseBody,
        ];
    }
}
