# Lingo — Spanish practice

A free, mobile-first, local-first language practice app. Spanish first, but the
engine is language-agnostic by design.

**See it, hear it, repeat it, reveal it, review it** — in two minutes, on a
phone, offline, with no account.

Status: **v0.1**. The architecture, engine and practice loop are in place, with a
generated A1–A2 Spanish pack of 845 practisable items awaiting editorial review
(see [`docs/spec`](docs/spec) for the product specification).

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Then open the printed URL. On a phone, use the network URL from the same Wi-Fi.

## Scripts

| Script                  | What it does                              |
| ----------------------- | ----------------------------------------- |
| `npm run dev`           | Vite dev server                           |
| `npm run build`         | Type-check and build the PWA into `dist/` |
| `npm run preview`       | Serve the production build locally        |
| `npm test`              | Vitest (unit + component)                 |
| `npm run typecheck`     | TypeScript, no emit                       |
| `npm run lint`          | ESLint (flat config)                      |
| `npm run format`        | Prettier                                  |
| `npm run build:data`    | Rebuild `public/packs` from `content/es`  |
| `npm run validate:data` | Validate every shipped dataset            |
| `npm run check`         | Everything above, in the order CI runs it |

## Layout

```text
src/
├── app/          composition root, routing, services context
├── domain/       the engine — pure, framework-free, fully tested
│   ├── content/  language model: items, lexemes, forms, skills, translations
│   ├── exercises/exercise generation and grading
│   ├── sessions/ session planning: filters, ordering, sizing
│   └── progress/ learner state and review scheduling
├── data/         dataset loading (JSONL) and the validation boundary
├── storage/      IndexedDB and in-memory implementations of learner storage
├── audio/        audio service + TTS provider seam
├── features/     screens: home, practice, settings, sharing
├── components/   shared UI primitives
├── styles/       design tokens and global CSS
└── utils/        small helpers (RNG, clipboard)

content/es/      dataset authoring sources (TSV) — the human-edited input
public/packs/    generated, shipped content packs (JSONL + manifest)
docs/             architecture notes, dataset format, product spec
tests/            unit and component tests, mirroring src/
scripts/          dataset validation CLI
dist/             build output (git-ignored)
```

## Architecture in one page

Three systems, deliberately kept apart:

1. **Language content** describes the language. It never describes exercises.
2. **The exercise engine** derives interactions from that content — one
   sentence becomes a listening drill, a flashcard, a cloze or a
   multiple-choice question without being stored four times.
3. **Learner state** references stable IDs only, so datasets can grow and
   change without invalidating progress.

Details and the rules that keep it that way: [`docs/architecture.md`](docs/architecture.md).

## Data

Canonical content is JSON + JSONL (`docs/dataset-format.md`). Everything read
from a dataset passes through the validation boundary in
`src/data/validation`; malformed records are reported and skipped rather than
breaking a session.

The shipped `core-es` pack covers A1–A2: **100 verbs** with generated forms,
**339 nouns**, **172 modifiers** and **443 example sentences** — 845 practisable
items in total.

Humans author compact TSV in `content/es/`; `npm run build:data` derives
everything mechanical from it — conjugations, plurals, adjective agreement,
stable ids, sentence tokenisation, lexeme links, grammar-pattern annotations and
translation records. Nobody hand-types `hablábamos`. CI fails if the generated
pack drifts from its sources.

The pack is machine-generated and carries `source: generated, review:
unreviewed` in its manifest. It is good enough to practise with, and it is not
yet reviewed curriculum. See [`docs/dataset-format.md`](docs/dataset-format.md).

## Audio

Reviewed, pre-generated audio is preferred and cached. Where a dataset has no
audio yet, the app falls back to device speech synthesis. No TTS vendor is
referenced above `src/audio/` — providers are injected at the composition root.

Device speech is chosen carefully: the browser's voice list loads
asynchronously, so the app waits for it before speaking, and it will only use a
voice that actually speaks the target language. If a device has no Spanish
voice installed, the app stays silent and says so — reading Spanish with an
English voice teaches the wrong pronunciation. Settings lists the available
voices and lets a learner pick one.

Installing a Spanish voice:

- **Windows** — Settings → Time & language → Speech → Manage voices → Add
  voices → Spanish (then restart the browser)
- **macOS/iOS** — System Settings → Accessibility → Spoken Content → System
  Voice → Manage Voices → Spanish
- **Android** — Settings → Accessibility → Text-to-speech output → install the
  Spanish voice data

## Offline

The app is an installable PWA: the shell and datasets are precached, audio is
cached on first play, and all learner state lives in IndexedDB on the device.

## License

MIT — see [LICENSE](LICENSE).
