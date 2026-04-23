# rcopt-api

## Purpose
REST API that wraps the frozen `backend/` optimisation engine (HCA and BA algorithms for RC retaining wall design).

## How to run
From this directory:

    npm install
    npm start

The server listens on `PORT` (default `3000`) and logs the port on startup.

## How to test

    npm test

Runs `test/health.test.js`, which boots the Express app on an ephemeral port, exercises each route via Node's built-in `http` module, and prints `PASS: N tests` on success (exit code 0).

## Endpoints (current)

| Method | Path           | Description                                                    |
|--------|----------------|----------------------------------------------------------------|
| GET    | `/`            | Plain-text landing message                                     |
| GET    | `/api/health`  | JSON health probe: status, version, timestamp, uptime_seconds  |
| POST   | `/api/optimize` | Runs BA optimization. Body: params + options. Returns bestCost, bestIteration, bestDesign, bestSteel, runtime_ms, algorithm. |
