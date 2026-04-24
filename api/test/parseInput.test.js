// parseInput.test.js -- plain Node test for POST /api/parse-input.
// Boots the Express app on an ephemeral port, issues HTTP requests
// via the built-in http module, and asserts against responses.
// Day 1 stub returns a fixed mock; these tests exercise the
// validation gate that will carry forward unchanged to Day 2.

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

// POST helper. Serializes body to JSON (unless already a string),
// sends to the given path, and calls back with (err, res, parsedBody).
// parsedBody falls back to the raw string if JSON.parse throws.
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

// Runs an array of {label, run} steps sequentially. Each run takes
// a doneStep callback. After all complete, invokes doneAll().
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

var server = app.listen(0, function () {
  var port = server.address().port;
  console.log('parseInput.test.js -- listening on ephemeral port ' + port);

  var steps = [
    {
      label: 'valid Thai input returns 200 + high-confidence mock',
      run: function (done) {
        postJson(port, '/api/parse-input', { input: 'ออกแบบกำแพง 3 เมตร' }, function (err, res, body) {
          check('valid input -- no transport error', function () {
            assert.strictEqual(err, null);
          });
          check('valid input -- status 200', function () {
            assert.strictEqual(res.statusCode, 200);
          });
          check('valid input -- confidence high', function () {
            assert.strictEqual(body.confidence, 'high');
          });
          check('valid input -- parsed.H === 3', function () {
            assert.strictEqual(body.parsed.H, 3);
          });
          check('valid input -- missing_fields is empty array', function () {
            assert.ok(Array.isArray(body.missing_fields));
            assert.strictEqual(body.missing_fields.length, 0);
          });
          done();
        });
      }
    },
    {
      label: 'missing input field returns 400 validation_failed',
      run: function (done) {
        postJson(port, '/api/parse-input', {}, function (err, res, body) {
          check('missing input -- no transport error', function () {
            assert.strictEqual(err, null);
          });
          check('missing input -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('missing input -- error validation_failed', function () {
            assert.strictEqual(body.error, 'validation_failed');
          });
          check('missing input -- details[0].field === input', function () {
            assert.ok(Array.isArray(body.details));
            assert.ok(body.details.length >= 1);
            assert.strictEqual(body.details[0].field, 'input');
          });
          done();
        });
      }
    },
    {
      label: 'empty string input returns 400 validation_failed',
      run: function (done) {
        postJson(port, '/api/parse-input', { input: '' }, function (err, res, body) {
          check('empty string -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('empty string -- error validation_failed', function () {
            assert.strictEqual(body.error, 'validation_failed');
          });
          done();
        });
      }
    },
    {
      label: 'wrong type (number) input returns 400 validation_failed',
      run: function (done) {
        postJson(port, '/api/parse-input', { input: 123 }, function (err, res, body) {
          check('number input -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('number input -- error validation_failed', function () {
            assert.strictEqual(body.error, 'validation_failed');
          });
          done();
        });
      }
    },
    {
      label: 'whitespace-only input returns 400 validation_failed',
      run: function (done) {
        postJson(port, '/api/parse-input', { input: '   ' }, function (err, res, body) {
          check('whitespace input -- status 400', function () {
            assert.strictEqual(res.statusCode, 400);
          });
          check('whitespace input -- error validation_failed', function () {
            assert.strictEqual(body.error, 'validation_failed');
          });
          done();
        });
      }
    }
  ];

  runSteps(steps, function () {
    console.log('');
    console.log('PASS: ' + passed + ' / FAIL: ' + failed);
    server.close(function () {
      process.exit(failed === 0 ? 0 : 1);
    });
  });
});
