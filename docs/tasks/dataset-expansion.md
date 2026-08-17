# Task: expand the Spanish dataset

**Status:** ready to start — the id prerequisite is cleared, so content is safe to edit
**Written:** 2026-08-17
**Revised:** 2026-08-17 — audited against the build; §3.4 and §9 are new, the
repairs in §3.0 have landed, and §4 is done rather than blocking.
**For:** a fresh agent session, no prior context assumed
**Scope:** dataset and the build pipeline. The learning engine is done and
should not need changing.

---

## 1. Orientation

Read these first, in order:

1. [`AGENTS.md`](../../AGENTS.md) — commands, architecture rules, conventions
2. [`docs/dataset-format.md`](../dataset-format.md) — record shapes, authoring
   workflow, usage fields
3. [`docs/spec/spanish_learning_app_spec_v0.1.md`](../spec/spanish_learning_app_spec_v0.1.md)
   — the product specification, especially §9–§21
4. [`docs/roadmap.md`](../roadmap.md) — what exists and what is deliberately absent

Then run `npm run check`. It must pass before you start; if it does not, fix
that first and mention it.

**The workflow in one line:** humans edit TSV in `content/es/`,
`npm run build:data` derives everything mechanical into `public/packs/`, and CI
fails if the generated pack does not match its sources. Never hand-edit
`public/packs/**`.

---

## 2. Where things stand, measured

Run this to reproduce these numbers at any time — do not trust the table if it
disagrees with the build:

```bash
npm run build:data
```

| Measure                              | Now                                    |
| ------------------------------------ | -------------------------------------- |
| Practisable items                    | 1,028                                  |
| — sentences and phrases              | 592                                    |
| — word cards                         | 436                                    |
| Lexemes                              | 671 (117 verbs, 358 nouns, 196 other)  |
| Generated verb forms                 | 2,808 (24 per verb, commands included) |
| Running words of Spanish             | **2,969 (~25 minutes of reading)**     |
| Average sentence length              | 5.0 words                              |
| Longest single item                  | 12 words                               |
| Multi-sentence texts                 | **14 (8 texts, 6 dialogues)**          |
| — sentences read in context          | 77, averaging 5.5 per passage          |
| Tokens linked to a lexeme            | 2,933 of 2,969 (99%)                   |
| Lexemes appearing in ≥1 sentence     | 669 of 671                             |
| Lexemes appearing in exactly one     | **318 (48%)**                          |
| Lexemes with ≥6 encounters           | **81 (12%)**                           |
| Items marked with register           | 60                                     |
| Items marked with address (tú/usted) | 60                                     |
| Items marked with a region           | 51                                     |
| Items with audio                     | 0                                      |
| Senses                               | 0                                      |
| Lexemes with `frequencyRank`         | 0                                      |
| Skills with `prerequisites`          | 0                                      |

---

## 3. The problems to solve

### 3.0 Already repaired — do not redo

An audit pass fixed the defects that were cheap to fix. Recorded here so a fresh
session does not spend the effort again:

- **CI could not pass.** `prettier --check` wanted `public/packs/core-es/pack.json`
  formatted one way and `build:data` wrote it another, so whichever way the file
  was committed, one of the two CI steps failed. `public/packs/` is now in
  `.prettierignore` — generated output is not Prettier's business.
- **Two wrong lemmas shipped.** `nada` in "No hay nada en la nevera." linked to
  `nadar` (to swim), and `mal` in "canta muy mal" linked to the adjective `malo`.
  Both came from `disambiguate` in `scripts/build-dataset.ts`: it never treated
  `hay` as a verb cue, and it could not see what followed a token. It now takes
  the next surface form as well, which also separates "muy mal" (adverb) from
  "mal tiempo" (adjective). Locked down in `tests/data/shipped-packs.test.ts`.
- **`doler` and `encantar` were missing from `verbs.tsv`** although the
  `gustar-type` pattern matcher names all three verbs, so the pattern was
  reachable by `gustar` alone and "Me duele la cabeza." carried no annotation and
  no verb lexeme. The skill now covers 16 sentences instead of 7.
- **80 distinct words appeared in sentences with no lexeme behind them** —
  `camarero`, `duele`, `favorito`, `llueve`, `mucha` and so on — so they could
  not be inspected or practised. Adding the missing rows took token linking from
  95% to 99%.
