// server.js -- Express entrypoint for the rcopt API.
// Mounts routes, exports the app for tests, and only calls listen()
// when executed directly (`node src/server.js`), never when required.

var express = require('express');
var healthRouter = require('./routes/health');
var optimizeRouter = require('./routes/optimize');

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
