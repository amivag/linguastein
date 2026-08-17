# Task: expand the Spanish dataset

**Status:** ready to start
**Written:** 2026-08-17
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

| Measure                              | Now                                   |
| ------------------------------------ | ------------------------------------- |
| Practisable items                    | 854                                   |
| — sentences and phrases              | 443                                   |
| — word cards                         | 411                                   |
| Lexemes                              | 620 (101 verbs, 348 nouns, 171 other) |
| Generated verb forms                 | 2,000                                 |
| Running words of Spanish             | **2,128 (~18 minutes of reading)**    |
| Average sentence length              | 4.8 words                             |
| Multi-sentence texts                 | **0**                                 |
| Lexemes appearing in ≥1 sentence     | 553 of 620                            |
| Lexemes appearing in exactly one     | **310 (56%)**                         |
| Lexemes with ≥6 encounters           | **57 (10%)**                          |
| Items marked with register           | 38                                    |
| Items marked with address (tú/usted) | 34                                    |
| Items marked with a region           | 23                                    |
| Items with audio                     | 0                                     |
| Senses                               | 0                                     |
| Lexemes with `frequencyRank`         | 0                                     |
| Skills with `prerequisites`          | 0                                     |

---

## 3. The problems to solve

### 3.1 Words are met once and abandoned — the biggest one

The median lexeme appears in **one** sentence. Research on vocabulary
acquisition puts durable learning at roughly **8–12 encounters in varied
contexts** (Nation). The scheduler therefore re-shows the same _sentence_
rather than the same _word in a new context_, which is what actually builds a
lexicon.

This is a content-shape problem, not a volume problem: adding 500 unrelated
sentences about new words would leave it unchanged.

### 3.2 There is almost nothing to read or listen to

2,128 running words is about 18 minutes of material, no item is longer than 12
words, and there are no multi-sentence texts at all. The spec's own influences
(Kató Lomb, §2.2) and its §16–§17 assume extended input; the app has no reading
or listening dimension today.

### 3.3 Depth the model supports but the data lacks

- **Senses** (§13.1): none. `tío` ships only as "uncle", not the Spain-only
  "guy"; `plata` only as "money" in the Latin American sense with no metal
  reading. The `Sense` record exists and nothing produces it.
- **`frequencyRank`**: absent, so nothing can sequence learning by payoff.
- **Skill `prerequisites`**: absent, so no i+1 ordering is possible.
- **Usage marking**: only 38 items of 854 carry register. The machinery works
  and is under-applied.
- **Audio**: none. Out of scope here — see §7.

---

## 4. Blocking prerequisite: item ids are positional

**Do this before adding or reordering a single row.**

`scripts/build-dataset.ts` assigns ids by position:

```text
core-es:item:000001 = "Hola, ¿cómo estás?"   ← first row of sentences-core.tsv
core-es:item:000002 = "Buenos días."          ← second row
core-es:item:500001 = "persona"               ← first row of nouns.tsv
```

Learner progress, attempt history and mastery all reference these ids
(`src/domain/progress`). Inserting a sentence anywhere but the end silently
renumbers everything after it, so every learner's history would then point at
**different sentences**. Spec §20 is explicit: published ids are stable
forever, and a typo fix keeps the same id.

**Required fix:** give each item an id that does not move. The approach that
fits the spec's revision rules (§20.1) is a checked-in registry, e.g.
`content/es/id-registry.tsv` mapping stable id ↔ source key, which the build
reads and appends to for new rows:

- an existing row keeps its id even if its text is corrected or it moves file
- a genuinely new row gets the next free id
- a removed row's id is retired, never reused

A content hash is _not_ adequate on its own: it would change the id when a
typo is fixed, which §20.1 forbids.

Add a test that locks this down: building twice, and building after inserting a
row at the top of a source file, must leave existing ids unchanged.

---

## 5. Goals

Targets, in priority order. Numbers are the point — "more content" is not a
finishing condition.

1. **Recycling.** Every A1 lexeme appears in **≥6 different sentences**; every
   A2 lexeme in **≥4**. Enforce it: the build already reports coverage, so make
   it _fail_ below threshold rather than print a number.
2. **Volume.** Roughly **1,200–1,500 sentences** and **8,000–10,000 running
   words** — an hour or so of material rather than eighteen minutes.
3. **Extended input.** 30–60 **micro-texts** (4–8 sentences: a day, a trip, a
   problem) and **dialogues** (§16), built from vocabulary the learner already
   has, introducing few new words each. This is what turns a drill app into an
   input app.
4. **Usage marking.** Register on every service, social and idiomatic phrase;
   address on every sentence spoken to someone (mostly automatic); regions on
   all regional vocabulary, with both sides of every pair shipped.
5. **Sequencing metadata.** `frequencyRank` from a documented open source, and
   `prerequisites` on the skills that genuinely have them.
6. **Senses** for the polysemous words that mislead a beginner.

---

## 6. Suggested sequence

1. Fix item ids (§4). Nothing else is safe until this lands.
2. Add the coverage gate to `scripts/build-dataset.ts` so the recycling target
   is enforced, and let it fail loudly at first — that failure list _is_ the
   work queue.
3. Recycling pass: write sentences that deliberately reuse existing lexemes in
   new contexts. Prefer this over introducing new vocabulary.
4. Micro-texts and dialogues. This needs a small model decision: `ITEM_TYPES`
   is `word | phrase | sentence`, so a passage needs either a new item type or
   a container record referencing its sentences (spec §16 sketches the latter).
   Prefer whichever keeps sentences individually practisable — the engine
   derives exercises per item, and a passage that hides its sentences from the
   scheduler loses that.
   If you add passages, add the minimal reading view to display them; content
   the app cannot show is not done.
5. Usage marking pass.
6. Frequency ranks and skill prerequisites.
7. Senses, and the translations that go with them.

Work in reviewable batches — a few hundred sentences at a time, each with the
build green — rather than one enormous commit.

---

## 7. Rules and constraints

- **Never hand-type a conjugation.** Verb forms come from
  `src/languages/es/conjugation.ts` plus the irregularity table. A verb tagged
  `irregular` without a table entry fails the build, by design.
- **Ship both sides of a regional pair.** `papa`/`patata`, `coche`/`carro`,
  `jugo`/`zumo`, `ordenador`/`computadora`, `móvil`/`celular`,
  `billete`/`boleto`. One alone teaches a dialect as if it were universal.
- **Do not invent `frequencyRank` numbers.** Take them from a documented open
  source and record which one in the pack manifest's provenance, or leave the
  field out. A plausible-looking invented ranking is worse than none.
- **Provenance stays honest.** The pack is `source: generated, review:
unreviewed`. Do not mark anything reviewed, and do not describe the pack as
  curriculum in docs or commit messages.
- **Validation stays clean.** `npm run validate:data` must report 0 errors and
  0 warnings.
- **`public/packs/**` is generated.** Edit `content/es/`, run
  `npm run build:data`, commit both. CI fails on drift.
- **Keep the architecture rules** in `AGENTS.md` — especially that content
  describes language and never describes exercises.
- **Audio is out of scope.** It needs the generate → review → approve → store
  pipeline (spec §6) and is its own task.

---

## 8. Definition of done

- [ ] Item ids are stable across inserts, with a test proving it
- [ ] The build fails when recycling drops below the threshold
- [ ] Every A1 lexeme appears in ≥6 sentences; A2 in ≥4
- [ ] 1,200+ sentences, 8,000+ running words
- [ ] 30+ multi-sentence texts or dialogues, reachable in the app
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
