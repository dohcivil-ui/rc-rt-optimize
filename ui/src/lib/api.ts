// src/lib/api.ts
// API client for POST /api/optimize.
// Base path: /api (Vite dev proxy forwards to localhost:3000;
// production deployment must serve api/ at the same origin).

import type { OptimizeRequest, OptimizeResponse } from '../types/api';

const ENDPOINT = '/api/optimize';

// Calls POST /api/optimize.
// Returns the parsed JSON body for any HTTP response with a valid
// JSON body (200 success, 400 validation_failed, 500 internal_error).
// Throws Error for network failures or non-JSON response bodies --
// caller must wrap the call in try/catch.
export const optimize = async (
  request: OptimizeRequest
): Promise<OptimizeResponse> => {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch (err) {
    // fetch rejects only on network-level failure
    const message = err instanceof Error ? err.message : 'network request failed';
    throw new Error('network: ' + message);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      'parse: response body is not valid JSON (HTTP ' + response.status + ')'
    );
  }

  // Trust the server contract -- types/api.ts mirrors handoff v5.1.
  // Runtime validation (zod) can be added later if contract drift becomes a concern.
  return body as OptimizeResponse;
};
