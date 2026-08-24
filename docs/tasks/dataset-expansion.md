# Task: expand the Spanish dataset

**Status:** ready to start — the id prerequisite is cleared, so content is safe to edit
**Written:** 2026-08-17
**Revised:** 2026-08-24 — re-measured against pack `0.3.0`. Goals 2, 3 and half
of 5 are now met, so the numbers throughout were restated; the recycling gate
(goal 1, §6.2) is still the open work and is now the only thing standing between
this brief and done.
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

**A dated snapshot, not a live figure.** Run the build and trust _it_ over this
table whenever the two disagree — the table has gone stale three times, each time
because content landed and the paragraph describing it did not:

```bash
npm run build:data
```

**Re-measured 2026-08-24**, against pack `0.9.0`. Goals 2 and 3 of §5 have since
been met — read the table before planning volume work, because the figures this
brief was written against are less than half of what now ships.

| Measure                              | Now                                    |
| ------------------------------------ | -------------------------------------- |
| Practisable items                    | 2,358                                  |
| — sentences and phrases              | 1,730                                  |
| — word cards                         | 628                                    |
| Lexemes                              | 803 (127 verbs, 393 nouns, 283 other)  |
| Generated verb forms                 | 3,024 (24 per verb, commands included) |
| Generated noun and adjective forms   | 1,122                                  |
| Running words of Spanish             | **10,165 (~85 minutes of reading)**    |
| Average sentence length              | 5.9 words                              |
| Longest single item                  | 13 words                               |
| Multi-sentence texts                 | **107 (57 texts, 50 dialogues)**       |
| — sentences read in context          | 812, averaging 7.6 per passage         |
| Tokens linked to a lexeme            | 10,121 of 10,165 (100%)                |
| Lexemes appearing in ≥1 sentence     | 789 of 803                             |
| Lexemes appearing in exactly one     | **109 (14%)**                          |
| Lexemes with ≥6 encounters           | **302 (38%)**                          |
| Questions / statements               | 391 / 1,034, with **5** minimal pairs  |
| Items marked with register           | 1,060                                  |
| Items marked with address (tú/usted) | 447                                    |
| Items marked with a region           | 69                                     |
| Items containing `¡`                 | 14                                     |
| Items with audio                     | 0                                      |
| Senses                               | 0                                      |
| Lexemes with `frequencyRank`         | 0                                      |
| Skills with `prerequisites`          | 58                                     |

Two rows moved for reasons worth knowing rather than by growth alone. **Token
linking reached 100%** when `segundo` the ordinal was added — it was the last
authoring gap, and until then the noun claimed `el segundo piso`. **Skill
prerequisites are no longer zero**: 58 authored skills declare one, so §5's goal 5
is half done and only `frequencyRank` remains.

The numbers this table replaced are kept nowhere, deliberately. They said 1,028
items and 2,969 running words, and a fresh session that trusted them would have
written the 449 sentences §3.1 asks for on top of 800 that already exist.

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

Just under a third of lexemes appear in **one** sentence — 250 of 802, down from
48% when this was written. Research on vocabulary
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

Measured cost of what remains: **1,306 missing encounters**, which at 5.9 linked
words per sentence is **224 more sentences at an absolute minimum**, and only if
every one is built entirely from words that are already short. Write them as
passages (§6.4) rather than standalone sentences.

That figure has barely moved while the pack doubled, and the reason is the point
of the table above §3.1: 800 sentences bought 224 encounters against the target,
because most of them introduced words of their own. Volume is no longer the
constraint. Shape is.

### 3.2 There is still not much to read or listen to

**This is the part that is now done.** 10,165 running words is about an hour and a half of
material, and 65 passages carry 489 sentences read in context against a target of
30–60 — so both the mechanism and the content have arrived, and the spec's
assumption of extended input (Kató Lomb, §2.2; §16–§17) is met. No item is longer
than 12 words, which is the one figure here that has not moved and the one worth
revisiting next.

What follows is kept because the argument still decides _how_ to write the
recycling pass, not because the passage count still needs raising.

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
- ~~**Skill `prerequisites`**~~: **done** — 58 authored skills declare one, so i+1
  ordering is possible and only `frequencyRank` is left of goal 5.
- **Usage marking**: 1,060 items of 1,730 carry register and 447 carry address, up
  from 46 and 60 — largely a side effect of the mission palettes, which are
  authored with both. The machinery is now well applied; what remains is whether
  it is _correct_, which is §9's second bullet. Two specifics for that pass: `register` is inconsistently
  authored (some rows say `neutral` explicitly, most leave it blank, and the
  format doc says blank _means_ neutral), and unlike `regions` it does **not**
  propagate from a lexeme to the sentences that use it — the sentences built on
  `plata` and `pasta` had to be marked colloquial by hand. Decide whether it
  should propagate and make it uniform either way.
- **Exclamations**: 14 items of 2,358 contain `¡` — up from zero, and still
  under 1%. A learner needs to read `¡…!` as much as `¿…?`, and almost nothing in
  the pack carries exclamatory intonation for audio to demonstrate. Surfaced by
  the audio sampler, which reports that it cannot test that prosody; cheap to fix
  while writing passages, since a dialogue is where an exclamation belongs.
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

