# Task: practice batches — a set the learner picks and keeps coming back to

**Status:** **Stage A has landed.** §5 and §6 now read as a record of why the
record, the store and the URL parameter are shaped as they are rather than as work
to do. Stage B — the three surfaces in §7 — is briefed and unstarted, and both
decisions in §9 were taken on the way in (see the note at the end of §6).
**Written:** 2026-08-23
**Stage A landed:** 2026-08-23 — `src/domain/batches/`, `BatchStore` at database
version 3, `?batch=` in `session-url.ts`, batches loaded at the composition root
alongside preferences, and the out-of-scope case reported rather than widened.
**For:** a fresh agent session, no prior context assumed
**Scope:** one new domain module (`src/domain/batches/`), one new store on
`LearnerStorage` at database version 3, one parameter in `session-url.ts`, and
three UI touch points — Browse, Study and Home. No content authoring, no new
exercise kind, no scheduler change.

---

## 1. The task in one line

Let a learner name a set of material once — "these 30 nouns" — and have every
short session for the next week draw from exactly that set, with the app tracking
how much of it has actually been absorbed.

## 2. Why

The ask is deep practice on a bounded batch: several short sessions per day, all
on the same material, until it is genuinely held. Three facts about the code as it
stands decide the shape of the answer.

**Most of it already works, unnamed.** A session link is already a complete,
reloadable description of a set:

```text
/es/a1/session?preset=quick&type=word&pos=noun&topic=food-drink&size=items:10
```

Bookmark that and every slot practises the same material today, with no code at
all. What a bookmark cannot do is tell the learner how far through the set they
are, or let the app offer the set back to them. **That gap is the whole feature** —
not the set, and not the sessions.

**The app cannot answer "practise that again."** `SessionRecord` stores an id, a
course, timestamps and three counts — no config, no filter. Session history
therefore cannot reconstruct what a session contained, so "the set I was working
on" is unrecoverable after the tab closes. This is the hole Stage A fills.

**Missions are the same shape and the wrong mechanism.** A mission already is a
bounded set of material with derived completion, and
[`domain/missions/progress.ts`](../../src/domain/missions/progress.ts) is the
pattern to copy. But a mission is a sequencing record over _authored_ passages,
and its completion reads authored `capabilities` and a `transfers` ladder — so
making one learner-editable breaks both. More decisively: a mission's "same
material again" is deliberately **three different situations**, because its
purpose is transfer. A batch's purpose is repetition. Same structure, opposite
intent; do not fold one into the other.

## 3. Orientation

Read these first, in order:

1. [`AGENTS.md`](../../AGENTS.md) — architecture rules 1, 4 and 8, **What a
   session practises**, and **The learning model**. Rule 4 is what the standing
   calculation must not break
2. [`src/domain/missions/progress.ts`](../../src/domain/missions/progress.ts) —
   **the model to copy.** Its header states the principle this task reuses: a
   definition may be stored, but where the learner stands is computed from the
   attempt log, so a catalogue stays safe to reorder and a pack safe to grow
3. [`src/features/practice/session-url.ts`](../../src/features/practice/session-url.ts) —
   in particular the note at line 137 on why `ids` is deliberately absent from a
   URL, which is what forces §5.2's design
4. [`src/features/practice/SessionScreen.tsx`](../../src/features/practice/SessionScreen.tsx) —
   how `?passage=` becomes `filter.ids`. A batch resolves the same way, but §6.3
   is why it cannot resolve from the same place
5. [`src/domain/progress/mastery.ts`](../../src/domain/progress/mastery.ts) — and
   then §4.3 below, which is why this task must **not** use its `strong` status
6. [`docs/tasks/learner-profile.md`](learner-profile.md) — §9.2 (per-kind
   scheduling) and Stage C (export). This task is the first consumer of
   `Attempt.exerciseKind`, and the first thing to add to the export envelope

Then run `npm run check`. It must pass before you start.

## 4. What the investigation established

Measured against the shipped `core-es` pack at `v0.1.0`, 984 sentences and 621
word cards.

### 4.1 The material a batch would be drawn from exists; the depth does not

