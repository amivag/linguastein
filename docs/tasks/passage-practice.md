# Task: practise a passage as a passage

**Status:** notes only — investigated, not briefed. Section 7 lists what is still
unknown; do not treat this as ready to start the way
[verb-cards.md](verb-cards.md) is.
**Written:** 2026-08-21
**For:** a later session, no prior context assumed
**Scope:** one new exercise kind, one widening of the generator signature, and a
decision about ordering. No content authoring is required to prototype it.

---

## 1. The idea in one line

A learner reads a five-line passage, then rebuilds it from shuffled lines — the
passage-level analogue of `tap-to-build`, which already shuffles the words of one
sentence.

## 2. Why

Connected text is how people actually retain language: a paragraph gives each
sentence a reason to be there, and recalling line 4 is easier when lines 1–3 have
set it up. The pack already has the material — 14 passages, 77 sentences — and
already reads them end to end at `/es/all/read/700001`. What it cannot do is
practise a passage _as_ a passage. Today "Practise these sentences" hands the
five lines to the ordinary planner, which deals them individually and by memory
strength, so the connective tissue that made them worth grouping is discarded at
exactly the moment it would pay off.

Reconstruction is also a genuinely harder retrieval mode than anything currently
offered, and the learning model already says recognition is the most flattering
and production the most valuable.

## 3. What the investigation established

**The content model needs nothing.** `Passage` already carries `items` in reading
order, `kind` (`text` / `dialogue`), `speakers` index-aligned with the lines, a
target-language `title` with its translation as a separate record, `level` and
`topics`. Ordering is the whole point of the record and it is already there.

**Passages already span thematic categories, which is what makes them worth
reading.** 11 of the 14 do. `Una mañana normal` draws on `daily-routine`, `clock`,
`food-drink` and `work`; `El sábado` touches five topics across five lines. The
passage declares one primary topic and its sentences carry their own, so a
category filter still finds the individual lines. Nothing needs changing here —
worth recording only because it is the property the exercise depends on, and it
holds by construction rather than by luck.

**Sizes are right for reconstruction.** 9 passages of 5 lines, 3 of 6, 2 of 7.
Five shuffled lines is a real puzzle and not a cruel one. 8 are `text`, 6 are
`dialogue`.

**`?passage=` already scopes a session.** `sessionPath(course, { passage: id })`
is written by `PassageScreen` and resolved to item ids by the session screen. So
the routing and the URL contract exist; only the exercise is missing.

**The blocker is one type signature.** `ExerciseGenerator` is
`supports(item: LearningItem, …)` / `generate(item: LearningItem, …)`, and a
`Passage` is not a `LearningItem`. Every one of the six kinds in `EXERCISE_KINDS`
is item-scoped. So the work is not "add a generator" but "let a generator be
about something other than an item" — the same wall a conjugation drill hits,
since a `VerbForm` is not a `LearningItem` either. Worth solving once, for both.

This is deliberately _not_ an argument for giving a passage its own text and
making it an item. The build already refuses that, for good reasons recorded in
`AGENTS.md`: each sentence must stay independently practisable, and mastery
weights a word by how many distinct sentences it appears in, so a passage that
became one long item would corrupt the mastery signal.

## 4. The exercise, concretely

Working name `passage-order`. Given a passage:

- prompt: the passage title, plus its reference-language translation
- parts: the sentences, shuffled with the injected `Rng`
- solution: `passage.items` in declared order
- grading: position-wise, so a learner who gets 4 of 5 sees which one moved

`tap-to-build` is the model to copy — including its lesson about grading. It
excludes punctuation from the tiles because a comma is "a tile you have to
remember to place and a full stop is a tile you cannot get wrong". The passage
analogue: **do not shuffle the speaker labels of a dialogue.** `A:` / `B:`
alternating is a free answer key, so either drop the labels while reconstructing
or keep them fixed as slots and shuffle only the lines into them. The second is
probably better for a dialogue and is the reason `speakers` exists.

Two further modes worth considering, in rough order of appetite:

- **words across the whole paragraph** — the user's original phrasing. Much harder
  than per-sentence, and probably too hard at A1; treat as a later variant, not
  the first cut.
- **cloze at passage scale** — blank one whole line and choose it from four. Cheap
  to build once the kind exists, and it exercises comprehension of the connective
  logic rather than word order.

## 5. Ordering: a real decision, currently made by accident

`PassageScreen` navigates to `preset: 'quick'`, which is `ordering: 'smart'`. So
the lines arrive by memory strength. `presets.ts` (~line 93) explicitly documents
`?order=sequential` as the mechanism "where a passage that has to be read in
order asks for it" — and the passage's own practise button does not pass it.

That looks like an oversight rather than a choice, and it is a one-line fix
independent of everything else in this document. But confirm the intent before
changing it: dealing a passage's lines in reading order every time also means the
learner always meets line 1 first, which is the same complaint that made
`sequential` the wrong default for the Flashcards preset. A reconstruction
exercise wants declared order as the _answer_, not as the deal order, so the two
concerns may not conflict at all.

## 6. Fallout to expect

- **`mode`.** Reconstruction is real retrieval, so it should be `practice` and
  feed the scheduler — unlike the reading screen, which records nothing. But what
  does it record against? The passage is not an item, and progress references item
  ids only (architecture rule 4). Simplest honest answer: record an attempt
  against each sentence, since each was genuinely recalled. Decide explicitly;
  do not let it default.
- **`tests/a11y/agent-surface.test.tsx`** will need the new controls named. A
  reorder interaction is the hardest thing in the app to expose through the
  accessibility tree — drag is not an option. `tap-to-build` solves the sentence
  case by tapping tiles in sequence, and the same pattern should carry over.
- **Coverage floors** in `vite.config.ts` — `src/domain` is held high.
- Session URL round-tripping: `session-url.ts` owns both directions, so a new
  exercise kind reachable by link needs its parameter read as well as written.

## 7. What is still unknown

Genuinely open, and the reason this file says notes rather than briefed:

1. **How to widen `ExerciseGenerator` without weakening it.** A discriminated
   union of subjects (`{kind:'item'} | {kind:'passage'}`) is the obvious move, but
   every generator's `supports` and the whole `ExerciseEngine` map are typed
   against `LearningItem` today, and `composer.ts` chooses kinds per item. Not
   investigated.
2. **How the composer schedules a passage.** It climbs items recognition → cued
   recall → production by memory strength. A passage has no memory state of its
   own. Unresolved.
3. **Whether 14 passages is enough to ship this.** 77 of 592 sentences are in a
   passage. If reconstruction becomes a preset, it exhausts in a handful of
   sessions — so this may need `docs/tasks/dataset-expansion.md` to run first.
4. Whether a `passage` preset belongs in `SESSION_PRESETS` at all, or whether this
   is only ever reached from a passage's own screen.
