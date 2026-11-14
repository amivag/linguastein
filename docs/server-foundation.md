# Optional server, accounts and registration

**Direction:** future planning only, reviewed 2026-11-14. PHP 8.5+ is likely;
SQLite, MySQL, MariaDB and PostgreSQL are database candidates. No framework,
authentication method, deployment, database or account UI is selected or built.
This document owns the plan; [current-state.md](current-state.md) owns the short
memory entry. The old Supabase-only decision is superseded.

## Architecture

```text
Browser screens -> application operations -> local storage + future outbox
                            |                           |
                       pure TS engine            HTTP sync adapter
                                                        |
PHP HTTP/auth -> application operations -> repositories + transactions -> SQL
```

Practice stays local and available to guests. Sync reconciles in the background;
individual UI storage calls do not become HTTP requests. Compose browser adapters
in `src/app/services.ts` and future PHP adapters in a server composition root.
The engine knows nothing about HTTP, accounts, SQL or PHP. A server may validate
and store evidence without duplicating the scheduler; if it later schedules,
choose one authority or verify implementations against versioned fixtures.

Application operations own authorization and transaction boundaries across
repositories. SQL and credentials stay server-side. Shared mechanics may cover
identity envelopes, sync and transactions; each learning subject retains its own
validated content and performance payloads.

## Users and registration

Accommodate registration, sign-in/out, session expiry and account recovery behind
an authentication service. Use a maintained authentication implementation when
building it; credential handling must not enter the learning engine. Whether to
use passwords, links, passkeys or external providers remains a later decision.
Verification, recovery, abuse limits and secure session handling belong in that
implementation's acceptance criteria, not placeholder endpoints now.

- Distinguish authenticated account identity, local learner/device identity and
  display name. Email and display name are not stable ownership keys. Keep
  account identity separate from app-specific learning records.
- Registration must not silently upload or reassign anonymous practice. Define
  an explicit guest-to-account merge with retry-safe attribution and preserve
  original evidence ids. Account creation and data adoption are distinct steps.
- Scope local data and pending sync work by owner before supporting multiple
  accounts. Switching users, signing out or expiring a session must not show
  another account's cached data or send its pending attempts under a new login.
- The server derives the authenticated owner and enforces app/account isolation
  on every operation; a payload's user id is not authorization. Whether multiple
  learning apps share one login remains open; sharing a login does not grant
  cross-app data access.
- Define local reset, record deletion, sign-out, account export/deletion and
  session revocation separately. Decide explicitly which settings sync:
  device-specific voice ids and local caches need different treatment from
  account preferences. Guest access and ownership tests precede registration UI.

## Wire contract and recovery

Choose a versioned HTTP contract for the first actual feature, using OpenAPI and
reusable JSON schemas/fixtures for PHP and TypeScript. Specify absent/null fields,
unknown fields, ids, time units, limits, pagination, errors and compatibility.
Validate input at both boundaries; generated types do not validate runtime data.
File exports remain distinct from wire DTOs and database schemas.

1. **Atomic local commit:** save attempt and progress together. A future outbox
   joins that transaction. Local success is durable local state, not a remote
   acknowledgement; surface write failures.
2. **Idempotent remote commit:** retrying one operation id with the same payload
   is safe; different content under that id is a conflict. Scope keys by app and
   authenticated owner. Commit records and acknowledgement state before success.
3. **Reconciliation:** immutable attempts are evidence; progress is a projection.
   Already-held attempts must still repair stale projections after interruption.
   Mutable settings need revisions/conflict rules, not client-clock ordering.
4. **Clock separation:** retain occurrence times, use server change cursors for
   sync, and define commit-visible pagination that cannot skip concurrent writes.
   Rhythm timing uses a separate monotonic clock/durations.
5. **Deletion:** mutable records need tombstones and retention/resync rules so
   another device cannot resurrect them. Account deletion also defines treatment
   of local replicas and pending work.

## SQL portability

Repositories isolate database selection, but common drivers do not make SQL,
locking and migrations identical. PDO exposes SQLite, MySQL and PostgreSQL
adapters; Doctrine DBAL is a candidate abstraction, not a selected dependency.
Primary references: [PDO drivers](https://www.php.net/manual/en/pdo.drivers.php),
[transactions](https://www.php.net/manual/en/pdo.transactions.php),
[DBAL platforms](https://www.doctrine-project.org/projects/doctrine-dbal/en/4.3/reference/platforms.html).

Choose one deployment database first. Claim others only after real-engine
migration and repository contract tests pass; SQLite-only tests cannot establish
MySQL, MariaDB or PostgreSQL support. Declare MySQL and MariaDB separately.
Use columns for queryable identity/ownership/revision/time, with versioned,
validated subject payloads where appropriate. Specify numeric ranges, booleans,
id case sensitivity, Unicode, JSON, sorting and pagination. Keep dialects,
upserts and migrations inside adapters. Test rollback, concurrent writes and
duplicate requests. Keep DDL outside request transactions where it may implicitly
commit; test upgrades on every supported engine.

## Next work

Local atomic persistence, retry repair and transactional settings updates are
implemented; [storage.md](../apps/linguastein/docs/storage.md) owns their contracts. Preserve those tests
before adding sync. A durable outbox, auth SDK, server scaffolding and database
dependencies remain deferred until a concrete feature needs them.

When server work is selected, settle the HTTP/auth and ownership contracts, PHP
runtime/framework, first database, migrations and integration environment. Add
Composer validation/audit, PHP static analysis and server tests to CI and the
local gate together. Registration is planned capability, not immediate scope.
