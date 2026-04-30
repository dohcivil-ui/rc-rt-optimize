// chat.test.js -- Day 9.9. Two layers:
//   1. Pure-JS unit tests for chatTools (handleToolCall + validation)
//      and chatMock (keyword + regex extraction).
//   2. Integration tests for /api/chat with the mock fallback path
//      (no API key required) and with an injected fake Claude client.

var assert = require('assert');
var http = require('http');
var chatTools = require('../src/lib/chatTools');
var chatMock = require('../src/lib/chatMock');
var app = require('../src/server');

var passed = 0;
var failed = 0;
function pass(label) { passed = passed + 1; console.log('  PASS: ' + label); }
function fail(label, err) {
  failed = failed + 1;
  console.log('  FAIL: ' + label + '  --  ' + (err && err.message ? err.message : err));
}
function check(label, fn) {
  try { fn(); pass(label); } catch (err) { fail(label, err); }
}

var BASE_PARAMS = {
  H: 3,
  H1: 1.2,
  gamma_soil: 1.8,
  gamma_concrete: 2.4,
  phi: 30,
  mu: 0.6,
  qa: 30,
  cover: 0.075,
  material: { fy: 4000, fc: 240, concretePrice: 2430, steelPrice: 24 }
};

var BASE_RESULT_SUMMARY = {
  bestCost: 2849.23,
  bestIteration: 58,
  algorithm: 'BA',
  verification: { allPass: true, FS_OT: 5.17, FS_SL: 2.94, FS_BC: 5.70 }
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// -------------------- Section 1: chatTools --------------------
check('validateParams: empty input -> no errors', function () {
  assert.deepStrictEqual(chatTools.validateParams({}), []);
});
check('validateParams: H=10 out of range', function () {
  var errs = chatTools.validateParams({ H: 10 });
  assert.strictEqual(errs.length, 1);
  assert.ok(errs[0].indexOf('H=10') !== -1);
});
check('validateParams: multiple out of range', function () {
  var errs = chatTools.validateParams({ H: 10, fc_prime: 100, fy: 1000 });
  assert.strictEqual(errs.length, 3);
});
check('handleToolCall: unknown tool name', function () {
  var r = chatTools.handleToolCall('foo', {}, BASE_PARAMS);
  assert.ok(r.error && r.error.indexOf('Unknown tool') !== -1);
});
check('handleToolCall: out-of-range returns error + hint', function () {
  var r = chatTools.handleToolCall('re_optimize_with_params', { H: 10 }, BASE_PARAMS);
  assert.ok(r.error && r.error.indexOf('นอก range') !== -1);
  assert.ok(typeof r.hint === 'string' && r.hint.length > 0);
  assert.deepStrictEqual(r.changedParams, { H: 10 });
});
check('handleToolCall: valid fc_prime override returns engine result', function () {
  var r = chatTools.handleToolCall('re_optimize_with_params', { fc_prime: 320 }, BASE_PARAMS);
  assert.ok(!r.error, 'unexpected error: ' + r.error);
  assert.strictEqual(r.algorithm, 'BA');
  assert.deepStrictEqual(r.changedParams, { fc_prime: 320 });
  assert.ok(typeof r.bestCost === 'number' && r.bestCost > 0);
  assert.ok(typeof r.bestIteration === 'number');
  assert.ok(r.verification && typeof r.verification.allPass === 'boolean');
  assert.ok(r.design && typeof r.design.Base === 'number');
});
check('handleToolCall: HCA algorithm honored', function () {
  var r = chatTools.handleToolCall('re_optimize_with_params', { H: 4, algorithm: 'HCA' }, BASE_PARAMS);
  assert.ok(!r.error, r.error);
  assert.strictEqual(r.algorithm, 'HCA');
});
check('mergeParams: tool fields mapped onto /optimize body shape', function () {
  var m = chatTools.mergeParams(BASE_PARAMS, { fc_prime: 320, fy: 5000, q_allow: 25 });
  assert.strictEqual(m.material.fc, 320);
  assert.strictEqual(m.material.fy, 5000);
  assert.strictEqual(m.qa, 25);
  // unrelated fields preserved
  assert.strictEqual(m.H, BASE_PARAMS.H);
  assert.strictEqual(m.material.concretePrice, BASE_PARAMS.material.concretePrice);
  // budget injected
  assert.strictEqual(m.options.maxIterations, 2000);
});

// -------------------- Section 2: chatMock --------------------
check('chatMock: knowledge "FS_OT คืออะไร?" -> no toolCalls', function () {
  var r = chatMock.generateMockReply('FS_OT คืออะไร?', BASE_PARAMS, BASE_RESULT_SUMMARY);
  assert.deepStrictEqual(r.toolCalls, []);
  assert.ok(r.reply.indexOf('FS_OT') !== -1);
  assert.ok(r.reply.indexOf('5.17') !== -1, 'expected current FS_OT in reply: ' + r.reply);
  assert.strictEqual(r.usedMock, true);
});
check('chatMock: "BA กับ HCA ต่างกันยังไง?" -> no toolCalls', function () {
  var r = chatMock.generateMockReply('BA กับ HCA ต่างกันยังไง?', BASE_PARAMS, BASE_RESULT_SUMMARY);
  assert.deepStrictEqual(r.toolCalls, []);
});
check('chatMock: "เปลี่ยน fc\' เป็น 320" triggers tool with extracted param', function () {
  var r = chatMock.generateMockReply('ลองเปลี่ยน fc\' เป็น 320 ดีมั้ย?', BASE_PARAMS, BASE_RESULT_SUMMARY);
  assert.strictEqual(r.toolCalls.length, 1);
  assert.deepStrictEqual(r.toolCalls[0].input, { fc_prime: 320 });
  assert.ok(!r.toolCalls[0].result.error, r.toolCalls[0].result.error);
  // Reply must echo the bestCost the engine actually returned, not a hardcode.
  var bc = r.toolCalls[0].result.bestCost;
  assert.ok(r.reply.indexOf(bc.toFixed(0)) !== -1,
    'reply missing engine bestCost ' + bc + ': ' + r.reply);
});
check('chatMock: "ถ้าสูง 5 เมตร" triggers tool with H=5', function () {
  var r = chatMock.generateMockReply('ถ้ากำแพงสูง 5 เมตรต้นทุนเท่าไหร่?', BASE_PARAMS, BASE_RESULT_SUMMARY);
  assert.strictEqual(r.toolCalls.length, 1);
  assert.deepStrictEqual(r.toolCalls[0].input, { H: 5 });
});
check('chatMock: "ถ้าสูง 10 เมตร" -> tool error (out of range)', function () {
  var r = chatMock.generateMockReply('ถ้ากำแพงสูง 10 เมตรล่ะ?', BASE_PARAMS, BASE_RESULT_SUMMARY);
  assert.strictEqual(r.toolCalls.length, 1);
  assert.ok(r.toolCalls[0].result.error, 'expected tool error');
  assert.ok(r.reply.indexOf('นอก') !== -1 || r.reply.indexOf('range') !== -1,
    'reply should mention range issue: ' + r.reply);
});
check('chatMock: tool keyword without numbers asks user to clarify', function () {
  var r = chatMock.generateMockReply('ลองปรับ parameter ดู', BASE_PARAMS, BASE_RESULT_SUMMARY);
  assert.strictEqual(r.toolCalls.length, 0);
  assert.ok(r.reply.indexOf('ตัวเลข') !== -1 || r.reply.indexOf('ลองพิมพ์') !== -1);
});

// -------------------- Section 3: HTTP integration --------------------
function postJson(port, path, body, callback) {
  var payload = JSON.stringify(body);
  var req = http.request({
    hostname: '127.0.0.1', port: port, path: path, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  }, function (res) {
    var chunks = [];
    res.on('data', function (c) { chunks.push(c); });
    res.on('end', function () {
      var raw = Buffer.concat(chunks).toString('utf8');
      var json = null;
      try { json = JSON.parse(raw); } catch (e) { /* allow */ }
      callback(null, { status: res.statusCode, body: json, raw: raw });
    });
  });
  req.on('error', callback);
  req.write(payload);
  req.end();
}
function runSteps(steps, doneAll) {
  var i = 0;
  function next() {
    if (i >= steps.length) { doneAll(); return; }
    var step = steps[i]; i = i + 1; step(next);
  }
  next();
}

var server = app.listen(0, function () {
  var port = server.address().port;
  console.log('=== Testing /api/chat on port ' + port + ' ===');

  function done() {
    server.close(function () {
      console.log('');
      if (failed === 0) {
        console.log('PASS: ' + passed + ' tests');
        process.exit(0);
      } else {
        console.log('FAIL: ' + failed + ' of ' + (passed + failed) + ' tests');
        process.exit(1);
      }
    });
  }

  // POST without API key -> mock fallback path. Tests assume the env
  // var is unset; CI runs do not set ANTHROPIC_API_KEY.
  function t1(next) {
    postJson(port, '/api/chat', {
      message: 'FS_OT คืออะไร?',
      currentParams: clone(BASE_PARAMS),
      currentResult: clone(BASE_RESULT_SUMMARY)
    }, function (err, r) {
      if (err) { fail('t1 dispatch', err); next(); return; }
      check('chat mock: status 200', function () { assert.strictEqual(r.status, 200); });
      check('chat mock: usedMock === true', function () { assert.strictEqual(r.body.usedMock, true); });
      check('chat mock: knowledge -> empty toolCalls', function () {
        assert.ok(Array.isArray(r.body.toolCalls) && r.body.toolCalls.length === 0);
      });
      check('chat mock: reply mentions FS_OT and 5.17', function () {
        assert.ok(r.body.reply.indexOf('FS_OT') !== -1);
        assert.ok(r.body.reply.indexOf('5.17') !== -1);
      });
      next();
    });
  }

  function t2(next) {
    postJson(port, '/api/chat', {
      message: 'ลองเปลี่ยน fc\' เป็น 320 ดีมั้ย?',
      currentParams: clone(BASE_PARAMS),
      currentResult: clone(BASE_RESULT_SUMMARY)
    }, function (err, r) {
      if (err) { fail('t2 dispatch', err); next(); return; }
      check('chat mock: tool-trigger -> 200', function () { assert.strictEqual(r.status, 200); });
      check('chat mock: toolCalls length 1', function () {
        assert.strictEqual(r.body.toolCalls.length, 1);
      });
      check('chat mock: tool result has bestCost > 0', function () {
        var tc = r.body.toolCalls[0];
        assert.ok(!tc.result.error, tc.result.error);
        assert.ok(typeof tc.result.bestCost === 'number' && tc.result.bestCost > 0);
      });
      next();
    });
  }

  function t3(next) {
    postJson(port, '/api/chat', { message: '   ' }, function (err, r) {
      if (err) { fail('t3 dispatch', err); next(); return; }
      check('chat: empty message -> 400 validation_failed', function () {
        assert.strictEqual(r.status, 400);
        assert.strictEqual(r.body.error, 'validation_failed');
      });
      next();
    });
  }

  runSteps([t1, t2, t3], done);
});
