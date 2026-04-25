// explainResult.claude.test.js -- exercises the Claude branch of POST /api/explain-result
// without making real network calls. Uses _setClientForTest seam to inject a
// fake Anthropic client per scenario. Mounts the router on a fresh Express app
// (not the full server) so the test is isolated from server.js config.
//
// Scenarios covered:
//   1. Happy path: fake returns valid tool_use -- expect 200 + body verbatim
//   2. Tool name mismatch: extractToolInput throws -- expect 500
//   3. Missing tool_use block: text-only content -- expect 500
//   4. SDK throws (e.g. AuthenticationError): catch + next(err) -- expect 500
//   5-9. Validation gate intact -- gate fires BEFORE Claude in every shape:
//        missing result, missing bestCost, missing bestDesign, missing bestSteel,
//        cumulative (multiple errors at once)
//   10. Optional input present: still 200 happy path
//   11. input = null (invalid): 400

var assert = require('assert');
var http = require('http');
var express = require('express');
var explainRouter = require('../src/routes/explainResult');

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

// POST helper -- identical pattern to parseInput tests for consistency.
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

// Build a fresh Express app that mounts only the explainResult router and
// a minimal global error handler. Mirrors what server.js does, but isolated.
function buildApp() {
  var app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/explain-result', explainRouter);
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
              id: 'toolu_test_explain',
              name: 'format_design_explanation',
              input: toolInputResponse
            }
          ]
        });
      }
    }
  };
}

// Variant for edge cases where we need full control over content array.
function makeFakeClientWithContent(contentBlocks) {
  return {
    messages: {
      create: function (req) {
        return Promise.resolve({ content: contentBlocks });
      }
    }
  };
}

// Distinct strings so a passing happy-path test proves the Claude
// branch ran (not the env-fallback mock). Avoids any token or phrase
// from MOCK_EXPLANATION.
var FAKE_TOOL_INPUT = {
  summary: 'fake summary -- กำแพงทดสอบจาก injected client',
  key_points: [
    'fake key point 1 -- ฐาน 2.5 เมตร',
    'fake key point 2 -- เหล็ก DB18 (ขนาดสมมติ)',
    'fake key point 3 -- SF ครบ'
  ],
  warnings: ['fake warning -- ค่า bearing ratio 0.85'],
  recommendations: ['fake recommendation -- ทดสอบดินจริง']
};

// Realistic OptimizeResponse-shape result body for the happy path.
// Field names follow conventional RC cantilever wall layout. If the
// live /api/optimize emits different names, only this fixture and
// few-shot in explainResultPrompt.js need adjustment -- the Tool
// schema and validation gate remain stable.
var FAKE_RESULT_INPUT = {
  result: {
    bestCost: 2992.45,
    bestIteration: 283,
    algorithm: 'ba',
    runtime_ms: 12,
    bestDesign: {
      B: 2.10, B1: 0.50, B2: 1.30,
      t1: 0.20, t2: 0.30, D: 0.30,
      H: 3, Hf: 0.30
    },
    bestSteel: {
      stem: { size: 'DB16', spacing_cm: 20, As_cm2_per_m: 10.05 },
      toe: { size: 'DB12', spacing_cm: 20, As_cm2_per_m: 5.65 },
      heel: { size: 'DB16', spacing_cm: 20, As_cm2_per_m: 10.05 }
    }
  },
  input: {
    H: 3, H1: 0.5,
    gamma_soil: 1.8, gamma_concrete: 2.4,
    phi: 30, mu: 0.5, qa: 20, cover: 0.075,
    material: { fy: 4000, fc: 240, concretePrice: 2500, steelPrice: 28 }
  }
};

// Variant without optional `input`. Used to verify the route does not
// require it and Claude branch still succeeds.
var FAKE_RESULT_INPUT_NO_INPUT = {
  result: FAKE_RESULT_INPUT.result
};