Word cards are the obvious first batch and they are there: **621 cards** over
**785 declared lexemes**, filterable by kind, topic and initial letter — Browse
already builds exactly these sheets and already turns one into a session.

Sentences carrying a _tense_, however, will not support a batch yet:

| skill                      | items in pack |
| -------------------------- | ------------- |
| presente de indicativo     | 785           |
| pretérito indefinido       | 33            |
| imperativo                 | 23            |
| pretérito imperfecto       | 10            |
| haber + participio (a2)    | 9             |
| estar + gerundio           | 5             |
| the seven numeral patterns | 0             |

"Learn the preterite this week" is a 33-item batch with no drill on the forms
themselves — the conjugator generates 3,024 forms across four paradigms, but a
`VerbForm` is not a `LearningItem` and cannot carry progress. That is roadmap item
7's unfinished half and [passage-practice.md](passage-practice.md)'s wall, not
this task. **Batch word cards and sentences; do not advertise tense batches.**

### 4.2 Missions are broad and shallow, which is what a batch is for

The thirteen missions reach 415 distinct lexemes across 454 of the 984 sentences —
good breadth. Depth, counted as how many mission items each lexeme appears in:

| appears in     | lexemes | share |
| -------------- | ------- | ----- |
| exactly 1 item | 122     | 29%   |
| 2–3 items      | 140     | 34%   |
| 4–5 items      | 48      | 12%   |
| 6+ items       | 105     | 25%   |

So the missions leave 262 lexemes met three times or fewer. Those are a batch's
natural contents, and it is worth writing down that this is the feature's actual
job: **not more material — depth on material the journey only glances at.**

### 4.3 The mastery floor is unreachable for most of the pack, and that decides the graduation bar

`ENCOUNTERS_FOR_STRENGTH` in `mastery.ts` is 6 _distinct items_ per lexeme, and it
is well argued there. But **588 of the 763 lexemes the sentences use appear in
fewer than 6 sentences pack-wide.** Of the 262 lexemes the missions meet thinly,
only 32 could reach that floor from elsewhere in the pack; **230 cannot without
new content.**

The consequence is not a content bug, it is a design constraint on this task: a
batch screen that reports `mastery.ts`'s `strong` status would read _permanently
unfinished_ for roughly three quarters of any vocabulary batch, through no fault
of the learner. **Use the per-item bar in §5.3, which needs repetition of one item
rather than six different sentences, and do not show lexeme mastery on a batch
surface.** Two definitions of "known" in one screen is worse than either.

### 4.4 The planner already behaves correctly inside a set, twice over

Neither of these needs changing, and both should be stated in the code so nobody
"fixes" them:

- `ordering: 'smart'` sorts into due → weak → fresh → rest _within whatever the
  filter admits_, so the third short slot of the day is the four items fumbled
  earlier plus the two not yet met — not a replay of the first. Repeated slots on
  one set sharpen by construction.
- `maxNewItems` lifts automatically for a deliberately picked set
  ([`presets.ts:173`](../../src/features/practice/presets.ts:173)), so a 30-item
  batch deals all 30 rather than capping at 8. The carve-out exists already and
  its comment already gives this exact reason.

### 4.5 `Attempt.exerciseKind` is recorded and nothing reads it

Confirmed: it is written by `recordAttempt` and aggregated nowhere.
[learner-profile.md §9.2](learner-profile.md) flags this as the biggest open
question in the learning model and notes "the evidence is already there". §5.3 is
the first feature with a concrete reason to read it, which is an argument for
doing this task before that decision rather than after.

### 4.6 Naming: not "focus", and not "study set"

Both obvious names are taken by something specific in this codebase.

- **`focus`** is the session _bias_ — `SessionFocus`, `SESSION_FOCUSES`,
  `focusTopics`, `FocusPicker`, `?focus=struggling` — and the whole point of that
  concept is that it never narrows the set. A "focus set" that _is_ a narrowing
  would invert the one word the architecture rules are most careful about.
- **`study`** means `mode: 'study'`, which records nothing. A "study set" whose
  sessions feed the scheduler contradicts the section split in `AGENTS.md`.

