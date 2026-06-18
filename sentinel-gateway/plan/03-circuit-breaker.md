# Task 3: Circuit breaker wrapper

Status: Pending
Created: 2026-06-18
Completed: —

## Goal
Wrap opossum into a reusable factory with typed config and a state query method.

## Acceptance criteria
- src/circuit/breaker.ts exports createBreaker(fn, options) returning a breaker with fire() and getState()
- Default config: errorThresholdPercentage=60, volumeThreshold=5, resetTimeout=10000, timeout=3000
- getState() returns 'closed' | 'open' | 'half-open'
- should transition circuit to open when failure rate exceeds 60% over min volume
- should fast-fail without calling source when circuit is open
- should return 200 from /ready when at least one circuit is closed

## Notes
Use opossum's fallback to throw SourceUnavailable when circuit is open — don't let opossum's generic error escape to the route layer.