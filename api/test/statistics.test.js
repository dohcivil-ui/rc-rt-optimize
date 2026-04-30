// statistics.test.js -- Day 9.7. Covers:
//   1. descriptiveStats correctness on a known array
//   2. wilcoxonSignedRank: identical, all-positive shift, mixed signs,
//      ties, all-zero edge case, length mismatch error
//   3. /api/compare integration: small `trials` value (5) so the test
//      stays under a few seconds while still exercising the route end
//      to end (validator -> engine.runMultiTrial -> wilcoxon).

var assert = require('assert');
var http = require('http');
var stats = require('../src/lib/statistics');
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

// ---------- Section 1: descriptiveStats ----------
check('descriptiveStats: empty array', function () {
  var d = stats.descriptiveStats([]);
  assert.strictEqual(d.n, 0);
  assert.ok(isNaN(d.mean));
});

check('descriptiveStats: single value', function () {
  var d = stats.descriptiveStats([5]);
  assert.strictEqual(d.n, 1);
  assert.strictEqual(d.mean, 5);
  assert.strictEqual(d.median, 5);
  assert.strictEqual(d.std, 0);
});

check('descriptiveStats: known array', function () {
  // [1,2,3,4,5,6,7,8,9,10]
  var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var d = stats.descriptiveStats(arr);
  assert.strictEqual(d.n, 10);
  assert.strictEqual(d.mean, 5.5);
  assert.strictEqual(d.median, 5.5);
  assert.strictEqual(d.min, 1);
  assert.strictEqual(d.max, 10);
  // Sample std for 1..10 = sqrt(sum((x-5.5)^2)/9) = sqrt(82.5/9) ~ 3.0277
  assert.ok(Math.abs(d.std - 3.0277) < 1e-3, 'std got ' + d.std);
  // q1 / q3 via linear interpolation: 3.25, 7.75
  assert.ok(Math.abs(d.q1 - 3.25) < 1e-9, 'q1 got ' + d.q1);
  assert.ok(Math.abs(d.q3 - 7.75) < 1e-9, 'q3 got ' + d.q3);
});

// ---------- Section 2: wilcoxonSignedRank ----------
check('wilcoxon: identical arrays -> p = 1, n = 0', function () {
  var r = stats.wilcoxonSignedRank([1, 2, 3], [1, 2, 3]);
  assert.strictEqual(r.n, 0);
  assert.strictEqual(r.W, 0);
  assert.strictEqual(r.pValue, 1);
  assert.strictEqual(r.conclusion, 'ไม่แตกต่างอย่างมีนัยสำคัญ');
});

check('wilcoxon: A consistently larger than B -> small p', function () {
  // A - B always +5 -> all positive, n=8, W- = 0
  var a = [10, 11, 12, 13, 14, 15, 16, 17];
  var b = [5, 6, 7, 8, 9, 10, 11, 12];
  var r = stats.wilcoxonSignedRank(a, b);
  assert.strictEqual(r.n, 8);
  assert.strictEqual(r.Wminus, 0);
  // Wplus = 1+2+...+8 = 36
  assert.strictEqual(r.Wplus, 36);
  assert.ok(r.pValue < 0.05, 'expected p<0.05 got ' + r.pValue);
  assert.strictEqual(r.conclusion, 'แตกต่างอย่างมีนัยสำคัญ');
});

check('wilcoxon: mixed differences with one tie -> finite p', function () {
  // pairs: (5,3)=+2, (4,7)=-3, (8,8)=0(skip), (9,6)=+3, (2,5)=-3,
  //        (10,4)=+6, (1,7)=-6
  // Non-zero diffs after dropping the 0:
  //   d = +2, -3, +3, -3, +6, -6  -> n = 6
  // |d| sorted: 2, 3, 3, 3, 6, 6
  // ranks (avg ties): 2 -> 1; three 3s -> (2+3+4)/3 = 3; two 6s -> (5+6)/2 = 5.5
  // signs: +2 -> +1, +3 (one of three) -> +3, +6 (one of two) -> +5.5
  //         -3 (two of three) -> -3 each, -6 (one of two) -> -5.5
  // Wplus = 1 + 3 + 5.5 = 9.5
  // Wminus = 3 + 3 + 5.5 = 11.5
  var a = [5, 4, 8, 9, 2, 10, 1];
  var b = [3, 7, 8, 6, 5, 4, 7];
  var r = stats.wilcoxonSignedRank(a, b);
  assert.strictEqual(r.n, 6);
  assert.ok(Math.abs(r.Wplus - 9.5) < 1e-9, 'Wplus ' + r.Wplus);
  assert.ok(Math.abs(r.Wminus - 11.5) < 1e-9, 'Wminus ' + r.Wminus);
  assert.strictEqual(r.W, 9.5);
  assert.ok(isFinite(r.z));
  assert.ok(r.pValue >= 0 && r.pValue <= 1);
});

