# Dayweave architecture — phase 0 / 1

Mobile-first bilingual Next.js App Router PWA, TypeScript strict, Tailwind 4, server-only Supabase Auth + PostgreSQL. Node 22, npm lockfile, Vercel compatible. No production deployment in this phase.

Browser calls same-origin JSON APIs; secrets never use NEXT_PUBLIC variables. Server authenticates each request with Supabase getUser and scoped client, with RLS as a second boundary. Mutations validate origin, schema, body size and rate limits. API responses never cache private data. UI has explicit loading/error/empty states.

Without credentials, an explicitly enabled local demo mode uses a session cookie and per-session memory store. It must require APP_DEMO_MODE=true and NODE_ENV!=production (or the dedicated E2E configuration with development server). No production fallback or fake Supabase success. Demo data is temporary, never represents a cloud account.

All instants are ISO UTC; wall-clock user preferences use Australia/Melbourne. Luxon handles DST; nonexistent/ambiguous input must be identified rather than silently converted. AI only produces reviewed structured intent in a later phase. Deterministic scheduling remains a separate pure module. Phase 1 does not pretend to schedule flexible tasks or deliver notifications.

PWA caches only a static offline page and assets, never API responses or private screens. Notifications are disabled and clearly marked next-phase. Raw natural-language input is not persisted.

Ownership: frontend owns src/components, src/app page/layout/styles/manifest and public; backend owns src/app/api, src/lib/server, supabase; AI agent owns src/lib/ai and src/lib/scheduler and adjacent tests. Main owns root configuration, src/lib/shared, docs, tests/e2e and final integration. No overlapping writes until handoff.

References: https://nextjs.org/docs/app/guides/upgrading/version-16 ; https://supabase.com/docs/guides/auth/server-side/creating-a-client
