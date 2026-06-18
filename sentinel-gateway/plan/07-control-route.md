# Task 7: Control route

Status: Pending
Created: 2026-06-18
Completed: —

## Goal
Demo-only endpoint to toggle mock connector state without restarting the server.

## Acceptance criteria
- src/routes/control.ts exports router with POST /control
- Body: { source: 'digid'|'idin', state: 'healthy'|'flaky'|'down' }
- Returns 200 { source, state } on success, 400 on invalid input
- Changes take effect immediately on next /fetch call

## Notes
This is a demo scaffolding endpoint — it would not exist in production. Can be on the cut list if time runs short.