1. **Recycling — the content half is still open; the gate is not.** Every A1
   lexeme appears in **≥6 different sentences**; every A2 lexeme in **≥4**.
   **A2 is met**: 170 of its 171 non-numeral lexemes appear in four or more
   sentences, and the one left is `menudo`, which lives only inside `a menudo` — a
   multiword lemma `tokenise` cannot reach, so it is unreachable by construction
   rather than by neglect. **A1 is the open half**: 339 of 594 still short.

   The gate asked for here now exists, and is a **ratchet** rather than the
   threshold itself: `content/es/recycling.tsv` records where we are, and the
   build fails both when the number gets worse and when an improvement is left
   unrecorded. Turning the real threshold on today would fail the build on 339
   lexemes and block every other kind of work — the same reason
   `vite.config.ts` sets coverage floors just under what the suite reaches. So
   the remaining work is writing the contexts and walking the ceiling down.

2. ~~**Volume.**~~ **Done** — 1,730 sentences and 10,165 running words, against a
   target of 1,200–1,500 and 8,000–10,000. About an hour of material.
3. ~~**Extended input.**~~ **Done and past the target** — 107 passages averaging
   7.6 sentences, against 30–60. Per §3.2 this was also meant to be the cheapest
   route to goal 1, and it only partly was: see the note under §3.1.
4. **Usage marking.** Register on every service, social and idiomatic phrase;
   address on every sentence spoken to someone (mostly automatic once §3.4's
   imperatives are generated); regions on all regional vocabulary, with both
   sides of every pair shipped.
5. **Sequencing metadata.** `frequencyRank` from a documented open source.
   `prerequisites` is **done** — 58 skills declare one.
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

4. **Write the recycling pass as passages.** The passage target is met — 65
   against 30–60 — so this is no longer about raising that count. 1,927 encounters
   are still missing (§3.1), and the job is unchanged in shape: pick lexemes that
   are short, then write a paragraph or a dialogue _around_ them rather than one
   sentence each. The discipline that matters is introducing no new word unless it
   pays for itself, which is where the last 800 sentences leaked.

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
  so it needs senses before it can be region-marked), `bolígrafo` and `bolso` and
  `autobús` (the Latin American side is too fragmented to pick one word for).

  **`nevera` is decided (2026-08-24), and the answer was neither option this
  paragraph offered.** It used to say `es-ES` would be too narrow — right — and
  concluded that the word should stay unmarked, with `refrigerador` added
  alongside. Two things were wrong with that. The data never matched it: `nevera`
  shipped marked `es-ES` regardless, and because `es-CO` is a filterable locale,
  a learner aiming at Colombia was denied the word everyone there uses and shown
  `refrigerador` instead — the marking was not imprecise, it was inverted. And
  unmarked would have been wrong in the other direction, because the column means
  "where this word is the usual choice" and Mexico says `refrigerador` while
  Argentina says `heladera`; leaving it blank claims a dialect word as universal,
  which is the same failure as shipping one side of a pair.

  A `regions` list takes more than one locale, and `regionCovers` reads each, so
  the word now carries the regions it actually owns:
  `es-ES,es-CO,es-VE,es-CU,es-DO,es-PR`. Spain sees `nevera`; Colombia sees both;
  Mexico and Argentina see `refrigerador`; and the `es-419` macro-filter sees
  `refrigerador`, correctly, as the wider Latin American choice. **The general
  lesson: reach for several locales before reaching for none.** A word can be
  regional without being confined to one country, and blank does not mean
  "complicated" — it means "usual everywhere".

  One gap this surfaced and did not close: Argentina is shown `refrigerador`,
  where an Argentine says `heladera`, which the pack does not have. Adding it is a
  lexeme plus at least one sentence, so it belongs with a content pass rather than
  here.

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

**No figures in this list, on purpose.** Every count that belongs to the pack
lives in §2, where a test holds it against the shipped files. This list carried
its own copies of the same numbers and they went stale three separate times while
§2 was being corrected — which is the whole failure mode written down twice. A
checklist states a _condition_; the table states where we are against it.

- [x] Item ids are stable across inserts, with a test proving it
- [x] The build fails when recycling drops below the threshold — a **ratchet** in
      `content/es/recycling.tsv`, which also fails when an improvement would go
      unrecorded, so a gain cannot quietly be handed back
- [ ] Every A1 lexeme appears in ≥6 different sentences; every A2 lexeme in ≥4 —
      see §2 for how far short, and `recycling.tsv` for the ceiling it is held to
- [x] 1,200+ sentences and 8,000+ running words
- [x] 30+ multi-sentence texts or dialogues, reachable in the app, with the
      reading view that shows them
- [x] Register, address and region marked across the content that needs it —
      whether the values are _right_ is §9's second bullet, and still open
- [x] `npm run check` passes; `npm run validate:data` reports 0 / 0
- [x] `npm run build:data` produces no diff on a second run
- [ ] `docs/dataset-format.md` updated to match reality (`docs/roadmap.md` and the
      README are held to the pack by `doc-stats.test.ts`, and §2 by
      `brief-table.test.ts`)
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
  bugs surfaced. There were 52 such tokens at the last count, and the class is
  not closed: `segundo` shipped as a floor number linked to a unit of time until
  2026-08-24, found by reading the ambiguous resolutions rather than by any
  number in the report.
- **Whether the marking is right, not just present.** `register`, `address` and
  `regions` counts go up whether or not the values are correct, and eight
  sentences currently claim third-person present for a tú imperative.
