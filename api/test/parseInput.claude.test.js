// parseInput.claude.test.js -- exercises the Claude branch of POST /api/parse-input
// without making real network calls. Uses _setClientForTest seam to inject a
// fake Anthropic client per scenario. Mounts the router on a fresh Express app
// (not the full server) so the test is isolated from server.js config.
//
// Scenarios covered:
//   1. Happy path: fake returns valid tool_use -- expect 200 + body verbatim
//   2. Tool name mismatch: extractToolInput throws -- expect 500
//   3. Missing tool_use block: text-only content -- expect 500
//   4. SDK throws (e.g. AuthenticationError): catch + next(err) -- expect 500
//   5. Validation gate intact: empty input short-circuits before Claude call

var assert = require('assert');
var http = require('http');
var express = require('express');
var parseRouter = require('../src/routes/parseInput');

var passed = 0;
var failed = 0;

function pass(label) {
  passed = passed + 1;
  console.log('  PASS: ' + label);
}

function fail(label, err) {
  failed = failed + 1;
  console.log('  FAIL: ' + label + '  --  ' + (err && err.message ? err.message : err));
}

function check(label, fn) {
  try { fn(); pass(label); } catch (err) { fail(label, err); }
}

// POST helper -- identical pattern to Day 1 parseInput.test.js for consistency.
function postJson(port, path, body, cb) {
  var payload = typeof body === 'string' ? body : JSON.stringify(body);
  var req = http.request({
    host: '127.0.0.1',
    port: port,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, function (res) {
    var chunks = [];
    res.on('data', function (c) { chunks.push(c); });
    res.on('end', function () {
      var raw = Buffer.concat(chunks).toString('utf8');
      var parsed;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
      cb(null, res, parsed);
    });
  });
  req.on('error', function (err) { cb(err); });
  req.write(payload);
  req.end();
}

function runSteps(steps, doneAll) {
  var i = 0;
  function next() {
    if (i >= steps.length) { return doneAll(); }
    var s = steps[i];
    i = i + 1;
    s.run(next);
  }
  next();
}

// Build a fresh Express app that mounts only the parseInput router and
// a minimal global error handler. Mirrors what server.js does, but isolated.
function buildApp() {
  var app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/parse-input', parseRouter);
  app.use(function (err, req, res, next) {
    res.status(500).json({ error: 'internal_error', message: err.message });
  });
  return app;
}

// Spec mock client -- returns a realistic two-block content array
// (preamble text + tool_use). errorToThrow simulates SDK rejection.
function makeFakeClient(toolInputResponse, errorToThrow) {
  return {
    messages: {
      create: function (req) {
        if (errorToThrow) return Promise.reject(errorToThrow);
        return Promise.resolve({
          content: [
            { type: 'text', text: 'I will use the tool.' },
            {
              type: 'tool_use',
              id: 'toolu_test_001',
              name: 'extract_design_params',
              input: toolInputResponse
            }
          ]
        });
      }
    }
  };
}

// Variant for edge cases where we need full control over the content array
// (wrong tool name, no tool_use block at all).
function makeFakeClientWithContent(contentBlocks) {
  return {
    messages: {
      create: function (req) {
        return Promise.resolve({ content: contentBlocks });
      }
    }
  };
}

// Distinct from MOCK_HIGH_CONFIDENCE so a passing happy-path test proves the
// Claude branch ran (not the env-fallback mock). Uses different H, fc, phi,
// confidence, reasoning, and missing_fields than the mock.
var FAKE_TOOL_INPUT = {
  parsed: {
    H: 4.5, H1: 0.6,
    gamma_soil: 1.9, gamma_concrete: 2.4,
    phi: 32, mu: 0.55, qa: 25, cover: 0.075,
    material: { fy: 4000, fc: 280, concretePrice: 2700, steelPrice: 30 }
  },
  confidence: 'medium',
  reasoning: 'fake reasoning from injected client',
  missing_fields: ['gamma_concrete']
};

var app = buildApp();
var server = app.listen(0, function () {
  var port = server.address().port;
  console.log('parseInput.claude.test.js -- listening on ephemeral port ' + port);

  var steps = [
    {
      label: 'Claude branch happy path -- valid tool_use returns 200 + verbatim input',
      run: function (done) {
        parseRouter._setClientForTest(makeFakeClient(FAKE_TOOL_INPUT, null));
        postJson(port, '/api/parse-input', { input: 'กำแพง 4.5 เมตร phi 32 fc 280' }, function (err, res, body) {
          check('happy path -- no transport error', function () {
            assert.strictEqual(err, null);
          });
          check('happy path -- status 200', function () {
            assert.strictEqual(res.statusCode, 200);
          });
          check('happy path -- parsed.H === 4.5 (verbatim from fake)', function () {
            assert.strictEqual(body.parsed.H, 4.5);
          });
          check('happy path -- parsed.material.fc === 280 (verbatim from fake)', function () {
            assert.strictEqual(body.parsed.material.fc, 280);
          });
          check('happy path -- confidence === medium (verbatim from fake)', function () {
            assert.strictEqual(body.confidence, 'medium');
          });
          check('happy path -- reasoning matches fake string', function () {
            assert.strictEqual(body.reasoning, 'fake reasoning from injected client');
          });
          check('happy path -- missing_fields matches fake array', function () {
            assert.deepStrictEqual(body.missing_fields, ['gamma_concrete']);
          });
          done();
        });
      }
    },
    {
      label: 'Claude branch tool name mismatch -- extractToolInput throws -> 500',
      run: function (done) {
        parseRouter._setClientForTest(makeFakeClientWithContent([
          { type: 'tool_use', id: 'toolu_test_002', name: 'wrong_tool', input: { foo: 'bar' } }
        ]));
        postJson(port, '/api/parse-input', { input: 'กำแพง 3 เมตร' }, function (err, res, body) {
          check('wrong tool -- status 500', function () {
            assert.strictEqual(res.statusCode, 500);
          });
          check('wrong tool -- error === internal_error', function () {
            assert.strictEqual(body.error, 'internal_error');
          });
          check('wrong tool -- message mentions unexpected tool', function () {
            assert.ok(body.message && body.message.indexOf('unexpected tool') !== -1,
              'expected message to mention "unexpected tool", got: ' + body.message);
          });
          done();
        });
      }
    },
    {
      label: 'Claude branch missing tool_use -- text-only content -> 500',
      run: function (done) {
        parseRouter._setClientForTest(makeFakeClientWithContent([
          { type: 'text', text: 'I cannot use the tool right now.' }
        ]));
        postJson(port, '/api/parse-input', { input: 'กำแพง 3 เมตร' }, function (err, res, body) {
          check('missing tool_use -- status 500', function () {
            assert.strictEqual(res.statusCode, 500);
          });
          check('missing tool_use -- error === internal_error', function () {
            assert.strictEqual(body.error, 'internal_error');
          });
          check('missing tool_use -- message mentions missing tool_use', function () {
            assert.ok(body.message && body.message.indexOf('missing tool_use') !== -1,
              'expected message to mention "missing tool_use", got: ' + body.message);
          });
          done();
        });
      }
    },
    {
      label: 'Claude branch SDK error -- fake throws -> 500 with echoed message',
      run: function (done) {
        // Simulate Anthropic SDK AuthenticationError without importing the class.
        // Behavior we test: any rejected Promise from messages.create flows
        // through .catch -> next(err) -> global error handler -> 500.
        var fakeError = new Error('invalid x-api-key');
        fakeError.name = 'AuthenticationError';
        parseRouter._setClientForTest(makeFakeClient(null, fakeError));
        postJson(port, '/api/parse-input', { input: 'กำแพง 3 เมตร' }, function (err, res, body) {
          check('SDK error -- status 500', function () {
            assert.strictEqual(res.statusCode, 500);
          });
          check('SDK error -- error === internal_error', function () {
            assert.strictEqual(body.error, 'internal_error');
          });
          check('SDK error -- message echoed from thrown error', function () {
            assert.strictEqual(body.message, 'invalid x-api-key');
          });
          done();
        });
      }
    },
    {
      label: 'Validation gate intact -- empty input short-circuits before Claude call',
      run: function (done) {
        // Client is injected, but validation should fire first. If gate were
        // broken, this would call into the fake and return 200 instead of 400.
        parseRouter._setClientForTest(makeFakeClient(FAKE_TOOL_INPUT, null));
        postJson(port, '/api/parse-input', { input: '' }, function (err, res, body) {
          check('validation gate intact -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('validation gate intact -- error === validation_failed', function () {
            assert.strictEqual(body.error, 'validation_failed');
          });
          done();
        });
      }
    }
  ];

  runSteps(steps, function () {
    // Reset client cache so a subsequent test process starting clean
    // does not see leftover state. Belt-and-suspenders since the process
    // exits next anyway.
    parseRouter._setClientForTest(null);
    console.log('');
    console.log('PASS: ' + passed + ' / FAIL: ' + failed);
    server.close(function () {
      process.exit(failed === 0 ? 0 : 1);
    });
  });
});
