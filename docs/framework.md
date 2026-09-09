# A framework for other subjects

**Written:** 2026-09-09
**For:** deciding whether the learning engine — not just the shell — can carry a
music or a maths app.

[skeleton.md](skeleton.md) already answers a narrower version of this question. It
says what other apps are scaffolded from today: the tooling, `src/styles`, the four
app-agnostic a11y tests, the seams, the components, `identity.ts`. And it puts
`src/domain/**` — the learning engine — under **"Delete or replace."**

This document is about the cut that document declines to make: keep the
**pedagogy**, swap the **subject**. Spaced repetition, mastery, drills and sessions
are not facts about Spanish. The question is how much of the code that implements
them knows that.

Measured rather than guessed: **17% ports unchanged, 16% needs parameterising, and
66% is subject-specific and should be** — and the seam the generic part needs
already exists in this repository under another name.

---

## 1. The three tiers, measured

Line counts are exact. The verdicts come from reading each file for what it
assumes, rather than from counting imports.

| Layer                         | Lines     | Share   | Verdict                                     |
| ----------------------------- | --------- | ------- | ------------------------------------------- |
| `progress/**`                 | 728       | 10%     | Ports unchanged                             |
| `batches/**`                  | 300       | 4%      | Ports; drop `Course` / `LanguageTag`        |
| `missions/progress.ts`        | 192       | 3%      | Ports unchanged                             |
| `drills/**`                   | 87        | 1%      | Ports unchanged                             |
| **Tier 1**                    | **1,307** | **17%** | **The extraction worth doing**              |
| `sessions/**`                 | 475       | 6%      | Right structure, three language fields      |
| `content/course.ts`           | 399       | 5%      | Mechanism general, concept named for one    |
| `missions/model.ts`           | 353       | 5%      | Parameterise the stage vocabulary           |
| **Tier 2**                    | **1,227** | **16%** | **Rename and parameterise, not rewrite**    |
| `content/**` less `course.ts` | 3,908     | 52%     | Per subject                                 |
| `exercises/**`                | 1,028     | 14%     | Per subject                                 |
| **Tier 3**                    | **4,936** | **66%** | **Should differ per subject. Not a defect** |

### Tier 1 is neutral by construction, not by luck

The reason is already written down in
[`progress/types.ts`](../src/domain/progress/types.ts): _"The subject is any
content entity, not only an item."_ Rule 4's widening — taken for verb forms and
grammatical patterns — is the same widening a different subject needs.
`core-es:skill:numerals-y-joining` and a hypothetical
`core-music:skill:perfect-fifth` are structurally identical: a closed, stable,
dataset-owned id that a progress row can be about.

[`drills/select.ts`](../src/domain/drills/select.ts) is the clearest case. Its own
docstring describes _"a small, fixed set of subjects … seven numeral patterns, a
verb's twenty forms"_ returned to _"for as long as the learner keeps going."_ That
is interval training. That is times tables. The file contains no language
vocabulary at all, and its three-part order — due first, then unmet in teaching
order, then weakest — is a claim about memory, not about Spanish.

### The proof already shipped

The strongest evidence is not an argument, it is a feature. The numbers drill in
[`NumbersSection.tsx`](../src/features/study/NumbersSection.tsx) asks a learner to
say 1042. 1042 has no id and — per the reasoning in `docs/tasks/numerals.md` §6.1 —
must not be given one. So the attempt is recorded against the **patterns the target
puts to work**, via `rulesFor(1042)`.

That is a **generated, non-authored, numeric target running through the FSRS
scheduler today**. The mechanism a maths app needs is not speculative; it is in
production. And it got there for an honest reason rather than in anticipation of
this document: a language ran out of authorable rows.

---

## 2. The obstacle, and it is not naming

`ItemType` is `'word' | 'phrase' | 'sentence'`. `LearningItem.text` is a `string`
carrying `tokens`, with character offsets computed at render time (rule 3).

Everything downstream inherits that shape: `TokenizedText`, `useWordSelection`,
`WordInfoSheet`, and the cloze and tap-to-build generators. **The engine assumes
the learnable unit is a linear sequence of tokens.**

That is true of every language. It half-holds for music — pitch against time is
two-dimensional, and a chord is a set rather than a sequence — and it fails for
maths, where an expression is a tree and `2(x+3)` and `2x+6` are the same subject
written two ways.

So the fork is the **item model**. Four of the six exercise kinds generalise
directly (`reveal`, `multiple-choice`, `cloze-choice`, `tap-to-build`);
`listen-repeat` and `think-say` are speech-bound; and
`ExerciseBase.item: LearningItem` binds all six to the language item model
regardless.

This is why Tier 3 is 66%, and why that figure should not be driven down. An app
whose subject is not text should not be made to borrow a text item model.

---

## 3. The seam exists, and it is named after numerals

[`languages/runtime.ts`](../src/languages/runtime.ts) declares `NumeralGuide`:
_"Everything a numbers drill needs from a language, or nothing."_ Read it with the
word "numeral" removed and it is a **general drill interface**:

```ts
/** What a drill needs from a subject: a closed rule set, and targets for it. */
export interface DrillGuide<Target> {
  /** The rules this subject puts to work, in teaching order. */
  readonly rules: readonly string[];
  /** A target that exercises one rule, for the drill to ask. */
  sampleFor(rule: string, rng: Rng): Target;
  /** Which rules a target exercises — what an attempt on it is evidence about. */
  rulesFor(target: Target): readonly string[];
  /** The target as the learner should produce it. */
  render(target: Target): string;
  /** The inverse, for grading what a learner answered. `null` when it is not one. */
  parse(text: string): Target | null;
}
```

