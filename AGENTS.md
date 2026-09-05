# Working in this repository

Guidance for AI agents and new contributors. Read this before changing code.

## Commands

```bash
npm run dev            # dev server
npm run check          # typecheck + lint + test + validate:data + format — run before finishing
npm run format         # write Prettier's formatting, rather than only checking it
npm test               # vitest
npx vitest run tests/a11y   # accessibility suite alone
npm run build:data     # regenerate public/packs from content/es
npm run build:data -- <tag>  # …or from content/<tag>, with only that language's
                             # module loaded. `es` is the only one authored today;
                             # the seam is proven by a fixture, not by a second pack
npm run review:data    # editorial review aid: content questions, by exception
npm run build          # production PWA build
```

`npm run check` is the gate. If it passes, the change is landable; if it fails,
fix it rather than working around it.

That claim only holds while the gate runs **every** step CI runs, in the same
order, so keep the two together when either changes. It has come apart twice.

First `check` omitted `format:check` while `.github/workflows/ci.yml` ran it
third, ahead of the tests, the dataset checks and the build. Fourteen commits
landed on `main` with the formatting step red — and because a failed step skips
the ones after it, none of those commits had its tests or datasets verified by CI
at all. A gate that is a subset of CI is worse than no gate, because it is
believed.

Then `check` omitted `npm run build`, which is how the B1 dataset reached `main`
red: the sentences file crossed 2.65 MB, Workbox refuses to precache anything
over 2 MiB, and the production build failed on a change whose gate had passed
locally. The fix to the first drift had also been overstated — formatting was
called "last" while `Build` still sat behind it, so a whitespace failure could
still skip the step that catches a broken bundle.

So: the gate now runs `build`, formatting is genuinely last in both, and there is
exactly **one** CI step the gate does not run — "Datasets match their sources",
which needs a clean working tree to diff against and cannot work mid-change. If
you add a CI step, add it to `check` too, before `format:check`.

## This repository is also a skeleton

Other applications are scaffolded from it, so the base — structure, tooling,
design system, test harness — is kept app-agnostic on purpose.
[docs/skeleton.md](docs/skeleton.md) is the map: what is generic, what is this
app, and the order to do things in when starting a new project. Read it before
adding a dependency or moving a layer.

Two consequences for ordinary work here:

- **App identity lives in one file.** `src/app/identity.ts` holds the name, the
  machine id and the base path; the IndexedDB database, the `localStorage`
  prefix, document titles, the PWA manifest, the service-worker cache names and
  `index.html` (through a build-time `%APP_ID%` substitution) all derive from it.
  Never type the app's name into a component.
- **Prefer a rule that bites to a rule that is written down.** Where an
  architectural decision can be expressed as a lint rule or a test that reads the
  source, express it that way — the list below is enforced, not merely stated.

## Architecture rules

These are load-bearing. Breaking one is a design change, not a refactor. Rules
1, 5 and the icon seam are enforced by `.oxlintrc.json`; a violation fails
`npm run lint` rather than waiting for review.

1. **Content, exercises and learner state are separate systems.** `src/domain`
   is pure TypeScript — no React, no DOM, no fetch, no vendor SDKs.
2. **Exercises are derived, never stored.** One sentence becomes a flashcard, a
   cloze or a multiple-choice question through `domain/exercises/generators.ts`.
   If you find yourself adding an exercise-shaped field to a content record,
   stop.
3. **Store semantic data, derive presentation.** Tokens carry ids and order;
   character offsets are computed at render time.
4. **Progress references stable ids only** (`core-es:item:000123`), so datasets
   can change without invalidating what a learner has done. A record also stores
   the `packId` that id already contains — that is the one permitted
   denormalisation, and only because an IndexedDB index is built from a stored
   key path: without it, "how much of this course have I done?" can be answered
   only by materialising every item id in the course. Derived facts may be
   stored where a query needs them; content may not.
5. **No vendor above a seam.** TTS, speech recognition, storage, dataset source
   and AI all sit behind interfaces chosen once in `src/app/services.ts`.
6. **English is the first reference language, not a structural requirement.**
   Translations are separate records resolved through a fallback chain.
7. **Randomness is injected** (`src/utils/random.ts`) so sessions are
   reproducible under a seed.
