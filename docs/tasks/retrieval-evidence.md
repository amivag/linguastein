# Task: the retrieval ladder, verified rather than prescribed

**Status:** briefed 2026-09-14. Stage A in progress.
**Written:** 2026-09-14
**For:** a fresh agent session, no prior context assumed
**Scope:** `src/domain/progress/`, `src/domain/sessions/composer.ts`, the
transfer schema, and one surface. **No content, no dataset, no new exercise kind,
and no change to FSRS.** If a change here needs a new content record, that is a
signal to stop and reconsider the change.

**Resolves** [learner-profile.md](learner-profile.md) §9.2, open since it was
written and described there as "the biggest open question in the learning model".
It is briefed separately rather than reopened there because §9.2 is a _question_
and this is an answer — and because the answer is smaller than the question
assumed.

---

## 1. The task in one line

`retrievalModeFor` decides how hard to test an item from its memory stability
alone; make it read what the learner has actually **done**.

## 2. Why

`composeSession` puts every item on a ladder — recognise it, then complete it,
then produce it — and `retrievalModeFor` decides which rung from `status`,
`stability` and `difficulty`. All three are folded across every exercise kind
equally, so the ladder is climbed by _any_ evidence rather than by evidence of
the rung below. Three consequences, all reachable today:

- An item answered as a four-way multiple choice ten times crosses
  `PRODUCTION_AT` and is offered as production, having never once been produced.
- An item a learner can produce but keeps mis-recognising sits at `recognition`,
  because a lapse on the easiest mode drops the rung for all of them.
- `status: 'mastered'` can be earned entirely on recognition, and every screen
  that counts mastered items repeats the claim.

[learner-profile.md](learner-profile.md) §9.2 states it exactly: "recognition
inflates the ladder that is meant to gate it." `AGENTS.md` states the principle
the ladder exists to serve — "Recognition is the weakest retrieval mode and the
most flattering; prefer production wherever the data supports it" — and the code
currently cannot tell whether the data supports it.

The learner-facing version is worth keeping in view, because it is what makes
this worth doing rather than merely correct: **"the ones I keep failing" is
usually a kind, not an item.** A person who can read `pedir` and cannot say it
does not have a `pedir` problem.

## 3. Where things stand, measured

Not opinion — this is what is in the tree at `87419a6`:

| Measure                                 | Now                                                      |
| --------------------------------------- | -------------------------------------------------------- |
| `RetrievalMode` values                  | 4 (`recognition`, `cued-recall`, `production`, `study`)  |
| Where a mode is decided                 | `retrievalModeFor`, from status / stability / difficulty |
| Kind → mode mapping                     | `MODE_KINDS`, one direction only                         |
| `Attempt.exerciseKind`                  | written by `recordAttempt`, aggregated nowhere           |
| Readers of `Attempt.exerciseKind`       | 0                                                        |
| Fold points for an attempt              | 1 — `applyAttempt`                                       |
| Progress rebuilt from the log on import | yes (`replaySubject`, `transfer/import.ts`)              |
| Per-mode quantity stored anywhere       | none                                                     |

Four things make this cheap, and they were not all true when §9.2 was written:

1. **The vocabulary already exists.** `RETRIEVAL_MODES` and `MODE_KINDS` are in
   `composer.ts`. Nothing has to be named.
2. **The evidence is already stored.** Every attempt since the log existed
   carries its `exerciseKind`, so this is a **rebuild from data already on the
   device**, not a migration of rows nothing can reconstruct.
3. **There is exactly one fold point.** `applyAttempt` is where an attempt
   becomes progress, for the live path and for replay alike. A field added there
   is correct in both by construction, and `fold(attempts) === stored progress`
   keeps holding.
4. **Progress is a projection** ([learner-profile.md](learner-profile.md) §9.1).
   The format that ships is the attempt log; the projection over it is free to
   change. That is what §9.2 means by "no longer a schema trap".

## 4. The shape

### 4.1 Evidence, not four memories

**The expensive version of this question is not the one being answered.** §9.2
frames it as "splitting one `stability`/`difficulty` per item into one per
retrieval mode". That is declined, for a reason worth writing down: a memory is
one memory. FSRS models a trace and its decay, not a question format; testing the
same trace four ways produces four estimates of one quantity, and the next
question would be which of the four `dueAt` comes from. There is no good answer,
and a scheduler that cannot say when an item is due is worse than one that
overrates recognition.

So the scheduler is untouched. What is added is **evidence**: how the learner has
been tested, and how it went, per mode. That answers the question actually being
asked — _has this ever been produced?_ — without inventing three more memories.

It is also reversible. Evidence is folded from the log, so a build that stops
writing it loses nothing a later one cannot rebuild.

### 4.2 One inversion, never a second list

`MODE_KINDS` maps a mode to its kinds. The reverse is needed and must be
**derived from it**, not written beside it:

```ts
/** Which retrieval mode an exercise kind is evidence of. */
export function modeOfKind(kind: ExerciseKind): GradedMode;
```

A second hand-maintained table is how a kind ends up in one list and not the
other.

