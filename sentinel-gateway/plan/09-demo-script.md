# Task 9: Demo script

Status: Pending
Created: 2026-06-18
Completed: —

## Goal
A single shell script that walks through the full circuit breaker lifecycle with annotated output.

## Acceptance criteria
- demo.sh is executable and runs against localhost:3000
- Steps: healthy fetch → toggle DigiD flaky → 6 rapid requests → /health shows open → fast-fail → wait 10s → /health shows half-open → probe → /health shows closed → normal fetch resumes
- Each step prefixed with a comment line explaining what's happening
- Script completes in under 60 seconds

## Notes
The 10s wait is the resetTimeout. Add a `sleep 11` after tripping the circuit so the half-open transition is visible.