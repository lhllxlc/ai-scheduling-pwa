# Phase 0 / 1 verification

Verified on 2026-09-11 with Node 22.19.0, Next.js 16.3.4 and locked npm dependencies.

| Check                          | Result                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| npm install / npm ls --depth=0 | Passed; no missing direct dependencies; audit reported 0 vulnerabilities   |
| npm run lint                   | Passed, no warnings                                                        |
| npm run typecheck              | Passed                                                                     |
| npm test                       | 4 files, 40 tests passed                                                   |
| npm run build                  | Passed; 14 generated routes/pages, dynamic authenticated APIs              |
| npm run test:e2e               | 6 tests passed across mobile and desktop Chromium                          |
| Mobile screenshot inspection   | Checked Today layout; no horizontal overflow in browser assertion          |
| Secret patterns / .env ignore  | No likely credential patterns; real env files and generated output ignored |

Browser coverage: manual draft remains unsaved before confirmation; edited draft saved once; calendar display; edit dialog; complete; preferences persistence and Chinese language; logout; two-user isolation; task deletion; account deletion; invalid input; forbidden cross-origin request; idempotency replay/mismatch; manifest and service failure state. Page runtime errors asserted absent.

Unit coverage includes Melbourne spring-forward/fall-back, invalid/ambiguous wall times, calendar bounds, fixed overlaps, shared schemas, demo isolation, production demo prohibition, body limits, rate limits, error redaction and proxy origin validation.

Fixed during integration: request URL origin mismatch behind development proxy (explicit APP_ORIGIN); inconsistent server/browser timezone abbreviations (deterministic initial render); developer indicator covering mobile navigation (disabled). Source formatting completed without altering phase scope.

Not executed: real Supabase signup/login/email confirmation/admin account deletion; SQL RLS integration test; iPhone Safari installation and push delivery; production hosting. No credentials supplied, no paid resources created, no deployment performed. The SQL isolation test is provided at supabase/tests/isolation.sql for a migrated disposable database.

Git origin was configured to https://github.com/lhllxlc/ai-scheduling-pwa.git. Read-only ls-remote returned Repository not found with current credentials. No remote content was fetched or overwritten and no push performed. Repository existence/access must be resolved before comparing remote history and pushing a branch.
