# Architecture

The goal of v0.1 is a small, genuinely useful practice app sitting on a
foundation that can grow into a language-learning engine — without a rewrite.

## The three systems

```text
    content                 exercises                learner state
 ┌──────────────┐        ┌──────────────┐         ┌──────────────┐
 │ items        │        │ generators   │         │ item progress│
 │ lexemes      │──────▶ │ grading      │ ──────▶ │ attempts     │
 │ forms/skills │        │              │         │ sessions     │
 │ translations │        └──────────────┘         └──────────────┘
 └──────────────┘               ▲                         ▲
        │                       │                         │
        └────────── session planner ──────────────────────┘
```

- **Content** (`src/domain/content`) describes language. It knows nothing about
  exercises, scoring or the learner.
- **Exercises** (`src/domain/exercises`) are _derived_, never stored. A
  generator answers two questions: can this item support my kind of
  interaction, and what does that interaction look like.
- **Progress** (`src/domain/progress`) references stable IDs only. Scheduling
  lives behind a `Scheduler` interface so a real SRS can replace the current
  interval ladder without touching anything else.
- **Sessions** (`src/domain/sessions`) combine the three: filter content, order
  it, size it, hand it to the engine.

Everything in `src/domain` is pure TypeScript — no React, no DOM, no fetch.
That is what makes it testable and what will make it reusable if the app ever
grows a second front end.

## Layers and dependencies

```text
features/ ──▶ app/ ──▶ domain/
    │           │         ▲
    │           ├──▶ data/ (loading + validation)
    │           ├──▶ storage/ (IndexedDB)
    │           └──▶ audio/ (playback + TTS seam)
    └──▶ components/, utils/
```

Dependencies point inwards. `domain` imports nothing from `data`, `storage`,
`audio`, `features` or `app`.

## Composition root

`src/app/services.ts` is the only place that picks concrete implementations:
which dataset source, which storage backend, which TTS provider. Features
receive them through `ServicesContext` and depend on interfaces. That is what
keeps Rules 7 and 8 (no hard-wired AI, no hard-wired vendor) enforceable rather
than aspirational.

## The validation boundary

Datasets are untrusted input. `src/data/validation` parses every record with
zod before it reaches the domain. Bad records produce issues and are skipped;
cross-record checks (duplicate IDs, dangling references, annotations pointing
at missing tokens) run over the assembled pack. `npm run validate:data` runs the
same code in CI.

## Determinism

Randomness is injected (`src/utils/random.ts`). Given a seed, session ordering
and exercise generation are reproducible — which is why ordering and distractor
selection can be tested at all, and what will make shareable practice sessions
possible later.

## Extension points already in place

| Seam                          | Where                            | For                                    |
| ----------------------------- | -------------------------------- | -------------------------------------- |
| `ExerciseGenerator`           | `domain/exercises/generators.ts` | new exercise types                     |
| `Scheduler`                   | `domain/progress/scheduler.ts`   | SM-2 / FSRS spaced repetition          |
| `DatasetSource`               | `data/loaders/source.ts`         | bundled, remote or user-imported packs |
| `LearnerStorage`              | `storage/types.ts`               | cloud sync behind the same contract    |
| `TtsProvider`                 | `audio/types.ts`                 | higher-quality or cached voices        |
| `SpeechRecognitionProvider`   | `audio/types.ts`                 | pronunciation practice                 |
| `Provenance`                  | `domain/content/provenance.ts`   | community + AI-generated content       |
| Reference-language resolution | `domain/content/language.ts`     | translation packs beyond English       |

None of these are implemented beyond what v0.1 needs. They exist so that adding
them later is additive.

## Deliberately not built yet

Backend, accounts, sync, community submissions, AI tutor, pronunciation
scoring, stories and dialogues — see §29 of the spec. The data model leaves room
for each; the app does not pretend to have them.
