// test_rng.js — validate PRNG helpers
var rng = require('../src/rng');

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else           { console.log('  FAIL: ' + msg); failed++; }
}

console.log('=== Test rng.js ===\n');

// --- createVB6Rng: deterministic ---
console.log('[VB6 LCG] deterministic sequences:');
var r1 = rng.createVB6Rng(42);
var r2 = rng.createVB6Rng(42);
var seq1 = []; var seq2 = [];
for (var i = 0; i < 10; i++) { seq1.push(r1()); seq2.push(r2()); }
var allEq = true;
for (var i = 0; i < 10; i++) { if (seq1[i] !== seq2[i]) { allEq = false; break; } }
assert(allEq, 'VB6 LCG: same seed -> same sequence');

// --- createVB6Rng: range [0,1) ---
console.log('\n[VB6 LCG] output range:');
var r3 = rng.createVB6Rng(12345);
var inRange = true;
for (var i = 0; i < 1000; i++) {
  var v = r3();
  if (v < 0 || v >= 1) { inRange = false; break; }
}
assert(inRange, 'VB6 LCG: 1000 outputs all in [0, 1)');

// --- createSeededRng: deterministic ---
console.log('\n[Seeded] deterministic sequences:');
var s1 = rng.createSeededRng('test-seed');
var s2 = rng.createSeededRng('test-seed');
var sSeq1 = []; var sSeq2 = [];
for (var i = 0; i < 10; i++) { sSeq1.push(s1()); sSeq2.push(s2()); }
var sAllEq = true;
for (var i = 0; i < 10; i++) { if (sSeq1[i] !== sSeq2[i]) { sAllEq = false; break; } }
assert(sAllEq, 'Seeded: same seed -> same sequence');

// --- rand(low, high, rng) inclusive ---
console.log('\n[rand] integer range:');
var r4 = rng.createSeededRng('rand-test');
var minVal = 999, maxVal = -999;
for (var i = 0; i < 1000; i++) {
  var v = rng.rand(-2, 2, r4);
  if (v !== Math.floor(v)) { assert(false, 'rand produces integer'); break; }
  if (v < minVal) minVal = v;
  if (v > maxVal) maxVal = v;
}
assert(minVal >= -2, 'rand(-2, 2): min >= -2');
assert(maxVal <= 2, 'rand(-2, 2): max <= 2');
assert(minVal === -2, 'rand(-2, 2): reaches -2 in 1000 trials');
assert(maxVal === 2, 'rand(-2, 2): reaches 2 in 1000 trials');

// --- rand(low, high): low == high ---
console.log('\n[rand] edge cases:');
var r5 = rng.createSeededRng('edge');
var allEq2 = true;
for (var i = 0; i < 10; i++) { if (rng.rand(5, 5, r5) !== 5) { allEq2 = false; break; } }
assert(allEq2, 'rand(5, 5) always returns 5');

// --- Summary ---
console.log('\n=============================');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed);
console.log('=============================');
if (failed > 0) process.exit(1);
