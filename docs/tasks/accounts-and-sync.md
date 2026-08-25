# Task: accounts, and learner state that survives a device

**Status:** briefed, not started. The two stages that must come first are already
briefed elsewhere — see §2 — and one decision (§6.1) has to be made before any
wire format is fixed. Both of those are now closed: the backend vendor is
**settled 2026-08-25 (§4.1)** and so is the merge policy (**§6.1**, reasoned in
[learner-profile.md](learner-profile.md) §9.1). What remains before this task can
start is work rather than decisions — §2's two stages, in that order.
**Written:** 2026-08-24
**For:** a fresh agent session, no prior context assumed
**Scope:** a `SyncProvider` behind `LearnerStorage`, an auth boundary, and the
one backend this repository has never had. No engine changes. No screen may learn
that an account exists beyond Settings.

Read [`AGENTS.md`](../../AGENTS.md) architecture rule 4 (_progress references
stable ids only_) and [learner-profile.md](learner-profile.md) in full. This task
is the third act of that one, and starting it without Stages A and C means
designing a merge over records that are not yet mergeable.

Claims marked _(verified)_ were checked against this tree on 2026-08-24.

---

## 1. Why this is the best-prepared of the three growth tracks

The hard part is done and was done for other reasons.

- **Progress references item ids, and an id carries its pack**
  (`core-es:item:000123`), so content can change under a learner without
  invalidating what they have practised _(verified: rule 4, and
  `domain/progress/`)_.
- **`LearnerStorage` is one interface**, listed in
  [architecture.md](../architecture.md) as the seam for "cloud sync behind the
  same contract", with two implementations already held to identical contract
  tests _(verified: `src/storage/`)_.
- **Stage B of [learner-profile.md](learner-profile.md) has landed**: `packId`
  and `updatedAt` on a progress row, `course` on a session row, and
  collision-free attempt and session ids. That last one is the load-bearing part
  — the brief says it plainly: "an id is the one field a merge has to be able to
  trust", and before Stage B both were deterministic from a timestamp, so two
  devices merging could not tell a duplicate from a collision _(verified:
  §4.8, §6)_.

What is missing is a serialisation format, a bulk write path, a record clock to
merge on, and a decision about what merging means. The first three are Stage C of
that task. The fourth was §6.1 here, and it is settled — which is what makes the
first three buildable.

## 2. Do these two things first, and ship them before any backend exists

**Stage A of [learner-profile.md](learner-profile.md) — device settings vs course
state.** Four preferences that are properties of a course are stored globally, so
a second language cannot behave correctly however good its pack is. This is not
sync preparation; it is a live bug, and §4.2 of that brief demonstrates it
emptying a session.

> One half of that bug was fixed on 2026-08-24 — `focusTopics` is now narrowed
> through `reachableTopics` before it is written into a session link, not only
> before it is summarised — which removes the empty-session symptom without
> removing the cause. `pronunciationLocale`, `voiceName` and `level` are still
> global, and a Spanish voice reading French text is the remaining shape of it.

**Stage C of the same task — a versioned export/import envelope**, validation on
the way in, and bulk read/write APIs on the stores.

Ship Stage C **on its own, in the UI, before there is any backend**. Three
reasons, in ascending order of importance:

1. It is the same four things sync needs, so none of the work is spent twice.
2. It is real value with no account, no server and no privacy surface — which is
   the product this app currently is.
3. The README says alpha means "there is no migration promise between alpha
   builds — practice history from an earlier one may simply be discarded"
   _(verified)_. Export is how a learner stops that being your problem. It is
   also the only thing standing between an iOS storage eviction and a lost year
   of FSRS history — see [native-port.md](native-port.md) §6.

Everything below assumes both have landed.

## 3. The shape: local stays authoritative

```text
features/  ──▶  LearnerStorage (interface)
                      │
                      ├── IndexedDbStorage        ← always the read path
                      └── SyncProvider (new)      ← reconciles in the background
```

