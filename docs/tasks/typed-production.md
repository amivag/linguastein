# Task: typed production, graded morphologically

**Status:** briefed 2026-09-14, not started.
**Written:** 2026-09-14
**For:** a fresh agent session, no prior context assumed
**Scope:** one new exercise kind, a comparator in `src/domain/exercises/`, a
diagnoser seam under `src/languages/`, and the practice surface that renders it.
No dataset, no scheduler change. If a change here needs a new field on a content
record, that is architecture rule 2 biting and the answer is no.

**Companion to** [retrieval-evidence.md](retrieval-evidence.md), which should
land first: that brief makes the ladder honest about the evidence it has, and
this one is how the evidence gets better.

---

## 1. The task in one line

Let a learner type the answer, and when it is wrong, say **which part** was
wrong — not merely what the answer was.

## 2. Why

### 2.1 Nothing in a session asks for free production

Six exercise kinds ship, and the retrieval each one actually demands is thinner
than the list suggests:

| Kind              | What the learner is given   | Retrieval demanded |
| ----------------- | --------------------------- | ------------------ |
| `multiple-choice` | the answer, among four      | recognition        |
| `cloze-choice`    | the answer, among four      | recognition        |
| `tap-to-build`    | every word of the answer    | ordering           |
| `reveal`          | nothing checked             | self-rated         |
| `listen-repeat`   | the answer, spoken, first   | imitation          |
| `think-say`       | nothing checked (or speech) | self-rated         |

The one machine-checked kind that asks the learner to supply words rather than
arrange them does not exist. `AGENTS.md` already says which way this should
lean — "prefer production wherever the data supports it" — and the data supports
it everywhere: every sentence item is its own answer key.

**The seam is already declared.** `Answer.value` is documented as "Chosen choice
id, **typed text**, or the ordered parts for tap-to-build", and nothing in a
session has ever produced the middle one.

### 2.2 The grader cannot say why

`GradeResult` is `{ correct, grade, expected }`. A learner who writes
_Ayer hablo con mi hermana_ is told the answer was _Ayer hablé con mi hermana_
and left to spot the difference. That is the whole feedback loop, and it is the
same feedback whether they missed a tense, a person, an agreement, or the entire
sentence.

**This is the part no competing app can copy cheaply, and the reason is in this
repository rather than in the idea.** Linguastein does not store its paradigms;
it _generates_ them — `conjugate()`, `adjectiveForms()`, `pluralOf()`,
`spellCardinal()` — and ships 9,206 form records with stable ids. So the app can
locate a wrong answer inside the paradigm it came from and name the axis that
slipped:

- _hablo_ for _hablé_ → right verb, right person, **wrong tense**
- _hablaste_ for _hablé_ → right verb, right tense, **wrong person**
- _la casa rojo_ → **agreement**: `rojo` does not agree with `casa`
- _hable_ for _hablé_ → **the accent alone**

An app whose content is a list of sentences can only diff strings. That is the
differentiator, and it is a consequence of a decision made two years of commits
ago, not a feature to be bolted on.

### 2.3 It produces evidence the model currently lacks

Every kind under `MODE_KINDS.production` today is self-rated
([retrieval-evidence.md](retrieval-evidence.md) §6). A typed answer is the first
production evidence the machine checks, which is what makes the top rung of the
ladder mean something.

## 3. The shape

### 3.1 The kind

```ts
/** Produce the target text from meaning, typed. */
export interface TypeItExercise extends ExerciseBase {
  readonly kind: 'type-it';
  readonly prompt: string;
  readonly answer: string;
}
```

Generated from the same items `think-say` is generated from, and therefore
available wherever a translation is — which is the constraint that decides where
it can be offered, exactly as it does for `think-say` today.

### 3.2 Three verdicts, not two

A typed answer is not a boolean. The comparator returns one of three, and the
middle one is the whole point:

| Verdict | Meaning                                             | Grade   |
| ------- | --------------------------------------------------- | ------- |
| `exact` | matches, including accents                          | normal  |
| `near`  | matches once accents and punctuation are normalised | `hard`  |
| `wrong` | does not match                                      | `again` |

**A missing accent is not a wrong answer, and it is not a right one either.**
Marking _hable_ wrong for _hablé_ punishes a learner who knew the tense for a
keyboard they do not have; marking it right teaches that Spanish accents are
decoration, when `él`/`el` and `té`/`te` are different words — `stem-collisions.tsv`
enumerates eight such pairs the pack has already hit. `hard` is the honest grade:
it counts, it schedules sooner, and the feedback names the accent specifically.

