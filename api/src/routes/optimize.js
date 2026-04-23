// optimize.js -- POST /api/optimize.
// Validates the request body via lib/validator, then delegates to
// lib/engine.runOptimize. Engine errors propagate to the global error
// handler registered in server.js via next(err).

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

  // Engine call is wrapped in try/catch so that thrown errors are
  // handed off to the Express error pipeline rather than crashing
  // the worker. Successful runs return 200 + the slim result object.
  try {
    var out = engine.runOptimize(result.params);
    res.status(200).json(out);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
