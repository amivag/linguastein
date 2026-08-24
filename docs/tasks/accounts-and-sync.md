# Task: accounts, and learner state that survives a device

**Status:** briefed, not started. The two stages that must come first are already
briefed elsewhere — see §2 — and one decision (§6.1) has to be made before any
wire format is fixed.
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
that task. The fourth is §6.1 here.

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

## 4. The backend

There has never been one. `services.ts` fetches static JSONL from the app's own
origin and nothing else _(verified)_.

**Recommendation: Supabase or Cloudflare (Workers + D1).** Both give hosted auth
plus a database on a free tier, and both keep the zero-ops posture that made
GitHub Pages the right host. Do not build a bespoke Node service for this; the
data is a handful of rows per learner and an append-only attempt log.

What the choice has to satisfy, in priority order:

1. **Row-level isolation by default.** A learner's progress must be unreadable
   by another account without a policy anyone has to remember to write.
2. **Deletion that actually deletes**, because §5 requires it.
3. **An append-friendly attempt log.** It is unbounded and unpruned today
   ([learner-profile.md](learner-profile.md) §9.3), and a replay-based merge
   (§6.1) needs it complete.
4. Email magic link, plus Apple and Google sign-in. Note that offering Google
   sign-in on iOS makes Apple sign-in mandatory _(unverified — check the current
   App Store guideline before building the second provider, not after)_.

Two things GitHub Pages cannot do, so plan for them: the API lives on a second
origin (CORS, and probably a real domain), and this is the first content-security
surface the app has ever had. The app makes no third-party request today. That is
worth keeping true except for exactly one host.

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

**6.1 The merge policy.** This is the decision, and
[learner-profile.md](learner-profile.md) §9.1 already frames it: per-record
last-write-wins on `updatedAt` is defensible and loses FSRS review history
invisibly; replaying the merged attempt log through `recordAttempt` is more
correct, much slower, and possible only because attempts are the source of truth
today. **Settle it before Stage C's envelope is fixed**, because a replay-based
merge needs the attempt log complete and §9.3 is about pruning it. A format that
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
learning model and it changes the stored shape. Doing it after this task means a
schema bump for a format that has just shipped to real accounts, which is
strictly worse than doing it before. It is listed here so it is decided rather
than discovered.
