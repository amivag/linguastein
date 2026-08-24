# Task: learner state as a profile

**Status:** **Stage B has landed** — stored state is at database version 2, and
§6 now reads as a record of why those fields exist rather than as work to do.
Stage A is briefed and unstarted: every blocking unknown below is resolved, and
nothing has been written. Stage C is briefed in shape, but §9.1 is a decision to
make before its file format is fixed rather than after.
**Written:** 2026-08-21
**Stage B landed:** 2026-08-21 — `packId` and `updatedAt` on a progress row,
`course` on a session row, collision-free attempt and session ids, the version-2
migration that backfills all four, and the Progress screen narrowed to its own
language. What Stage B was briefed to do and deliberately did _not_ do is listed
at the end of §6.
**For:** a fresh agent session, no prior context assumed
**Scope:** `src/storage`, `src/domain/progress`, the four screens that read
progress and the twenty files that read a preference. No content authoring, no
new exercise kind, no scheduler rewrite — §9.2 is the one that would touch the
scheduler, and it is deliberately left out of the stages.

---

## 1. The task in one line

Split the one flat `Preferences` record into device settings plus per-course
state, give progress and session records the pack dimension they are missing,
and put a versioned export/import behind both.

## 2. Why

Three things are true of the learner-state layer, in ascending order of what they
cost to leave alone.

**The hard part is already right, and nothing here proposes changing it.**
Progress references item ids, ids carry their pack (`core-es:item:000123`), and
the screens scope the _report_ rather than the store — `HomeScreen` and
`ProgressScreen` each build a `Set` of in-course item ids and filter what they
read. Architecture rule 4 holds end to end. Growing `content/es`, adding a second
Spanish pack, or retiring a row is safe today with no change to any of this.

**Four preferences that are properties of a course are stored globally**, so a
second language cannot behave correctly however good its pack is. This is not a
prediction: the stale-category path is reachable now, with the French fixture,
and it hands back an empty session (§4.2).

**There is nothing to export.** No serialisation, no schema version in the data,
no bulk write path, and no record clock to merge on. Each is cheaper to add
before there are installs carrying history than after — and the `SyncProvider`
the spec anticipates (§23) needs the same four things, so this is not work spent
only on a file format.

## 3. Orientation

Read these first, in order:

1. [`AGENTS.md`](../../AGENTS.md) — **Architecture rules** 1, 4 and 8, and **The
   learning model**. Rule 4 is what this task must not break; rule 8's last
   sentence ("progress is untouched by it") is what Stage B has to keep true
   while adding a pack field to a progress record
2. [`src/storage/types.ts`](../../src/storage/types.ts) — the whole contract, 85
   lines, worth reading before anything else
3. [`src/domain/progress/types.ts`](../../src/domain/progress/types.ts) and
   [`tracker.ts`](../../src/domain/progress/tracker.ts) — the records, and the one
   pure function that writes them
4. [`src/app/course.ts`](../../src/app/course.ts) — where a course comes from.
   Stage A hangs off this, because the path already knows which course is open
5. [`docs/spec/spanish_learning_app_spec_v0.1.md`](../spec/spanish_learning_app_spec_v0.1.md)
   §23 — what local-first was meant to cover

Then run `npm run check`. It must pass before you start.

## 4. What the investigation established

### 4.1 Four global preferences are really per-course

| Field                              | Read in                           | Why it is per-course                                                                                                                                                                                                                                                               |
| ---------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `level`                            | `App.tsx:185` (only)              | Spanish-at-A2 and French-at-A1 cannot both be true. `CourseBar:42` writes language and level together, so switching language carries the level across and `resolveCourse` widens it to `all` when the new language has no such level — and the old ceiling is gone on the way back |
| `focusTopics`                      | `HomeScreen:51`, `FocusPicker:70` | A topic slug is pack vocabulary. `food-drink` means nothing to the French pack                                                                                                                                                                                                     |
| `focus`                            | `HomeScreen:52`, `FocusPicker:83` | Arguably global — it is a bias over buckets, not over content. Listed because it lives beside the other three and moving it costs nothing; keeping it global is a defensible call                                                                                                  |
| `pronunciationLocale`, `voiceName` | 8 files, 24 sites                 | A locale is a _language's_ accent (`es-MX`), and a voice that can read Spanish cannot read French. One global value means a French course speaks French text through a Spanish voice                                                                                               |

`targetLanguage` stays global and stays exactly what its comment says it is: the
pointer deciding where `/` lands.

### 4.2 The stale category is reachable today, and it empties a session

