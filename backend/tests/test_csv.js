// test_csv.js — validate CSV I/O module (Step 9.5.1)
// Pattern matches tests/test_hca.js: plain Node, custom assert, console output.

var fs = require('fs');
var path = require('path');
var csv = require('../src/csv');

var passCount = 0;
var failCount = 0;

function assert(cond, msg) {
  if (cond) {
    passCount = passCount + 1;
  } else {
    failCount = failCount + 1;
    console.log('  FAIL: ' + msg);
  }
}

function section(title) {
  console.log('');
  console.log('=== ' + title + ' ===');
}

// Helper: safe cleanup of temp file
function rm(p) {
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* ignore */ }
}

console.log('=== Test csv.js (Step 9.5.1) ===');

// ==========================================================================
// Group 1: parseLoopPrice against real VB6 sample
// ==========================================================================
section('Group 1: parseLoopPrice (vb6_samples/loopPrice-HCA-H3-280.csv)');
var lpPath = path.join(__dirname, '..', '..', 'vb6_samples', 'loopPrice-HCA-H3-280.csv');
var lpRows = csv.parseLoopPrice(lpPath);

assert(lpRows.length === 30, 'parseLoopPrice returns 30 rows (got ' + lpRows.length + ')');
assert(lpRows[0].trial === 1, 'row[0].trial === 1');
assert(lpRows[29].trial === 30, 'row[29].trial === 30');

var allBest = true;
var i;
for (i = 0; i < lpRows.length; i++) {
  if (lpRows[i].bestPrice !== 2942.29) { allBest = false; break; }
}
assert(allBest, 'every row.bestPrice === 2942.29');

assert(lpRows[0].loop === 99, 'row[0].loop === 99');

var allLoopOK = true;
for (i = 0; i < lpRows.length; i++) {
  if (!Number.isInteger(lpRows[i].loop) || lpRows[i].loop <= 0) { allLoopOK = false; break; }
}
assert(allLoopOK, 'all loop values are integers > 0');

var allFinite = true;
for (i = 0; i < lpRows.length; i++) {
  if (!isFinite(lpRows[i].bestPrice)) { allFinite = false; break; }
}
assert(allFinite, 'all bestPrice values are finite numbers');

// ==========================================================================
// Group 2: parseAccept against real VB6 sample
// ==========================================================================
section('Group 2: parseAccept (vb6_samples/accept-HCA-H3-280.csv)');
var acPath = path.join(__dirname, '..', '..', 'vb6_samples', 'accept-HCA-H3-280.csv');
var acRows = csv.parseAccept(acPath);

assert(acRows.length === 5001, 'parseAccept returns 5001 rows (got ' + acRows.length + ')');
assert(acRows[0].iter === 0, 'row[0].iter === 0');
assert(acRows[0].type === 'better', "row[0].type === 'better' (got " + acRows[0].type + ')');
assert(acRows[0].cost === 9494.76, 'row[0].cost === 9494.76 (got ' + acRows[0].cost + ')');

var validTypes = { rejected: true, passed: true, better: true };
var allTypesOK = true;
for (i = 0; i < acRows.length; i++) {
  if (typeof acRows[i].type !== 'string' || !validTypes[acRows[i].type]) {
    allTypesOK = false; break;
  }
}
assert(allTypesOK, 'every row.type is one of {rejected,passed,better}');

var counts = { rejected: 0, passed: 0, better: 0 };
for (i = 0; i < acRows.length; i++) counts[acRows[i].type]++;
assert(counts.better === 9,   'better count === 9 (got ' + counts.better + ')');
assert(counts.passed === 4992, 'passed count === 4992 (got ' + counts.passed + ')');
assert(counts.rejected === 0, 'rejected count === 0 (got ' + counts.rejected + ')');