**A kind claimed by several modes resolves to the weakest of them**, and getting
this backwards reintroduces the exact bug the task exists to close. `MODE_KINDS`
is a _preference order for offering_ an exercise, not a claim about what one
demonstrates: a harder mode lists easier kinds as fallbacks for items that
support nothing better, which is why `multiple-choice` is the last entry under
`cued-recall`. Read that membership as a claim and the commonest recognition
exercise in the app starts counting as evidence of cued recall.

`study` is not a mode a kind can be evidence of — a study session records nothing
at all — so it is excluded from the type (`GradedMode`), not merely from the
switch. A kind that no graded mode claims must fail a test rather than default
quietly: `unclaimedKinds()` exists to be asserted empty, because a new kind added
to `EXERCISE_KINDS` and to no mode would otherwise record as recognition
forever — a lie the type system cannot catch.

### 4.3 `ModeEvidence` on the progress row

```ts
export interface ModeEvidence {
  readonly attempts: number;
  readonly correct: number;
  readonly lastAt: Timestamp;
}

// on SubjectProgress:
readonly evidence?: Partial<Record<GradedMode, ModeEvidence>>;
```

Optional, for the same reason `stability` is: rows written before this build have
none, and the next attempt starts one. Bounded at three keys, so it is not an
unbounded accumulator on a row. Folded in `applyAttempt` and nowhere else.

`correct` counts a non-`again` grade, matching what `streak` already treats as a
pass. A self-rated kind therefore contributes the learner's own claim — see §6.

### 4.4 The gate

`retrievalModeFor` keeps its stability thresholds and gains one rule: **a rung is
offered only once the rung below has been passed at least once.**

- `cued-recall` requires one correct `recognition` attempt.
- `production` requires one correct `cued-recall` attempt.

Stated once rather than per rung: the offered mode is the highest rung at or
below the earned one whose prerequisite is met. **In practice that is at most one
rung down**, because an item with no correct answer at all is already held at
`recognition` by `status === 'learning'` before the gate is consulted — but the
rule is the descent, not the single step, and writing it as "one rung" in code
would be a special case standing in for a general one.

It never holds back an item whose evidence is absent entirely because it predates
this build: a missing `evidence` map behaves exactly as today, so nobody's ladder
resets on upgrade.

**A learner who only ever runs a recognition-only preset stays at recognition,
and that is correct.** It is not a stall to be worked around; it is the true
statement about what they have shown. Making it _visible_ is Stage C, not a
bypass here.

### 4.5 Stages

- **Stage A — the domain.** `modeOfKind`, `ModeEvidence`, the fold, the gate, the
  transfer schema, tests. No screen changes. This is the whole of the correctness
  work and it is testable without a UI.
- **Stage B — mastery reads it.** `MasteryRecord.strength` is one number
  (`mastery.ts`). Add the per-mode breakdown, derived, never stored — the module's
  own standing rule. "Strong" then means strong _at something_.
- **Stage C — the surface.** Progress and the end-of-session summary say which
  mode the evidence came from. The sentence worth being able to write is "you
  recognise this and have never produced it", and Stage C is the only stage a
  learner sees.

## 5. Rules and constraints

- **No new exercise kind.** This task reads evidence; it does not create any.
- **The scheduler is not touched.** `fsrs.ts` keeps one stability and one
  difficulty per subject (§4.1).
- **`fold(attempts) === stored progress` must keep holding.** It is asserted over
  generated logs; a field folded anywhere but `applyAttempt` breaks it.
- **No stored cross-item aggregate.** `mastery.ts` argues this at length and the
  argument stands: Stage B derives, it does not store.
- **Not every progress row is about an item** (architecture rule 4). Evidence is
  per subject, so a drill's pattern rows get it too — which is correct and free.

## 6. Known weakness, recorded rather than fixed

`MODE_KINDS.production` is `['think-say', 'listen-repeat']`, and **both are
self-rated**. Repeating a phrase you have just heard is imitation rather than
production at all, and a self-rating is the learner's own claim about a
performance nothing checked. So the top rung's evidence is the weakest evidence
in the system.

Stage A does not change `MODE_KINDS`: which kinds a mode offers is what sessions
are _made of_, and moving one is a visible change to practice that deserves its
own reasoning rather than arriving inside a scheduling fix. The gate in §4.4 is
built so this does not matter for promotion — reaching `production` is gated on
`cued-recall`, which is machine-checked.

The real repair is a machine-checked production kind, which is
[typed-production.md](typed-production.md). The two are worth reading together:
this brief makes the ladder honest about the evidence it has, and that one gives
it better evidence to be honest about.

## 7. Definition of done (Stage A)

1. `modeOfKind` exists, is derived from `MODE_KINDS`, and cannot return `study`.
2. `ModeEvidence` is folded in `applyAttempt`, so `replaySubject` produces it too.
3. A round trip through `transfer/` preserves evidence for a row whose attempts
   did not travel with it.
4. `retrievalModeFor` holds an item back one rung without evidence, and behaves
   exactly as today when `evidence` is absent.
5. `npm run check` passes, and no screen has changed.

## 8. Verification

- `tests/domain/composer.test.ts` — the inversion, and the gate in both
  directions.
- `tests/domain/tracker.test.ts` — the fold, and the replay invariant over a
  generated log that mixes kinds.
- A test that an item answered only by multiple choice never reaches
  `production`, which is the bug in one line.