_Fixed 2026-08-24 for topics, ahead of Stage A. The cause below remains: this was
the symptom, and §4.1 is still the disease._

Verified with a throwaway test against `multilingualRepository()` — written, run
and deleted, so do not go looking for it. With `focusTopics: ['food-drink']`
stored and the French course open, pressing **5 min** on Home navigates to
`/fr/all/session?…&topic=food-drink`, and the French pack has 0 of 2 items
carrying that topic. The learner gets "Nothing to practise here yet."

Two things this brief had not noticed, both found on 2026-08-24 and both now
covered by tests:

- **It does not need a second language.** A category whose content is all B1
  survives a switch down to A1, so the shipped single-pack app reaches it.
- **The two halves already disagreed.** `FocusPicker` narrowed the stored list
  for its own summary — its comment says "switching down to A1 must not leave the
  bar boasting about a B1 category" — while `HomeScreen` wrote the raw list into
  the link at three sites. So the bar read `Everything · balanced` above a link
  that said `?topic=hotel`, which is worse than an empty session, because nothing
  on screen said what had narrowed it.

`reachableTopics` in `domain/content/course.ts` is now the one definition, used by
the summary and by every writer. Do not re-derive it at a call site.

### 4.3 The URL parser is not the bug — the writer is

`slugs()` in [`session-url.ts`](../../src/features/practice/session-url.ts) says
plainly that topics and skills "are pack vocabulary rather than domain enums, so
there is no `allowed` list to check them against", and that is correct: the parser
cannot know. What is inconsistent is what happens next. `SessionScreen` resolves a
`?skill=` slug through the repository and drops it when no pack declares it —
with a comment explaining that a stale link should widen a session rather than
plan an empty one — and then passes `url.filter.topics` straight through
untouched. **Fix it at the writer, and beside the skill fix; do not add
validation to `slugs()`.**

_Done for topics on 2026-08-24, and the advice held: the parser is unchanged, and
the narrowing sits at the writer in `reachableTopics`. Note that the two cases
degrade differently on purpose — an unknown `?skill=` **widens** the session,
because a skill is one narrowing among several, while an unreachable `?topic=` is
**dropped from the preference before it is written**, because the learner never
asked for that category in this course. Both avoid an empty session; only one is
a link a learner could have typed._

### 4.4 The manifest already declares pronunciation locales, and nothing reads it

`PackManifest.pronunciationLocales` exists in
[`model.ts:295`](../../src/domain/content/model.ts), is validated in
`schemas.ts:264`, and is populated by `build-dataset.ts:1585` with
`['es-ES', 'es-MX']`. The app instead offers the hard-coded four-entry
`PRONUNCIATION_LOCALES` in [`language.ts:70`](../../src/domain/content/language.ts),
which is Spanish-only. Deriving the list from the loaded packs is the same move
`courseOptions()` already makes for languages, and it is what makes a second
language's accents appear with no code change — the property
`tests/fixtures/pack.ts` exists to protect.

Same shape, smaller: `VOICE_SAMPLE = 'Tengo que trabajar.'` is hard-coded Spanish
inside the otherwise app-agnostic
[`VoiceSettings`](../../src/components/VoiceSettings.tsx), which the skeleton rule
about app identity would not allow if it were a name.

### 4.5 Nothing stored was indexable by pack, and it could not be

_Addressed by Stage B; the reasoning is kept because it is what the `packId`
field and its backfill exist for._

An IndexedDB index is built from a stored key path, and **a record lacking that
key path is absent from the index** — which is also the trap in Stage B's
migration. `packIdOf()` can derive a pack from an item id in memory, but no
`by-pack` query is possible until the field is on the record. Meanwhile
`progress.all()` has four callers — `HomeScreen:35`, `useSessionRunner:137`,
`ProgressScreen:62` and `ShareActions:24`, so the entire progress table is read
to open a share sheet — and `attempts.recent(limit)` reads every attempt row via
`getAllFromIndex` before `reverse().slice()`. All fine at 1,043 items; all
O(all history) for ever.

### 4.6 There is no bulk write path

`progress.put` and `attempts.append` are one record per call. There is no
`putMany`, no `replaceAll` and no exposed transaction, so importing an attempt
log through `append` is one IndexedDB transaction per attempt.

### 4.7 Two declarations are dead

_Settled 2026-08-24: both deleted. §9.5 records why._

