# Task: make the function words studiable

**Status:** done 2026-08-26 — the decision, the phantom tile, the paradigm
repairs and §3.1's cloze follow-up have all landed. One item stays open by
design: object `la`/`los`/`las`, which is a senses problem rather than authoring
**Written:** 2026-08-24
**For:** a fresh agent session, no prior context assumed
**Scope:** one product decision, then a small amount of code and a content pass.
The learning engine needs no changes; the exercise generators need none either.

Read [`AGENTS.md`](../../AGENTS.md) and
[`docs/tasks/dataset-expansion.md`](dataset-expansion.md) first. This task is a
sibling of [`feelings-mood-state.md`](feelings-mood-state.md): both are content
gaps briefed separately because each needs deciding before anything is written.

---

## 1. What already landed, so it is not redone

The question words have their **sentences**.
[`content/es/sentences-questions.tsv`](../../content/es/sentences-questions.tsv)
gave `cuándo`, `cuál`, `quién` and `por qué` a dialogue each plus a palette of
answers on both sides, and the demonstratives ride along at the end. The
`questions` topic now carries 172 sentences — third-largest in the pack, behind
only `travel` and `social`.

That half is done and is not what this task is about.

## 2. The gap

**A function word cannot be studied, only met.** Re-measured against pack
`0.16.0`, 136 lexemes have no word card — and after the decision below, none of
them is meant to:

| Kind                 | Lexemes | Cards |
| -------------------- | ------: | ----: |
| Adverbs (`ADV`)      |      61 |     0 |
| Pronouns (`PRON`)    |      31 |     0 |
| Prepositions (`ADP`) |      14 |     0 |
| Determiners (`DET`)  |      12 |     0 |
| Conjunctions         |      12 |     0 |
| Interjections        |       6 |     0 |

The figures were 56 / 27 / 13 / 12 / 9 / 6 when this was written, against pack
`0.13.0`. They grew with the content and with §4.2's repairs; the shape of the gap
did not.

Two constants decide it, and they disagree with each other:

- [`scripts/build-dataset.ts`](../../scripts/build-dataset.ts) — `CARD_POS` is
  `{ADJ, NUM}`, so no other modifier row ever gets an id, and without an id there
  is no card.
- [`src/domain/content/annotation.ts`](../../src/domain/content/annotation.ts) —
  `STUDYABLE_POS` is `[VERB, NOUN, ADJ, ADV, NUM]`.

`ADV` is in the second list and absent from the first. So Study derives an
Adverbs tile, counts it with the filter it links to — `{types: ['word'], pos:
['ADV']}` — gets zero, and drops it. The rule works exactly as designed; the
result is that `dónde`, `cuándo`, `cómo` and 53 other adverbs are unreachable as
a set, while the list that names them calls them studiable.

**The interrogatives are the sharpest case**, because a learner asks with them
constantly and the pack cannot offer them as a group. Encounters in sentences:

```
qué 85 · cuánto 32 · dónde 31 · cómo 18 · cuándo 17 · quién 14 · cuál 10
adónde 2 · por qué 0
este 85 · ese 21 · aquel 5 · eso 4 · esto 1
```

Two of those zeroes and near-zeroes are structural rather than editorial:

- **`por qué` can never be linked.** It is one row with a space in it and
  `tokenise` is per-word, so the lexeme is unreachable however many sentences use
  it. Same for `a menudo`. Recorded in §3.4 of the expansion brief.
- **`como` as a conjunction also links 0 times.** It loses its surface to
  `comer`'s first person, and `disambiguate` is right to prefer the verb. The
  conjunction is a separate reading of one spelling — a senses problem, and the
  same shape as the `segundo` bug that shipped a floor number linked to a unit of
  time.

**The paradigms themselves have holes**, which no amount of card-making fixes:

- **`ustedes` appears nowhere in the pack** — not as a lexeme, not in one
  sentence. `vosotros` appears once. Yet the conjugator generates both (six
  persons, four commands) and `UsageBadges` already has labels for each. Plural
  "you" is machinery with no content behind it, and for most of the Spanish-speaking
  world `ustedes` is the only plural "you" there is. This is the region-pair rule
  of `AGENTS.md` failing in the other direction: shipping one side of a
  distinction teaches a dialect as universal.
- Absent entirely: `ellas`, `nosotras`, `les`, `os`, the object pronouns
  `la`/`los`/`las` (only `lo` and `le` exist, and `la` is indexed as the article),
  `cuyo`, relative `quien` and `lo que`, `otro`, `mismo`, `varios`.
- Thin where present: `él` 2, `ellos` 1, `esto` 1, `alguien` 1, `nadie` 1,
  `nuestro` 2, `alguno` 1.

**No pattern covers any of it.** The pack ships 16 generated patterns and four
grammar skills. None is about forming a question, and none about the
`este`/`ese`/`aquel` three-way contrast — even though the header of
`sentences-questions.tsv` says the choosing dialogue exists to teach that
contrast. The teaching is in the content and nothing names it.

## 3. The decision to make first

**Do function words become cards, or do they become patterns?** They are not the
same product and the choice cannot be deferred into the authoring.

