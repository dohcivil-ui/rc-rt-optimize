// parseInput.js -- POST /api/parse-input
// Day 1 stub: validates payload shape, returns a fixed mock response.
// Day 2 will replace the mock body with a real Claude SDK call using
// tool use for structured output matching OptimizeRequest schema.
//
// Contract (per handoff v5.3):
//   Request:  { input: string }  -- natural Thai description
//   Response 200: { parsed, confidence, reasoning, missing_fields }
//   Response 400: { error: 'validation_failed', details: [...] }

var express = require('express');
var router = express.Router();

// Fixed mock matching the handoff v5.3 high-confidence example.
// Represents what Claude is expected to return for a simple Thai
// input like "ออกแบบกำแพง 3 เมตร". Defaults mirror the VB6 scenario 1
// baseline (H=3, phi=30, fc=240) used throughout Week 1-2 tests.
var MOCK_HIGH_CONFIDENCE = {
  parsed: {
    H: 3,
    H1: 0.5,
    gamma_soil: 1.8,
    gamma_concrete: 2.4,
    phi: 30,
    mu: 0.5,
    qa: 20,
    cover: 0.075,
    material: {
      fy: 4000,
      fc: 240,
      concretePrice: 2500,
      steelPrice: 28
    }
  },
  confidence: 'high',
  reasoning: 'stub response -- Claude integration deferred to Day 2',
  missing_fields: []
};

router.post('/', function (req, res) {
  var body = req.body || {};

  // Minimal validation: input must be a non-empty string after trim.
  // This same gate carries forward to Day 2 before calling Claude,
  // so tests written now will continue to pass after the swap.
  if (typeof body.input !== 'string' || body.input.trim().length === 0) {
    return res.status(400).json({
      error: 'validation_failed',
      details: [
        { field: 'input', message: 'must be a non-empty string' }
      ]
    });
  }

  // Day 1: ignore body.input contents, return the fixed mock.
  // Day 2: pass body.input to Claude SDK via tool use and return
  //        the real structured parse result.
  return res.status(200).json(MOCK_HIGH_CONFIDENCE);
});

module.exports = router;
