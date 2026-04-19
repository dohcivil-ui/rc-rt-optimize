// csv.js — CSV I/O for RC_RT_HCA Step 9.5
// Pure Node built-ins (fs, path); no external dependencies.
//
// Provides:
//   parseLoopPrice(filePath)              -> Array<{trial, loop, bestPrice}>
//   parseAccept(filePath)                 -> Array<{iter, type, cost}>
//   exportLoopPrice(trials, filePath)     -> void   (VB6-compatible)
//   exportAccept(log, filePath)           -> void   (VB6-compatible; only ACCEPTED moves)
//   exportTrialsRich(trialResults, fp)    -> void   (analysis schema)
//   exportIterationsRich(trialLogs, fp)   -> void   (analysis schema)
//
// Line endings are LF only on output (matches VB6 after normalization).
// Parsers tolerate both CRLF and LF and ignore empty trailing lines.

var fs = require('fs');

// ==========================================================================
// Internal helpers
// ==========================================================================

// Split CSV text into non-empty trimmed lines, tolerating CRLF/LF.
// Trailing empty lines are dropped.
function splitLines(text) {
  var raw = text.split(/\r?\n/);
  var out = [];
  var i;
  for (i = 0; i < raw.length; i++) {
    var line = raw[i];
    // Preserve content as-is (do not trim cells); only skip purely empty lines
    if (line.length > 0) out.push(line);
  }
  return out;
}

// Quote a field for rich CSV if it contains comma, quote, or newline.
function quoteIfNeeded(s) {
  if (s === null || typeof s === 'undefined') return '';
  var str = String(s);
  if (str.length === 0) return '';
  if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ==========================================================================
// A) Parsers — read VB6 reference CSV files
// ==========================================================================

// parseLoopPrice — schema: No., Loop, BestPrice
function parseLoopPrice(filePath) {
  var text = fs.readFileSync(filePath, 'utf8');
  var lines = splitLines(text);
  var out = [];
  var i;
  // Skip header (line 0)
  for (i = 1; i < lines.length; i++) {
    var parts = lines[i].split(',');
    if (parts.length < 3) continue;
    out.push({
      trial: parseInt(parts[0], 10),
      loop:  parseInt(parts[1], 10),
      bestPrice: parseFloat(parts[2])
    });
  }
  return out;
}

// parseAccept — schema: No., Rejected, Passed, Passed and Better value
// Exactly one of cols 2/3/4 has a value per row -> sets type.
function parseAccept(filePath) {
  var text = fs.readFileSync(filePath, 'utf8');
  var lines = splitLines(text);
  var out = [];
  var i;
  for (i = 1; i < lines.length; i++) {
    var parts = lines[i].split(',');
    if (parts.length < 4) continue;
    var iter = parseInt(parts[0], 10);
    var rej = parts[1];
    var pas = parts[2];
    var bet = parts[3];
    var type, cost;
    if (rej && rej.length > 0) {
      type = 'rejected';
      cost = parseFloat(rej);
    } else if (pas && pas.length > 0) {
      type = 'passed';
      cost = parseFloat(pas);
    } else if (bet && bet.length > 0) {
      type = 'better';
      cost = parseFloat(bet);
    } else {
      // Malformed row — skip
      continue;
    }
    out.push({ iter: iter, type: type, cost: cost });
  }
  return out;
}

// ==========================================================================
// B) VB6-compatible exporters
// ==========================================================================

// exportLoopPrice — header "No.,Loop,BestPrice", one line per trial, LF endings.
function exportLoopPrice(trials, filePath) {
  var lines = ['No.,Loop,BestPrice'];
  var i;
  for (i = 0; i < trials.length; i++) {
    var t = trials[i];
    lines.push(t.trial + ',' + t.loop + ',' + t.bestPrice.toFixed(2));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

// exportAccept — VB6 only logs ACCEPTED moves. Filter out accepted===false.
// Better -> col 4; passed (lateral, accepted but not better) -> col 3.
// Rejected column always empty (matches VB6 behavior).
function exportAccept(log, filePath) {
  var lines = ['No.,Rejected,Passed,Passed and Better value'];
  var i;
  for (i = 0; i < log.length; i++) {
    var e = log[i];
    if (e.accepted === false) continue;
    var passedCell = '';
    var betterCell = '';
    if (e.isBetter === true) {
      betterCell = e.cost.toFixed(2);
    } else {
      passedCell = e.cost.toFixed(2);
    }
    lines.push(e.iter + ',,' + passedCell + ',' + betterCell);
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

// ==========================================================================
// C) Rich exporters (for analysis and paper figures)
// ==========================================================================

// exportTrialsRich — per-trial summary table.
function exportTrialsRich(trialResults, filePath) {
  var header = 'trial,seed,bestCost,bestIter,totalIter,validCount,betterCount,acceptedCount,timeMs';
  var lines = [header];
  var i;
  for (i = 0; i < trialResults.length; i++) {
    var r = trialResults[i];
    var seedCell = (typeof r.seed === 'number') ? String(r.seed) : '';
    lines.push(
      r.trial + ',' +
      seedCell + ',' +
      r.bestCost.toFixed(2) + ',' +
      r.bestIter + ',' +
      r.totalIter + ',' +
      r.validCount + ',' +
      r.betterCount + ',' +
      r.acceptedCount + ',' +
      r.timeMs
    );
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

// exportIterationsRich — full per-iteration log across all trials.
// Input: array of {trial, log} where log is the hcaOptimize log array.
function exportIterationsRich(trialLogs, filePath) {
  var header = 'trial,iter,cost,valid,accepted,isBetter,bestSoFar,bestIter,reason';
  var lines = [header];
  var i, j;
  for (i = 0; i < trialLogs.length; i++) {
    var trial = trialLogs[i].trial;
    var log = trialLogs[i].log;
    for (j = 0; j < log.length; j++) {
      var e = log[j];
      var reasonCell = e.reason ? quoteIfNeeded(e.reason) : '';
      lines.push(
        trial + ',' +
        e.iter + ',' +
        e.cost.toFixed(2) + ',' +
        (e.valid ? 1 : 0) + ',' +
        (e.accepted ? 1 : 0) + ',' +
        (e.isBetter ? 1 : 0) + ',' +
        e.bestSoFar.toFixed(2) + ',' +
        e.bestIter + ',' +
        reasonCell
      );
    }
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

module.exports = {
  parseLoopPrice: parseLoopPrice,
  parseAccept: parseAccept,
  exportLoopPrice: exportLoopPrice,
  exportAccept: exportAccept,
  exportTrialsRich: exportTrialsRich,
  exportIterationsRich: exportIterationsRich
};