The rule, and it is the whole design: **no screen ever awaits the network to show
a learner their own progress.** The local store answers every read. The sync
provider pushes and pulls on its own schedule and writes through the same bulk
APIs Stage C adds. A failed sync is a status line in Settings, never an error a
practice session can see.

This is what keeps "works offline, no account, in two minutes on a phone" true
after accounts exist. An account becomes a _backup and a second device_, not a
precondition. If a design ever requires being signed in to practise, it has left
this brief.

Consequences worth stating because they are easy to lose:

- `services.ts` stays the only place a provider is chosen. A signed-out app
  composes exactly what it composes today.
- The provider is not a third `LearnerStorage` implementation. It wraps one and
  adds a reconciler, because two implementations of the same interface cannot
  both be authoritative.
- Sync is per record and idempotent, which is what Stage B's ids are for.
- The provider's SDK is **dynamically imported**, so a signed-out install
  downloads none of it. The app ships no third-party network code today, and
  "works offline, no account, in two minutes on a phone" is a claim about the
  bundle as much as about the UX. An optional module that is optional only at
  runtime has already given half of it away.

## 4. The backend

There has never been one. `services.ts` fetches static JSONL from the app's own
origin and nothing else _(verified)_.

### 4.1 The decision

**Settled 2026-08-25: Supabase.** Postgres, hosted auth, row-level security,
generated TypeScript types.

What the choice had to satisfy, in priority order — the list is kept because it
is what decided it:

1. **Row-level isolation by default.** A learner's progress must be unreadable
   by another account without a policy anyone has to remember to write.
2. **Deletion that actually deletes**, because §5 requires it.
3. **An append-friendly attempt log.** It is unbounded and unpruned today
   ([learner-profile.md](learner-profile.md) §9.3), and a replay-based merge
   (§6.1) needs it complete.
4. Email magic link, plus Apple and Google sign-in. Note that offering Google
   sign-in on iOS makes Apple sign-in mandatory _(unverified — check the current
   App Store guideline before building the second provider, not after)_.

Item 1 settled it, and it is worth being exact about why. Postgres row-level
security is declarative and enforced by the database, so a forgotten
`where user_id = …` in an endpoint written a year from now cannot leak a row.
Every alternative in §4.2 turns that guarantee into a habit, and a habit is
precisely what item 1 says it must not be.

Then, in descending order of weight: hosted auth covers all three sign-in
methods with none of it as code here; the schema generates TypeScript, so the
records in `storage/types.ts` are not re-expressed by hand in a second language
and cannot drift from it; deletion is a real `delete`; and the whole thing is
open source and self-hostable, which keeps the "run your own" story an AGPL
repository ought to have.

**This does not settle §6.1 and must not be read as settling it.** An
append-only Postgres table serves last-write-wins and attempt-log replay equally
well, so the merge policy stays open — and stays the decision that blocks Stage
C's envelope.

### 4.2 What lost, so that it is not re-derived

**Cloudflare Workers + D1** — the runner-up, and close. Better on latency and on
cost. It loses on item 1 alone: D1 is SQLite, SQLite has no row-level security,
and isolation becomes query discipline inside a Worker. Auth is also
bring-your-own, so a solved problem would be traded for an integration.
Defensible for someone already fluent in Cloudflare. Not chosen here.

**PHP** — cheap ubiquitous hosting and a deployment model that is hard to break,
and the objection is not about the language. Two things: magic links, OAuth,
sessions and every `where user_id` would be hand-written here, in the
highest-consequence area of the system; and it is a second language in a
single-language repository, so Stage C's zod schemas and the storage contract
acquire a hand-maintained twin that drifts. A PHP host is also a server somebody
patches, which spends the zero-ops posture that made GitHub Pages right.

**A bespoke Node service** — the same objection minus the language mismatch. It
owns auth, the database, the patching, and a process that can be down. The data
is a handful of rows per learner and an append-only log. Do not.

### 4.3 The tables, and the policies that isolate them

A sketch rather than a migration. The shapes are the records as they stand on
2026-08-25 _(verified against `domain/progress/types.ts`,
`domain/sessions/types.ts` and `domain/batches/model.ts`)_ — and Stage A moves
four fields out of `Preferences` before any of this is written, so `courses`
below is that stage's shape rather than today's.