`SkillProgress` in `progress/types.ts` was referenced nowhere in `src` or
`tests` — mastery is derived instead, and `mastery.ts` says why.
`showRomanisationHints` was in `Preferences`, had a default, and was read by
nothing. Neither is carried into the file format §7 describes.

### 4.8 Both record ids were deterministic

_Addressed by Stage B._

`Attempt.id` is the item id and the timestamp joined (`tracker.ts:52`), and a
session id is `session-` plus the timestamp in base 36 (`planner.ts:44`). Two
attempts on one item in the same millisecond overwrite silently, and two devices
merging cannot tell a duplicate from a collision. Cheap to fix now, unfixable
later — an id is the one field a merge has to be able to trust.

## 5. Stage A — device settings plus course state

### 5.1 The shape

Two records under `meta`, not one nested blob:

```ts
// meta:preferences — unchanged in kind, minus the fields that moved
interface Preferences {
  readonly targetLanguage: LanguageTag; // still only "where / lands"
  readonly referenceLanguage: LanguageTag;
  readonly autoPlayAudio: boolean;
  readonly showTimer: boolean;
  readonly slowAudio: boolean;
  readonly theme: ThemePreference;
}

// meta:courses — keyed by target language
interface CourseState {
  readonly level: LevelScope;
  readonly focusTopics: readonly string[];
  readonly focus: SessionFocus;
  readonly pronunciationLocale: LanguageTag;
  readonly voiceName: string;
}
```

Two records rather than one nested object, because `updatePreferences(patch)` is
called with a flat patch from eleven sites in five files, and the chained-write fix in
[`App.tsx:75`](../../src/app/App.tsx) depends on that shape. Keeping the device
record flat means those call sites do not move, and a new
`updateCourse(language, patch)` needs the same chaining for the same reason:
picking three categories in a row is exactly what broke it the first time, and
`tests/app/preferences.test.tsx` is the test that caught it.

### 5.2 Read course state through `useCourse`, not through `preferences`

This is the point of the stage. `useCourse()` already resolves which course is
open, from the path, correcting a stale one. Return its state from there:

```ts
const { course, courseState, updateCourse } = useCourse();
```

Then `focusTopics` read on a French screen is _French's_ list, and §4.2 stops
being possible rather than being filtered against. `FocusPicker` keeps its
existing narrowing — a stored topic that the current _level_ puts out of reach
must still not be advertised, which is a different problem and its comment
explains it — but it no longer has to defend against another language's
vocabulary.

`HomeScreen:51` must then write the same narrowed list it displays. A link that
practises a category the screen did not offer is the bug; making the two agree is
the fix.

### 5.3 The migration

`DB_VERSION` goes to 2. idb's `upgrade(db, oldVersion, newVersion, tx)` hands you
a transaction, so read `meta:preferences`, write the moved fields to
`meta:courses` under that record's own `targetLanguage`, and put the trimmed
preferences back. Do it in the upgrade rather than lazily on first read: a lazy
migration is two code paths that both have to keep working for ever, and this one
is a dozen lines.

### 5.4 Pronunciation locales from the packs

Add a derivation beside `courseOptions()` — same file, same reasoning — that
unions `manifest.pronunciationLocales` across the packs of one language and falls
back to `baseLanguage(targetLanguage)` when a pack declares none, so a pack that
forgot the field still speaks. `PRONUNCIATION_LOCALES` becomes the _labels_ for
locales a pack names, not the list of what exists. `FILTERABLE_REGIONS` has the
same problem and can follow the same route; it is not a blocker.

`VOICE_SAMPLE` should come from the course. The first short item of the pack in
scope is one honest answer, a `sample` field on the manifest is another. Do not
leave a Spanish sentence hard-coded in a shared component.

### 5.5 Validate what comes back

`mergePreferences(DEFAULT_PREFERENCES, stored)` trusts whatever is in `meta`, so
a removed theme id or a value from a newer build passes straight through into
`data-theme`. Content gets a zod boundary in `src/data/validation`; learner state
gets none, and Stage C makes that asymmetry load-bearing, because a file someone
can edit is untrusted input by definition.

Add the schemas here, in Stage A, where there is one small record to validate and
no importer yet: unknown keys dropped, bad values replaced by the default, and a
`console.warn` rather than a throw. Practice must never fail because a preference
is malformed — the same rule `createStorage()` already follows when IndexedDB is
refused.

## 6. Stage B — the dimensions the records were missing (landed)

### 6.1 `packId` on `ItemProgress`

Derived, not new information: `packIdOf(itemId)`. Denormalised onto the record
because §4.5 means an index needs a stored field, and set in `recordAttempt()` —
it is pure, it already imports from `../content`, and it is the one place a
progress record is created.