- **33 word cards had no example sentence**, including nine halves of the
  regional pairs: `patata`, `carro`, `zumo`, `computadora`, `celular`, `boleto`,
  `camión`, `plata`, `pasta` shipped as bare cards while their counterparts had
  sentences. `sentences-more-coverage.tsv` fixes that; every word card now has an
  example.
- **Item ids no longer move.** Word cards were split into a noun range and an
  adjective range, and then ids stopped being positional altogether — see §4.
- Smaller corrections: `carta` was glossed "letter (post)" while a shipped
  sentence uses it for a restaurant menu; `camión` carried "(Mexico)" in its
  gloss where the `regions` column already says `es-MX`; "Mucho gusto." was
  marked `formal` when it is neutral.

### 3.1 Words are met once and abandoned — the biggest one

The median lexeme appears in **one** sentence. Research on vocabulary
acquisition puts durable learning at roughly **8–12 encounters in varied
contexts** (Nation). The scheduler therefore re-shows the same _sentence_
rather than the same _word in a new context_, which is what actually builds a
lexicon.

This is a content-shape problem, not a volume problem, and two passes in this
repository have now measured the difference:

| Pass                   | Sentences added | Encounters bought | "Appears in exactly one" |
| ---------------------- | --------------- | ----------------- | ------------------------ |
| Coverage (new words)   | 72              | ~20               | 50% → **54% (worse)**    |
| Passages (known words) | 77              | ~165              | 54% → **48% (better)**   |

Near-identical row counts, opposite effects. The coverage pass had to introduce a
new word per sentence to give it an example, so it added as many one-encounter
lexemes as it fixed. The passage pass was written from words the pack already
had, so every sentence paid into the recycling target instead of borrowing from
it. This is the whole argument for §3.2.

Measured cost of what remains: **2,151 missing encounters**, which at ~4.8 linked
words per sentence is **449 more sentences at an absolute minimum**, and only if
every one is built entirely from words that are already short. Write them as
passages (§6.4) rather than standalone sentences.

### 3.2 There is still not much to read or listen to

2,969 running words is about 25 minutes of material and no item is longer than 12
words. Passages now exist — 14 of them, 77 sentences read in context — against a
target of 30–60, so the mechanism is done and the content is a third of the way
there. The spec's own influences (Kató Lomb, §2.2) and its §16–§17 assume extended
input.

Single sentences also train the wrong thing. A learner who only ever meets
isolated sentences never practises carrying a subject across a clause boundary,
picking up a pronoun that refers back, or keeping a tense consistent over four
sentences. A short coherent paragraph — a morning, a trip, a problem and how it
was solved — trains flow and makes retention easier, because the second mention
of a word arrives while the first is still fresh.

**These two problems are one piece of work**, and the table in §3.1 is the
evidence. A five-sentence paragraph about a morning routine gives `casa`,
`salir`, `café` and `temprano` two or three encounters each, in context, for the
price of five rows. Writing paragraphs is the cheapest way to hit the §5.1
recycling target and produces better input than 449 unrelated sentences would.

### 3.3 Depth the model supports but the data lacks

- **Senses** (§13.1): none. `tío` ships only as "uncle", not the Spain-only
  "guy"; `plata` only as "money" in the Latin American sense with no metal
  reading; `pasta` only as Spain's "cash", not the food everyone eats. The
  `Sense` record exists and nothing produces it. Note that `plata` and `pasta`
  carry `regions` and `register` on the whole lexeme, which is right for the
  colloquial money sense and wrong for the universal one — senses are what fixes
  that, so the glosses were left alone.
- **`frequencyRank`**: absent, so nothing can sequence learning by payoff.
- **Skill `prerequisites`**: absent, so no i+1 ordering is possible.
- **Usage marking**: only 46 items of 951 carry register. The machinery works
  and is under-applied. Two specifics for that pass: `register` is inconsistently
  authored (some rows say `neutral` explicitly, most leave it blank, and the
  format doc says blank _means_ neutral), and unlike `regions` it does **not**
  propagate from a lexeme to the sentences that use it — the sentences built on
  `plata` and `pasta` had to be marked colloquial by hand. Decide whether it
  should propagate and make it uniform either way.
