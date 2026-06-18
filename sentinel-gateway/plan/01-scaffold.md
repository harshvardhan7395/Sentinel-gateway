# Task 1: Project scaffold

Status: Pending
Created: 2026-06-18
Completed: —

## Goal
Initialize the ockto-gateway Node.js project with pinned dependencies and full folder structure.

## Acceptance criteria
- package.json has all pinned deps (express@4.19.2, opossum@8.1.1, typescript@5.4.5, ts-node@10.9.2, jest@29.7.0, ts-jest@29.1.4, @types/express@4.17.21, @types/node@20.14.0)
- tsconfig.json targets ES2020, strict mode on
- Folder structure exists: src/connectors, src/circuit, src/routes, src/errors, tests/
- `npm run build` and `npm test` scripts defined
- `npm install` completes without errors

## Notes
Project root: /Users/harsh/Projects/ockto/ockto-gateway