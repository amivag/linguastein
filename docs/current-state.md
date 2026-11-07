# Current project state

**Reviewed:** 2026-10-29. Repository memory; update facts in place.

## Decisions

- Spanish is the working app. Its shell is a scaffold for other apps; the pure
  `@platform/engine` package is the reusable learning core. Rhythm training with
  hands/pencils is the next subject being considered, not a built app.
- Keep content, exercises, evidence and learner state separate. Rhythm owns
  temporal targets and grading; it must not pretend to be text or Spanish.
- Theme infrastructure is portable in `@platform/appearance`; each app supplies its
  namespace, catalog and CSS. Build-time theme modules are supported; runtime
  downloads are not. [Theming](theming.md) owns registration and accessibility.
- A future optional server is likely modern PHP. SQLite, MySQL, MariaDB and
  PostgreSQL are candidates; no framework, deployment or database is selected.
- Future users, registration and sign-in must be accommodated, not implemented
  now. Guest practice remains available. Identity, app/account ownership and
  guest-to-account migration need explicit contracts before sync.
- Hosting moves to Cloudflare, one subdomain per app, with a moved notice left
  at the GitHub Pages address. The domain is undecided; the switch is prepared
  and off ([deploy.md](deploy.md#switching-hosts)).
- No backend vendor is fixed. [server-foundation.md](server-foundation.md) owns
  the server/account plan; older Supabase-only notes are superseded.
- Use `sfw npm` for dependency work and respect the configured release cutoff.
  Keep TypeScript compatible with the installed ESLint parser. Query installed
  versions and audits when needed; do not cache volatile results here.

## Implemented foundation guarantees

Atomic assessment/import/reset operations, snapshot exports and transactional
settings updates protect local state. Retry repairs older interrupted imports;
practice reports unsaved writes. [Storage](storage.md) owns these contracts.

Modal focus survives rerenders, isolates the top dialog, and restores its opener.
Nested portals share keyboard ownership; background branches are inert.
[Design language](design-language.md#3-overlay-never-push) owns the UI contract.

Provider-independent `src/layout/PageLayout.tsx` owns page structure and layout
slots; `AppShell` composes Spanish navigation, history, speech and updates.
[Skeleton](skeleton.md) owns reuse; a rhythm fixture guards the boundary.

## Verified unresolved foundation findings

1. Shared scheduling still embeds learning-policy thresholds; make policies
   explicit when a real second subject needs different behavior.

These are findings, not completed fixes. Keep the list current as fixes land.

## Where to read next

[Docs map](README.md) routes by task. [framework.md](framework.md) owns reuse;
[roadmap.md](roadmap.md) tracks product work. Load only the relevant topic and
source/tests. Historical task briefs are not current architecture or memory.