var app = buildApp();
var server = app.listen(0, function () {
  var port = server.address().port;
  console.log('explainResult.claude.test.js -- listening on ephemeral port ' + port);

  var steps = [
    {
      label: 'Claude branch happy path -- valid tool_use returns 200 + verbatim input',
      run: function (done) {
        explainRouter._setClientForTest(makeFakeClient(FAKE_TOOL_INPUT, null));
        postJson(port, '/api/explain-result', FAKE_RESULT_INPUT, function (err, res, body) {
          check('happy path -- no transport error', function () {
            assert.strictEqual(err, null);
          });
          check('happy path -- status 200', function () {
            assert.strictEqual(res.statusCode, 200);
          });
          check('happy path -- summary verbatim from fake', function () {
            assert.strictEqual(body.summary, FAKE_TOOL_INPUT.summary);
          });
          check('happy path -- key_points length matches fake (3 items)', function () {
            assert.strictEqual(body.key_points.length, 3);
          });
          check('happy path -- key_points[0] verbatim', function () {
            assert.strictEqual(body.key_points[0], FAKE_TOOL_INPUT.key_points[0]);
          });
          check('happy path -- warnings verbatim from fake', function () {
            assert.deepStrictEqual(body.warnings, FAKE_TOOL_INPUT.warnings);
          });
          check('happy path -- recommendations verbatim from fake', function () {
            assert.deepStrictEqual(body.recommendations, FAKE_TOOL_INPUT.recommendations);
          });
          done();
        });
      }
    },
    {
      label: 'Claude branch happy path WITHOUT input field -- still 200',
      run: function (done) {
        explainRouter._setClientForTest(makeFakeClient(FAKE_TOOL_INPUT, null));
        postJson(port, '/api/explain-result', FAKE_RESULT_INPUT_NO_INPUT, function (err, res, body) {
          check('no input -- status 200', function () {
            assert.strictEqual(res.statusCode, 200);
          });
          check('no input -- summary verbatim from fake', function () {
            assert.strictEqual(body.summary, FAKE_TOOL_INPUT.summary);
          });
          done();
        });
      }
    },
    {
      label: 'Claude branch tool name mismatch -- extractToolInput throws -> 500',
      run: function (done) {
        explainRouter._setClientForTest(makeFakeClientWithContent([
          { type: 'tool_use', id: 'toolu_test_x', name: 'wrong_tool', input: { foo: 'bar' } }
        ]));
        postJson(port, '/api/explain-result', FAKE_RESULT_INPUT, function (err, res, body) {
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
        explainRouter._setClientForTest(makeFakeClientWithContent([
          { type: 'text', text: 'I cannot use the tool right now.' }
        ]));
        postJson(port, '/api/explain-result', FAKE_RESULT_INPUT, function (err, res, body) {
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
        var fakeError = new Error('invalid x-api-key');
        fakeError.name = 'AuthenticationError';
        explainRouter._setClientForTest(makeFakeClient(null, fakeError));
        postJson(port, '/api/explain-result', FAKE_RESULT_INPUT, function (err, res, body) {
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
      label: 'Validation gate -- missing result -> 400 (does not call Claude)',
      run: function (done) {
        // Inject a client that would throw if called -- proves gate fires first.
        explainRouter._setClientForTest({
          messages: {
            create: function () { return Promise.reject(new Error('SHOULD NOT BE CALLED')); }
          }
        });
        postJson(port, '/api/explain-result', {}, function (err, res, body) {
          check('missing result -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('missing result -- error validation_failed', function () {
            assert.strictEqual(body.error, 'validation_failed');
          });
          check('missing result -- details mentions result field', function () {
            assert.ok(Array.isArray(body.details) && body.details.length >= 1);
            assert.ok(body.details.some(function (d) { return d.field === 'result'; }));
          });
          done();
        });
      }
    },
    {
      label: 'Validation gate -- result.bestCost not a number -> 400',
      run: function (done) {
        explainRouter._setClientForTest({
          messages: {
            create: function () { return Promise.reject(new Error('SHOULD NOT BE CALLED')); }
          }
        });
        var bad = {
          result: {
            bestCost: 'cheap',
            bestDesign: {},
            bestSteel: {}
          }
        };
        postJson(port, '/api/explain-result', bad, function (err, res, body) {
          check('bad bestCost -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('bad bestCost -- details mentions result.bestCost', function () {
            assert.ok(body.details.some(function (d) { return d.field === 'result.bestCost'; }));
          });
          done();
        });
      }
    },
    {
      label: 'Validation gate -- result.bestDesign missing -> 400',
      run: function (done) {
        explainRouter._setClientForTest({
          messages: {
            create: function () { return Promise.reject(new Error('SHOULD NOT BE CALLED')); }
          }
        });
        var bad = {
          result: {
            bestCost: 1000,
            bestSteel: {}
          }
        };
        postJson(port, '/api/explain-result', bad, function (err, res, body) {
          check('missing bestDesign -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('missing bestDesign -- details mentions result.bestDesign', function () {
            assert.ok(body.details.some(function (d) { return d.field === 'result.bestDesign'; }));
          });
          done();
        });
      }
    },
    {
      label: 'Validation gate -- result.bestSteel missing -> 400',
      run: function (done) {
        explainRouter._setClientForTest({
          messages: {
            create: function () { return Promise.reject(new Error('SHOULD NOT BE CALLED')); }
          }
        });
        var bad = {
          result: {
            bestCost: 1000,
            bestDesign: {}
          }
        };
        postJson(port, '/api/explain-result', bad, function (err, res, body) {
          check('missing bestSteel -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('missing bestSteel -- details mentions result.bestSteel', function () {
            assert.ok(body.details.some(function (d) { return d.field === 'result.bestSteel'; }));
          });
          done();
        });
      }
    },
    {
      label: 'Validation gate -- cumulative (3 errors at once) -> 400 with all details',
      run: function (done) {
        explainRouter._setClientForTest({
          messages: {
            create: function () { return Promise.reject(new Error('SHOULD NOT BE CALLED')); }
          }
        });
        var bad = {
          result: {
            bestCost: NaN,
            bestDesign: null,
            bestSteel: 'not an object'
          }
        };
        postJson(port, '/api/explain-result', bad, function (err, res, body) {
          check('cumulative -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('cumulative -- details length >= 3 (collected, not short-circuited)', function () {
            assert.ok(body.details.length >= 3,
              'expected >=3 details, got ' + body.details.length);
          });
          done();
        });
      }
    },
    {
      label: 'Validation gate -- input is null (when present must be object) -> 400',
      run: function (done) {
        explainRouter._setClientForTest({
          messages: {
            create: function () { return Promise.reject(new Error('SHOULD NOT BE CALLED')); }
          }
        });
        var bad = {
          result: {
            bestCost: 2992.45,
            bestDesign: { B: 2.1 },
            bestSteel: { stem: {} }
          },
          input: null
        };
        postJson(port, '/api/explain-result', bad, function (err, res, body) {
          check('null input -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('null input -- details mentions input field', function () {
            assert.ok(body.details.some(function (d) { return d.field === 'input'; }));
          });
          done();
        });
      }
    }
  ];

  runSteps(steps, function () {
    // Reset client cache so a subsequent test process starting clean
    // does not see leftover state.
    explainRouter._setClientForTest(null);
    console.log('');
    console.log('PASS: ' + passed + ' / FAIL: ' + failed);
    server.close(function () {
      process.exit(failed === 0 ? 0 : 1);
    });
  });
});