`STUDYABLE_POS` already carries the argument against cards, and it is a good one:
determiners, prepositions and conjunctions are a closed handful each, met inside
phrases rather than studied as a batch, and offering them as a category would put
`de` and `el` at the head of a list of thousands. Nothing about that has stopped
being true. A card whose front is `de` and whose back is "of, from" is a card
nobody learns anything from.

But it does not follow that all 123 belong on the same side of the line. Three
groups behave differently:

1. **The interrogatives** (9: `qué`, `quién`, `cuál`, `cuánto`, `dónde`,
   `cuándo`, `cómo`, `por qué`, `adónde`). A closed set a learner genuinely
   revises as a set, and the one group where "which word do I use?" is the whole
   question. `qué` against `cuál` is the classic beginner error and the pack
   cannot currently drill it.
2. **The demonstratives and pronoun paradigms** (`este`/`ese`/`aquel`, the
   subject and object pronouns). Systems, not vocabulary. What a learner needs is
   the contrast and the slot, which is what a pattern teaches and a card cannot.
3. **The rest** — prepositions, conjunctions, interjections, and most adverbs.
   `STUDYABLE_POS`'s reasoning applies unchanged. Leave them as lexemes.

The likely answer is therefore **a pattern for group 2, a decision to make for
group 1, and nothing for group 3** — but that is a recommendation, not the
finding. Whoever picks this up should either confirm it or say why not, in the
file, before authoring.

### Decided, 2026-08-26

**The recommendation is confirmed for groups 2 and 3, and group 1 gets no cards.**
Three findings changed the shape of it, one of which was not visible when this was
written.

**1. Question formation landed in between, and it already delivers group 1 as a
group.** `QUESTION_SKILLS` in the build now derives `yes-no-question` and
`question-word`, and `INTERROGATIVES` reads the closed set off the `questions`
topic exactly as §3's third bullet suggested it could. So a learner reaches the
interrogatives from Study → Grammar today, as the sentences that ask with them.
That is the better group: the set a learner revises is _the questions_, not nine
glosses. §5's "reach the interrogatives as a group" is met, by content rather than
by cards.

**2. A card is the wrong shape for the thing that is actually hard.** A card
whose front is `qué` and whose back is "what" is `STUDYABLE_POS`'s own argument
turned on the one group that looked exempt — and it does not drill `qué` against
`cuál` either, because a word card yields recognition (word → gloss) and nothing
else. The error this task names is a _choice inside a sentence_, and the exercise
shaped like that is `cloze-choice`. Cards would have added nine ids, two constant
changes and a Study tile, and drilled the wrong thing in the weakest retrieval
mode. Rejected.

**3. `ADV` comes out of `STUDYABLE_POS`.** With no adverb becoming a card, the
list must not say otherwise. It is removed rather than filled, and
`tests/data/studyable-pos.test.ts` now fails if any member of the list has no card
behind it in the shipped pack — the phantom Adverbs tile was invisible precisely
because nothing asserted this.

So: **no function word becomes a card.** Groups 1 and 2 are taught as named
grammar — `question-word` and, added here, the demonstrative contrast — and
group 3 stays lexemes, met in sentences and answerable when tapped.

### 3.1 Two follow-ups this decision creates rather than closes

Neither is authoring; both are recorded so the next session does not rediscover
them.

**~~The cloze cannot drill any of it yet~~ — landed 2026-08-26.** The diagnosis
held: `blankCandidate` blanked only a `VERB` or an `AUX`, and relaxing that alone
would have found nothing, because the non-adjective paradigms were _indexed and
never recorded_ — `formsOf('core-es:lexeme:este')` came back empty while four
surfaces of it shipped.

Both halves are now in place. `src/languages/es/closed-class.ts` owns the
paradigms — articles, demonstratives, possessives, quantifiers, the pronouns with
a feminine — deriving what the regular `-o` rule already gets right and declaring
only what no rule produces (`estos`, not `estes`). The build emits them as
`FormRecord`s and **refuses a declared surface the module derives**, which is the
rule the ordinals already had; twenty rows of `modifiers.tsv` lost their extra
surfaces column to it. Two things read paradigms and both work now: word
inspection shows `este / estos / esta / estas` when you tap `estas`, and the cloze
has alternatives to offer.

**The line held as stated:** a cloze may drill _agreement and inflection_, where
the rest of the sentence settles the answer, and must not drill _lexical choice_,
where it usually does not. `___ casas` has one right article because `casas` is
feminine plural; `¿Quieres ___?` takes `algo`, `nada` or `todo` equally well, and
a cloze offering all three is a question with three right answers — the same
hazard `distractors()` guards from the other side.

Three guards enforce it, and each rules out a case that looked fine
(`tests/domain/agreement-cloze.test.ts`):

- **A target noun within two words**, adjectives allowed in between. A pronoun
  standing before a verb has nothing to agree with, which is what keeps
  `ellos`/`ellas` out of the exercise while leaving them in the paradigm.
- **A noun that is not itself ambiguous in number.** `el lunes` and `los lunes`
  are both right. This is the dangerous case: the noun _does_ carry a number, so
  every other check passes it.