8. **A course is a scope, not a partition.** One target language, narrowed to one
   CEFR level, derived from the packs actually loaded (`domain/content/course.ts`).
   Level is a _ceiling_ — `a2` means "a2 and below" — and the whole thing reduces
   to an `ItemFilter`, so nothing downstream needs to know courses exist.
   Progress is untouched by it: records reference item ids, which carry their
   pack, so switching course can never invalidate what has been practised.

   **A setting is a property of the device or of a course, and the difference is
   load-bearing.** `Preferences` holds what belongs to the person — their name,
   the reference language, the theme, which course `/` reopens — and `CourseState`
   holds what belongs to one course, keyed by target language: the level, the
   chosen categories, the practice focus, the accent and the voice. Five of these
   were global once, and it was not a tidiness problem: Spanish-at-A2 and
   French-at-A1 cannot both be true of one `level`, a topic slug is pack
   vocabulary, and a device voice that reads Spanish cannot read French. Read
   course state through `useCourse()` — never from `preferences` — so a screen
   gets this course's answer by construction rather than by remembering to narrow
   a global one.

## Layout

```text
src/app/         composition root, routing, the current course (`course.ts`)
src/domain/      the engine (content, exercises, sessions, progress, missions,
                 batches)
src/languages/   language-specific morphology and the alphabet, behind two
                 interfaces: `types.ts` is the build's half (`index.ts` loads one
                 by tag) and `runtime.ts` is the screens' half. Not engine
src/data/        dataset loading + the zod validation boundary
src/storage/     IndexedDB and in-memory LearnerStorage, plus `transfer/` — the
                 export file's format, and the merge that reads one back in
src/audio/       audio service + TTS seam
src/ai/          AI seam and learner-context builder (no vendor, no network)
src/features/    screens: home, study, browse, read, progress, practice, missions,
                 settings (one file per section), sharing. `search/` is the one
                 that is not a screen: the box, the results and the `?q=` codec,
                 rendered by Home and movable to any section
src/components/  shared UI: AppShell, AppNav, Button, Chip, Sheet, Icon, CourseBar,
                 ThemeToggle, PaletteControl, ContrastControl, ReadingSizeControl,
                 VoiceInput, TokenizedText, WordInfoSheet and
                 useWordSelection (used by practice, reading, browse and progress
                 alike). `icons.ts` is the icon-set seam
src/features/design/  the live style guide at /design
src/styles/      primitives, shared surface recipes, the token reader, the
                 categorical hue assignment (kinds.ts), one file per palette per
                 mode (themes/) and one per contrast level (contrast/)
content/         capabilities.tsv — the language-neutral capability registry,
                 shared by every language rather than owned by one
content/es/      hand-authored dataset sources (TSV)
public/packs/    GENERATED datasets — never edit by hand
```

## Screens and URLs — [docs/screens-and-urls.md](docs/screens-and-urls.md)

Home, Study, Browse, Read, Settings, the learner's own section, courses in the
path and what a session practises: **420 lines, moved out of this file when it
passed seventy kilobytes.** Read it before touching a screen, a route or a query
parameter. What survives here is the shape of it, because these four bite even
when you are working somewhere else:

- **The URL is the state.** A screen is an address; a session is fully described
  by its query string, so it can be reloaded, shared, scripted and driven by an
  agent. Each spelling is owned by exactly one codec — `session-url.ts`,
  `browse-url.ts`, `read-url.ts`, `study-url.ts`, `settings-url.ts` — and links
  are built through it (`coursePath`, `sessionPath`, `studyPath`,
  `settingsPath`), never by concatenation.
- **A focus is a bias, never a filter.** It reorders the planner's buckets, so it
  cannot hand back an empty session. The speaker's gender and a search's course
  scope follow the same rule. Turning one into a filter is the mistake this shape
  exists to prevent.
- **Nothing on a screen is a hard-coded list.** Word kinds, categories, grammar
  patterns, the Study section list and the courses on offer are all counted from
  the packs actually loaded, and a count of zero is not offered. The one
  exception is the alphabet, which is a property of the language rather than of
  the content, and is decided synchronously by `alphabetGuide(tag)`.
- **Back may cost a learner one step, and never two** — and it may never land
  them somewhere they have not been.

## Authoring content — [docs/content-authoring.md](docs/content-authoring.md)