// ==========================================================================
// Group 3: exportLoopPrice round-trip
// ==========================================================================
section('Group 3: exportLoopPrice round-trip');
var tmpLP = path.join(__dirname, 'tmp_loopPrice.csv');
try {
  var input3 = [
    { trial: 1, loop: 99,  bestPrice: 2942.29 },
    { trial: 2, loop: 485, bestPrice: 2942.29 },
    { trial: 3, loop: 376, bestPrice: 2942.29 }
  ];
  csv.exportLoopPrice(input3, tmpLP);
  assert(fs.existsSync(tmpLP), 'tmp_loopPrice.csv was created');

  var roundTrip = csv.parseLoopPrice(tmpLP);
  assert(roundTrip.length === 3, 'round-trip returns 3 rows');

  var allMatch = true;
  for (i = 0; i < input3.length; i++) {
    if (roundTrip[i].trial !== input3[i].trial ||
        roundTrip[i].loop !== input3[i].loop ||
        roundTrip[i].bestPrice !== input3[i].bestPrice) {
      allMatch = false; break;
    }
  }
  assert(allMatch, 'round-trip data matches input exactly');
} finally {
  rm(tmpLP);
}

// ==========================================================================
// Group 4: exportAccept filters rejects and formats correctly
// ==========================================================================
section('Group 4: exportAccept filters and formatting');
var tmpAC = path.join(__dirname, 'tmp_accept.csv');
try {
  var log4 = [
    { iter: 0, cost: 100, accepted: true,  isBetter: true,  valid: true },
    { iter: 1, cost: 99,  accepted: true,  isBetter: true,  valid: true },
    { iter: 2, cost: 150, accepted: false, isBetter: false, valid: false },
    { iter: 3, cost: 95,  accepted: true,  isBetter: false, valid: true },
    { iter: 4, cost: 200, accepted: false, isBetter: false, valid: true }
  ];
  csv.exportAccept(log4, tmpAC);
  var raw4 = fs.readFileSync(tmpAC, 'utf8');
  var lines4 = raw4.split('\n');
  // Last element is empty string due to trailing \n
  while (lines4.length > 0 && lines4[lines4.length - 1] === '') lines4.pop();

  assert(lines4[0] === 'No.,Rejected,Passed,Passed and Better value',
    'header matches exactly (got: ' + lines4[0] + ')');
  assert(lines4.length === 4,
    'output has 4 non-empty lines (header + 3 accepted rows); got ' + lines4.length);
  assert(lines4[1] === '0,,,100.00', 'iter 0 line is "0,,,100.00" (got: ' + lines4[1] + ')');
  assert(lines4[2] === '1,,,99.00',  'iter 1 line is "1,,,99.00"  (got: ' + lines4[2] + ')');
  assert(lines4[3] === '3,,95.00,',  'iter 3 line is "3,,95.00,"  (got: ' + lines4[3] + ')');
} finally {
  rm(tmpAC);
}

// ==========================================================================
// Group 5: exportTrialsRich schema
// ==========================================================================
section('Group 5: exportTrialsRich schema');
var tmpTR = path.join(__dirname, 'tmp_trials.csv');
try {
  var trials5 = [
    { trial: 1, seed: 12345, bestCost: 2942.2934, bestIter: 99, totalIter: 5000,
      validCount: 1234, betterCount: 9, acceptedCount: 5000, timeMs: 1234 },
    { trial: 2, seed: null,  bestCost: 3100.5,    bestIter: 200, totalIter: 5000,
      validCount: 999,  betterCount: 5, acceptedCount: 4999, timeMs: 1500 }
  ];
  csv.exportTrialsRich(trials5, tmpTR);
  var raw5 = fs.readFileSync(tmpTR, 'utf8');
  var lines5 = raw5.split('\n');
  while (lines5.length > 0 && lines5[lines5.length - 1] === '') lines5.pop();

  var expectedHeader5 = 'trial,seed,bestCost,bestIter,totalIter,validCount,betterCount,acceptedCount,timeMs';
  assert(lines5[0] === expectedHeader5, 'header matches exactly');
  assert(lines5.length === 3, 'line count = 3 (header + 2 trials); got ' + lines5.length);

  // Trial 1 row: bestCost two decimals, integer fields, numeric seed
  var expectedRow1 = '1,12345,2942.29,99,5000,1234,9,5000,1234';
  assert(lines5[1] === expectedRow1, 'trial 1 row formatted correctly (got: ' + lines5[1] + ')');

  // Trial 2 row: empty seed cell since seed is not a number
  var expectedRow2 = '2,,3100.50,200,5000,999,5,4999,1500';
  assert(lines5[2] === expectedRow2, 'trial 2 row has empty seed cell (got: ' + lines5[2] + ')');
} finally {
  rm(tmpTR);
}