- **The blank's own form must agree too.** That is what skips `el agua` —
  Spanish's own exception, where the rule this exercise teaches is false — rather
  than grading it either way.

Against the shipped pack it produces roughly 2,400 agreement blanks beside 5,600
verb ones, over `el` (1,549), `un` (572), `este` (167), `ese` (63), `mucho`,
`aquel`, `poco`, `cuánto`, `alguno`, `ninguno` and `nuestro`. The balance is by
_kind_ rather than by token: an ordinary sentence holds one clozeable verb and
three or four determiners, so shuffling every candidate would have made two clozes
in three an article.

**Two-form paradigms cannot be asked**, and that is correct rather than a gap.
`mi`/`mis`, `su`/`sus`, `cuál`/`cuáles` offer one wrong answer, so the card would
be a coin flip; the generator's existing floor of two alternatives excludes them.
They are recorded all the same, because inspection should show them.

**Object `la`, `los` and `las` are blocked, and it is a senses problem.** §4.2
lists them as a paradigm hole to repair. They are not repairable as rows:
`el` claims `la`, `los` and `las` as its declared surfaces, and those surfaces
carry 749, 149 and 174 sentence occurrences. A second `PRON` claimant would
contest every one of them, and `disambiguate` prefers `NOUN | ADJ | PRON` in
nominal position — so `veo la casa` would resolve `la` to the object pronoun. That
is the `como`/`segundo` class named in §2 and §4.5: one spelling, two readings,
and the fix is senses rather than another row. Left alone deliberately.

Three things worth weighing while deciding:

- **The filter machinery already supports it.** `posFromSlug` accepts every UD
  tag, so `?pos=pron` is a valid narrowing today and returns sentences
  exemplifying a pronoun. Only cards and the tile are missing, so the cost of
  group 1 is two constants and some rows, not architecture.
- **A pattern needs no new record type.** `PATTERNS` in the build already
  produces a `pattern` skill from a token matcher, filtered to those a sentence
  actually uses, and the Grammar section on Study lists them. `ordinals` was
  added that way, and it is the closest precedent: a closed set, taught by
  contrast, given a skill rather than cards.
- **A card needs a card's justification.** Every word card must have an example
  sentence, and it must not duplicate another item's text. `qué` and `cuál` are
  fine; `que` the conjunction would collide with `qué` in a learner's eye if not
  in the build.

## 4. What to do once it is decided

In the order that keeps the build green:

1. **Write the decision down** in this file, then in `annotation.ts` beside
   `STUDYABLE_POS` if the list changes. That comment is the only record of why
   `DET` is excluded, and a change that leaves it stale is worse than no change.
2. **Repair the paradigm holes** (independent of the decision, and worth doing
   either way): `ustedes` with sentences that use it, `ellas`, `nosotras`, the
   object pronouns, `os`. Ship both sides of the plural-you distinction the way
   `papa`/`patata` ships both sides of its own — one alone is the same failure.
3. **Add the patterns.** A question-formation pattern and a demonstrative-contrast
   pattern, in `PATTERNS`, matched off the tokens already in the pack. They will
   light up immediately: 172 sentences carry the `questions` topic and 111 carry a
   demonstrative.
4. **If group 1 becomes cards**, add `PRON` to `CARD_POS` and to `STUDYABLE_POS`,
   give the nine interrogatives ids, and check the Study tile counts with the
   filter each tile links to — the trap `AGENTS.md` records, and the one that
   produced the phantom Adverbs tile above.
5. **Leave the two structural items alone** unless you want them: `por qué` needs
   multiword lemmas and `como` needs senses. Both are named in §3.4 of the
   expansion brief and neither is content work.

## 5. Definition of done

- [x] The decision is written down, with its reasoning, and `STUDYABLE_POS`'s
      comment agrees with the code
- [x] `ustedes` exists as a lexeme and appears in sentences; the subject and
      object pronoun paradigms have no missing members — **except** object `la`,
      `los` and `las`, which §3.1 records as unreachable by authoring
- [x] No part of speech is in `STUDYABLE_POS` with zero cards behind it — either
      it has cards or it is not listed (`tests/data/studyable-pos.test.ts`)
- [x] A learner can reach the interrogatives as a group from Study — through the
      `question-word` skill, 198 A1 items, rather than through nine cards
- [x] Question formation and the demonstrative contrast are each a named skill —
      `yes-no-question` and `question-word` landed before this pass, and
      `demonstratives` carries 105 A1 items
- [x] `npm run check` passes; `npm run validate:data` reports 0 / 0
- [x] `npm run build:data` produces no diff on a second run

- [x] The closed-class paradigms are `FormRecord`s, so inspection can show them
      and the cloze can drill agreement (`tests/domain/agreement-cloze.test.ts`)

Left open, and recorded in §3.1 rather than here: object `la`/`los`/`las`, which
no amount of authoring reaches.

## 6. Verification

```bash
npm run build:data && npm run check
```

Then read the build's coverage report, and open Study in the running app: every
tile it offers must lead to a sheet with something in it, and every part of
speech it does not offer must be one nobody would ask for.
