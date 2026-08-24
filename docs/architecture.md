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
  lives behind a `Scheduler` interface, implemented by FSRS
  (`domain/progress/fsrs.ts`), so the algorithm can be replaced without
  touching anything else.
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

`src/languages/<tag>/` holds language-specific morphology (Spanish conjugation,
plurals, adjective agreement). The engine never imports it; the dataset build
does. That is what keeps the engine language-agnostic while still letting the
Spanish pack ship 2,000 generated verb forms.

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

## Updates and caching

The app is aggressively cached by design — it has to work offline — so shipping a
fix means being deliberate about how the old copy is replaced.

**Version.** `package.json` is the single source of truth. `vite.config.ts`
injects it, with the short commit and build time, through `define`; `src/app/version.ts`
is the only module that reads those globals. Nothing imports `package.json` at
runtime, and no constant is hand-copied, so the string in Settings cannot drift
from the package that produced it. Override `LINGUASTEIN_BUILD_COMMIT` or
`LINGUASTEIN_BUILD_TIME` for a reproducible build.

**JS and CSS.** Content-hashed by Vite (`index-Bmm2NiPE.js`), so a changed file is
a new URL and can be cached forever. Nothing extra is needed here, and adding a
query-string cache-buster on top would only defeat the hashing.

**The two files that cannot be hashed** are `index.html` — it is what names the
hashed assets — and `sw.js`. Both must be served with a short or no-store cache
policy at the HTTP layer, or a stale `index.html` will keep pointing at assets
that no longer exist. That is a hosting-header concern; no amount of build
configuration fixes it.

**The pack's own version.** Separate from the app's, authored in
`content/es/pack.tsv` and copied into `pack.json` by the build. It is what
`PackSettings` shows beside the app version, which is why it is guarded: as a
literal in the build script it went four expansions without moving, so the file
also records the item count the version was cut at and
`tests/data/pack-version.test.ts` fails when the two disagree.

**Datasets and audio.** Packs are precached by revision, so a rebuilt pack is
refetched. That revision is a content hash of each file, computed at build time
and written into `sw.js` — so it is the _file changing_ that invalidates the
cache, not the version string. Bumping the pack version does not make a client
refetch anything, and forgetting to bump it does not stop one: the two mechanisms
are independent, and only one of them is displayed. Audio is `CacheFirst` for 90 days, which is safe because a clip is named
for a hash of the text it speaks: correcting a sentence produces a different
filename rather than leaving a stale clip behind a stable item id.

**Taking the update.** `registerType: 'autoUpdate'` reloads the page itself the
moment a new worker activates. That is the wrong behaviour here: it can land
mid-answer, and because a session is described by its URL the learner is dropped
back at its start. `main.tsx` passes `onNeedReload` to suppress it, and
`src/app/updates.ts` turns the event into a flag the UI reads — so the app offers
a reload and the person practising picks the moment. The new build is already
cached either way, so nothing is lost by waiting.

Deferring that reload means the page runs the old JS under the new worker until it
is taken. That is safe **because the app builds to a single bundle**: there is no
lazily-imported chunk whose old URL could 404 once the new precache drops it. If
route-level `import()` is ever introduced, revisit this — either take the reload
immediately or keep the previous revision cached.

## Extension points already in place

| Seam                          | Where                            | For                                    |
| ----------------------------- | -------------------------------- | -------------------------------------- |
| `ExerciseGenerator`           | `domain/exercises/generators.ts` | new exercise types                     |
| `Scheduler`                   | `domain/progress/scheduler.ts`   | a different SRS, or per-user weights   |
| `DatasetSource`               | `data/loaders/source.ts`         | bundled, remote or user-imported packs |
| `LearnerStorage`              | `storage/types.ts`               | cloud sync behind the same contract    |
| `TtsProvider`                 | `audio/types.ts`                 | higher-quality or cached voices        |
| `TtsVoice`                    | `audio/types.ts`                 | voice choice, without vendor types     |
| `SpeechRecognitionProvider`   | `audio/types.ts`                 | pronunciation practice                 |
| `MicrophoneLevels`            | `audio/types.ts`                 | live input level, and the permission   |
| `Provenance`                  | `domain/content/provenance.ts`   | community + AI-generated content       |
| Reference-language resolution | `domain/content/language.ts`     | translation packs beyond English       |

None of these are implemented beyond what v0.1 needs. They exist so that adding
them later is additive.

## Deliberately not built yet

Backend, accounts, sync, community submissions, AI tutor, pronunciation
scoring, stories and dialogues — see §29 of the spec. The data model leaves room
for each; the app does not pretend to have them.

Three of those have since been briefed rather than merely deferred, because they
are what the seams above were built for and it is worth knowing which seam pays
out where: [accounts and sync](tasks/accounts-and-sync.md) behind
`LearnerStorage`, and [a native port](tasks/native-port.md) behind
`TtsProvider`, `SpeechRecognitionProvider`, `MicrophoneLevels` and
`DatasetSource`. [Monetisation](tasks/monetisation.md) needs no seam and is
mostly a set of constraints. The router remains the one vendor with no seam
([tanstack-router.md](tasks/tanstack-router.md)), which is why it is named in
both of the first two.