The TSV sources, the build that derives a pack from them, ids, the conjugator,
the topic and skill registries, the alphabet module, audio as a ledger: **335
lines, moved out with the above.** Read it before adding or editing a row. Its
companion is [docs/dataset-format.md](docs/dataset-format.md), which owns the
record shapes rather than the authoring rules. Three things bite from outside it:

- **`content/es/*.tsv` is the source of truth**; `public/packs/**` is generated by
  `npm run build:data` and CI fails if the two disagree.
- **An item id is permanent.** Progress references it, so a row keeps its id
  through a typo fix, a reordering or a move to another file; a deleted row's id
  is retired rather than reused. Leave the id column **off** a new row — off, not
  empty — and the build assigns one and writes it back.
- **Never type a conjugation, a plural, an agreement or a numeral by hand.** They
  come from `src/languages/<tag>/`, and the build refuses a spelling the module
  would not produce.

## Accessibility is the agent interface

The app is driven through the accessibility tree by screen readers and by
automated agents alike, so the same rules serve both:

- every control has a stable accessible name (`tests/a11y/agent-surface.test.tsx`
  fails otherwise), and a name has to be _pickable_: a screen showing several
  phrases passes `contextLabel` to `TokenizedText` so its words are named
  `About “Tengo” in “Tengo que trabajar.”` rather than offering four controls
  called the same thing
- state is exposed as ARIA — `role="status"` for results, `aria-expanded` on
  word buttons, `aria-pressed` on the course and category chips,
  `role="progressbar"` for session position — never colour alone
- a value that changes every second is not a live region. The session timer is
  `role="timer"` with its reading in the accessible name and no `aria-live`; the
  total is announced once, on the summary, where it is news
- each screen has exactly one `<h1>`, one `<main>` and a matching document title
- session state lives in the URL
  (`/es/a1/session?preset=verbs&size=items:10&due=1`), so a session can be
  resumed, shared or scripted. `src/features/practice/session-url.ts` owns both
  directions — build links with `sessionPath` rather than by hand, so a
  parameter cannot be written that the screen does not read
- colour contrast is asserted for every _combination_ of palette and contrast
  level by `tests/a11y/contrast.test.ts`, which discovers both from their
  directories. Where a boundary is drawn at all it uses `--color-border-strong`
  (3:1) for a control and `--color-border` for decoration — but see rule 1 of the
  design language: almost nothing draws one
- `tests/a11y/design-language.test.ts` enumerates every remaining border and
  fails on a new one, and refuses a hard-coded colour outside a theme file
- a render that throws is caught by `src/app/ErrorBoundary.tsx` and reported as
  an `role="alert"` screen with a reload, rather than as a blank page. It clears
  no stored state and phones nothing home; `onError` is the seam if a project
  ever wants reporting

Run `npx vitest run tests/a11y` after any UI change.

## The learning model

Three pieces decide what a learner sees, and they are separable on purpose:

- **Scheduling** (`domain/progress/fsrs.ts`) models memory stability and item
  difficulty, so intervals adapt per item. Weights are FSRS defaults awaiting a
  per-user fit against the attempt log we already store.
- **Composition** (`domain/sessions/composer.ts`) decides _how_ each item is
  practised: items climb recognition → cued recall → production as their memory
  stabilises, and drop back after a lapse. It also breaks up runs of one
  exercise type. Do not reintroduce a fixed preference order — that produced
  multiple choice on effectively every item.
- **Mastery** (`domain/progress/mastery.ts`) infers strength for words and
  patterns from item history, weighted by how many different sentences a word
  appears in. It is derived, never stored.

Recognition is the weakest retrieval mode and the most flattering; prefer
production wherever the data supports it.

A choice a learner can eliminate without knowing any Spanish is not a choice.
`distractors()` in `domain/exercises/generators.ts` ranks candidates by how much
they resemble the answer — surface form first (a question is offered against
questions; the lone `?` in a list of four _is_ the answer), then item type,
level, theme and comparable length. It is a score, not a cascade of filters, and
deliberately so: questions are thin in any pack, and a hard "same topic and same
form" filter would starve the choices, which is easier still. Do not promote
theme back above form — that is the bug this replaced.

A graded card hides what it is grading, and nothing else. Every word of every
phrase is tappable on every screen, practice included — the alternative made the
one screen a learner is actually studying on the only place "what is this word?"
had no answer. So the _sheet_ withholds instead of the text: a multiple-choice
card grades a meaning, so `WordInfoSheet meanings={false}` drops the gloss, the
pattern's explanation and the example translations (one seam,
`InspectOptions.meanings`, rather than four call sites deciding separately), and
says so, because an entry that is silently empty reads as an unknown word. A cloze
grades a _form_ and already renders it as the blank, so its sheet hides nothing.

