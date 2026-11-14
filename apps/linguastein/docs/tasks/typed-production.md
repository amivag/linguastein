# Task: typed production, graded morphologically

**Status:** **Stages A and B landed 2026-09-14** — the `type-it` kind, the
three-verdict comparator, the card, a `Write it` preset, and the diagnosis that
names the axis a wrong answer slipped on. Stage C (the axis as evidence) is
briefed and not started. §6's three open questions are answered below, two of
them by measurement; §3.3's language seam was **not built**, and §8 says why.
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

### 3.3 The diagnoser seam — specified, then not needed

**This section was wrong, and the correction is the most useful thing Stage B
produced.** It is kept as written below, because the reasoning is the obvious
reasoning and the next person to reach for a language module for a
grammar-shaped problem should see it fail here first. What actually shipped is in
§8.

The premise — "naming the axis that slipped is language-specific" — sounds
unarguable and is false for this app, because the pack already carries the
answer. Stage B is `src/domain/exercises/diagnose.ts`, has no language module
behind it, and works for any pack that ships forms.

The original text follows.

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

## 6. Open questions, as answered

- **Where it sits on the ladder — `production`, first.** `MODE_KINDS.production`
  reads `['type-it', 'think-say', 'listen-repeat']`. First because it is the only
  member whose answer the app checks; the other two record what the learner says
  about their answer.

- **Which items can carry it — eight words, and the guess was wrong.** This
  section worried about "a twenty-word B1 sentence", and `core-es` has none: the
  longest sentence in the pack is **thirteen** words, and the distribution is
  88% at eight or fewer, 95.6% at nine, 98.6% at ten. `TYPE_IT_MAX_WORDS = 8`
  therefore admits 2,657 of the 3,016 sentences — material enough that the kind
  is never starved — while leaving the tail that turns recall into a typing test
  on a phone. The ceiling withholds one kind and never an item: an eleven-word
  sentence still supports five others, and a test asserts it.

- **Accent entry — not shipped, and the comparator is why.** An accent row was
  going to be the answer to "how does anyone type `hablé` on an English
  keyboard". The `near` verdict answers it better: the learner types `hable`, it
  counts, and the card names the accent. That is a correction rather than a hint,
  so `hintsUsed` stays out of it. Revisit only if learners start asking for the
  row.

## 7. What Stage A settled that the brief had not thought about

**Which marks are accents is a question about the language, and the engine must
not answer it.** §3.2 said "accents and punctuation are normalised" as though
that were one operation. It is not: `normalise` in `domain/content` strips every
combining mark, so it turns `año` into `ano` — a different word, and precisely
the accident `src/languages/es/orthography.ts` was written to record. A
comparator built on it would have accepted `ano` for `año` while correctly
accepting `hable` for `hablé`, and only the second looks like the feature working.

The fix keeps the engine neutral without a new seam: `compareTyped` asks
`Intl.Collator(language, { sensitivity: 'base' })`, which equates `hable` with
`hablé` and separates `cana` from `caña` in `es`, and equates both in `en`.
The knowledge is CLDR's rather than this repository's, the tag comes off the item
(`answerLanguage`), and a language whose pack is not loaded compares the marks as
written — strict rather than wrong. `MissDiagnoser` in §3.3 is still the right
shape for Stage B; it simply is not needed for the verdict.

## 8. What Stage B actually needed

**No language module.** §3.3 assumed that naming a missed tense means knowing how
the language conjugates. It does not, because the pack has already done that
work at build time:

- every `InflectedForm` carries a `Morphology` — `tense`, `person`, `number`,
  `gender`, `mood`, `formality` — and those field _names_ are language-neutral by
  construction, since the same record shape serves every pack;
- `core-es` ships **9,206** of them;
- every sentence token already carries the `lexeme` the build linked it to.

So the diagnosis is a lookup and a field comparison: find the one substituted
word, take its token's lexeme, find both spellings among that lexeme's forms, and
report the `Morphology` fields on which the two disagree. `MISS_AXES` is
`satisfies readonly (keyof Morphology)[]`, so a field added to the model cannot
become silently undiagnosable. A French pack gets all of this for nothing.

**What it refuses to do is most of the work.** A diagnosis is offered only where
exactly one word differs _and_ both spellings are forms of the same lexeme.
Everything else returns `null` and the card says what it said before. In
particular a word the pack cannot place is **not** reported as the wrong word: it
may be a different lexeme, or a form this pack does not carry, and those need
different sentences on screen. §5's Stage C risk — a wrong diagnosis quietly
rescheduling the wrong thing — is the same risk one screen earlier, and the
answer is the same: a missing lemma shows up in a coverage report, a confidently
wrong one is counted as a success.

Measured against the shipped pack: **2,630 of the 2,657 sentences** short enough
for `type-it` have at least one token a diagnosis can be built from, so this is
the ordinary case rather than a garnish.

### 8.1 The dead card `Write it` exposed

A preset that allows one exercise kind can be dealt an item that kind declines,
and the card then reads "This item has no exercise available yet" — a turn the
learner has to skip past. It was reachable before `type-it` (an item with no
translation refuses `think-say` the same way) and the length ceiling made it
ordinary, at about one sentence in eight.

`useSessionRunner` now drops items no allowed kind can render, before composing.
That shortens a session rather than padding it, which is the honest trade: seven
real cards beat eight with a dead one among them. The alternative — teaching the
planner what an exercise is — would put content and exercises back into one
system, which is the thing architecture rule 1 exists to prevent.
