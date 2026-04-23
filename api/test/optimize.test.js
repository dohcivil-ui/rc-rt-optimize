// optimize.test.js -- plain Node test for POST /api/optimize.
// Boots the Express app on an ephemeral port, issues HTTP requests
// via the built-in http module, and asserts against responses.
// Ground truth values for Test 1 / Test 2 come from the spec and
// were obtained by running backend/src/ba.js directly.

var assert = require('assert');
var http = require('http');
var app = require('../src/server');

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

// POST a JSON payload and hand the parsed response to callback(err, res).
function postJson(port, path, body, callback) {
  var payload = JSON.stringify(body);
  var req = http.request({
    hostname: '127.0.0.1',
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
      var json = null;
      try { json = JSON.parse(raw); } catch (e) { /* non-JSON body allowed */ }
      callback(null, { status: res.statusCode, headers: res.headers, body: json, raw: raw });
    });
  });
  req.on('error', callback);
  req.write(payload);
  req.end();
}

// Issue a plain GET for method-not-allowed style checks.
function getRaw(port, path, callback) {
  http.get({ hostname: '127.0.0.1', port: port, path: path }, function (res) {
    var chunks = [];
    res.on('data', function (c) { chunks.push(c); });
    res.on('end', function () {
      callback(null, { status: res.statusCode, headers: res.headers });
    });
  }).on('error', callback);
}