```sql
-- One row per account. `preferences` and `courses` are jsonb rather than
-- columns: §9.1 takes preferences wholesale, never field-merged, so a column
-- per setting buys nothing and costs a migration each time one is added.
create table profiles (
  user_id     uuid primary key references auth.users on delete cascade,
  preferences jsonb  not null default '{}',
  courses     jsonb  not null default '{}',   -- keyed by target language
  updated_at  bigint not null
);

create table progress (
  user_id            uuid    not null references auth.users on delete cascade,
  item_id            text    not null,          -- 'core-es:item:000123'
  pack_id            text,                      -- absent where the id will not parse
  status             text    not null,
  attempts           integer not null,
  correct            integer not null,
  incorrect          integer not null,
  difficulty         real    not null,
  stability          real,
  last_reviewed_at   bigint,
  due_at             bigint,
  average_latency_ms integer,
  hints_used         integer not null,
  streak             integer not null,
  updated_at         bigint  not null,
  primary key (user_id, item_id)
);
create index on progress (user_id, pack_id);   -- the `by-pack` index, again

create table attempts (
  user_id       uuid    not null references auth.users on delete cascade,
  id            text    not null,  -- client-generated, collision-free (Stage B)
  item_id       text    not null,
  exercise_kind text    not null,
  grade         text    not null,
  correct       boolean,
  latency_ms    integer,
  hints_used    integer,
  at            bigint  not null,
  session_id    text,
  primary key (user_id, id)
);
create index on attempts (user_id, at);

create table sessions (
  user_id         uuid    not null references auth.users on delete cascade,
  id              text    not null,
  course_language text    not null,
  course_level    text    not null,
  started_at      bigint  not null,
  ended_at        bigint,
  planned         integer not null,
  completed       integer not null,
  correct         integer not null,
  primary key (user_id, id)
);

create table batches (
  user_id         uuid    not null references auth.users on delete cascade,
  id              text    not null,
  label           text    not null,
  course_language text    not null,
  course_level    text    not null,
  item_ids        text[]  not null,  -- frozen at creation, so an array is honest
  created_at      bigint  not null,
  per_session     integer,
  primary key (user_id, id)
);
```

Three things about that schema are decisions rather than transcription.

**Timestamps are `bigint`, not `timestamptz`.** `Timestamp` is epoch
milliseconds, and `domain/progress/types.ts` says why: numbers survive a JSON
round trip. Converting to `timestamptz` on the way out and back on the way in is
a lossy trip through a format no client ever reads, and it would put the wire
format and Stage C's export envelope into disagreement over the same field.

**Every primary key is composite on `user_id`.** Stage B made the attempt,
session and batch ids collision-free _per device_ — `batch-lq2p8v-k3f9a1`, a
clock plus a token — which is not the same claim as globally unique.
`(user_id, id)` is the key those ids can actually support.

**`on delete cascade` from `auth.users` is the erasure path.** §5 asks for
deletion that is not an email address; this is it, expressed in the schema
rather than as a job somebody runs.

```sql
alter table profiles enable row level security;
alter table progress enable row level security;
alter table attempts enable row level security;
alter table sessions enable row level security;
alter table batches  enable row level security;

-- profiles, progress, sessions and batches all take this one.
create policy own_rows on progress
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Attempts are the exception: the log is append-only, so no update and no
-- delete policy exists. Erasure runs through the cascade above rather than
-- through a policy that would let a client rewrite its own history.
create policy insert_own on attempts
  for insert to authenticated with check (auth.uid() = user_id);
create policy read_own on attempts
  for select to authenticated using (auth.uid() = user_id);
```

One honest qualification to §4.1's headline. Row-level security is enforced by
the database once it is **on**, and it is off by default for a table created by
SQL — the dashboard enables it for tables made through the UI, a migration does
not. So the guarantee is real, and the `enable row level security` line is the
one thing that can still be forgotten. Assert it: a test that queries each table
as a second account and expects nothing back is a few lines and it never rots.

