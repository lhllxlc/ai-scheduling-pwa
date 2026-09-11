# API contract v1

All JSON envelopes: success {data:T}, failure {error:{code,message}}. Never return stack traces or plan bodies in errors/logs. 400 schema, 401 unauthorized, 404 ownership-safe missing, 409 conflicts/idempotency mismatch, 429 limit, 503 unconfigured. Browser fetch uses same-origin credentials. All dates ISO with offset. Shared types are src/lib/shared/types.ts.

- GET /api/session -> SessionInfo. Anonymous allowed, no sensitive data.
- POST /api/auth {action:'login'|'signup'|'logout'|'demo',email?,password?} -> SessionInfo with optional message for email verification. demo action only explicitly enabled development mode; email verification signup may return null user.
- GET /api/preferences -> Preferences (defaults if new account).
- PUT /api/preferences full Preferences -> Preferences.
- GET /api/tasks -> Task[].
- POST /api/tasks TaskInput, required Idempotency-Key UUID -> Task (201). Same key/payload replays; changed payload 409.
- PATCH /api/tasks/:id Partial<TaskInput> & {status?:TaskStatus} -> Task; validate merged data.
- DELETE /api/tasks/:id -> {deleted:true}.
- GET /api/export -> {preferences,tasks}; attachment JSON, authenticated.
- DELETE /api/account {confirmation:'DELETE'} -> {deleted:true}; service role only for admin auth deletion, session cleared. Config absence returns 503. Demo deletion clears isolated demo data.

Review stores only structured manual draft in sessionStorage until confirmation, then POST once with stable idempotency key. Fixed times are user-chosen; flexible tasks show unscheduled. Missing AI and push are explicit disabled capabilities. No AI/push routes required this phase.

## Deployment origin

Set APP_ORIGIN to the exact public scheme/host/port. Mutation Origin is compared to this configured value, never an untrusted forwarded host. Without APP_ORIGIN the request URL origin is used; reverse-proxy deployments should always set it.
