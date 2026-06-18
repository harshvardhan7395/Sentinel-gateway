# Task 2: Error types

Status: Pending
Created: 2026-06-18
Completed: —

## Goal
Define three typed error classes covering every failure mode the gateway must distinguish.

## Acceptance criteria
- src/errors/types.ts exports SourceUnavailable (503), UserNotFound (404), ConsentRevoked (403)
- Each class extends Error and carries: code (string), httpStatus (number), optional metadata object
- should return USER_NOT_FOUND when source returns 404
- should return CONSENT_REVOKED when source returns 403
- should return SOURCE_UNAVAILABLE when circuit is open or source times out

## Notes
These are pure data classes — no mocking needed in tests, just construct the real thing.