### 4.4 Check these before signing up for anything

- **Free-tier limits move**, and in particular whether inactive free projects
  are still paused _(unverified)_. §3's rule is what makes this survivable: a
  failed sync is a status line in Settings, so a paused project degrades to
  exactly the app that exists today.
- **A custom domain is a paid add-on** at the time of writing _(unverified)_. It
  matters more than it looks: CSP wants exactly one allowed host, and it had
  better not be a name that changes.
- **The DPA and the region choice**, for §5's processor agreement.

### 4.5 Two things GitHub Pages cannot do

Plan for them: the API lives on a second origin (CORS, and probably a real
domain), and this is the first content-security surface the app has ever had.
The app makes no third-party request today. That is worth keeping true except
for exactly one host.

## 5. The privacy cost, paid deliberately

Today the app collects nothing, stores nothing off-device, and needs no privacy
policy to be honest. That is a genuine asset and this task spends it.

What accounts require:

- A privacy policy that says what is stored and where, and a data-deletion path
  that is not an email address.
- GDPR obligations: lawful basis, export (Stage C already is this), erasure, and
  a processor agreement with whichever backend is chosen.
- A decision on device settings in the export — [learner-profile.md](learner-profile.md)
  §9.4 — which becomes sharper with sync: a `voiceName` naming a voice the second
  device does not have is a silent fallback, and a theme is a property of the
  device that was in front of the learner rather than of the learner.
- Store privacy disclosures, if [native-port.md](native-port.md) has landed.

Do not add analytics as part of this. It is a separate decision with a separate
justification, and bundling it here is how an app that promised no tracking
acquires some in a commit about backups.

## 6. Judgement calls left open

**6.1 The merge policy. Settled 2026-08-25** — in
[learner-profile.md](learner-profile.md) §9.1, which carries the reasoning and the
per-record table. In one line: the attempt log is what syncs, and progress is a
projection folded back out of it. `ItemProgress` is a total, deterministic fold
over an item's attempts, so replay is exact, and last-write-wins on it is a
lost-update bug against five accumulating fields rather than merely a lossy
choice.

Three things follow for this brief in particular.

- **§3's diagram gets more specific.** The provider pushes and pulls the attempt
  log — plus sessions, batches and the two preference documents — and rebuilds
  progress locally. Progress is never _sent_ as an authority, only ever as a
  cache the receiving device is free to recompute.
- **§6.3 stops being a question.** Appending to a log does not conflict, so there
  is no conflict to show anyone. That section wanted the merge silent and
  defensible; this is the version that is silent because there is nothing to
  adjudicate.
- **`updatedAt`'s role narrows, and Stage B is not wasted by it.** It is the sync
  high-water mark — what to push, what to pull — and the last-write-wins field
  for the records that genuinely are documents. It is no longer the merge input
  for progress, because progress no longer has a merge. A format that
  has shipped is a format that costs a migration to change.

**6.2 Whether an account is ever required for anything.** The answer that keeps
this app what it is: no. The pressure will come from
[monetisation.md](monetisation.md) — a supporter tier needs a receipt, and a
receipt wants an identity. Decide there, and let it be the one feature behind an
account rather than the reason accounts exist.

**6.3 Conflict as a thing a learner sees.** Two devices practising the same item
offline is the ordinary case, not the edge case. The temptation is a conflict
dialog. Resist it: nobody can adjudicate their own FSRS stability values. The
merge has to be silent and defensible, which is another argument for §6.1's
replay.

**6.4 Whether progress stays per item.** [learner-profile.md](learner-profile.md)
§9.2 — one `stability` and one `difficulty` per item fold a four-way multiple
choice together with a production answer. It is the biggest open question in the
learning model and it changes the stored shape.

This one got cheaper on 2026-08-25, and the entry is kept because the reason
matters. §6.1 makes progress a projection, so changing its shape is a rebuild
from attempts that are already stored rather than a schema bump against live
accounts. It is therefore safe to defer past this task — which is the opposite of
what this section said while the merge policy was open, and the only one of these
four calls that the decision moved.
