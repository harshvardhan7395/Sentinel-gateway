# Task 6: Health routes

Status: Pending
Created: 2026-06-18
Completed: —

## Goal
Expose liveness, readiness, and per-connector health state for AWS ECS probes and on-call monitoring.

## Acceptance criteria
- src/routes/health.ts exports router with GET /live, /ready, /health
- /live always returns 200 { status: 'ok' }
- /ready returns 503 if ALL circuits open, 200 otherwise
- /health returns { digid: 'closed'|'open'|'half-open', idin: '...' }
- should return 200 from /live regardless of circuit state
- should return 503 from /ready when all circuits are open
- should return per-connector circuit state from /health as structured JSON

## Notes
Liveness = process alive (never fail on open circuit). Readiness = should receive traffic (fail only when fully degraded). This distinction matters for ECS task replacement vs. load balancer routing.