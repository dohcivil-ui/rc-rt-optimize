// optimize.hca.presets.test.js -- plain Node test for POST /api/optimize.
// Locks 9 HCA preset ground truths covering the full 3x3 (H x fc) grid.
//
// Unlike optimize.presets.test.js (BA, 7 cases), HCA shares no baseline
// with optimize.test.js T1/T2, so all 9 cells are locked here.
//
// Convention: paper-authentic config (cases.js DEFAULT_PARAMS),
// identical to optimize.presets.test.js:
//   mu=0.60, qa=30, per-fc concrete prices {240:2430, 280:2524,
//   320:2617}, steelPrice=24. algorithm='hca'. seed=42.
//   maxIterations=10000.
//
// Source of truth: Node@seed=42 deterministic snapshot. This is a
// regression test for HCA reproducibility, not a statistical claim.
// The 30-trial paired BA-vs-HCA comparison (paper Section 10.3) is
// the basis for the BA-dominates-HCA narrative.

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

// Per-fc concrete price (baht/m^3) -- matches modShared.bas
// GetConcretePrice and web/src/data/cases.js CONCRETE_PRICE.
var PRICE_MAP = { 240: 2430, 280: 2524, 320: 2617 };

// Paper-authentic baseline body. Individual tests clone and mutate H,
// material.fc, and material.concretePrice via PRICE_MAP.
var BASE_PRESET_BODY = {
  H: 3,
  H1: 1.2,
  gamma_soil: 1.80,
  gamma_concrete: 2.40,
  phi: 30,
  mu: 0.60,
  qa: 30,
  cover: 0.075,
  material: { fy: 4000, fc: 240, concretePrice: 2430, steelPrice: 24 },
  algorithm: 'hca',
  options: { seed: 42, maxIterations: 10000 }
};

// IMPORTANT: seed=42 AND maxIterations=10000 are PART OF the ground
// truth contract. Changing either value invalidates every bestCost
// and bestIteration locked below. Do not edit BASE_PRESET_BODY.options
// without re-capturing all 9 entries via tmp/capture-hca-presets.ps1.
//
// Captured 2026-05-04 (Day 10 Commit 2 phase 1) via
// tmp/capture-hca-presets.ps1 against api/src/lib/engine.js HCA path.
var GROUND_TRUTH = [
  { id: 'H3-240', H: 3, fc: 240, bestCost: 2849.2292159999997, bestIter: 176  },
  { id: 'H3-280', H: 3, fc: 280, bestCost: 2942.2892159999997, bestIter: 176  },
  { id: 'H3-320', H: 3, fc: 320, bestCost: 3034.359216,        bestIter: 176  },
  { id: 'H4-240', H: 4, fc: 240, bestCost: 3975.5134080000003, bestIter: 1170 },
  { id: 'H4-280', H: 4, fc: 280, bestCost: 4101.473408,        bestIter: 8031 },
  { id: 'H4-320', H: 4, fc: 320, bestCost: 4226.093408000001,  bestIter: 8031 },
  { id: 'H5-240', H: 5, fc: 240, bestCost: 5517.843167999999,  bestIter: 1031 },
  { id: 'H5-280', H: 5, fc: 280, bestCost: 5744.523808,        bestIter: 9076 },
  { id: 'H5-320', H: 5, fc: 320, bestCost: 5833.873168,        bestIter: 1479 }
];

function makeTest(g) {
  return function (done) {
    var body = clone(BASE_PRESET_BODY);
    body.H = g.H;
    body.material.fc = g.fc;
    body.material.concretePrice = PRICE_MAP[g.fc];
    postJson(this.port, '/api/optimize', body, function (err, r) {
      if (err) { fail(g.id + ' dispatch', err); done(); return; }
      check(g.id + ': status === 200', function () {
        assert.strictEqual(r.status, 200, 'status ' + r.status + ', body: ' + r.raw);
      });
      check(g.id + ': bestCost === ' + g.bestCost, function () {
        assert.ok(r.body && typeof r.body.bestCost === 'number', 'no bestCost');
        assert.ok(Math.abs(r.body.bestCost - g.bestCost) < 1e-9,
          'got ' + r.body.bestCost);
      });
      check(g.id + ': bestIteration === ' + g.bestIter, function () {
        assert.strictEqual(r.body && r.body.bestIteration, g.bestIter);
      });
      check(g.id + ': algorithm === "hca"', function () {
        assert.strictEqual(r.body && r.body.algorithm, 'hca');
      });
      done();
    });
  };
}

var server = app.listen(0, function () {
  var port = server.address().port;
  console.log('=== Testing /api/optimize 9 HCA presets on port ' + port + ' ===');

  var ctx = { port: port };
  var steps = GROUND_TRUTH.map(function (g) {
    var fn = makeTest(g);
    return function (done) { fn.call(ctx, done); };
  });

  runSteps(steps, function () {
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
  });
});
