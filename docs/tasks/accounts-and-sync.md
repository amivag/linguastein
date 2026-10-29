# Task: accounts, registration and synchronization

**Status:** future requirement; no backend, account system or registration is
implemented. **Reviewed:** 2026-10-29. The former vendor comparison and SQL
sketches were superseded and removed; Git history retains their rationale.

## 1. Current direction

[Server foundation](../server-foundation.md) owns the PHP/SQL, identity,
registration and sync requirements. Modern PHP is likely; database and auth
providers remain open. Supabase is not a requirement. Guest learning remains
available and local progress does not await a network request.

## 2. Prerequisites

Local per-course settings and versioned file transfers already exist. Consult
`src/storage/transfer`, `src/storage/types.ts` and their tests for current shapes.
`replaySubject` rebuilds progress from attempts. Atomic persistence, interrupted
import recovery and concurrent settings writes still need the fixes recorded in
[current-state.md](../current-state.md); a file round trip alone does not prove
network retry safety.

## 3. Local storage and sync

Local storage remains the practice read/write path. A separate background sync
service reconciles it over HTTP. Account switching and guest adoption require
explicit ownership, cache and pending-operation rules before any account UI.

## 4. Backend

Select a maintained PHP/auth stack and one deployment database when work starts.
Test other SQL adapters before claiming support. No schema, hosting provider,
login method or shared cross-app account policy is fixed by this brief.

## 5. Privacy and account lifecycle

Define what registration uploads, ownership/access checks, verification/recovery,
export/deletion, session revocation and local replicas. Review applicable privacy
and distribution requirements at implementation time; old briefs are not legal
or platform-policy guidance. Registration must not silently claim guest data.

## 6. Planning decisions

### 6.1 Reconciliation

Preserve immutable attempt ids and rebuild progress. Specify revisions for
mutable records, deletion propagation, server change cursors and idempotent
acknowledgements in the API contract; keep it distinct from file exports.

### 6.2 Account UI

Settings is the current place for device/profile information; future registration
and sign-in flows need their own UX decision. No account UI is authorized by this
plan. [Server foundation](../server-foundation.md) is the detailed checklist.
