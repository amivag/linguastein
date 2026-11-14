# Local persistence guarantees

`LearnerStorage` owns concurrency and atomicity; screens must not depend on a
queue in one React instance for correctness. No database or file format changes
are needed for these operations.

## Transactions

`storage.transaction(async (stores) => ...)` serializes read/modify/write and
commits all participating records together or rolls them back on failure. The
callback receives `LearnerStores`, with no nested transaction or database object.
Await only those scoped store calls: external I/O can allow IndexedDB to close,
and calling the outer storage can deadlock. Scoped stores expire at completion.
This is a local capability, never an HTTP transaction to send to a PHP server.

IndexedDB uses a multi-store read/write transaction for these operations. Normal
reads/writes use only their required stores; preference and course patches each
read/merge/write `meta` in one transaction, including across connections/tabs.
Memory storage serializes operations, stages transaction snapshots and publishes
only a successful snapshot; failed callbacks discard staged writes. Its map
snapshot cost is proportional to local history, acceptable for the temporary
fallback rather than a server-database implementation pattern.

## Assessment and reconciliation

All assessment screens call `saveAttempts(storage, attempts)`. It reads fresh
progress inside the transaction, saves immutable evidence and its projection,
and groups all patterns exercised by one number into the same commit. Repeating
an identical attempt id is idempotent; conflicting evidence under an existing id
is rejected. Missing projections, retries and out-of-order/same-time attempts
use canonical `replaySubject`; ordinary chronological reviews remain incremental.
Raw store methods remain available for migrations/reconciliation, not independent
progress/attempt writes from a screen. A source-boundary test enforces that cut.

Imports merge all stores and optional settings in one transaction. Already-held
attempts still participate in reconciliation, so retry repairs stale progress
left by older non-atomic imports. Reports count actual changed projections rather
than calling an unchanged re-import a reschedule. Log-less cached progress remains
preserved as fallback evidence. Exports read one consistent transaction snapshot.
History-only reset is transactional; full reset clears all stores atomically.

## Connections and durability

Updates wait for the learner, so an old tab can be open when a newer build
upgrades the schema. The old connection closes itself on `versionchange` and
marks the tab reload-required: its banner becomes a non-dismissible alert. A
newer tab whose upgrade is still blocked says so on the boot screen and continues
once the other tab closes. It does not fall back to memory storage, which would
lose what is practised next. A connection the browser terminates is treated the
same way as one that closed for an upgrade.

After the first evidence commits, `saveAttempts` asks for persistent storage
(`navigator.storage.persist()`), once per page load. Firefox shows a prompt
for it, so it is not asked at boot. `tests/storage/connection.test.ts` and
`durability.test.ts` cover both behaviours.

## Feedback and tests

Practice and number drills retain failed write operations with their original
ids while mounted, expose an alert/retry and do not regrade on retry. A completed
session says saved only after its attempts and summary have committed. This
in-memory retry state is not a durable outbox: leaving the page loses unsaved
operations. Future sync/outbox and account ownership requirements belong in
[server-foundation.md](../../../docs/server-foundation.md), not this local API.

`tests/storage/atomicity.test.ts` exercises both implementations, rollback,
concurrent updates, duplicate/conflicting requests and legacy import repair;
separate connections check settings races. Feature tests cover persistence
failures, pending writes, retry feedback and reset rollback. Database migrations
remain covered by the existing migration suite.
