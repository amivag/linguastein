# Working in this repository

Keep this entry point short. Read only the topic document needed for the task;
[docs/README.md](docs/README.md) is the map. Current decisions and unresolved
foundation findings live in [docs/current-state.md](docs/current-state.md).

## Layout

An npm workspace. `apps/linguastein/` is the Spanish app; `packages/*` hold the
platform code other apps share ([framework.md](docs/framework.md)). Paths in this
file such as `src/` or `tests/` are relative to `apps/linguastein/` unless they
name a package. Docs and this guidance stay at the root.

## Commands

Run from the root; each delegates to the workspaces.

```bash
npm run dev
npm run check            # per workspace: typecheck, lint, coverage, data, build; then format
npm run format           # write formatting
npm test                 # vitest, every workspace
npm test -w linguastein-app -- tests/a11y # after any UI change
npm run test:e2e         # Playwright, 3 engines; after PWA, storage, CSP or boot changes
npm run build:data       # generate packs from content/es; optional -- <tag>
npm run review:data      # editorial exceptions
npm run build            # production PWA
```

`npm run check` is the finishing gate; fix failures. Keep its steps and order
aligned with `.github/workflows/ci.yml`, with formatting last. CI additionally
rebuilds datasets and diffs a clean tree; that comparison cannot run mid-change.
Use `sfw npm` for registry queries, audits and dependency installation/updates;
respect the configured release cutoff. Do not force audit fixes or lower coverage
to make a change pass. Preserve unrelated changes. Concurrent agents need separate
worktrees; use another agent only when the session instructions authorize it.

## Read when relevant

