// parseInput.js -- POST /api/parse-input
// Day 2: when ANTHROPIC_API_KEY is set, calls Claude via tool use
// for structured parameter extraction. Without the key, falls back to
// the Day 1 MOCK_HIGH_CONFIDENCE response (preserves existing tests).
//
// Contract (per handoff v5.3):
//   Request:  { input: string }  -- natural Thai description
//   Response 200: { parsed, confidence, reasoning, missing_fields }
//   Response 400: { error: 'validation_failed', details: [...] }

var express = require('express');
var Anthropic = require('@anthropic-ai/sdk');
var promptModule = require('../lib/parseInputPrompt');
var toolModule = require('../lib/parseInputTool');

var router = express.Router();

// Day 1 mock -- still used as fallback when no API key is configured.
// Allows the test suite to run without a key and without network.
var MOCK_HIGH_CONFIDENCE = {
  parsed: {
    H: 3, H1: 0.5,
    gamma_soil: 1.8, gamma_concrete: 2.4,
    phi: 30, mu: 0.5, qa: 20, cover: 0.075,
    material: { fy: 4000, fc: 240, concretePrice: 2500, steelPrice: 28 }
  },
  confidence: 'high',
  reasoning: 'stub response -- ANTHROPIC_API_KEY not configured, returning mock',
  missing_fields: []
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

// Build request payload for messages.create from user input.
// Live user turn is constructed by promptModule.wrapLiveTurn so that it
// satisfies the tool_use/tool_result pairing required by the API: the
// last tool_use in FEW_SHOT_MESSAGES needs a matching tool_result in
// the next user message, which is this live turn.
function buildClaudeRequest(input) {
  var fewShot = promptModule.FEW_SHOT_MESSAGES;
  var liveTurn = promptModule.wrapLiveTurn(input);
  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
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
  return block.input;
}

router.post('/', function (req, res, next) {
  var body = req.body || {};

  // Validation gate -- unchanged from Day 1.
  if (typeof body.input !== 'string' || body.input.trim().length === 0) {
    return res.status(400).json({
      error: 'validation_failed',
      details: [
        { field: 'input', message: 'must be a non-empty string' }
      ]
    });
  }

  var client = getClient();
  if (!client) {
    // No key configured -- return Day 1 mock. Preserves existing tests.
    return res.status(200).json(MOCK_HIGH_CONFIDENCE);
  }

  // Real Claude call. Use Promise chain instead of async/await to keep
  // style consistent with the rest of the codebase (var + function exprs).
  var request = buildClaudeRequest(body.input);
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
module.exports.MOCK_HIGH_CONFIDENCE = MOCK_HIGH_CONFIDENCE;
module.exports.buildClaudeRequest = buildClaudeRequest;
module.exports.extractToolInput = extractToolInput;
