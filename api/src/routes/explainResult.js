// explainResult.js -- POST /api/explain-result
// Day 3: when ANTHROPIC_API_KEY is set, calls Claude via tool use
// to format an /api/optimize result into a structured Thai explanation.
// Without the key, returns MOCK_EXPLANATION fallback (preserves CI tests).
//
// Contract (per handoff v5.5 D3.1):
//   Request:  { result: {...}, input?: {...} }
//             result must contain bestCost (number), bestDesign (object),
//             bestSteel (object). input is optional original OptimizeRequest.
//   Response 200: { summary, key_points, warnings, recommendations }
//   Response 400: { error: 'validation_failed', details: [...] }
//   Response 500: defers to global error handler

var express = require('express');
var Anthropic = require('@anthropic-ai/sdk');
var promptModule = require('../lib/explainResultPrompt');
var toolModule = require('../lib/explainResultTool');

var router = express.Router();

// Day 3 mock -- still used as fallback when no API key is configured.
// Lets the test suite run without a key and without network. Distinct
// values from any few-shot example so a passing happy-path test in the
// Claude-branch suite proves the live branch was exercised.
var MOCK_EXPLANATION = {
  summary: 'ผลการออกแบบ (mock fallback) -- ANTHROPIC_API_KEY ไม่ได้ตั้งค่า ระบบส่งคำอธิบายตัวอย่างแทน',
  key_points: [
    'ค่า bestCost ของ result ถูกส่งกลับโดยไม่ได้แปลความหมาย (ไม่มี LLM)',
    'หากต้องการคำอธิบายภาษาไทยจริงให้ตั้งค่า ANTHROPIC_API_KEY ใน environment'
  ],
  warnings: [],
  recommendations: [
    'ตั้งค่า ANTHROPIC_API_KEY แล้ว restart server เพื่อใช้ Claude'
  ]
};

// Lazy client cache. Returns null if no API key, signaling mock fallback.
var clientCache = null;
function getClient() {
  if (clientCache) return clientCache;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  clientCache = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return clientCache;
}

// Test seam: allow injection of a fake client for unit tests without
// touching env vars. Tests call this before each test and reset after.
function _setClientForTest(client) {
  clientCache = client;
}

// Cumulative validation gate. Mirrors api/src/validation.js style:
// collect all errors and return them together so the client can fix
// everything in one pass instead of error-ping-pong.
function validateBody(body) {
  var errors = [];
  if (!body || typeof body !== 'object') {
    errors.push({ field: 'body', message: 'must be a JSON object' });
    return errors;
  }
  if (!body.result || typeof body.result !== 'object') {
    errors.push({ field: 'result', message: 'must be an object' });
    // Cannot inspect sub-fields if result is missing.
    return errors;
  }
  if (typeof body.result.bestCost !== 'number' || isNaN(body.result.bestCost)) {
    errors.push({ field: 'result.bestCost', message: 'must be a finite number' });
  }
  if (!body.result.bestDesign || typeof body.result.bestDesign !== 'object') {
    errors.push({ field: 'result.bestDesign', message: 'must be an object' });
  }
  if (!body.result.bestSteel || typeof body.result.bestSteel !== 'object') {
    errors.push({ field: 'result.bestSteel', message: 'must be an object' });
  }
  if (body.input !== undefined && (body.input === null || typeof body.input !== 'object')) {
    errors.push({ field: 'input', message: 'when present, must be an object' });
  }
  return errors;
}

// Build request payload for messages.create from the validated body.
// Live user turn is constructed by promptModule.wrapLiveTurn so it
// satisfies tool_use/tool_result pairing for LAST_TOOL_USE_ID.
function buildClaudeRequest(body) {
  var fewShot = promptModule.FEW_SHOT_MESSAGES;
  // Live payload mirrors example shape: { result, input? }
  var livePayload = { result: body.result };
  if (body.input) livePayload.input = body.input;
  var liveTurn = promptModule.wrapLiveTurn(livePayload);
  return {
    model: 'claude-sonnet-4-6',
    // Bumped to 2048 per handoff Risk 6: explanations are longer than
    // parse-input tool inputs because key_points/warnings/recommen-
    // dations are Thai prose, not labels. If truncation observed in
    // smoke, raise to 4096.
    max_tokens: 2048,
    system: promptModule.SYSTEM_PROMPT,
    tools: [toolModule.TOOL_DEFINITION],
    tool_choice: toolModule.TOOL_CHOICE,
    messages: fewShot.concat([liveTurn])
  };
}

// Extract the single tool_use block we forced via tool_choice.
// Returns the structured input object or throws.
function extractToolInput(response) {
  if (!response || !Array.isArray(response.content)) {
    throw new Error('Claude response missing content array');
  }
  var block = response.content.find(function (b) { return b.type === 'tool_use'; });
  if (!block) {
    throw new Error('Claude response missing tool_use block');
  }
  if (block.name !== toolModule.TOOL_NAME) {
    throw new Error('Claude called unexpected tool: ' + block.name);
  }
  if (!block.input || typeof block.input !== 'object') {
    throw new Error('Claude tool_use block missing input object');
  }
  // Defaults for fields Claude sometimes omits despite required schema.
  // Smoke 2+3 in Day 3 (v5.6 carryover #2) showed warnings and
  // recommendations missing. Frontend assumes 4-field schema, so fill
  // defaults here rather than nullcheck downstream.
  var input = block.input;
  if (!Array.isArray(input.warnings)) input.warnings = [];
  if (!Array.isArray(input.recommendations)) input.recommendations = [];
  return input;
}

router.post('/', function (req, res, next) {
  var body = req.body || {};

  // Validation gate -- runs BEFORE getClient() so a malformed request
  // never reaches the real (or fake) Claude client. There is a
  // dedicated test for this regression -- do not reorder.
  var errors = validateBody(body);
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'validation_failed',
      details: errors
    });
  }

  var client = getClient();
  if (!client) {
    // No key configured -- return mock. Preserves tests without a key.
    return res.status(200).json(MOCK_EXPLANATION);
  }

  // Real Claude call. Promise chain matches parseInput.js style.
  var request = buildClaudeRequest(body);
  client.messages.create(request).then(function (response) {
    var toolInput = extractToolInput(response);
    res.status(200).json(toolInput);
  }).catch(function (err) {
    // Defer to global error handler. Anthropic SDK error classes
    // (AuthenticationError, RateLimitError, etc.) carry useful messages.
    next(err);
  });
});

module.exports = router;
module.exports._setClientForTest = _setClientForTest;
module.exports.MOCK_EXPLANATION = MOCK_EXPLANATION;
module.exports.buildClaudeRequest = buildClaudeRequest;
module.exports.extractToolInput = extractToolInput;
module.exports.validateBody = validateBody;