- **Exclamations**: not one item of 1,028 contains `¡`. Every sentence is a
  statement or a question, so the pack never shows `¡…!` — which a learner needs
  to read as much as `¿…?` — and nothing in it carries exclamatory intonation for
  audio to demonstrate. Surfaced by the audio sampler, which reports that it
  cannot test that prosody; cheap to fix while writing passages, since a dialogue
  is where an exclamation naturally belongs.
- **Audio**: none. Out of scope here — see §7 and
  [`canonical-audio.md`](canonical-audio.md).

### 3.4 Structural gaps that hold back the last 36 tokens

Token linking is at 99%; the remainder is not missing rows but missing
morphology. Each of these needs a build or `src/languages/es` change, so none of
them is content work, and each is small enough to do on its own:

| Gap                                | Tokens affected                                                              | What it needs                                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~Imperatives~~                    | —                                                                            | **Done** — see below. Was `pon`, `siga`, `gire`, `perdona` plus 8 mislabelled sentences.                                                                                          |
| **Enclitic pronouns**              | `irme`, `ayudarme`, `llamarme`, `explicarme`, `enviarme`, `sacarnos`, `dime` | Split `verb+pronoun` in `tokenise`, or index the combined surfaces. Now the largest remaining group.                                                                              |
| **Reflexive verbs**                | `levanto`, `acuesto`                                                         | `levantarse`/`acostarse` are different lemmas from `levantar`/`acostar`, and glossing the plain verb would teach the wrong meaning — which is why the rows were not simply added. |
| **Conditional and subjunctive**    | `quisiera`, `gustaría`                                                       | Deliberately out of the conjugator (§14 beginner priority); these two are common set phrases.                                                                                     |
| **ser/ir share a preterite**       | `fue` ×4, `fui` ×2, `fuimos` ×3                                              | Genuinely ambiguous. Left unlinked on purpose and asserted by a test; only a look at the following phrase could decide it.                                                        |
| **Feminine forms of person nouns** | `médica`                                                                     | Only the lemma and plural are indexed, so `médica`, `chica`, `prima`, `jefa`, `profesora` cannot link.                                                                            |
| **Participles used as adjectives** | `pasada`                                                                     | `pasado` links to `pasar`; agreement forms of a participle are not derived.                                                                                                       |
| **Multiword lemmas**               | —                                                                            | `por qué` is a single row with a space in it, and `tokenise` is per-word, so that lexeme can never be reached. Same for `a menudo`.                                               |

**The mislabelled imperatives are fixed** — they were the one item shipping wrong
data rather than absent data, so they went first. `conjugate` now generates the
four affirmative commands per verb (2,808 forms in total), `imperativo` is a
practisable skill, and `describeMorphology` reports `command · usted` rather than
`2nd sg · imperative · formal`.

Two things are worth knowing before touching that code:

- **A tú command is spelled like the third person present**, so nothing local
  distinguishes `Cierra la puerta` from `La tienda cierra a las dos`. The build
  does not guess: declaring `address` on the sentence is what marks it a command,
  and the declared address must match the command form's own audience — without
  that check, `Está muy cerca. Siga por esta calle.` matched estar's _tú_ command
  (`está`) and mislabelled a statement.
- **Commands are indexed after every other word**, and only where no other lexeme
  already claims the surface. Indexing them earlier cost more links than it gained:
  `sé` stopped resolving to `saber`, `entre` to the preposition and `limpia` to the
  adjective.

---

## 4. Item ids — done, and how they work now

This used to be the blocking prerequisite: ids were row positions, so inserting a
sentence renumbered every id after it and repointed every learner's history at a
different sentence. It is fixed. What follows is how to not break it.

**A row owns its id.** It sits in the first column of `sentences-*.tsv`,
`nouns.tsv` and `modifiers.tsv`. Leave the column off a new row and
`build:data` assigns one and writes it back into the file:

```text
000001	Hola, ¿cómo estás?	Hi, how are you?	a1	greetings
500001	persona	person	f		a1	people
600001	bueno	good	ADJ	a1	core	buen
```