A **study** session (`mode: 'study'`, e.g. the Flashcards preset, and where Browse
sends you) records nothing: no attempt, no progress, no session row, and no score
at the end. A self-rated reveal is not evidence of retrieval, and browsing must
not reschedule what it happened to show. Only `mode: 'practice'` feeds the
scheduler. `maxNewItems` caps unseen material in an open-ended session, and is
deliberately not applied when the learner picked the set — capping a 12-sentence
passage at 8 would quietly practise two thirds of it.

## Versioning

`package.json`'s `version` is the only place the app's version is written. The
build injects it (plus the short commit and build time) via `define`, and
`src/app/version.ts` is the only module allowed to read those globals — do not
import `package.json` at runtime or copy the number into a constant.

Releasing is: bump `version`, move the `Unreleased` section of
[CHANGELOG.md](CHANGELOG.md) under the new number, commit, tag. Settings shows
`Linguastein <version> (<commit>)`, which is what a bug report should quote.

**A pack carries its own identity, because it is an add-on.** Once a pack can come
from somewhere other than this build, "who made the thing I installed, which cut
is it, and how old is that cut" are questions the app has to answer. `id`, `name`
and `levels` are derived; `version` and `updated` are authored on one row of
`content/es/pack.tsv`; `authors` is a list in `content/es/authors.tsv`, one row per
contributor with a role, the same shape `voices.tsv` will take when audio ships.

Two rules hold that, and both are asserted. **`updated` is authored, never
stamped**: the build must be reproducible, CI fails when a rebuild changes
`public/packs`, and a date read from the clock would make every build differ from
the last. It costs nothing to author, because the item-count guard already forces
an edit to that row whenever content moves — which is exactly when the date should
change. The build rejects a shape that is not `YYYY-MM-DD`, a day that does not
exist (`2026-02-31` matches the pattern and is not a date, so the check round-trips
through `Date`), and a date in the future. And **`authors` is a list with roles
rather than one string**, for the reason `voices.tsv` is a list: a generated pack's
honest author is a tool, `generation` beside a name is not the same claim as
`content`, and one field would flatten both into something wrong in at least one
direction. Do not credit a person for generated material.

Content packs version separately in their own `pack.json` — a dataset can ship
without an app release, and does. That version is authored in
`content/es/pack.tsv`, beside the content it describes, along with the item count
it was cut at. It used to be a literal in `scripts/build-dataset.ts` and was
written exactly once: the pack grew from 443 sentences to 1,395 across four
expansions still calling itself `0.1.0`, and Settings showed that number to every
learner. The count is what stops a repeat — the build reports a disagreement and
`tests/data/pack-version.test.ts` fails on one, so changing what the pack
_contains_ forces an edit to the file the version lives on. A wording fix changes
no count and needs no bump.

**A pack's meanings version separately again**, one level further down. A
translation set is keyed `(pack, reference language)` and lives at
`packs/translations/<pack>/<language>/<version>/`, versioned in its path from a
row in `content/es/translations.tsv` and listed in `catalog.json` — never in
`pack.json`, which is the point: anything the pack names is something that has to
be edited, and the pack re-versioned, to add a language. A reworded gloss ships as
a new translations URL and no device re-downloads 6.4 MB of unchanged Spanish for
it. Same two guards as `pack.tsv`: an authored date, and a record count that makes
the build report a version left behind by its content. A row is required rather
than defaulted, because a unit with no version would ship at `0.0.0` and the next
build would overwrite it at the same URL. `translations` is a reserved pack id.