// Baseline valid body. Individual tests clone and mutate it.
var BASE_BODY = {
  H: 3,
  H1: 0.5,
  gamma_soil: 1.8,
  gamma_concrete: 2.4,
  phi: 30,
  mu: 0.5,
  qa: 20,
  cover: 0.075,
  material: { fy: 4000, fc: 240, concretePrice: 2500, steelPrice: 28 },
  options: { seed: 42, maxIterations: 10000 }
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// Sequential step runner -- each step receives a `done` callback and
// calls it when finished. Keeps the chain flat and avoids deep nesting.
function runSteps(steps, doneAll) {
  var i = 0;
  function next() {
    if (i >= steps.length) { doneAll(); return; }
    var step = steps[i];
    i = i + 1;
    step(next);
  }
  next();
}

// Helper to reduce boilerplate in body-mutation failure tests.
function containsSubstring(arr, substr) {
  if (!arr || typeof arr.length !== 'number') return false;
  var i;
  for (i = 0; i < arr.length; i++) {
    if (typeof arr[i] === 'string' && arr[i].indexOf(substr) !== -1) return true;
  }
  return false;
}

var server = app.listen(0, function () {
  var port = server.address().port;
  console.log('=== Testing /api/optimize on port ' + port + ' ===');

  // --- Test 1: ground truth scenario 1 (H=3, fc=240, seed=42) ---
  function test1(done) {
    postJson(port, '/api/optimize', clone(BASE_BODY), function (err, r) {
      if (err) { fail('T1 dispatch', err); done(); return; }
      check('T1: status === 200', function () {
        assert.strictEqual(r.status, 200, 'status ' + r.status + ', body: ' + r.raw);
      });
      check('T1: bestCost === 2992.4507519999997', function () {
        assert.ok(r.body && typeof r.body.bestCost === 'number', 'no bestCost');
        assert.ok(Math.abs(r.body.bestCost - 2992.4507519999997) < 1e-9,
          'got ' + r.body.bestCost);
      });
      check('T1: bestIteration === 283', function () {
        assert.strictEqual(r.body && r.body.bestIteration, 283);
      });
      check('T1: algorithm === "ba"', function () {
        assert.strictEqual(r.body && r.body.algorithm, 'ba');
      });
      check('T1: runtime_ms is number >= 0', function () {
        assert.strictEqual(typeof r.body.runtime_ms, 'number');
        assert.ok(r.body.runtime_ms >= 0, 'negative runtime: ' + r.body.runtime_ms);
      });
      check('T1: bestDesign is non-null object', function () {
        assert.ok(r.body.bestDesign && typeof r.body.bestDesign === 'object');
      });
      check('T1: bestSteel is non-null object', function () {
        assert.ok(r.body.bestSteel && typeof r.body.bestSteel === 'object');
      });
      done();
    });
  }

  // --- Test 2: ground truth scenario 2 (H=4, fc=280, seed=42) ---
  function test2(done) {
    var body = clone(BASE_BODY);
    body.H = 4;
    body.material.fc = 280;
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T2 dispatch', err); done(); return; }
      check('T2: status === 200', function () {
        assert.strictEqual(r.status, 200, 'status ' + r.status + ', body: ' + r.raw);
      });
      check('T2: bestCost === 4812.973376', function () {
        assert.ok(r.body && typeof r.body.bestCost === 'number');
        assert.ok(Math.abs(r.body.bestCost - 4812.973376) < 1e-9,
          'got ' + r.body.bestCost);
      });
      check('T2: bestIteration === 523', function () {
        assert.strictEqual(r.body && r.body.bestIteration, 523);
      });
      done();
    });
  }

  // --- Test 3: determinism (same request twice -> identical bestCost) ---
  function test3(done) {
    postJson(port, '/api/optimize', clone(BASE_BODY), function (err, r1) {
      if (err) { fail('T3 first dispatch', err); done(); return; }
      postJson(port, '/api/optimize', clone(BASE_BODY), function (err2, r2) {
        if (err2) { fail('T3 second dispatch', err2); done(); return; }
        check('T3: determinism -- identical bestCost across runs', function () {
          assert.strictEqual(r1.status, 200);
          assert.strictEqual(r2.status, 200);
          var a = r1.body.bestCost;
          var b = r2.body.bestCost;
          assert.ok(Math.abs(a - b) < 1e-12, 'drift: ' + a + ' vs ' + b);
        });
        done();
      });
    });
  }

  // --- Test 4: missing required field H -> 400 ---
  function test4(done) {
    var body = clone(BASE_BODY);
    delete body.H;
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T4 dispatch', err); done(); return; }
      check('T4: status === 400', function () {
        assert.strictEqual(r.status, 400);
      });
      check('T4: error === "validation_failed"', function () {
        assert.strictEqual(r.body && r.body.error, 'validation_failed');
      });
      check('T4: details contains an error mentioning "H"', function () {
        assert.ok(Array.isArray(r.body.details));
        assert.ok(containsSubstring(r.body.details, 'H'),
          'no H-related message in ' + JSON.stringify(r.body.details));
      });
      done();
    });
  }

  // --- Test 5: out-of-range H -> 400 with "range" ---
  function test5(done) {
    var body = clone(BASE_BODY);
    body.H = 10;
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T5 dispatch', err); done(); return; }
      check('T5: status === 400', function () {
        assert.strictEqual(r.status, 400);
      });
      check('T5: error === "validation_failed"', function () {
        assert.strictEqual(r.body && r.body.error, 'validation_failed');
      });
      check('T5: details includes both "H" and "range"', function () {
        assert.ok(Array.isArray(r.body.details));
        var i, hit = false;
        for (i = 0; i < r.body.details.length; i++) {
          var d = r.body.details[i];
          if (typeof d === 'string' && d.indexOf('H') !== -1 && d.indexOf('range') !== -1) {
            hit = true; break;
          }
        }
        assert.ok(hit, 'no H+range message in ' + JSON.stringify(r.body.details));
      });
      done();
    });
  }

  // --- Test 6: wrong type (string H) -> 400 with "number" ---
  function test6(done) {
    var body = clone(BASE_BODY);
    body.H = 'three';
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T6 dispatch', err); done(); return; }
      check('T6: status === 400', function () {
        assert.strictEqual(r.status, 400);
      });
      check('T6: error === "validation_failed"', function () {
        assert.strictEqual(r.body && r.body.error, 'validation_failed');
      });
      check('T6: details includes both "H" and "number"', function () {
        assert.ok(Array.isArray(r.body.details));
        var i, hit = false;
        for (i = 0; i < r.body.details.length; i++) {
          var d = r.body.details[i];
          if (typeof d === 'string' && d.indexOf('H') !== -1 && d.indexOf('number') !== -1) {
            hit = true; break;
          }
        }
        assert.ok(hit, 'no H+number message in ' + JSON.stringify(r.body.details));
      });
      done();
    });
  }

  // --- Test 7: missing nested material.fc -> 400 ---
  function test7(done) {
    var body = clone(BASE_BODY);
    delete body.material.fc;
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T7 dispatch', err); done(); return; }
      check('T7: status === 400', function () {
        assert.strictEqual(r.status, 400);
      });
      check('T7: error === "validation_failed"', function () {
        assert.strictEqual(r.body && r.body.error, 'validation_failed');
      });
      check('T7: details mentions "fc" (or "material.fc")', function () {
        assert.ok(Array.isArray(r.body.details));
        assert.ok(containsSubstring(r.body.details, 'fc'),
          'no fc message in ' + JSON.stringify(r.body.details));
      });
      done();
    });
  }

  // --- Test 8: multiple errors (H=10 AND phi=100) ---
  function test8(done) {
    var body = clone(BASE_BODY);
    body.H = 10;
    body.phi = 100;
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T8 dispatch', err); done(); return; }
      check('T8: status === 400', function () {
        assert.strictEqual(r.status, 400);
      });
      check('T8: details.length >= 2 (errors collected, not short-circuited)', function () {
        assert.ok(Array.isArray(r.body.details));
        assert.ok(r.body.details.length >= 2,
          'only ' + r.body.details.length + ' errors: ' + JSON.stringify(r.body.details));
      });
      done();
    });
  }

  // --- Test 9: empty body -> 400 with details for all required fields ---
  function test9(done) {
    postJson(port, '/api/optimize', {}, function (err, r) {
      if (err) { fail('T9 dispatch', err); done(); return; }
      check('T9: status === 400', function () {
        assert.strictEqual(r.status, 400);
      });
      check('T9: error === "validation_failed"', function () {
        assert.strictEqual(r.body && r.body.error, 'validation_failed');
      });
      check('T9: details.length >= 8 (all required fields missing)', function () {
        assert.ok(Array.isArray(r.body.details));
        assert.ok(r.body.details.length >= 8,
          'only ' + r.body.details.length + ' errors: ' + JSON.stringify(r.body.details));
      });
      done();
    });
  }

  // --- Test 10 (bonus): GET /api/optimize -> 404 or 405 ---
  function test10(done) {
    getRaw(port, '/api/optimize', function (err, r) {
      if (err) { fail('T10 dispatch', err); done(); return; }
      check('T10: GET /api/optimize returns 404 or 405', function () {
        assert.ok(r.status === 404 || r.status === 405,
          'got ' + r.status);
      });
      done();
    });
  }

  runSteps(
    [test1, test2, test3, test4, test5, test6, test7, test8, test9, test10],
    function () {
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
  );
});
