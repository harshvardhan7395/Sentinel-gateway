# Task 5: Gateway route

Status: Pending
Created: 2026-06-18
Completed: —

## Goal
Main gateway endpoint that routes requests through circuit-breaker-wrapped connectors and returns structured errors.

## Acceptance criteria
- src/routes/gateway.ts exports an Express router with POST /fetch
- Query param ?source=digid|idin, body { userId: string }
- Returns 200 with connector data on success
- Maps errors to structured JSON: { code, message, source, timestamp }
- should return fetched data when DigiD connector is healthy and circuit is closed
- should return SOURCE_UNAVAILABLE when DigiD circuit is open
- should not retry when circuit is open

## Notes
Circuit breaker wraps the connector call at this layer, not inside the connector. The connector handles retries; the circuit breaker tracks the connector's final outcome.