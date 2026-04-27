// api.js -- thin fetch wrapper for rcopt backend.
// Uses relative /api/* paths so Vite dev proxy and nginx prod proxy
// both work without a base URL config. Errors are normalized into
// 3 categories: network, validation (4xx), server (5xx).

var BASE = '/api';

// Internal: send a fetch and classify the response.
// Resolves with parsed JSON on 2xx; rejects with a normalized Error.
async function request(path, options) {
  var res;
  try {
    res = await fetch(BASE + path, options);
  } catch (e) {
    var netErr = new Error('network');
    netErr.cause = e;
    throw netErr;
  }

  // Try to parse body as JSON. Some error paths may return non-JSON;
  // fall back to empty object so downstream code does not crash.
  var body = {};
  try {
    body = await res.json();
  } catch (e) {
    // ignore -- body stays {}
  }

  if (res.ok) {
    return body;
  }

  if (res.status >= 400 && res.status < 500) {
    var clientErr = new Error(body.error || 'validation_failed');
    clientErr.status = res.status;
    clientErr.details = body.details;
    throw clientErr;
  }

  // 5xx and anything else not 2xx
  var serverErr = new Error(body.message || 'server_error');
  serverErr.status = res.status;
  throw serverErr;
}

// GET /api/health -- liveness probe.
async function health() {
  return request('/health', { method: 'GET' });
}

// POST /api/parse-input -- NL Thai text to design params.
// Backend contract: { input: string } -- NOT { text: string }.
// Handoff v6.8 had this wrong; verified against api/src/routes/parseInput.js.
async function parseInput(text) {
  return request('/parse-input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text })
  });
}

// POST /api/optimize -- run BA optimization.
async function optimize(params) {
  return request('/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
}

// POST /api/explain-result -- AI explanation of optimize result.
async function explainResult(result) {
  return request('/explain-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: result })
  });
}

export { health, parseInput, optimize, explainResult };