// ==========================================================================
// Group 6: exportIterationsRich schema
// ==========================================================================
section('Group 6: exportIterationsRich schema');
var tmpIT = path.join(__dirname, 'tmp_iters.csv');
try {
  var trialLogs6 = [
    { trial: 1, log: [
      { iter: 0, cost: 9494.76, valid: true,  accepted: true,  isBetter: true,
        bestSoFar: 9494.76, bestIter: 0, reason: '' },
      { iter: 1, cost: 7616.40, valid: true,  accepted: true,  isBetter: true,
        bestSoFar: 7616.40, bestIter: 1, reason: '' },
      { iter: 2, cost: 8370.35, valid: true,  accepted: true,  isBetter: false,
        bestSoFar: 7616.40, bestIter: 1, reason: '' }
    ]},
    { trial: 2, log: [
      { iter: 0, cost: 9000.00, valid: true,  accepted: true,  isBetter: true,
        bestSoFar: 9000.00, bestIter: 0, reason: '' },
      { iter: 1, cost: 9500.00, valid: false, accepted: false, isBetter: false,
        bestSoFar: 9000.00, bestIter: 0, reason: 'overturning, sliding' },
      { iter: 2, cost: 8500.00, valid: true,  accepted: true,  isBetter: true,
        bestSoFar: 8500.00, bestIter: 2, reason: '' }
    ]}
  ];
  csv.exportIterationsRich(trialLogs6, tmpIT);
  var raw6 = fs.readFileSync(tmpIT, 'utf8');
  var lines6 = raw6.split('\n');
  while (lines6.length > 0 && lines6[lines6.length - 1] === '') lines6.pop();

  var expectedHeader6 = 'trial,iter,cost,valid,accepted,isBetter,bestSoFar,bestIter,reason';
  assert(lines6[0] === expectedHeader6, 'header matches exactly');
  assert(lines6.length === 7, 'line count = 7 (header + 2*3 entries); got ' + lines6.length);

  // First data row: trial 1, iter 0, all flags true -> 1
  assert(lines6[1] === '1,0,9494.76,1,1,1,9494.76,0,', 'row 1 formatted correctly (got: ' + lines6[1] + ')');

  // Trial 2 iter 1: valid=false, accepted=false, isBetter=false -> all 0; reason quoted (contains comma)
  assert(lines6[5] === '2,1,9500.00,0,0,0,9000.00,0,"overturning, sliding"',
    'rejected row with quoted reason (got: ' + lines6[5] + ')');

  // Boolean flags become 1/0 — verify across all rows
  var allBoolsOK = true;
  for (i = 1; i < lines6.length; i++) {
    var cells = lines6[i].split(',');
    // valid, accepted, isBetter at indices 3, 4, 5
    if (cells[3] !== '0' && cells[3] !== '1') { allBoolsOK = false; break; }
    if (cells[4] !== '0' && cells[4] !== '1') { allBoolsOK = false; break; }
    if (cells[5] !== '0' && cells[5] !== '1') { allBoolsOK = false; break; }
  }
  assert(allBoolsOK, 'all boolean flags are 1 or 0');
} finally {
  rm(tmpIT);
}

// ==========================================================================
// Summary
// ==========================================================================
console.log('');
console.log('Total: ' + passCount + ' passed, ' + failCount + ' failed');
if (failCount > 0) process.exit(1);