`NumeralGuide` is this with `Target = number`, `render` called `spell`, and one
extra bound (`maxValue`) that a numeral speller happens to have. Music instantiates
it with an interval or a chord, and its rules are interval classes; maths
instantiates it with an expression, and its rules are the identities that
expression exercises. Nothing in `drills/select.ts` changes.

The wider `SubjectModule` should copy `LanguageModule` wholesale, because
[`languages/types.ts`](../src/languages/types.ts) already got the hard parts right:

- **Every capability is optional, and absence is the point.** A music module
  declares no `verbs`; a maths module declares no `alphabet`. The build skips the
  step rather than being handed a stub — which is also what stops a half-added
  subject from looking finished.
- **Two halves, not one interface.** `types.ts` is what the build asks for and
  `runtime.ts` is what a screen asks for, split because loading a conjugator in
  order to draw a chart of letters is seven times the payload for no gain. A
  subject module needs that split identically.
- **A capability returns a loader, not a promise**, so "does this subject have a
  drill?" is answered synchronously off the same switch that knows how to load one,
  and no tab appears a frame late.

[`content/capabilities.tsv`](../content/capabilities.tsv) is a third precedent:
_"what a learner can accomplish, independent of language"_ is already a
subject-neutral curriculum spine, shared rather than owned by one language.

---

## 4. What to do, in order

**Do not design the framework up front.** [skeleton.md](skeleton.md) makes the
argument against it better than this document can: _a stripped template with no
real application in it is never run, so it rots._ A speculative `@learn/*` package
set has exactly that failure mode, one layer further in.

1. **Build the second app from today's skeleton**, with its own content model and
   its own exercise generators, importing nothing from `src/domain`. Copy Tier 1
   rather than extracting it. A copy is honest about being unproven; a package
   claims a generality that nothing has tested yet.

   **Pick music.** Interval and chord recognition map onto the existing
   durable-subject drill model almost directly, so Tier 1 gets exercised on day
   one. Maths fights the item model hardest — expression trees against a token
   string — and would spend that first week on the one problem §2 says is genuinely
   unsolved.

2. **Diff the two copies of Tier 1 once the music app works.** What survived
   unchanged in both is the package. What diverged was never generic, and the diff
   says so at no cost. This is the step that replaces the design meeting.

3. **Extract `@learn/scheduler`** from what survived — FSRS, mastery, subject
   progress, drill selection. Take `src/utils/random.ts` with it; rule 7's injected
   randomness is a precondition of the whole thing being testable under a seed.

4. **Generalise `NumeralGuide` to `DrillGuide<Target>` in place, in this
   repository**, before either app depends on it. It is a rename plus one type
   parameter, and doing it here means the Spanish app is what proves the
   generalisation compiles.

5. **Parameterise Tier 2 only if the second app actually needs it.**
   `SessionConfig` carries `referenceLanguage`, `pronunciationLocale` and
   `speakerGender`; a music app needs none of the three, and can hold its own
   config type for a long time before that duplication costs more than the
   abstraction would.

Tier 2's ideas are worth stealing even where the code is not. `course.ts` — _"a
course is a scope, not a partition … the whole thing reduces to an `ItemFilter`, so
nothing downstream needs to know courses exist"_ — is a genuinely general design.
So is the split it enforces: a setting belongs either to the device or to one
scope, never to both. Both survive renaming "language plus level" to whatever the
subject's scope is.

---

## 5. Costs to price in first

Three, all of which bite at step 3 rather than at step 1.

- **The coverage thresholds are per-directory.** `vite.config.ts` pins
  `src/domain/**` at 88/76/90/92 and `src/languages/**` at 96/96/95/97. Splitting a
  package splits those figures, and the extracted half inherits neither number.
  Decide the new floors when the package is created, and follow
  [skeleton.md](skeleton.md)'s rule: never lower one to make a change fit.

- **`@/*` is configured and unused, and the tree has grown.** There are **863**
  relative imports in `src` and **zero** through the alias.
  [skeleton.md](skeleton.md) says 167, which was true when it was written and is now
  stale by a factor of five — corrected there in the same commit as this file.
  Package extraction turns every crossing import into a path rewrite, so pick the
  alias before step 3, not during it.

- **No dead-code detection.** Step 1 deletes a large subtree in the new app, and
  nothing reports what became unreachable as a result. `knip` is the missing tool,
  and it is cheaper to add to this repository first.

---

## 6. What this document does not answer

- **The item model for a non-text subject.** §2 states the problem and stops.
  Whether music notation and maths expressions share _any_ item model, or whether
  each simply gets its own, is the open design question — and the music app is how
  to find out, rather than something to settle first.
- **Whether missions generalise.** `missions/model.ts` sequences authored passages
  through understand → practise → use. That ladder is a claim about acquiring
  language. Whether it describes learning an instrument is a pedagogy question, not
  an architecture one, and nothing here should pretend the code decides it.
- **Anything about a shared UI layer beyond the skeleton.** The screens are 16,635
  lines and the largest single body of code in the repository. None of it was
  examined for this document.