One range per kind — sentences `000001+`, noun cards `500001+`, adjective cards
`600001+` — so appending a noun cannot renumber an adjective.

Because the id lives in the row, a row keeps it through a **typo fix**, a
**reordering**, and a **move to another file**, which is what spec §20.1 requires.
A content hash could not do that (the hash changes when the typo is fixed) and
nor could a registry keyed on the row's text (it cannot tell a corrected row from
a deleted one plus a new one).

`content/es/id-ledger.tsv` records every id ever issued and marks the ones no row
claims any more as `retired`, so a deleted row's id is never handed out again.
It is generated — do not hand-edit it, and never hand-edit an assigned id.

`tests/data/item-ids.test.ts` builds a scratch copy of the sources and asserts all
of this: a second build changes nothing, a row inserted at the top of a file
leaves every existing id alone, the assigned id is written back into the row, and
a deleted row's id is retired rather than reissued.

Two consequences worth knowing:

- The build now writes to `content/es` as well as `public/packs`, so CI's drift
  check covers the whole tree rather than just the pack.
- Sentence files no longer have to sort in any particular order, and rows can be
  inserted anywhere. `sentences-more-coverage.tsv` was named to sort last only
  because it predates this fix; there is no longer any reason to keep that up.

---

## 5. Goals

Targets, in priority order. Numbers are the point — "more content" is not a
finishing condition.

1. **Recycling.** Every A1 lexeme appears in **≥6 different sentences**; every
   A2 lexeme in **≥4**. Enforce it: the build already reports coverage, so make
   it _fail_ below threshold rather than print a number. Currently 451 of 518 A1
   lexemes and 150 of 151 A2 lexemes are short.
2. **Volume.** Roughly **1,200–1,500 sentences** and **8,000–10,000 running
   words** — an hour or so of material rather than twenty minutes.
3. **Extended input.** 30–60 **micro-texts** (4–8 sentences: a day, a trip, a
   problem) and **dialogues** (§16), built from vocabulary the learner already
   has, introducing few new words each. This is what turns a drill app into an
   input app, and per §3.2 it is also the cheapest way to reach goal 1.
   **14 of 30 done**, averaging 5.5 sentences each.
4. **Usage marking.** Register on every service, social and idiomatic phrase;
   address on every sentence spoken to someone (mostly automatic once §3.4's
   imperatives are generated); regions on all regional vocabulary, with both
   sides of every pair shipped.
5. **Sequencing metadata.** `frequencyRank` from a documented open source, and
   `prerequisites` on the skills that genuinely have them.
6. **Senses** for the polysemous words that mislead a beginner.

---

## 6. Suggested sequence

1. ~~Fix item ids~~ — done, see §4. Content can now be edited freely.
2. Add the coverage gate to `scripts/build-dataset.ts` so the recycling target
   is enforced, and let it fail loudly at first — that failure list _is_ the
   work queue.
3. ~~Micro-texts and dialogues~~ — the mechanism is done. A `Passage` record
   references sentences that stay independently practisable, membership is
   authored in the `passage` column of a sentence row, and `/read` shows a passage
   with tappable words plus a practice session scoped to its sentences. The record
   and the authoring columns are documented in
   [`docs/dataset-format.md`](../dataset-format.md).

4. **More passages, and write the recycling pass as passages.** 14 exist against a
   target of 30–60, and 2,151 encounters are still missing (§3.1). These are the
   same job: pick lexemes that are short of encounters, then write a paragraph or
   a dialogue around them rather than one sentence each.

   Practical notes from writing the first 14: keep to vocabulary the pack already
   has, or the pass costs more than it pays (§3.1); the build now rejects two
   items with the same text, so check before reusing a sentence you remember
   writing; a passage inherits its sentences' `regions`, so a single `jugo` marks
   the whole text `es-419`; and a dialogue needs a speaker on every line.

5. ~~Generate imperative forms~~ — done, see §3.4.
6. Usage marking pass. Commands now declare their own address, so what is left is
   register on service, social and idiomatic phrases, and `usted` on the
   third-person sentences that address someone (`¿Me trae la cuenta?`) — those
   cannot be derived and must be declared.
7. Frequency ranks and skill prerequisites.
8. Senses, and the translations that go with them.
9. The rest of §3.4, in whatever order suits.