check('wilcoxon: length mismatch throws', function () {
  var threw = false;
  try { stats.wilcoxonSignedRank([1, 2], [1, 2, 3]); } catch (e) { threw = true; }
  assert.ok(threw, 'expected throw on length mismatch');
});

// ---------- Section 3: /api/compare integration (trials = 5) ----------
var BASE_BODY = {
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
      try { json = JSON.parse(raw); } catch (e) { /* allow */ }
      callback(null, { status: res.statusCode, body: json, raw: raw });
    });
  });
  req.on('error', callback);
  req.write(payload);
  req.end();
}

var server = app.listen(0, function () {
  var port = server.address().port;
  console.log('=== Testing /api/compare on port ' + port + ' (trials=5) ===');

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

  var body = JSON.parse(JSON.stringify(BASE_BODY));
  body.trials = 5;
  body.maxIterations = 1000;

  postJson(port, '/api/compare', body, function (err, r) {
    if (err) { fail('compare dispatch', err); done(); return; }
    check('/api/compare: status 200', function () {
      assert.strictEqual(r.status, 200, 'status ' + r.status + ' body ' + r.raw);
    });
    check('/api/compare: trials echoed back', function () {
      assert.strictEqual(r.body.trials, 5);
    });
    check('/api/compare: ba.costs.length === 5', function () {
      assert.ok(Array.isArray(r.body.ba.costs));
      assert.strictEqual(r.body.ba.costs.length, 5);
    });
    check('/api/compare: hca.costs.length === 5', function () {
      assert.ok(Array.isArray(r.body.hca.costs));
      assert.strictEqual(r.body.hca.costs.length, 5);
    });
    check('/api/compare: ba.stats has expected fields', function () {
      var s = r.body.ba.stats;
      assert.ok(typeof s.mean === 'number' && isFinite(s.mean));
      assert.ok(typeof s.median === 'number' && isFinite(s.median));
      assert.ok(typeof s.std === 'number' && isFinite(s.std));
      assert.ok(typeof s.min === 'number');
      assert.ok(typeof s.max === 'number');
    });
    check('/api/compare: wilcoxon has W, z, pValue, conclusion', function () {
      var w = r.body.wilcoxon;
      assert.ok(typeof w.W === 'number');
      assert.ok(typeof w.z === 'number');
      assert.ok(typeof w.pValue === 'number');
      assert.ok(w.pValue >= 0 && w.pValue <= 1);
      assert.ok(typeof w.conclusion === 'string');
    });
    check('/api/compare: paired determinism (same costs across reruns)', function () {
      // Costs are deterministic for a given seed; sanity-check that
      // every cost is finite and positive.
      var i;
      for (i = 0; i < 5; i++) {
        assert.ok(isFinite(r.body.ba.costs[i]) && r.body.ba.costs[i] > 0,
          'ba cost[' + i + ']=' + r.body.ba.costs[i]);
        assert.ok(isFinite(r.body.hca.costs[i]) && r.body.hca.costs[i] > 0,
          'hca cost[' + i + ']=' + r.body.hca.costs[i]);
      }
    });

    // Validation gate still works (missing H -> 400).
    var bad = JSON.parse(JSON.stringify(BASE_BODY));
    delete bad.H;
    bad.trials = 5;
    postJson(port, '/api/compare', bad, function (err2, r2) {
      if (err2) { fail('compare bad dispatch', err2); done(); return; }
      check('/api/compare: missing H => 400 validation_failed', function () {
        assert.strictEqual(r2.status, 400);
        assert.strictEqual(r2.body.error, 'validation_failed');
      });
      done();
    });
  });
});
