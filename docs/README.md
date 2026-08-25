# Docs

A map, because there are now more than thirty files here and the useful question
is never "what exists" but "which one answers this".

[AGENTS.md](../AGENTS.md) at the repository root is still the file to read first.
Everything below either expands one of its sections or is a task brief.

## Start here

| If you are about to…                         | Read                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| change any code at all                       | [AGENTS.md](../AGENTS.md) — commands, rules, layout                        |
| touch a screen, a route or a query parameter | [screens-and-urls.md](screens-and-urls.md)                                 |
| add or edit a row of content                 | [content-authoring.md](content-authoring.md)                               |
| change what a content record can contain     | [dataset-format.md](dataset-format.md)                                     |
| style anything                               | [design-language.md](design-language.md), and `/design` in the running app |
| add a palette, a contrast level or an axis   | [theming.md](theming.md)                                                   |
| move a layer or add a dependency             | [architecture.md](architecture.md), [skeleton.md](skeleton.md)             |
| start a new app from this repository         | [skeleton.md](skeleton.md)                                                 |
| deploy, or debug a base-path problem         | [deploy.md](deploy.md)                                                     |
| pick up the next piece of work               | [roadmap.md](roadmap.md), then a brief in [tasks/](tasks/)                 |

## Reference

- **[architecture.md](architecture.md)** — the three systems, the layer
  dependencies, the validation boundary, determinism, and how updates and caching
  work. Read the caching section before changing `registerSW` options, the
  Workbox config, or introducing a lazily-imported chunk.
- **[screens-and-urls.md](screens-and-urls.md)** — Home, Study, Browse, Read,
  Settings, the learner's own section, courses in the path, and what narrows a
  session. Every URL spelling and which module owns it.
- **[content-authoring.md](content-authoring.md)** — the TSV sources and the
  build that derives a pack from them: ids, the conjugator, topics and skills,
  the alphabet module, audio as a ledger, one build for many languages.
- **[dataset-format.md](dataset-format.md)** — the record half of the above: the
  columns, the JSONL shapes, the manifest, the validation rules.
- **[design-language.md](design-language.md)** — the six rules, and the four test
  files that enforce them.
- **[theming.md](theming.md)** — appearance as five independent axes, the colour
  roles, and how a palette is solved rather than picked.
- **[skeleton.md](skeleton.md)** — what in this repository is generic and what is
  this app, for scaffolding a new project. Also the honest list of known gaps.
- **[deploy.md](deploy.md)** — GitHub Pages, the one setting that matters, the
  subpath, and the rough edges.
- **[roadmap.md](roadmap.md)** — the feature inventory: what is in place, what is
  next, and what the architecture allows but the code does not attempt.
- **[spec/](spec/)** — the original product and technical specification. It is a
  **founding document, not a current one**: where it and the code disagree, the
  code and the docs above win. Useful for the reasoning behind a decision, and
  for §28's v0.1 requirements, which [roadmap.md](roadmap.md) tracks against.

## Tasks

Briefs in [tasks/](tasks/), each written so a fresh session can pick it up
without archaeology. **Every one opens with a `Status:` line** — that line is the
first thing to read and the first thing to update when the work moves.

Roughly by state, as this index was written:

- **Landed, kept for the reasoning** — [verb-cards.md](tasks/verb-cards.md),
  and the landed stages of [practice-batches.md](tasks/practice-batches.md) and
  [learner-profile.md](tasks/learner-profile.md).
- **In progress** — [numerals.md](tasks/numerals.md),
  [game-feel.md](tasks/game-feel.md),
  [canonical-audio.md](tasks/canonical-audio.md) (both code halves done; nothing
  generated), [second-language.md](tasks/second-language.md).
- **Briefed, not started** — [dataset-expansion.md](tasks/dataset-expansion.md),
  [past-tense-mission.md](tasks/past-tense-mission.md),
  [feelings-mood-state.md](tasks/feelings-mood-state.md),
  [function-words.md](tasks/function-words.md),
  [more-missions.md](tasks/more-missions.md),
  [pack-addressing.md](tasks/pack-addressing.md),
  [tanstack-router.md](tasks/tanstack-router.md),
  [accounts-and-sync.md](tasks/accounts-and-sync.md),
  [native-port.md](tasks/native-port.md),
  [monetisation.md](tasks/monetisation.md),
  [language-matrix.md](tasks/language-matrix.md).
- **Notes and surveys** — [stack-survey.md](tasks/stack-survey.md),
  [passage-practice.md](tasks/passage-practice.md).

## Elsewhere in the repository

- **[CHANGELOG.md](../CHANGELOG.md)** — changes to the **app**, newest first.
  Feature inventory lives in [roadmap.md](roadmap.md) instead, and dataset growth
  in the pack's own counts.
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — the gate, and the sign-off every
  commit needs.
- **`.audit/`** — dated, point-in-time review records with their screenshots.
  Historical evidence, not current description; each says so at the top.