This document uses **batch**: `src/domain/batches/`, `BatchDefinition`, `?batch=`.
The learner-facing label is a separate, later choice and does not have to match.

## 5. The shape

### 5.1 The record

```ts
export interface BatchDefinition {
  /** Short, URL-safe, learner-scoped. Written into a session link. */
  readonly id: string;
  readonly label: string;
  /**
   * The course it was drawn in. Same reasoning as `SessionRecord.course`: the
   * ids resolve anywhere, but a batch of Spanish nouns must not be listed on a
   * French screen.
   */
  readonly course: Course;
  /**
   * Frozen at creation, and that is the point of the feature — a set whose
   * membership drifts is not something you can be finished with.
   */
  readonly itemIds: readonly ItemId[];
  readonly createdAt: Timestamp;
  /** Pacing hint for sizing a slot. Never scored — see §8. */
  readonly perSession?: number;
}
```

Two rules carry over from missions and are not negotiable:

**The definition is stored; the standing is derived.** "Is this batch absorbed?"
must be computed from the attempt log every time it is asked, exactly as
`missionStandings` does. Nothing about completion is ever written down.

**A stored list of item ids is not a rule-4 violation, and say so in the doc
comment.** Rule 4 requires progress to reference stable ids, which this does; the
new thing here is that a learner can now author a _curriculum object_, where
previously only `src/app/missions.ts` could. That is the actual conceptual
addition and deserves a sentence in the module header.

### 5.2 The URL

`?batch=<id>`, resolved to `filter.ids` by the screen — the same move
`?passage=mercado` and `?skill=preterite` already make, and for the reason
`session-url.ts:137` gives: five hundred item ids is not a link anyone can share.
`writeItemFilter` stays exactly as it is.

Follow the established degradation rule: **an unknown batch id widens the session
rather than emptying it.** A batch whose ids no longer resolve in the current
course is the one case that must not silently widen — see §6.4.

### 5.3 When an item is absorbed

Three conditions, all from data already stored:

1. **Retrieved in production**, meaning an `Attempt` whose `exerciseKind` is
   `think-say` or `tap-to-build`. Not `multiple-choice` or `cloze-choice`:
   `AGENTS.md` states plainly that recognition is the weakest retrieval mode and
   the most flattering, and a batch that graduates on recognition is a batch that
   lies.
2. **FSRS `stability` ≥ 7 days**, from `ItemProgress.stability`. One real spacing
   gap survived, rather than one good afternoon.
3. **On at least two distinct days**, from `Attempt.at`. This is the condition
   that separates knowing thirty words from having crammed them, and it is the one
   the current model cannot fake.

One refinement the implementation added, worth keeping: a production attempt
graded `again` does not count towards condition 3. An attempt that failed is not
a retrieval, and without this two days of getting an item wrong would graduate it.
The item lands in `shaky` instead, which is exactly what that count is for.

A batch is **complete at 90%**, not 100%: one stubborn item must not hold a batch
hostage, and the stragglers are exactly what the next batch should open with.

On the day boundary in condition 3 — the domain layer is pure and must not read a
clock or a timezone. Pass a `dayOf: (t: Timestamp) => string` into the standing
function and let the screen supply local-calendar bucketing. Do not settle for
UTC-day division inside the domain: for a learner practising in the evening west
of Greenwich it would count one session as two days.

### 5.4 The standing

```ts
export interface BatchStanding {
  readonly batch: BatchDefinition;
  /** Ids that still resolve inside the current course. */
  readonly total: number;
  /** Ids that no longer do — reported, never pruned (§6.4). */
  readonly missing: number;
  readonly absorbed: number;
  /** Attempted, not yet absorbed. */
  readonly shaky: number;
  readonly untouched: number;
  readonly dueNow: number;
  readonly complete: boolean;
}
```

## 6. Stage A — the record, the store and the session

Self-contained and reviewable on its own: no UI, and the feature is exercised
entirely through a hand-typed URL at the end of it.

### 6.1 `src/domain/batches/{model,progress}.ts`

