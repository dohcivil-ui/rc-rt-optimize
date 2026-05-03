// optimize.hca.test.js -- Day 9.6: verify /api/optimize accepts the
// optional `algorithm` field and routes BA vs HCA correctly while
// preserving the slim response shape introduced in earlier days.

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
      callback(null, { status: res.statusCode, body: json, raw: raw });
    });
  });
  req.on('error', callback);
  req.write(payload);
  req.end();
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

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

var BASE_BODY = {
  H: 3,
  H1: 1.2,
  gamma_soil: 1.8,
  gamma_concrete: 2.4,
  phi: 30,
  mu: 0.5,
  qa: 20,
  cover: 0.075,
  material: { fy: 4000, fc: 240, concretePrice: 2500, steelPrice: 28 },
  options: { seed: 42, maxIterations: 10000 }
};

var server = app.listen(0, function () {
  var port = server.address().port;
  console.log('=== Testing /api/optimize HCA toggle on port ' + port + ' ===');

  // Test 1: default (no algorithm field) -> BA, identical bestCost as before
  function test1(done) {
    postJson(port, '/api/optimize', clone(BASE_BODY), function (err, r) {
      if (err) { fail('T1 dispatch', err); done(); return; }
      check('T1: default algorithm => 200', function () {
        assert.strictEqual(r.status, 200, 'status ' + r.status);
      });
      check('T1: algorithm === "ba"', function () {
        assert.strictEqual(r.body.algorithm, 'ba');
      });
      check('T1: bestCost matches BA baseline 2992.4507519999997', function () {
        assert.ok(Math.abs(r.body.bestCost - 2992.4507519999997) < 1e-9,
          'got ' + r.body.bestCost);
      });
      check('T1: verification.optimization.algorithm === "BA"', function () {
        assert.ok(r.body.verification && r.body.verification.optimization);
        assert.strictEqual(r.body.verification.optimization.algorithm, 'BA');
      });
      done();
    });
  }

  // Test 2: explicit BA -> identical to default
  function test2(done) {
    var body = clone(BASE_BODY);
    body.algorithm = 'BA';
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T2 dispatch', err); done(); return; }
      check('T2: explicit BA => 200', function () {
        assert.strictEqual(r.status, 200);
      });
      check('T2: algorithm === "ba"', function () {
        assert.strictEqual(r.body.algorithm, 'ba');
      });
      check('T2: bestCost matches BA baseline', function () {
        assert.ok(Math.abs(r.body.bestCost - 2992.4507519999997) < 1e-9,
          'got ' + r.body.bestCost);
      });
      done();
    });
  }

  // Test 3: HCA -> 200, valid result, verification labels HCA
  function test3(done) {
    var body = clone(BASE_BODY);
    body.algorithm = 'HCA';
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T3 dispatch', err); done(); return; }
      check('T3: HCA => 200', function () {
        assert.strictEqual(r.status, 200, 'status ' + r.status + ' body ' + r.raw);
      });
      check('T3: algorithm === "hca"', function () {
        assert.strictEqual(r.body.algorithm, 'hca');
      });
      check('T3: bestCost is finite positive', function () {
        assert.ok(typeof r.body.bestCost === 'number');
        assert.ok(r.body.bestCost > 0 && isFinite(r.body.bestCost),
          'got ' + r.body.bestCost);
      });
      check('T3: bestDesign + bestSteel present', function () {
        assert.ok(r.body.bestDesign && typeof r.body.bestDesign === 'object');
        assert.ok(r.body.bestSteel && typeof r.body.bestSteel === 'object');
      });
      check('T3: verification.optimization.algorithm === "HCA"', function () {
        assert.ok(r.body.verification && r.body.verification.optimization);
        assert.strictEqual(r.body.verification.optimization.algorithm, 'HCA');
      });
      check('T3: HCA verification keys are complete', function () {
        var v = r.body.verification;
        assert.ok(v.material && v.earthPressures && v.weights);
        assert.ok(v.steel && v.safetyFactors && v.bearingCapacity);
      });
      done();
    });
  }

  // Test 4: lowercase 'hca' is normalized -> still routes HCA
  function test4(done) {
    var body = clone(BASE_BODY);
    body.algorithm = 'hca';
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T4 dispatch', err); done(); return; }
      check('T4: lowercase hca => 200', function () {
        assert.strictEqual(r.status, 200);
      });
      check('T4: algorithm normalized to "hca"', function () {
        assert.strictEqual(r.body.algorithm, 'hca');
      });
      done();
    });
  }

  // Test 5: unknown algorithm string falls back to BA
  function test5(done) {
    var body = clone(BASE_BODY);
    body.algorithm = 'GENETIC';
    postJson(port, '/api/optimize', body, function (err, r) {
      if (err) { fail('T5 dispatch', err); done(); return; }
      check('T5: unknown algorithm => 200', function () {
        assert.strictEqual(r.status, 200);
      });
      check('T5: falls back to BA', function () {
        assert.strictEqual(r.body.algorithm, 'ba');
      });
      done();
    });
  }

  runSteps(
    [test1, test2, test3, test4, test5],
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