JS and CSS are content-hashed, so they need no cache-busting of their own.
`index.html` and `sw.js` cannot be hashed and must be served no-store; a service
worker update is offered to the learner rather than force-reloading the page. The
reasoning is in [docs/architecture.md](docs/architecture.md#updates-and-caching) —
read it before changing `registerSW` options or the workbox config.

## Theming

Appearance is **five independent axes**, never one combined id: `data-theme`
(light/dark), `data-palette` (which hues), `data-contrast` (how far apart the
neutrals sit), `data-intensity` (how loud the hues are) and `data-reading-size`
(the type scale). Combining them would need `dark-teal-large-more-vivid`, and
every palette added would multiply the files.

**One mechanism, five uses.** An axis is a declaration through `defineAxis` in
[`src/styles/appearance.ts`](src/styles/appearance.ts) — a key, a closed set of
values, a default — and the storage key, the validator and the `apply` that writes
the root attribute come with it. [`src/styles/axes.ts`](src/styles/axes.ts) lists
all five. Adding an axis is a declaration plus a control; it used to be six
places, five of which were copies of something.

Palettes are colour-only and live in `src/styles/themes/<palette>-<mode>.css`,
registered in `src/styles/themes.ts`; contrast levels live in
`src/styles/contrast/<level>-<mode>.css`, registered in `src/styles/contrast.ts`.
Primitives (spacing, type, layout) are axis-independent and belong in
`primitives.css`. Never hard-code a colour in a component — use a role token, and
add a role rather than inventing a one-off.

**Palettes are solved, not picked.** `npm run build:palette` finds values from a
handful of hue angles. A palette is a few hundred contrast constraints, and hand
tuning converges on mud — the colours that are easy to find by eye are the
desaturated ones, because those are the ones with contrast to spare. Adding one is
documented in [docs/theming.md](docs/theming.md).

Five rules do the load-bearing work, and all five are asserted:

- **A contrast level declares no hue.** It restates the neutral roles as mixes
  along the palette's own `--color-ink` → `--color-paper` axis, which is what lets
  one level serve a palette written after it — More contrast in Sand stays warm
  instead of turning grey.
- **An intensity declares no neutral.** The mirror of the rule above, and what
  lets the two compose instead of fighting: one owns the neutrals, the other owns
  the hues. Intensity blocks live _inside_ each palette file, because a custom
  property cannot refer to itself — so a new palette has to generate its own, and
  the test fails until it does. Re-run `npm run build:palette -- intensity` after
  editing a palette's hues by hand.
- **Every combination is checked, not just the default.** `contrast.test.ts`
  discovers palettes from the directory and holds each to WCAG AA at every
  contrast level × every intensity, evaluating the `color-mix` itself. Soft is
  quieter, not less legible, and the levels are asserted to come out in order.
- **Colours that mean different things stay apart.** A WCAG ratio is a
  _lightness_ comparison, so a crimson accent and a crimson `danger` can pass
  every floor and still be the same colour to look at. The test measures the six
  meaning pairs in OKLab with lightness excluded. It caught three generated
  palettes on the day it was written, two of which had to be redesigned rather
  than nudged: a palette whose identity _is_ crimson cannot coexist with a crimson
  verdict.
- **A preview is the real palette.** Each palette file also selects a
  _descendant_ carrying `data-palette`, so the settings pickers show live palettes
  and live intensities with no colour leaving `src/styles/themes/`. Never build a
  swatch from a hex.

`<html>` always carries all five attributes. The pre-paint script in `index.html`
cannot import a module, so `vite.config.ts` **injects** the axis registry into it
as `%APPEARANCE_AXES%`, the same way it injects the app id. That used to be a
literal copy of every list guarded by a drift test; the copy is gone, and the test
now only checks that nobody puts it back.

## The design language

[docs/design-language.md](docs/design-language.md) is the written version;
**`/design` in the running app is the live one** — every token, icon and control,
read out of the stylesheets the build is actually using, so it cannot drift.
Open it before styling anything.

Six rules, and four test files enforce them:

1. **Depth, not outlines.** A border is drawn only where it is the _only_ thing
   identifying a control. There are exactly two such places — native form fields
   and the rule between lines of a passage — and both are enumerated in
   `tests/a11y/design-language.test.ts`, which fails on a border anywhere else.
   WCAG 1.4.11 asks for 3:1 on a boundary _if one exists_; it does not require
   one, and a filled control with a 4.5:1 label is identified by its label.
2. **Soft geometry.** `--radius-pill` for controls that select, container radii
   for things that hold.
3. **Overlay, never push.** A control that expands opens over the page, through
   `Sheet` — never as a panel in normal flow. The height of a screen must not be
   a function of which disclosures are open. Only `Sheet.module.css` may pin a
   full-viewport overlay, and that is asserted.
4. **One display voice.** Spanish in `--font-display` and set large; the
   furniture small and quiet.
5. **Colour means something.** Accent = the app acting, highlight = new
   material, success/danger = verdicts. Tints are roles (`--color-*-soft`), never
   a per-component `color-mix`. No hex or `rgb()` outside `src/styles/themes/`.
   The one addition is `--color-kind-1…12`: twelve hues sharing the single meaning
   "which kind of material this is", assigned from a stable id by
   `src/styles/kinds.ts` and mapped to colours only by `kindTone` in
   `surfaces.module.css`. It is never a verdict and never a control — where the
   two meet, the state wins.

   Also in `src/styles/`: `themes.ts`, `contrast.ts`, `reading-size.ts` and
   `kinds.ts` are the four registries the tests read. A change to any of them is a
   change to what the palettes must declare.

6. **Motion confirms, never informs.** Name an intent (`var(--transition-fast)`),
   never a duration and a curve.

Shared material lives in `src/styles/surfaces.module.css` — `card`,
`cardPrimary`, `cardInteractive`, `well`, `sectionLabel`, `listReset` — composed
into a screen's own classes with `composes`. One trap: CSS Modules only allows
`composes` on a rule whose selector is a single local class, so
`.filter select { composes: … }` is a build error. Native elements are styled by
element in `global.css` instead.

## Icons

The set is **Lucide** (ISC), and `src/components/icons.ts` is the only file
allowed to know that — the same seam rule `src/app/services.ts` applies to TTS
and storage. Adding an icon is one line there; nothing else may import from
`lucide-react`.

Names are **semantic, never pictorial**: `listen`, not `ear`. A pictorial name is
how two screens end up illustrating one idea with different glyphs, and how a
better drawing becomes unadoptable because six call sites hard-coded the old
one's name.

Size and stroke come from `--icon-*` tokens applied in CSS rather than through the
vendor's `size` prop, so a call site cannot invent a pixel size. Icons are
`aria-hidden` by default: they sit inside controls that already have names, and a
second name makes a screen reader read the button twice. When an icon _replaces_
visible text, the control needs an explicit `aria-label` — dropping a glyph from
a label silently shortens the accessible name, which is how "Add “que” after"
briefly became "que".

## Conventions

- TypeScript is strict, including `exactOptionalPropertyTypes`: build optional
  fields with `...(value ? { key: value } : {})` rather than assigning
  `undefined`.
- Prefer `import type` for types (`verbatimModuleSyntax` is on).
- Tests live in `tests/`, mirroring `src/`. New behaviour needs a test; bug
  fixes need the test that would have caught them.
- Coverage floors are enforced (`vite.config.ts`), with `src/domain` and
  `src/languages` held much higher than the app as a whole — they are pure and
  cheap to test. Raise a floor when the real figure moves up; do not lower one to
  make a change fit.
- Tests that exercise the dataset scripts build a scratch copy of `content/es`
  through `tests/fixtures/dataset.ts` — use `createScratchPack` rather than
  spawning the build yourself, so there is one spelling of it.
- Comments explain _why_. Do not narrate what the code already says.
- Keep the domain layer free of framework imports.

## Known constraints

- **Linting is two tools, and the split is not about speed.** `.oxlintrc.json` is
  the main config: the architecture boundaries, the icon seam, and the core and
  TypeScript rule sets. `eslint.config.js` survives for the React rules alone,
  because oxlint 1.78 implements two of the sixteen rules `react-hooks` v7
  enables and has no `react-refresh` plugin at all. `npm run lint` runs oxlint
  first. Add a rule to the oxlint config unless it is a React rule.
- **TypeScript is pinned to 5.9 by that second tool.** ESLint cannot parse `.tsx`
  without `@typescript-eslint/parser`, which declares
  `typescript: >=4.8.4 <6.1.0`. The next step is TypeScript **6**, not 7 — 7 is
  the native port and no longer ships the JS compiler API that
  `typescript-eslint` is built on, which is why neither its stable nor its canary
  release accepts it. Full reasoning in
  [docs/tasks/tanstack-router.md](docs/tasks/tanstack-router.md#8-two-things-that-will-bite).
- The React Compiler lint rules (`react-hooks` v7) are on. Do not call
  `Date.now()` or other impure functions during render — read the clock in an
  effect or an event handler. This is the rule the split above exists to keep.
- Device speech only speaks a language when a matching voice exists; silence
  plus an explanation is deliberate, not a bug.
