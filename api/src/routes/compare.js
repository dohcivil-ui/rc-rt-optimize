// compare.js -- POST /api/compare (Day 9.7).
// Validates the same body shape as /api/optimize (the existing
// validator already accepts and ignores extra fields), then delegates
// to engine.runMultiTrial which runs paired BA+HCA trials and a
// Wilcoxon signed-rank test on the bestCost arrays.
//
// Optional body fields beyond the standard /optimize payload:
//   trials:        integer in [2, 100] (default 30)
//   maxIterations: forwarded to each engine call (default 5000)

var express = require('express');
var router = express.Router();
var validator = require('../lib/validator');
var engine = require('../lib/engine');

router.post('/', function (req, res, next) {
  var result = validator.validateOptimizeParams(req.body);
  if (!result.valid) {
    res.status(400).json({
      error: 'validation_failed',
      details: result.errors
    });
    return;
  }

  var trials = (req.body && typeof req.body.trials === 'number')
    ? req.body.trials
    : 30;
  var maxIterations = (req.body && typeof req.body.maxIterations === 'number')
    ? req.body.maxIterations
    : (result.params.options && result.params.options.maxIterations) || 5000;

  try {
    var out = engine.runMultiTrial(result.params, {
      trials: trials,
      maxIterations: maxIterations
    });
    res.status(200).json(out);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
