# Linguastein — Spanish practice

A free, mobile-first, local-first language practice app. Spanish first, but the
engine is language-agnostic by design.

**See it, hear it, repeat it, reveal it, review it** — in two minutes, on a
phone, offline, with no account.

Status: **0.1.0-alpha.1 — alpha.** The architecture, engine and practice loop are
in place, with a generated A1–A2 Spanish pack of 1,043 practisable items awaiting
editorial review (see [`docs/spec`](docs/spec) for the product specification).

Alpha means what it says: anything may change drastically, including the data
model, the stored shape of learner progress and the exercise mix. There is no
migration promise between alpha builds — practice history from an earlier one may
simply be discarded. Do not treat a streak here as durable yet.

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
| `npm run test:coverage` | Vitest with the enforced coverage floors  |
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
├── languages/    Spanish morphology used to generate the dataset
├── data/         dataset loading (JSONL) and the validation boundary
├── storage/      IndexedDB and in-memory implementations of learner storage
├── audio/        audio service, TTS and speech-recognition seams
├── ai/           AI provider seam and learner-context builder
├── features/     screens: home, browse, progress, practice, settings, sharing
├── components/   shared UI: AppShell, AppNav, Button, ThemeToggle, VoiceInput
├── styles/       primitives + one CSS file per theme
└── utils/        small helpers (RNG, clipboard)

content/es/      dataset authoring sources (TSV) — the human-edited input
public/packs/    generated, shipped content packs (JSONL + manifest)
public/_*         Cloudflare Pages routing and headers; robots.txt sits alongside
docs/             architecture notes, dataset format, deployment, product spec
tests/            unit and component tests, mirroring src/
scripts/          dataset validation CLI
dist/             build output (git-ignored)
```

## The app

Four sections behind a tab bar (a rail on wider screens):

| Section  | What it is                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------- |
| Practice | quick sessions and the six practice presets                                                       |
| Browse   | search and filter all 1,043 items, by thematic category or facet; dictate the search with the mic |
| Progress | what has been practised, accuracy, weak items, recent sessions                                    |
| Settings | language, audio and voice, appearance, data — in grouped sections                                 |

A running session hides the chrome and fills the screen, so practice stays the
focus rather than the navigation.

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

The shipped `core-es` pack covers A1–A2: **117 verbs** with generated forms,
**358 nouns**, **218 modifiers** and **592 example sentences** — 1,043 practisable
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

## Themes and layout

Dark and light, switchable from the header or Settings, defaulting to the OS
setting and following it live. Themes are one CSS file each plus a registry
entry — see [`docs/theming.md`](docs/theming.md). Colour contrast for every
theme is asserted in tests, so a new theme cannot ship below WCAG AA.

The layout is one readable column that widens with the viewport (phone →
tablet → desktop), with hover styles applied only where a pointer can hover and
tap targets that stay at least 44px. The word panel is a bottom sheet on a
phone and a centred dialog on a larger screen.

## Accessibility

WCAG 2.2 AA is a build gate, not an aspiration:

- axe runs over every screen in `tests/a11y` and must report zero violations
- colour contrast is computed from the theme files and asserted for both themes
- focus is trapped in dialogs and restored on close; every screen has one
  `<h1>`, one `<main>`, a skip link and a matching document title
- state is exposed through ARIA — `role="status"` for answer feedback,
  `aria-expanded` on word buttons, `role="progressbar"` for session position

The same properties make the app drivable by automated agents, which read the
accessibility tree. See [AGENTS.md](AGENTS.md).

## Speech input

Speaking exercises offer an optional pronunciation check using the browser's
built-in recogniser: free, no API key, nothing to host. It never gates
progress — self-rating remains the way through — and the control is hidden
where the browser cannot listen (Firefox today). Desktop Chrome sends audio to
a Google service for transcription; Android and iOS recognise on device. The
app itself never records, stores or transmits audio.

## Offline

The app is an installable PWA: the shell and datasets are precached, audio is
cached on first play, and all learner state lives in IndexedDB on the device.

## Versions and updates

The app reports its own version in Settings → Data as `Linguastein <version> (<commit>)`,
alongside the version of each loaded content pack — content ships independently of
the app. `package.json` is the source of truth; the build injects it. Changes are
recorded in [CHANGELOG.md](CHANGELOG.md).

JS and CSS are content-hashed, so an update can never be served from a stale
cache. When the service worker has fetched a new build, the app offers a reload
rather than taking one — being thrown back to the start of a session mid-answer is
worse than running a few minutes behind. Details, including the two files that
must not be HTTP-cached: [docs/architecture.md](docs/architecture.md#updates-and-caching).

## Deploying

Hosted on Cloudflare Pages, built from a private repository and gated behind an
email one-time-code so nothing is publicly reachable or crawlable. Every push to
`main` republishes; every branch gets a preview URL to open on a phone. Setup and
the reasoning behind the choice: [docs/deploy.md](docs/deploy.md).

## Licence

Two licences, because code and language content are different things:

| What                            | Licence       | File                               |
| ------------------------------- | ------------- | ---------------------------------- |
| All code                        | AGPL-3.0-only | [LICENSE](LICENSE)                 |
| `content/**`, `public/packs/**` | CC BY-SA 4.0  | [LICENSE-CONTENT](LICENSE-CONTENT) |

Copyright (c) 2026 amivag.

Free and open, with attribution required. The AGPL adds one condition that matters
for a web app: anyone who modifies Linguastein and lets other people use it — over
a network included — has to publish their source under the same licence. Commercial
use is allowed; closed commercial use is not.

That condition binds everyone except the copyright holder. Linguastein may
therefore be offered commercially in future, under separate terms, alongside this
licence. The commitment that goes with that: the basic practice loop stays free,
and the app stays respectful of the person using it — no account, no tracking,
learner state on the device.

Keeping that option open is also why [CONTRIBUTING.md](CONTRIBUTING.md) asks
contributors to sign off on their patches.

**On model training:** no open licence prevents it, this one included. Scrapers do
not read licences. The repository being private is the only real control — see
[docs/deploy.md](docs/deploy.md).