Pure, mirroring `domain/missions/`. `model.ts` owns the record, the id spelling
and `batchesForCourse`; `progress.ts` owns `batchStanding` and the absorbed
predicate. Both fully tested — `src/domain/**` is held at 88/76/90/92 in
`vite.config.ts`.

### 6.2 `BatchStore` on `LearnerStorage`

```ts
export interface BatchStore {
  all(): Promise<readonly BatchDefinition[]>;
  put(batch: BatchDefinition): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
```

`DB_VERSION` 2 → 3, adding a `batches` object store keyed by `id`, plus a
`by-course` index if the listing wants one. **There is nothing to backfill** — the
store is new and empty — which is what makes this migration a dozen lines against
version 2's careful rewrite. Keep `upgradeToV3` in the same shape as
`upgradeToV2` regardless, and note in it that the absence of a backfill is a
property of this version rather than an omission.

`tests/storage/storage.test.ts` runs one contract against memory and IndexedDB
alike; extend it rather than writing a second suite. `tests/storage/migration.test.ts`
gains a v2 → v3 case.

### 6.3 Batches load like preferences, not like progress

**This is the one non-obvious piece of the stage.** `SessionScreen` builds its
config in a synchronous `useMemo` over the repository, because the URL is the only
dependency. A batch lives in async storage, so it cannot be resolved there the way
`?passage=` is.

Do not make the session screen await a read. Follow the precedent that already
exists for exactly this: `preferences` are loaded once at `App` and exposed
synchronously through `useServices()`, and `MISSIONS` is a synchronous
module-level catalogue that both Home and Session read. Batches are few and tiny,
so load them once at the composition root and expose them the same way, writing
through to the store on change.

Note the trap `App.tsx:75` already documents: chained writes. Creating two batches
in quick succession is the same hazard that `tests/app/preferences.test.tsx`
exists to catch, and the fix is the same.

### 6.4 A batch whose material has gone

`ItemFilter.ids` treats an empty list as _no items_, deliberately, so a batch
whose ids all fall outside the current course plans an empty session. That must
read as "this batch's material is not in the course you are in" and not as the
generic "Nothing to practise here yet" — those are different problems and only one
of them is recoverable by switching course.

Partially-resolving is the normal case and needs no message: report `missing` in
the standing, practise what resolves. **Never prune the stored ids** — the same
rule learner-profile Stage C sets for orphaned progress records, for the same
reason.

### 6.5 End of stage

`/es/a1/session?preset=quick&batch=<id>&size=items:10` plans a session over a
batch written directly to storage. No batch can be _created_ yet — that is §7.1 —
so the stage is verified through a hand-written record and a hand-typed link, and
the three states a link can be in are what `tests/features/batch-session.test.tsx`
covers: resolving, unknown, and out of scope.

Two corrections to what this section originally claimed, both found while
building it:

- **`SessionScreen` does change**, and had to. The stage adds no _surface_ — no
  button, no tab, no card — but the resolution in §6.3 lives in that screen, and
  §6.4's message is rendered there. "No screen has changed" was wrong.
- **Neither decision in §9 needed deferring.** §9.1 resolved itself by being
  taken: version 3 lands before learner-profile Stage A, so that task's migration
  bumps to 4 and reads a database this one has already touched. §9.2 is settled
  in `LearnerStorage`'s doc comment — `clearAll` takes the batches, the narrower
  reset in Settings does not, and nothing there needed editing to make it so,
  since that control names the three history stores explicitly.

## 7. Stage B — the three surfaces

### 7.1 Creation, on Browse

Browse already ends in **Practise these** / **Study these** over the current
filter ([`BrowseScreen.tsx:592`](../../src/features/browse/BrowseScreen.tsx:592)),
and the filter is already the exact expression of "these 30 nouns". Add a third
action that saves the current results as a batch, taking the first N in the
_displayed_ sort order.

One subtlety worth getting right, because Browse's own comment at line 285 is
about precisely this: sort is deliberately not written into a session link,
because ordering is the session's business. It _is_ however the right order to
freeze a batch in — the learner is looking at a list and asking for its first
thirty. Freezing membership is not the same as prescribing the practice order, so
take the sorted slice and let `ordering` stay the session's.

