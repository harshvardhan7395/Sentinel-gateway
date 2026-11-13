# sentinel-gateway

A resilient API gateway in TypeScript/Node.js that wraps upstream data sources behind circuit breakers, structured error handling, and AWS-style health probes.

## What it is

A production-shaped Express service that proxies requests to two mock upstream connectors — analogous to government identity and bank verification APIs used in Dutch fintech. When an upstream source becomes flaky or unreachable, a circuit breaker trips, subsequent requests fail fast without touching the source, and the service self-recovers once the upstream stabilises. Every failure mode returns a typed, structured error (not a generic 500) so callers can take the right action without guessing.

## Why it exists

Financial data platforms depend entirely on third-party APIs they do not control — government identity services, bank PSD2 endpoints, and KYC sources. When one of those sources degrades, naive retry loops amplify load on an already struggling system and keep users waiting through cascading timeouts. This prototype demonstrates the circuit breaker pattern as the correct response: shared failure state across all callers, fast-fail behaviour that protects the upstream, and observable recovery that surfaces cleanly to both application monitoring and infrastructure health probes.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20, TypeScript 5.4 (strict mode) |
| HTTP server | Express 4.19 |
| Circuit breaker | [opossum 8.1](https://nodeshift.dev/opossum/) |
| Testing | Jest 29 + ts-jest + Supertest |
| Cloud target | AWS ECS (liveness/readiness probe design) |

## Key concepts demonstrated

- **Circuit breaker states** — `closed` (normal), `open` (fast-fail), `half-open` (probe), with configurable failure-rate threshold and reset timeout
- **Error taxonomy** — `SOURCE_UNAVAILABLE` / `USER_NOT_FOUND` / `CONSENT_REVOKED` as distinct typed classes; domain errors excluded from failure-rate counting so they never trip the circuit
- **Retry safety** — exponential backoff with jitter on transient errors; no retries on domain errors or when the circuit is open
- **AWS health probes** — `/live` (always 200, process-alive signal) vs `/ready` (503 when all circuits open, liveness probe vs readiness probe distinction)
- **Observability surface** — `/health` returns per-connector circuit state as structured JSON, ready to be scraped by Prometheus or consumed by ECS container health checks

## Project structure

```
src/
  connectors/
    base.ts       # shared interface + withRetry (backoff + jitter)
    digid.ts      # mock DigiD connector (healthy / flaky / down)
    idin.ts       # mock iDIN connector
  circuit/
    breaker.ts    # opossum wrapper with getState() + errorFilter
  routes/
    gateway.ts    # POST /fetch — main entry point
    health.ts     # GET /live  /ready  /health
    control.ts    # POST /control — toggle mock state for demo
  errors/
    types.ts      # SourceUnavailable, UserNotFound, ConsentRevoked
tests/
  circuit.test.ts   # state transitions, fast-fail, half-open recovery
  errors.test.ts    # error codes and HTTP statuses
  gateway.test.ts   # end-to-end request flow + health probes
demo.sh             # annotated curl walkthrough of the full lifecycle
```

## Run locally

```bash
npm install
npm start
# → sentinel-gateway listening on http://localhost:3000
```

```bash
npm test
# → 23 tests, 3 suites, all passing
```

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/fetch?source=digid\|idin` | Fetch data for a userId through the circuit breaker |
| `GET` | `/health` | Per-connector circuit state JSON |
| `GET` | `/ready` | 503 if all circuits open, 200 otherwise |
| `GET` | `/live` | Always 200 — process alive |
| `POST` | `/control` | Toggle connector state (demo only) |
| `GET` | `/dashboard` | Live demo dashboard (HTML); data at `/dashboard/state` |

### Example responses

**Healthy fetch**
```bash
curl -X POST "http://localhost:3000/fetch?source=digid" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-42"}'
```
```json
{
  "source": "digid",
  "userId": "user-42",
  "data": { "bsn": "BSN-user-42", "annualIncome": 65000, "brpVerified": true },
  "fetchedAt": "2026-06-18T10:43:20.547Z"
}
```

**Circuit open — fast fail**
```json
{
  "code": "SOURCE_UNAVAILABLE",
  "message": "digid circuit is open — failing fast",
  "source": "digid",
  "timestamp": "2026-06-18T10:43:25.100Z"
}
```

**Health endpoint**
```json
{ "digid": "open", "idin": "closed" }
```

## Demo

Run the full circuit lifecycle in one script (requires the server to be running):

```bash
./demo.sh
```

The script walks through:
1. Healthy fetch — circuit closed, data returned
2. Toggle DigiD to flaky (70% failure rate)
3. Fire 8 requests — circuit trips to `open`
4. Fast-fail — subsequent requests return `SOURCE_UNAVAILABLE` instantly, no network call made
5. `/ready` stays `200` because iDIN circuit is still `closed`
6. Wait 11 seconds — circuit moves to `half-open`
7. Toggle DigiD back to healthy — probe succeeds, circuit returns to `closed`
8. Normal operation resumes

## Circuit breaker configuration

| Parameter | Default | Notes |
|---|---|---|
| `errorThresholdPercentage` | 60 | Trips when >60% of requests fail |
| `volumeThreshold` | 5 | Minimum requests before rate is evaluated |
| `resetTimeout` | 10 000 ms | Time in `open` before moving to `half-open` |
| `timeout` | 3 000 ms | Per-request timeout before counting as failure |

Domain errors (`USER_NOT_FOUND`, `CONSENT_REVOKED`) are excluded from failure-rate counting via opossum's `errorFilter` — a user authentication failure is not an infrastructure problem and should not trip the circuit## Demo

### Live dashboard

With the server running, open **http://localhost:3000/dashboard**. It polls `/dashboard/state` every 250 ms and shows:

- each connector's circuit state (closed / open / half-open) and its upstream mode
- `/ready` status (turns 503 only when every circuit is open)
- a live feed of `POST /fetch` requests with status, typed error code and latency. Fast-fails are flagged ⚡.
- a timeline of state transitions

You can also switch upstream modes and send traffic from the dashboard buttons.

### Scripted walkthrough

```bash
./demo.sh          # step-by-step: press Enter to advance (good for narrating)
./demo.sh --auto   # run straight through
```

Start from a fresh server (`npm start`); the script refuses to run if a circuit is still open from a previous run. It walks through:
1. Healthy fetch: circuit closed, data returned
2. Domain errors (`USER_NOT_FOUND`) do not trip the circuit
3. DigiD goes down: requests retry with backoff, then return typed `SOURCE_UNAVAILABLE` (503)
4. Requests keep coming until the circuit trips to `open`
5. Fast-fail: the request is rejected in a few ms with no upstream call
6. `/ready` stays `200` because the iDIN circuit is still `closed`
7. After `resetTimeout` the circuit moves to `half-open`
8. DigiD recovers, the probe succeeds and the circuit returns to `closed`

Mock upstreams add ~120 ms of simulated network latency (set `UPSTREAM_LATENCY_MS` to change it; 0 under Jest), so fast-fail is visibly faster than a real call.

## Circuit breaker configuration

| Parameter | Default | Notes |
|---|---|---|
| `errorThresholdPercentage` | 60 | Trips when >60% of requests fail |
| `volumeThreshold` | 5 | Minimum requests before rate is evaluated |
| `resetTimeout` | 10 000 ms | Time in `open` before moving to `half-open` |
| `timeout` | 3 000 ms | Per-request timeout before counting as failure |

Domain errors (`USER_NOT_FOUND`, `CONSENT_REVOKED`) are excluded from failure-rate counting via opossum's `errorFilter` — a user authentication failure is not an infrastructure problem and should not trip the circuit.