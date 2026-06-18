# Plan: Resilient Data-Source Gateway (Ockto portfolio prototype)

Status: Completed
Created: 2026-06-18
Completed: 2026-06-18

## Done definition
Gateway runs locally. POST /fetch?source=digid returns income data. POST /control sets DigiD to flaky, 6 rapid requests trip the circuit to open, /health confirms state, subsequent requests fast-fail with SOURCE_UNAVAILABLE instantly. After 10s /health shows half-open, probe succeeds, circuit closes, normal responses resume. Full story runs via demo.sh in under 30 seconds.

## Test scenarios
- should return fetched data when DigiD connector is healthy and circuit is closed
- should return SOURCE_UNAVAILABLE when DigiD circuit is open
- should return USER_NOT_FOUND when source returns 404
- should return CONSENT_REVOKED when source returns 403
- should transition circuit to open when failure rate exceeds 60% over min volume
- should fast-fail without calling source when circuit is open
- should retry up to 2 times with backoff when source returns 5xx
- should not retry when circuit is open
- should not retry when error is USER_NOT_FOUND or CONSENT_REVOKED
- should return 200 from /live regardless of circuit state
- should return 503 from /ready when all circuits are open
- should return 200 from /ready when at least one circuit is closed
- should return per-connector circuit state from /health as structured JSON

## Cut list (drop in this order if time runs short)
1. iDIN connector — DigiD alone proves the pattern
2. Retry logic — circuit breaker is the core story
3. Control route — hardcode flaky state in mock instead
4. Unit tests — reduce to circuit transitions only if needed

## Tasks
- [x] [01-scaffold.md](01-scaffold.md) — project scaffold, pinned deps, folder structure
- [x] [02-error-types.md](02-error-types.md) — SourceUnavailable, UserNotFound, ConsentRevoked
- [x] [03-circuit-breaker.md](03-circuit-breaker.md) — opossum wrapper with state query
- [x] [04-mock-connectors.md](04-mock-connectors.md) — DigiD + iDIN mocks with toggle + retry logic
- [x] [05-gateway-route.md](05-gateway-route.md) — POST /fetch with structured errors
- [x] [06-health-routes.md](06-health-routes.md) — /health, /ready, /live
- [x] [07-control-route.md](07-control-route.md) — POST /control to toggle connector state
- [x] [08-unit-tests.md](08-unit-tests.md) — circuit transitions, error categorisation, retry logic
- [x] [09-demo-script.md](09-demo-script.md) — demo.sh curl script