# Task: make the function words studiable

**Status:** briefed, not started — needs a decision before authoring
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

**A function word cannot be studied, only met.** Measured against the shipped
pack, 123 lexemes have no word card and no way to be reached as a set:

| Kind                 | Lexemes | Cards |
| -------------------- | ------: | ----: |
| Adverbs (`ADV`)      |      56 |     0 |
| Pronouns (`PRON`)    |      27 |     0 |
| Prepositions (`ADP`) |      13 |     0 |
| Determiners (`DET`)  |      12 |     0 |
| Conjunctions         |       9 |     0 |
| Interjections        |       6 |     0 |

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

- [ ] The decision is written down, with its reasoning, and `STUDYABLE_POS`'s
      comment agrees with the code
- [ ] `ustedes` exists as a lexeme and appears in sentences; the subject and
      object pronoun paradigms have no missing members
- [ ] No part of speech is in `STUDYABLE_POS` with zero cards behind it — either
      it has cards or it is not listed
- [ ] A learner can reach the interrogatives as a group from Study
- [ ] Question formation and the demonstrative contrast are each a named skill
- [ ] `npm run check` passes; `npm run validate:data` reports 0 / 0
- [ ] `npm run build:data` produces no diff on a second run

## 6. Verification

```bash
npm run build:data && npm run check
```

Then read the build's coverage report, and open Study in the running app: every
tile it offers must lead to a sheet with something in it, and every part of
speech it does not offer must be one nobody would ask for.