Default label from the filter summary Browse already computes for its heading.

### 7.2 Listing, on Study

A `batches` entry in `STUDY_TABS`. Study's sections are derived and a section
whose count is zero is not offered, so the tab appears once the learner has one
and creation lives on Browse — which resolves the "how do you make your first
one" question without an empty-state screen.

### 7.3 Resuming, on Home

Home's adaptive path is one primary action plus at most two follow-ups, and due
reviews lead. **A batch belongs in the follow-up slots, not ahead of due
reviews.** FSRS items outside the batch keep coming due while a learner drills it,
and a batch that displaces them builds precisely the review debt that gets
abandoned. Read the existing `followUps` construction before adding to it.

The card states the standing plainly — _"Food & travel nouns · 11 of 30
absorbed"_ — and resumes in one tap at the batch's `perSession` size.

## 8. Deliberately out of scope

- **A scored daily rate.** "30 a day" is a sizing input for building the batch,
  never a number the learner hits or misses. `docs/tasks/game-feel.md` already
  binds this: no resettable streak, and no reward that overstates the evidence. A
  quota also fights FSRS directly — it says "meet 30 new items" on the morning 60
  reviews are due.
- **The coach-built batch** — "the next 30 words worth learning", ranked by how
  many already-practised sentences each unlocks. `itemsByLexeme` makes the payoff
  score computable and this is the genuinely valuable version, but it needs the
  stored batch under it first.
- **Tense batches** (§4.1) and **verb forms as items** (roadmap 7).
- **Batches as a global lens.** A batch narrows sessions started from it. It must
  not filter Browse or Read: a learner who finishes one would find an empty app,
  which is the same failure mode `SESSION_FOCUSES` is expressed as an ordering to
  avoid.

## 9. Judgement calls to take before Stage A

**9.1 Migration ordering against learner-profile Stage A.** That task also wants
a version bump, and it _moves_ four preference fields where this one only adds a
store. Two bumps in either order are fine; interleaved they are not. Batches first
is the cheaper sequence — additive, nothing to backfill — but the call is whichever
is actually being worked on, and it should be recorded in both documents.

**9.2 Whether "reset progress" deletes batches.** Settings has two controls: a
narrow reset that clears the three history stores by hand so appearance and voice
survive, and `clearAll()`. A batch is neither history nor a device setting — it is
learner-authored curriculum, and the honest default is that **resetting progress
keeps the batches and clears the evidence**, leaving the learner their sets to
start again on. `clearAll()` takes everything, as it says. Decide it explicitly
rather than letting it fall out of which store the loop happens to touch, and name
it in the confirm text: the existing control announces what it will do, and this
adds a noun to that sentence.

## 10. Fallout to expect

- **`tests/a11y/agent-surface.test.tsx`** needs the new controls named — the save
  action on Browse, the Study tab, the Home card. `npx vitest run tests/a11y`
  after any UI change.
- **`tests/features/reset-progress.test.tsx`** needs whichever way §9.2 goes.
- **`tests/storage/{storage,migration}.test.ts`** — the contract and the v3 case.
- **Coverage floors** in `vite.config.ts`: this adds `src/domain` code, held at
  88/76/90/92. Raise a floor if the real figure moves up; never lower one to make
  the change fit.
- **`session-url.ts`** gains one parameter and its round-trip test. Do not add
  `ids` to `writeItemFilter` while you are in there — read the note at line 137
  first.
- **`docs/roadmap.md`** — a line under _In place_, and item 8 ("word-level
  progress") should cross-reference this: "words I keep looking up" is a batch
  source, and the two would otherwise be designed twice.
- **`AGENTS.md`** — the **What a session practises** section lists course, focus
  and filter as the three things that narrow a session. A batch is a fourth kind
  of thing and needs a sentence there, explicitly distinguishing it from a focus,
  or the next reader will reasonably assume it is one.
- **learner-profile Stage C** — a batch definition belongs in the export envelope,
  and it references item ids, so the orphans-are-kept-never-pruned rule covers it
  unchanged.
