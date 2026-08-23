# Task: the past-tense mission

A briefed, ready-to-start task. Everything blocking it is a **content** question,
and each one is answered below.

## Why this is the next mission and not one of the last six

Thirteen missions exist. Twelve are A1 and one — saying what hurts — is A2,
because the exchange that teaches it needs `¿desde cuándo?` and an answer in the
past. That is the only place in the app where a learner meets the past tense
inside a communicative goal rather than as a grammar sheet.

"Tell someone about a trip" is the obvious next mission and was deliberately left
out of the last batch, for a reason worth writing down: **the content is not there
yet.** The other five were buildable because their vocabulary already was —
travel had 148 items before `buy-a-ticket` was authored, family 37 before
`introduce-your-family`. The past tense has one passage and thin verb coverage,
so authoring the mission first would mean inventing the language it teaches at the
same time as the sequence that teaches it. That is how a mission ends up drilling
whatever its author happened to write.

## What exists today

- **`700006 El verano pasado`** — a five-line monologue text, A2, topic `travel`.
  The seed. It is the only passage nothing points at that is worth pointing at.
- **`700005 No me siento bien`** — five lines in the preterite and imperfect
  (`Ayer no me sentí bien`, `Me dolía la cabeza y tenía fiebre`, `No pude dormir`,
  `fui al médico`, `Me dio una medicina`). Not a trip, but the best worked example
  of narrating a past episode the pack has.
- **`trabajo-ocupado` (700042)** — the independent rung of `your-work`, authored
  in the past on purpose: `Llegué`, `Tuve`, `No pude`, `Terminé`. Proof that the
  narration model carries a past-tense rung.
- Study's Grammar section already offers `pretérito indefinido` and
  `pretérito imperfecto` as generated skills, so the tenses are practisable —
  as tenses. Nothing yet says what a learner can _do_ with them.

## The blocking unknown, resolved

**How many past-tense verb forms does the pack actually have, and are they
irregular?** `src/languages/es/conjugation.ts` plus the irregularity table
generate every form, and the build refuses a conjugation typed by hand — so the
answer is not "author them", it is "check the table covers the verbs the mission
needs, and add irregulars entries where it does not". `npm run review:data`
already reports the gap: eighteen words no lexeme claims, "mostly irregular
preterites (`fue`, `fui`), infinitive+pronoun forms and conditionals". Close that
list first; it is the same work.

## Shape

Four communicative functions, in `content/es/skills.tsv`, level `a2`:

| slug                    | label                      | what the learner can do               |
| ----------------------- | -------------------------- | ------------------------------------- |
| `open-a-past-story`     | Empezar a contar algo      | Set when and where it happened        |
| `say-what-happened`     | Decir qué pasó             | Report the events in order            |
| `describe-the-scene`    | Describir cómo era         | Say what things were like (imperfect) |
| `react-to-a-past-story` | Reaccionar a lo que cuenta | React, and ask one follow-up          |

The last two are the point. A learner who only has the preterite narrates a list
of events; the pair — what happened against what things were like — is the actual
A2 ability, and it is why this mission earns four functions rather than three.

Taught passage: `700006`, with skills declared on its five existing rows (they
carry none, like `medico` did). Then three transfer passages, and here the ladder
should **cross topics rather than change details**, which no mission does yet:

1. **guided** — a weekend rather than a summer. Same shape, shorter span.
2. **guided** — a dialogue, not a monologue: someone asks `¿Qué hiciste el fin de
semana?` and the learner answers. Moving between the two models inside one
   mission is new, and this is the mission that justifies it.
3. **independent** — recount something that went wrong, from intention cues. This
   is where `describe-the-scene` stops being decorative: `Llovía y no había taxis`
   is the reason the story is worth telling.

One response palette on `say-what-happened`, eight options minimum
(`shipped-packs.test.ts` and `missions.test.ts` both enforce it), authored in
`sentences-response-palettes.tsv` with a `note` per option.

One variation pattern in `src/app/mission-variations.ts`. Every choice needs a
visible target — `variations.test.ts` refuses an empty one, because a slot renders
as a `<select>` and an empty option is a blank line rather than a choice.

## What the tests will make you update

Landing a mission is not only content. In order:

1. `npm run build:data` — assigns ids and writes them back. It rejects duplicate
   text across the whole corpus, an undeclared topic or skill, and a conjugation
   the generator would not produce.
2. `tests/data/shipped-packs.test.ts` — every declared capability must be
   teachable in **every** situation, and every palette option must carry the
   capability it is offered for.
3. `tests/domain/variations.test.ts` — the mission id joins the key list, and the
   combination total changes.
4. `tests/domain/missions.test.ts` — the A1 ordering assertion counts missions;
   an A2 mission does not join it.
5. `tests/data/doc-stats.test.ts` — the sentence and item counts quoted in
   `README.md` and `docs/roadmap.md` must match the pack again.
6. `tests/data/authored-skills.test.ts` — add the new group; the A1 assertion
   hard-codes `level: 'a1'`, so an A2 group needs its own check, as `healthIds`
   has.

## What not to do

- Do not add an entry to `content/es/reviewed.tsv`. The pack is
  `source: generated, review: unreviewed`, and a sign-off for content nobody read
  destroys the one signal that distinguishes checked material from generated
  material.
- Do not give the passage its own copy of its text. Membership is the `passage`
  column on a sentence row; the build derives the container and fails on a copy.
- Do not reach for A2 vocabulary the pack lacks in order to make a line read
  better. Add the word to `nouns.tsv` or `verbs.tsv` first, or write the line with
  what exists — an unlinked word is reported by `review:data` for a reason.
