# Lingo — Spanish practice

A free, mobile-first, local-first language practice app. Spanish first, but the
engine is language-agnostic by design.

**See it, hear it, repeat it, reveal it, review it** — in two minutes, on a
phone, offline, with no account.

Status: **v0.1 groundwork**. The architecture, data model, engine and a working
practice loop are in place. Production datasets are curated separately and are
not part of this repository yet (see [`docs/spec`](docs/spec)).

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Then open the printed URL. On a phone, use the network URL from the same Wi-Fi.

## Scripts

| Script                  | What it does                                 |
| ----------------------- | -------------------------------------------- |
| `npm run dev`           | Vite dev server                              |
| `npm run build`         | Type-check and build the PWA into `dist/`    |
| `npm run preview`       | Serve the production build locally           |
| `npm test`              | Vitest (unit + component)                    |
| `npm run typecheck`     | TypeScript, no emit                          |
| `npm run lint`          | ESLint (flat config)                         |
| `npm run format`        | Prettier                                     |
| `npm run validate:data` | Validate every dataset in `public/demo-data` |
| `npm run check`         | Everything above, in the order CI runs it    |

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

public/demo-data/ tiny demo dataset — development fixture, not curriculum
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

The dataset in `public/demo-data/` exists to exercise the engine. It is not
curriculum, and the production datasets will be curated separately.

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
