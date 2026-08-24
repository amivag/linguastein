# Linguastein — Spanish practice

A free, mobile-first, local-first language practice app. Spanish first, but the
engine is language-agnostic by design.

**See it, hear it, repeat it, reveal it, review it** — in two minutes, on a
phone, offline, with no account.

Status: **alpha.** The architecture, engine and practice loop are
in place, with a generated A1–A2 Spanish pack of 2,266 practisable items awaiting
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
├── app/          composition root, routing, the current course, services context
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
├── features/     screens: home, study, browse, read, progress, practice, missions,
│                 settings, sharing
├── components/   shared UI: AppShell, AppNav, Button, CourseBar, ThemeToggle,
│                 PaletteControl, ContrastControl, VoiceInput, TokenizedText,
│                 WordInfoSheet
├── styles/       primitives, one CSS file per palette per mode, one per
│                 contrast level
└── utils/        small helpers (RNG, clipboard)

content/es/      dataset authoring sources (TSV) — the human-edited input
public/packs/    generated, shipped content packs (JSONL + manifest)
public/robots.txt crawl and training opt-outs for the deployed site
docs/             architecture notes, the design language, dataset format,
                  deployment, product spec
tests/            unit and component tests, mirroring src/
scripts/          dataset validation CLI
dist/             build output (git-ignored)
```

## The app

Four destinations behind a tab bar (a rail on wider screens):

| Section  | What it is                                                                                   |
| -------- | -------------------------------------------------------------------------------------------- |
| Study    | the material, in linkable sections: missions, words, phrases, grammar, abilities, categories |
| Test     | where a session starts: the recommended next action, then quick sessions and the six presets |
| Progress | what has been practised, accuracy, weak items, recent sessions                               |
| Settings | five linkable sections: learning, appearance, audio, content packs, about                    |

Browse and Read are sheets _inside_ Study rather than destinations of their own —
search and filter all 2,266 items by category or facet (and dictate the search
with the mic), or open a connected text with every word tappable. Both still work
as deep links.

A running session hides the chrome and fills the screen, so practice stays the
focus rather than the navigation.

The journey is thirteen real-world missions, listed in order on Study: twelve at
A1 and one at A2. Each teaches one connected example, practises its sentences,
then changes the situation for Use. Transfer attempts
feed the same local FSRS schedule as ordinary practice; speech can grade them
automatically, and every device has an explicit self-rating fallback after
reveal. A communicative ability is never called reliable from one memorised
passage alone.

Every mission now includes a **response palette**: several natural ways to
perform its central communicative move, with meaning and pragmatic nuance. Three
high-value options appear first; learners can expand into real café orders,
destinations, clothing needs, hotel details, reactions to plans, morning actions
and answers about how they feel. Speech practice accepts any context-appropriate
response rather than demanding one theatre-script line.

**Variation Labs** go one step further in every mission: learners swap meaningful
slots, listen to the newly composed sentence, then hide the Spanish and produce
it from meaning. The 314 combinations cover wellbeing, café orders, directions,
clothes, hotel stays, making plans and morning routines. They remain transient
study material rather than fake progress-bearing content records.

### Courses are in the URL

Every screen lives under a course — one target language, narrowed to one CEFR
level:

```text
/es/a1              practice, scoped to A1
/es/a1/browse       browse, scoped to A1
/es/all/read/700001 one passage, unnarrowed
/es/a2/session?preset=verbs&size=items:10&focus=struggling
```

A level is a ceiling, not a chapter: A2 keeps A1 material in rotation, because
practising it is review rather than regression. `/` redirects to the course you
left. Only Spanish A1–A2 ships, but the courses on offer are derived from the
packs actually loaded, so a second language pack appears in the picker — and in
the URL — with no code change.

### Asking what something means

Tap a word for its meaning, grammar, the pattern it belongs to, its other forms
and other phrases that use it. Grow the selection a word at a time and you get
what the _run_ of words means — `tener que` is not `tener` — with a word-by-word
breakdown beneath it. Available in practice, reading, Browse, Progress and the
example sentences under a card. A cloze question opens up before it is answered,
since its answer is the blank rather than any word on the card; a multiple-choice
question does not, because the meaning of the sentence is what it is asking.

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

The shipped `core-es` pack covers A1–A2: **126 verbs** with generated forms,
**393 nouns**, **284 modifiers** and **1,638 example sentences** — 2,266 practisable
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

### Speaking back

"Say it" uses the browser's own recogniser, and it is an assist rather than a
gate: every exercise that offers it is still completable by self-rating, and the
control is absent where the browser cannot listen.

Because a recogniser either produces a transcript or produces nothing, the
control shows the microphone level while it listens, and the words it has so far
before it commits to them. That is not decoration — it is the only way to tell
"the page cannot hear you" from "it heard you and made nothing of it", which
have different fixes.

Two things to know if it does not work on a phone:

- **It needs a secure page.** Over plain `http://` — a dev server reached by LAN
  address, for instance — there is no microphone to open at all. The app says so
  rather than blaming the device.
