# Task 4: Mock connectors

Status: Pending
Created: 2026-06-18
Completed: —

## Goal
Build DigiD and iDIN mock connectors with toggleable state and retry-on-read logic.

## Acceptance criteria
- src/connectors/base.ts defines ConnectorResult type and withRetry(fn, maxRetries) with exponential backoff + jitter
- src/connectors/digid.ts and idin.ts each export: fetch(userId), setState('healthy'|'flaky'|'down')
- healthy: returns mock income/identity data
- flaky: fails ~70% of the time with a 500-equivalent error
- down: always throws a connection error
- should retry up to 2 times with backoff when source returns 5xx
- should not retry when error is USER_NOT_FOUND or CONSENT_REVOKED

## Notes
Retry is applied inside the connector before the circuit breaker counts the failure. This means transient blips don't immediately count against the failure rate — only persistent failures do.