`normalise` and `splitWords` in `domain/content` already do the accent- and
punctuation-blind comparison `tap-to-build` grades with. Reuse them; do not write
a second normaliser.

### 3.3 The diagnoser seam

Naming the axis that slipped is **language-specific** and must not leak into the
engine. It goes behind a loader beside the two seams that already exist for this
(`alphabetGuide(tag)`, `drillGuide(tag)`):

```ts
export interface MissDiagnoser {
  /** What went wrong, or null when nothing more specific than "wrong" is true. */
  diagnose(written: string, expected: string): Miss | null;
}

export interface Miss {
  /** A stable, language-neutral axis the engine may key on. */
  readonly axis: 'tense' | 'person' | 'number' | 'gender' | 'agreement' | 'accent' | 'lexeme';
  /** What the learner wrote, and what was wanted, at that axis. */
  readonly written: string;
  readonly expected: string;
}
```

Three properties are load-bearing:

1. **A language that declares no diagnoser loses nothing.** The result is
   `null` and the feedback is today's feedback. English packs, a French pack, and
   the French fixture all keep working untouched — this is the same shape
   `NumeralGuide` uses and the reason it is that shape.
2. **`axis` is language-neutral, its values are not free text.** `tense` means
   the same thing in every language that has one; the _labels_ a learner reads
   come from the language module, never from the engine.
3. **It is pure and it is not content.** The diagnoser reads the generated
   paradigm, at runtime, from the same modules the build uses. Nothing is
   authored, nothing is stored, and no content record grows an
   exercise-shaped field (architecture rule 2).

### 3.4 What a diagnosis is allowed to change

**Feedback, and nothing else, in Stage A.** The grade comes from the verdict in
§3.2; the diagnosis explains it. Feeding an axis back into the scheduler — "you
miss the preterite, not this sentence" — is genuinely valuable and is exactly the
kind of inference that should have to earn its way in behind a landed, observable
feature. It is Stage C, and it is written down in §5 so that it is a decision
rather than a drift.

## 4. Rules and constraints

- **Never a gate.** Speech input is an assist, not a requirement, and typing is
  the same: the kind is offered where it fits and every item stays practisable
  without it. A phone keyboard without Spanish accents must not be a wall.
- **The engine stays language-neutral.** `src/domain` may know an axis exists; it
  may not know what a tilde is.
- **One normaliser** (§3.2).
- **Accessibility.** A text input needs a real label, the verdict goes through the
  existing `role="status"` region, and the diagnosis must read as text — colour
  marking the changed syllable is decoration on top, never the signal.
- **The sheet still withholds what the card is grading.** A `type-it` card grades
  the whole sentence, so `WordInfoSheet meanings={false}` applies, as it does for
  multiple choice.

## 5. Stages

- **Stage A — the kind.** `type-it`, the three-verdict comparator, the input, the
  feedback. No diagnoser: the verdict alone is already better than today, and it
  is worth landing separately so the comparator's behaviour is settled before
  anything reasons on top of it.
- **Stage B — the Spanish diagnoser.** `axis` detection off `conjugate()` and
  `adjectiveForms()`, the labels, the feedback line.
- **Stage C — the axis as evidence.** Whether a miss records against the `form`
  or `skill` id the axis implicates, which `SubjectProgress.subject` already
  admits. **Decide it then, with Stage B on screen.** The risk to weigh is a
  wrong diagnosis quietly rescheduling the wrong thing — a missing lemma shows up
  in a coverage report, and a confidently wrong one is counted as a success. The
  pack has made that mistake once already (`segunda`, recorded in roadmap item 0).

## 6. Open questions

- **Where it sits on the ladder.** `production`, presumably, beside `think-say` —
  but it is the only machine-checked member, and
  [retrieval-evidence.md](retrieval-evidence.md) §6 argues the others are weak
  evidence. It may be worth `MODE_KINDS.production` listing `type-it` first.
- **Which items can carry it.** A four-word phrase is a fair thing to type; a
  twenty-word B1 sentence is a typing test. A length ceiling is likely, and it
  should be measured against the pack rather than guessed.
- **Accent entry.** Whether to offer an accent row above the input. It is a real
  affordance on a phone and it is also a hint; if it ships, `hintsUsed` is
  already the field that records having used one.