- **The microphone is opened before the recogniser starts.** On Android,
  starting the recogniser does not reliably prompt for the permission, and one
  started without it ends immediately and silently. Asking through
  `getUserMedia` first is what makes the browser ask, and the same stream feeds
  the level meter.

## Design, themes and layout

Six rules, written down in [`docs/design-language.md`](docs/design-language.md)
and enforced by four test files: depth rather than outlines, soft geometry,
overlay rather than push, one display voice, colour that means something, and
motion that confirms without informing. The whole app draws three borders, each
enumerated with the reason it earns one — a test fails on a fourth.

**`/design` in the running app is the live version of all of it**: every colour
role, token, icon and control the build is actually using, read out of the loaded
stylesheets rather than from a list someone has to keep current. Add a token and
it appears there; switch theme and every value re-reads. It is code-split, so it
costs nothing until it is opened, and it is linked from Settings.

Icons are [Lucide](https://lucide.dev) (ISC), behind a seam in
`src/components/icons.ts` — one 24px grid, one stroke weight, tree-shaken per
glyph, and `currentColor` throughout, so no icon can be off-palette.

Appearance is four independent axes rather than one list of themes: light or
dark (defaulting to the OS setting and following it live), which of four
palettes — Indigo, Teal, Plum or Sand — how far apart that palette's neutrals
sit, and the type scale. Keeping them separate is what lets Large text, warm
colours and high contrast be chosen independently instead of as a combined
`dark-teal-large-more` theme.

A palette is two CSS files plus a registry entry; a contrast level restates the
neutral roles as mixes along the palette's own ink-to-paper axis and touches no
hue, so one level serves every palette including ones written later. See
[`docs/theming.md`](docs/theming.md). Colour contrast is asserted for every
palette at every contrast level, so nothing a learner can select ships below
WCAG AA.

The layout is one readable column that widens with the viewport (phone →
tablet → desktop), with hover styles applied only where a pointer can hover and
tap targets that stay at least 44px. Navigation is a tab bar within thumb reach
on a phone and a rail on the left once there is room — always visible, never a
hamburger. Any panel that expands is a sheet on a phone and a centred dialog on a
larger screen, so the height of a screen is never a function of what is open.

## Accessibility

WCAG 2.2 AA is a build gate, not an aspiration:

- axe runs over every screen in `tests/a11y` and must report zero violations
- colour contrast is computed from the stylesheets and asserted for every
  palette at every contrast level
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

Live at **https://amivag.github.io/linguastein/**. A push to `main` checks, builds
and uploads `dist/` as a GitHub Pages artifact — about a minute. Because a project
page is served under `/<repo>/`, the subpath is threaded through the build from a
single `BASE` constant in [vite.config.ts](vite.config.ts); the dev server uses it
too, so a base-path mistake surfaces locally. Setup, the one Pages setting that
matters, and the rough edges: [docs/deploy.md](docs/deploy.md).

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

**On model training:** no open licence prevents it, this one included, and scrapers
do not read licences. The repository is public, so the `robots.txt` and `<meta>`
opt-outs are the only signals sent and both are advisory. A deliberate trade, made
in exchange for free hosting — the reasoning is in
[docs/deploy.md](docs/deploy.md#on-the-source-being-public).
