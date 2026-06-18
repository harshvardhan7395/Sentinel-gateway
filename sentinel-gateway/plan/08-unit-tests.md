# Task 8: Unit tests

Status: Pending
Created: 2026-06-18
Completed: —

## Goal
Test suite covering circuit state transitions, error categorisation, and retry behaviour.

## Acceptance criteria
- tests/circuit.test.ts: transition to open when failure rate > 60%, fast-fail when open, recover to closed
- tests/errors.test.ts: correct class and httpStatus for each error category
- tests/gateway.test.ts: end-to-end request through gateway with connector stubbed at network boundary
- All 13 test scenarios pass
- `npm test` exits 0

## Notes
Mock at the network boundary only — use an injectable fetch/call function passed to connectors, not spying on internal methods. No mocking the circuit breaker itself.