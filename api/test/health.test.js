// health.test.js -- plain Node test script for the /api/health route.
// No test framework: uses require('assert') and the http module so it
// runs on any Node 18+ without extra dependencies.

var assert = require('assert');
var http = require('http');
var app = require('../src/server');

var passed = 0;
var failed = 0;

// Record a passing check with a short label.
function pass(label) {
  passed = passed + 1;
  console.log('  PASS: ' + label);
}

// Record a failure with the caught error message, continue running so
// every assertion can report its own status before final summary.
function fail(label, err) {
  failed = failed + 1;
  console.log('  FAIL: ' + label + '  --  ' + (err && err.message ? err.message : err));
}

// Wrap a single assertion in try/catch so one bad check does not
// abort the rest of the suite.
function check(label, fn) {
  try {
    fn();
    pass(label);
  } catch (err) {
    fail(label, err);
  }
}

// Issue an HTTP GET against the in-process server and return body as
// a parsed JSON object when possible; otherwise surface the raw string.
function getJson(port, path, cb) {
  http.get({ host: '127.0.0.1', port: port, path: path }, function (res) {
    var chunks = [];
    res.on('data', function (c) { chunks.push(c); });
    res.on('end', function () {
      var raw = Buffer.concat(chunks).toString('utf8');
      var body;
      try { body = JSON.parse(raw); } catch (e) { body = raw; }
      cb(null, { statusCode: res.statusCode, headers: res.headers, body: body, raw: raw });
    });
  }).on('error', function (err) { cb(err); });
}

// Run all checks against an ephemeral port to avoid clashes with a
// real dev server on 3000. `app.listen(0, ...)` hands out a free port.
var server = app.listen(0, function () {
  var port = server.address().port;
  console.log('=== Testing /api/health on port ' + port + ' ===');

  // Sequence the checks so we close the server only after all have
  // completed, regardless of pass/fail outcome.
  getJson(port, '/api/health', function (err, resp1) {
    if (err) {
      fail('GET /api/health dispatched', err);
      finalize();
      return;
    }

    check('GET /api/health returns 200', function () {
      assert.strictEqual(resp1.statusCode, 200);
    });
    check('Content-Type includes application/json', function () {
      var ct = resp1.headers['content-type'] || '';
      assert.ok(ct.indexOf('application/json') !== -1, 'got ' + ct);
    });
    check('body.status === "ok"', function () {
      assert.strictEqual(resp1.body && resp1.body.status, 'ok');
    });
    check('body.version === "0.1.0"', function () {
      assert.strictEqual(resp1.body && resp1.body.version, '0.1.0');
    });
    check('body.timestamp parses as a valid Date', function () {
      var ts = resp1.body && resp1.body.timestamp;
      assert.ok(typeof ts === 'string' && ts.length > 0, 'missing timestamp');
      var d = new Date(ts);
      assert.ok(!isNaN(d.getTime()), 'not a parseable date: ' + ts);
    });
    check('body.uptime_seconds is a non-negative number', function () {
      var u = resp1.body && resp1.body.uptime_seconds;
      assert.strictEqual(typeof u, 'number');
      assert.ok(isFinite(u), 'not finite: ' + u);
      assert.ok(u >= 0, 'negative: ' + u);
    });

    // Now probe an unknown sub-path under /api/health and expect 404.
    getJson(port, '/api/health/unknown', function (err2, resp2) {
      if (err2) {
        fail('GET /api/health/unknown dispatched', err2);
        finalize();
        return;
      }
      check('GET /api/health/unknown returns 404', function () {
        assert.strictEqual(resp2.statusCode, 404);
      });
      finalize();
    });
  });

  function finalize() {
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
});
