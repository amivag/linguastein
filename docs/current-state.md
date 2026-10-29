# Current project state

**Reviewed:** 2026-10-29. Repository memory; update facts in place.

## Decisions

- Spanish is the working app. Its shell is a scaffold for other apps; the pure
  `src/engine/` directory is the reusable learning core. Rhythm training with
  hands/pencils is the next subject being considered, not a built app.
- Keep content, exercises, evidence and learner state separate. Rhythm owns
  temporal targets and grading; it must not pretend to be text or Spanish.
- Theme infrastructure is portable in `src/appearance/`; each app supplies its
  namespace, catalog and CSS. Build-time theme modules are supported; runtime
  downloads are not. [Theming](theming.md) owns registration and accessibility.
- A future optional server is likely modern PHP. SQLite, MySQL, MariaDB and
  PostgreSQL are candidates; no framework, deployment or database is selected.
- Future users, registration and sign-in must be accommodated, not implemented
  now. Guest practice remains available. Identity, app/account ownership and
  guest-to-account migration need explicit contracts before sync.
- No backend vendor is fixed. [server-foundation.md](server-foundation.md) owns
  the server/account plan; older Supabase-only notes are superseded.
- Use `sfw npm` for dependency work and respect the configured release cutoff.
  Keep TypeScript compatible with the installed ESLint parser. Query installed
  versions and audits when needed; do not cache volatile results here.

## Verified unresolved foundation findings

1. Attempts/progress use separate writes. An interrupted import can retain an
   attempt while leaving progress stale, and retry may rebuild nothing.
   Start with atomic persistence and partial-failure recovery tests.
2. Concurrent IndexedDB settings writes can lose a patch. Make read/merge/write
   transactional inside storage; a UI queue does not cover other tabs/callers.
3. The focus trap depends on callback identity. Stabilize its lifecycle and test
   ordinary rerenders, nested dialogs and empty dialogs.
4. Shared scheduling still embeds learning-policy thresholds; make policies
   explicit when a real second subject needs different behavior.
5. `AppShell` still depends on course navigation and speech UI. Use a neutral
   layout plus an app wrapper when building the second app.

These are findings, not completed fixes. Keep the list current as fixes land.

## Where to read next

[Docs map](README.md) routes by task. [framework.md](framework.md) owns reuse;
[roadmap.md](roadmap.md) tracks product work. Load only the relevant topic and
source/tests. Historical task briefs are not current architecture or memory.
