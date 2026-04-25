// server.js -- Express entrypoint for the rcopt API.
// Mounts routes, exports the app for tests, and only calls listen()
// when executed directly (`node src/server.js`), never when required.

// Force IPv4-first DNS resolution for outbound HTTPS calls. The
// Anthropic SDK uses fetch under the hood, which inherits Node's DNS
// settings. Some networks have broken or slow IPv6 paths to
// api.anthropic.com that surface only as "Connection error." Setting
// this here -- before any module is required -- ensures every outbound
// lookup in this process prefers IPv4 records.
require('dns').setDefaultResultOrder('ipv4first');

var express = require('express');
var healthRouter = require('./routes/health');
var optimizeRouter = require('./routes/optimize');
var parseInputRouter = require('./routes/parseInput');
var explainResultRouter = require('./routes/explainResult');
var app = express();
// JSON body parser applied before any route so that req.body is
// available to handlers. 64kb limit keeps accidental or malicious
// large payloads from exhausting memory (the spec payload is a few
// hundred bytes).
app.use(express.json({ limit: '64kb' }));
// Root landing route -- plain text, intentionally simple.
app.get('/', function (req, res) {
  res.status(200).type('text/plain').send('rcopt API -- see /api/health');
});
// Health probe lives under /api/health.
app.use('/api/health', healthRouter);
// BA optimization endpoint.
app.use('/api/optimize', optimizeRouter);
// Claude AI-assisted parse endpoint. Day 1 returns a fixed mock;
// Day 2 will swap in a real Claude SDK call via tool use.
app.use('/api/parse-input', parseInputRouter);
app.use('/api/explain-result', explainResultRouter);
// Global error handler -- MUST be registered last, after all routes.
// Catches anything thrown from route handlers or passed via next(err)
// and returns a uniform 500 JSON response. Errors are logged server-side
// with full stack traces; clients only see the message.
app.use(function (err, req, res, next) {
  console.error('[error]', err.stack || err.message || err);
  res.status(500).json({
    error: 'internal_error',
    message: err.message || 'unknown error'
  });
});
// Only start the HTTP listener when this module is run directly.
// When required by tests, exporting the app is enough -- tests call
// app.listen(0, ...) themselves to use an ephemeral port.
if (require.main === module) {
  var port = process.env.PORT || 3000;
  app.listen(port, function () {
    console.log('rcopt API listening on port ' + port);
  });
}
module.exports = app;