| Task                                            | Source                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| Screens, routes, query parameters               | [screens-and-urls.md](docs/screens-and-urls.md)                  |
| Content rows or generated forms                 | [content-authoring.md](docs/content-authoring.md)                |
| Content record shapes                           | [dataset-format.md](docs/dataset-format.md)                      |
| Styling                                         | [design-language.md](docs/design-language.md) and live `/design` |
| Appearance axes or palettes                     | [theming.md](docs/theming.md)                                    |
| Storage, atomic writes and retry behavior       | [storage.md](docs/storage.md)                                    |
| Learning behavior, releases, coding conventions | [working-conventions.md](docs/working-conventions.md)            |
| Dependency or layer changes; scaffolding        | [skeleton.md](docs/skeleton.md)                                  |
| Shared engine or another learning subject       | [framework.md](docs/framework.md)                                |
| PHP, SQL, accounts, registration or sync        | [server-foundation.md](docs/server-foundation.md)                |
| Service-worker or caching changes               | [architecture.md](docs/architecture.md#updates-and-caching)      |

## Architecture rules

These are design constraints; prefer executable enforcement over repeated prose.

1. **Separate content, exercises and learner state.** `src/domain` and
   `src/languages` are pure TypeScript: no React, DOM, fetch or vendor SDKs.
   `src/engine` is the subject-neutral subset, with no imports outside its own
   directory and no browser/Node ambient types (`tests/engine/boundary.test.ts`,
   `tsconfig.engine.json`). Lint enforces the pure-layer boundaries.
2. **Derive exercises; never store them in content.** Use
   `domain/exercises/generators.ts`.
3. **Store semantic data; derive presentation.** Tokens have ids/order;
   character offsets are computed when rendering.
4. **Progress references stable dataset-owned entity ids.** Forms and skills
   count as subjects too. Never mint ids for generated targets: record against
   the rules they exercise. `packId` may be stored for indexed queries; content
   may not. Item-shaped readers use `itemProgressIn` to narrow by type and
   course (`tests/features/non-item-progress.test.tsx`).
5. **Vendors sit behind seams.** Choose storage, content, speech, audio and AI
   adapters in `src/app/services.ts`. Only `components/icons.ts` imports Lucide.
   Shared components may not import screens; lint enforces these boundaries.
6. **English is a fallback, not a structural requirement.** Translations are
   separate records resolved through the reference-language fallback chain.
7. **Inject randomness.** Use `src/engine/random.ts` (also re-exported by
   `utils/random.ts`) so seeds reproduce sessions.
8. **A course is a scope, not a partition.** Derive it from loaded packs; CEFR
   level is a ceiling. Narrow downstream through an `ItemFilter`. Device
   preferences and per-language `CourseState` are distinct: read level, topics,
   focus, accent and voice through `useCourse()`, never global preferences.

## Identity, navigation and content

- `src/app/identity.ts` owns app name/id/description/base path, document titles,
  storage prefixes and cache names. Do not type the app name into components.
- URLs own shareable screen/session state. Use each screen's codec and path
  builders (`coursePath`, `sessionPath`, `studyPath`, `settingsPath`); never
  concatenate links. A focus is a bias, not a filter. Back costs at most one
  step and never invents a previous destination. Nested screens use the owning
  module's breadcrumb builder; top-level nav destinations name their section.
- Offer lists/counts derived from loaded packs; omit empty options. The alphabet
  is a language capability (`alphabetGuide`), not content-derived.
- `content/es/*.tsv` is source; `public/packs/**` is generated. Keep item ids
  through edits, retire deleted ids, and omit the id column entirely for new
  rows. Derive conjugations, plurals, agreements and numerals from the language
  module; never hand-author them.
- App version comes only from `package.json` via `app/version.ts`. Packs and
  translation sets have independent authored versions, dates and count guards;
  see the content guide. Do not stamp build dates into datasets.

## Accessibility is the agent interface

- Every control has a stable, unambiguous accessible name. Multiple phrases need
  `TokenizedText contextLabel`. Expose status and selection with ARIA; never
  rely on color alone. Exactly one h1/main and a matching title per screen.
- Session position is a progressbar. A ticking timer is `role="timer"` with no
  live region; announce the total once in the summary.
- Use `Sheet` for overlays, preserve focus and accessible disclosure state.
  `ErrorBoundary` exposes rendering failures as an alert without clearing state.
- Check all palette × contrast × intensity combinations, not just defaults.
  Existing a11y tests enforce naming, contrast, borders, hover and motion.

## Design and appearance

- Open live `/design` before styling. Depth rather than outlines; only native
  fields and passage rules draw borders. Use existing tokens and shared surface
  recipes. Controls that select use pill radii; containers use container radii.
- Expand over the page through `Sheet`, never push content. Only its stylesheet
  may pin a full-viewport overlay. Spanish uses `--font-display`.
- No hard-coded colors or component-local color mixes. Accent means app action,
  highlight means new material, success/danger mean verdicts. Kind hues identify
  material; control state wins. Motion uses intent tokens, never raw durations.
- Theme, palette, contrast, intensity and reading size remain independent axes
  declared with `defineAxis`. `src/appearance` is portable; app theme metadata
  and CSS entries live in `src/app/themes.ts` and `themes.css`. Keep app identity
  and palette choices outside the core. Contrast owns neutrals, intensity owns hues.
  Pre-paint settings are injected from the registry; do not duplicate its lists.
  Generate palettes with `npm run build:palette`; use real palette previews.
- Icon names are semantic. Use CSS size/stroke tokens; icons are decorative by
  default. A glyph-only control needs an explicit accessible name.

## Conventions

Strict TypeScript includes `exactOptionalPropertyTypes`; omit absent optional
fields rather than assigning `undefined`. Use type-only imports. Tests mirror
source under `tests/`; new behavior and bugs need meaningful tests. Coverage
floors live in `vite.config.ts`; never lower them to accommodate changes.
Dataset-script tests use `createScratchPack` from `tests/fixtures/dataset.ts`.
Comments explain why. CSS Modules `composes` requires one local-class selector.

Oxlint handles core/architecture rules; ESLint handles React rules. `tsc` is
TypeScript 7 (`@typescript/native`); the `typescript` package is aliased to
`@typescript/typescript6` because the ESLint parser and AST tests import its API,
which 7.0 lacks. Check parser metadata before removing the alias. `.npmrc` blocks
install scripts and enforces the release age. Render must be pure: read clocks in
effects or handlers. Device speech requires a matching voice; explained silence
is deliberate.

## Documentation and memory

Keep operational rules here, current decisions in `docs/current-state.md`, and
detail in the owning topic doc. `CLAUDE.md` stays a pointer. Do not copy session
transcripts, audit counts, test totals or version inventories into memory.
Update or remove superseded statements instead of appending contrary warnings.
Historical briefs/specs are reference only: inspect headings and relevant ranges,
verify against code, and never bulk-load them to start an unrelated task.
Documentation size limits are enforced in `tests/docs/context-budget.test.ts`.