This does not weaken rule 4. The record still _references_ only the item id; the
pack is recoverable from that id and is stored so the database can group by it.
Put that reasoning in the field's doc comment, or a future reader will read it as
content leaking into learner state.

Migration: add the field and the `by-pack` index at `DB_VERSION` 2 — the same
bump as Stage A — **and backfill every existing record inside the upgrade
transaction.** A row without the key path is not in the index, so an unbackfilled
row silently vanishes from every per-pack query, which is the worst available
failure mode for a progress record: it looks like lost history.

### 6.2 `course` on `SessionRecord`

`SessionRecord` carries no language and, unlike progress, cannot derive one — it
holds no item ids at all. The visible consequence: "Recent sessions" is the only
unscoped panel on the Progress screen, so French sessions list under Spanish.
Store the `Course` — language and level — which is also what the row wants for a
label, and add `mode` while you are there. Study sessions are not recorded today,
and if that ever changes there is nowhere to say which kind a row is.

### 6.3 `updatedAt`, and ids that survive a merge

Add `updatedAt: Timestamp` to `ItemProgress`. `lastReviewedAt` is close but it is
a statement about the learner, and a merge needs one about the record.

Give `Attempt.id` a collision-free spelling; `src/utils/random.ts` is where
injected randomness lives. The session id is different and needs care: the
planner is pure and reproducible under a seed, and that is deliberate, so the id
has to keep coming from the plan rather than from a clock read at persist time.
Do not trade reproducibility for uniqueness — seed the plan id with something the
plan already knows.

### 6.4 What this unlocked

Per-course reset in Settings ("erase my French"), a `by-pack` count without
materialising every item, an orphan report, and per-course export. None were
possible before the fields existed; all are small now. `sessions.recent` already
walks a `prev` cursor because narrowing by language had to happen before the
limit, and `attempts.recent` still reads every row and reverses it.

### 6.5 What Stage B deliberately left

Three things were in scope when this was written and were dropped on the way,
each for the same reason: they can be added later at exactly the cost they would
have been now, and a migration is the wrong thing to pad.

- **`mode` on `SessionRecord`.** Only `practice` sessions are recorded, so the
  field would have had one value. If study sessions ever start being recorded,
  every existing row is a practice row by construction — a one-line backfill,
  which is precisely what makes this _not_ urgent. `packId` and `course` are here
  instead because neither can be recovered from a row that never stored them.
- **`putMany` / `appendMany`** (§7.3). Additive, no migration, needed only when
  there is an importer to use them.
- **The `attempts.recent` cursor.** A performance fix, not a data-shape one. It
  reads the whole attempt log to hand back a page, and will keep doing so until
  the log is big enough for anyone to notice.

Two tests hold the parts that would otherwise rot silently:
`tests/storage/migration.test.ts` opens a hand-built version-1 database and
asserts on the _old_ rows — including a read through the `by-pack` index, since a
row the backfill missed is absent from the index rather than merely incomplete —
and `tests/features/progress-scope.test.tsx` covers the leak §6.2 describes.

## 7. Stage C — export and import

### 7.1 The envelope

```jsonc
{
  "app": "linguastein", // APP.id, never typed by hand
  "schema": 1, // the file's version, independent of DB_VERSION
  "exportedAt": 1755734400000,
  "packs": [{ "id": "core-es", "version": "0.3.0" }], // what the records reference
  "preferences": {},
  "courses": { "es": {} },
  "progress": [],
  "attempts": [],
  "sessions": [],
}
```

`schema` is the file's own number and must not be `DB_VERSION`: the database
version tracks a local migration, the file version tracks a format other builds
have to read. `packs` records what the records referenced at export time, so an
import can _report_ what it cannot resolve.

### 7.2 Validate on the way in

A zod module beside the storage layer, in the same spirit as
`src/data/validation` — which is the precedent to copy, including returning
issues rather than throwing. An import that drops a malformed attempt and says so
is better than one that refuses a whole file, and much better than one that
writes it.

### 7.3 Bulk APIs

Add `putMany` to `ProgressStore` and `appendMany` to `AttemptStore`, one
transaction per batch, and put them in the interface so both implementations
carry them. `tests/storage/storage.test.ts` runs one contract against memory and
IndexedDB alike, and that is the property worth preserving.

### 7.4 What the UI says

Settings grows an export button and an import picker. Two rules for the import,
neither negotiable:

- **orphans are kept, never pruned.** A record referencing a pack that is not
  installed is exactly what rule 4 was designed to survive. Report the count;
  keep the rows.
- **the confirm names what will happen.** The existing three-state reset control
  is the model — irreversible, with nowhere to restore from, so the warning is
  announced and not merely coloured.

## 8. Fallout to expect

- **Around 86 lines across 9 test files** touch a preference field.
  `tests/fixtures/services.tsx` and `tests/app/preferences.test.tsx` come first;
  most of the rest is mechanical once `testServices()` takes a `courseState`
  override.
- **`tests/a11y/agent-surface.test.tsx`** needs the new Settings controls named,
  and `tests/features/reset-progress.test.tsx` needs the per-course case.
- **Coverage floors** in `vite.config.ts`: `src/domain/**` is held at 88/76/90/92
  and this adds domain code. Raise a floor if the real figure moves up; do not
  lower one to make the change fit.
- **`docs/roadmap.md`** — "cloud sync behind `LearnerStorage`" sits under _Later_
  and this is its groundwork, so the _In place_ list will want a line.
- **`AGENTS.md`** — rule 4 gains a sentence about the denormalised pack id, or a
  future reader will read it as a violation. Rule 8's "progress is untouched by
  it" stays true and should stay written down.
- **`src/storage/types.ts:83`** — `clearAll`'s comment says it is "used by reset
  progress", but Settings deliberately clears three stores instead so that
  preferences survive. Fix the comment while you are in the file.

## 9. Judgement calls left open

**9.1 The merge policy, which is the real decision.** Not the file format. The
defensible default is per-record last-write-wins on `updatedAt` for progress,
union-by-id for attempts and sessions, and preferences taken wholesale — theirs
or mine, never field-merged, because a half-merged course state is one neither
device chose. But last-write-wins on an FSRS record loses review history in a way
that is invisible afterwards, and the alternative — replaying the merged attempt
log through `recordAttempt` to rebuild progress from scratch — is both more
correct and much slower, and possible only because attempts are the source of
truth today. Decide before §7.1 is fixed, because a replay-based merge needs the
attempt log to be complete and §9.3 is about pruning it.

**9.2 Whether scheduling stays per item.** The biggest open question in the
learning model, and deliberately outside the stages above. One `stability` and
one `difficulty` per item fold together a four-way multiple choice and a
production answer, and the composer then reads that same status to decide which
retrieval mode to offer — so recognition inflates the ladder that is meant to
gate it. `Attempt.exerciseKind` is recorded and nothing aggregates it, so the
evidence is already there. It is also what "the ones I keep failing" means to a
learner: usually a _kind_, not an item. Doing this after Stage C means a schema
bump for a format that has just shipped; doing it before means a bigger first
change. Neither is wrong — but it is not a detail to discover later.

**9.3 Attempt retention.** The log is unbounded and unpruned, and `AGENTS.md`
says the FSRS weights are "awaiting a per-user fit against the attempt log we
already store", which is an argument for keeping all of it. A retention window,
if there is ever one, belongs next to that sentence as a decision — not as a side
effect of making an export smaller.

**9.4 Whether device settings belong in the export at all.** A theme and a voice
name are properties of the device that was in front of the learner. Exporting
them is convenient on a new phone and wrong on a shared one, and a `voiceName`
naming a voice the target device does not have is a silent fallback. Splitting
the record (§5.1) is what makes either answer expressible; pick one and say so in
the envelope's doc comment.

**9.5 `SkillProgress` and `showRomanisationHints`.** **Settled 2026-08-24:
both deleted**, ahead of the rest of this task rather than inside it, because a
dead field costs nothing until it reaches a file format and then costs every
future reader a decision.

`SkillProgress` is gone for the reason `mastery.ts` now records in its module
comment: a stored aggregate has to be maintained, so every change to what counts
as an encounter or a strength would become a migration of rows nothing can
rebuild — and `MasteryRecord`, derived, is already richer than the row was.

`showRomanisationHints` is gone because it was in the wrong record as well as
unread. Romanisation is a property of a script, so it is per course rather than
per device — romaji is not a Spanish problem — and the place for it is the
`CourseState` Stage A introduces (§5.1). A note to that effect sits where the
field used to be, in `storage/types.ts`, so the next person to want it adds it
in the right half.

Nothing was migrated. A stored preferences record from an earlier build may
still carry the key; `read()` merges the stored object over `DEFAULT_PREFERENCES`
so it survives as an untyped extra property and is read by nothing — which is
what it already was.