Work in reviewable batches — a few hundred sentences at a time, each with the
build green — rather than one enormous commit.

---

## 7. Rules and constraints

- **Never hand-type a conjugation.** Verb forms come from
  `src/languages/es/conjugation.ts` plus the irregularity table. A verb tagged
  `irregular` without a table entry fails the build, by design. The table may run
  ahead of the dataset — it already carries entries for verbs no row uses yet.
- **Ship both sides of a regional pair.** `papa`/`patata`, `coche`/`carro`,
  `jugo`/`zumo`, `ordenador`/`computadora`, `móvil`/`celular`,
  `billete`/`boleto`, `gafas`/`lentes`. One alone teaches a dialect as if it were
  universal, and shipping one side with an example sentence and the other without
  is the same failure in slower motion.
  Still undecided, deliberately: `piso` (Spain's "flat" but everyone's "floor",
  so it needs senses before it can be region-marked), `nevera` (Spain _and_ much
  of the Caribbean, so `es-ES` would be too narrow — `refrigerador` was added
  alongside it instead), `bolígrafo` and `bolso` and `autobús` (the Latin
  American side is too fragmented to pick one word for).
- **Do not invent `frequencyRank` numbers.** Take them from a documented open
  source and record which one in the pack manifest's provenance, or leave the
  field out. A plausible-looking invented ranking is worse than none.
- **Provenance stays honest.** The pack is `source: generated, review:
unreviewed`. Do not mark anything reviewed, and do not describe the pack as
  curriculum in docs or commit messages.
- **A missing lemma beats a wrong one.** `disambiguate` returns `null` rather
  than guessing, and a test asserts that `Fuimos` stays unlinked. Do not "fix"
  the remaining unlinked tokens by loosening it.
- **Validation stays clean.** `npm run validate:data` must report 0 errors and
  0 warnings.
- **`public/packs/**` is generated.** Edit `content/es/`, run
  `npm run build:data`, commit both. CI fails on drift, and the directory is
  Prettier-ignored so that check and the drift check cannot contradict each other.
- **Keep the architecture rules** in `AGENTS.md` — especially that content
  describes language and never describes exercises, and that usage is carried as
  data rather than written into a gloss.
- **Audio is out of scope.** It needs the generate → review → approve → store
  pipeline (spec §6) and is its own task, briefed in
  [`canonical-audio.md`](canonical-audio.md). One overlap to respect: a clip is
  keyed by a hash of the sentence text, so fixing a typo in a sentence that
  already has audio marks that clip stale rather than silently keeping the old
  pronunciation. Expect the build to say so, and do not treat it as a regression.

---

## 8. Definition of done

- [x] Item ids are stable across inserts, with a test proving it
- [ ] The build fails when recycling drops below the threshold
- [ ] Every A1 lexeme appears in ≥6 sentences; A2 in ≥4
- [ ] 1,200+ sentences, 8,000+ running words
- [ ] 30+ multi-sentence texts or dialogues, reachable in the app — **14 so far,
      and the reading view that shows them is in place**
- [ ] Register, address and region marked across the content that needs it
- [ ] `npm run check` passes; `npm run validate:data` reports 0 / 0
- [ ] `npm run build:data` produces no diff on a second run
- [ ] `docs/dataset-format.md` and `docs/roadmap.md` updated to match reality
- [ ] The coverage report in the build output tells the truth about what is
      still missing

## 9. Verification

```bash
npm run build:data && npm run check && npm run build
```

Then read the build's coverage report. It is the honest summary of the work:
if it says 57 lexemes have no example, that is the number, regardless of how
many rows were added.

Two things the report does not tell you, and that an audit should check by hand
or by script each pass:

- **Wrong links, not just missing ones.** Every token whose surface form is
  claimed by more than one lexeme is a chance to ship the wrong lemma, and the
  coverage percentage counts a wrong link as a success. Enumerate the ambiguous
  resolutions and read them; that is how the `nada` → `nadar` and `mal` → `malo`
  bugs surfaced. There were 52 such tokens at the last count.
- **Whether the marking is right, not just present.** `register`, `address` and
  `regions` counts go up whether or not the values are correct, and eight
  sentences currently claim third-person present for a tú imperative.
