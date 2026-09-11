# Implementation plan

## Phase 0

Empty directory inspected; no existing Git or AGENTS.md. Establish root config, shared types, DB and HTTP contracts before releasing agents.

## Phase 1

Frontend: five pages Today / Add Plan / Review / Week / Settings, auth screen, bilingual UI, manual structured draft confirmation, task CRUD, preferences, PWA/offline shell and install guidance.
Backend: schema + RLS + tests, cookie-based auth, isolated local demo adapter, authenticated validated APIs, idempotency, preferences, export/delete scaffolding.
AI/Scheduling: shared-compatible schema validation and pure Melbourne time utilities with DST/conflict tests, explicitly disabled parser interface; no real model or automatic scheduling.
Main: configuration/dependency lock, E2E flows, security review, integration, README and final checks.

## Verification

npm install / npm ls; npm run lint; npm run typecheck; npm test; npm run build; npm run test:e2e. E2E runs explicit demo mode in development server on loopback, testing manual review/save/update/delete/preferences and anonymous isolation. SQL integration tests require Supabase and are reported separately if not run. No claim of live Auth, iPhone push or production validation without credentials/device.

## Deferred phases

Structured OpenAI parsing/privacy consent, deterministic capacity scheduling, recurrence expansion, adaptive rescheduling and schedule health; then verified Web Push subscription/delivery/cancellation with durable jobs and iPhone device validation.

## Delivery status

Phase 0 and Phase 1 implemented and integrated. See verification.md for executed checks and external checks still requiring credentials. No Phase 2 AI/scheduling or Phase 3 push work enabled.
