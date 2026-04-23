// server.js -- Express entrypoint for the rcopt API.
// Mounts routes, exports the app for tests, and only calls listen()
// when executed directly (`node src/server.js`), never when required.

var express = require('express');
var healthRouter = require('./routes/health');

var app = express();

// Root landing route -- plain text, intentionally simple.
app.get('/', function (req, res) {
  res.status(200).type('text/plain').send('rcopt API -- see /api/health');
});

// Health probe lives under /api/health.
app.use('/api/health', healthRouter);

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
