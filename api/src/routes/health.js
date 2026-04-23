// health.js -- liveness/health probe for the rcopt API.
// Returns a small JSON object suitable for uptime checks and smoke tests.

var express = require('express');
var router = express.Router();

// Keep version in sync with package.json. Hard-coded here (rather than
// require('../../package.json')) to avoid pulling the manifest into
// runtime for every request.
var API_VERSION = '0.1.0';

// GET /api/health
//   status          -- constant 'ok' (reserved for richer states later)
//   version         -- current API semver, sourced from package.json
//   timestamp       -- ISO-8601 UTC string at the moment of response
//   uptime_seconds  -- process uptime rounded to 1 decimal place
router.get('/', function (req, res) {
  var uptime = Math.round(process.uptime() * 10) / 10;
  res.status(200).json({
    status: 'ok',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    uptime_seconds: uptime
  });
});

module.exports = router;
