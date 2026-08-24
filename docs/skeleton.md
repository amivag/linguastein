# The skeleton

**Written:** 2026-08-21
**For:** an agent starting a new application from this repository.

This repository is two things at once: a Spanish practice app, and the base other
apps get scaffolded from. This document is about the second one — what is
reusable, what is not, and what to do in which order.

It stays **in** the working app on purpose. A stripped template repository with no
real application in it is never run, so it rots: the tests pass because there is
nothing to break, and the first project scaffolded from it discovers six months of
drift. Everything described below is load-bearing in a shipping app right now,
which is the only honest way to know it works.

---

## 1. What you get

Four things, roughly in order of how hard they are to rebuild yourself.

### Executable rules, not documented rules

The unusual part. Five test files read the source as _text_ and fail the build on
a violation, so architectural and design decisions are enforced rather than
merely written down:

| File                                 | Refuses                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `tests/a11y/contrast.test.ts`        | Any palette that misses WCAG AA at any contrast level. Discovers both itself.                     |
| `tests/a11y/motion.test.ts`          | A hard-coded duration or easing outside `primitives.css`.                                         |
| `tests/a11y/hover-states.test.ts`    | A control whose hover can repaint it in a colour its label was not chosen for.                    |
| `tests/a11y/design-language.test.ts` | A border outside two enumerated exceptions; a colour outside a theme file.                        |
| `eslint.config.js`                   | React in the engine; the icon vendor outside its seam; a shared component reaching into a screen. |

Four of the five are **fully app-agnostic** — copy them unchanged. The reason this
matters more than it sounds: an agent reads a convention document or it does not,
and either way nothing fails. A rule that bites is a rule that survives contact
with the tenth contributor.

### A strict TypeScript baseline

`tsconfig.app.json` turns on the settings most projects claim and half-configure:
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`.

`exactOptionalPropertyTypes` in particular changes how you write code — build
optional fields with `...(value ? { key: value } : {})` rather than assigning
`undefined`. It is worth keeping. It catches a whole class of "the key exists and
holds undefined" bug that ordinary `strict` does not.

### A design system that shows itself

`src/styles` plus `/design`. Tokens are read back out of the loaded stylesheets at
runtime, so the style guide cannot drift from the app — add a token and it appears
on the page. See [design-language.md](design-language.md) for the rules and
[theming.md](theming.md) for the colour roles.

### Seams instead of vendors

Every external dependency is chosen in exactly one place. `src/app/services.ts` is
the composition root; `src/components/icons.ts` is the icon vendor's only
appearance; `src/storage` is the only module that knows about IndexedDB. Swapping
any of them is one edit, and the lint rules now enforce two of the three.

---

## 2. What is generic and what is this app

Measured, not guessed — from import graphs and coupling counts.

### Take as-is

```text
src/app/identity.ts          app name, id, base path — the file you edit first
src/app/ErrorBoundary.tsx    the screen of last resort
src/app/version.ts           build identity injected by Vite
src/styles/**                every token, theme, surface recipe, the token reader
                             — see "The appearance system" below; it is the most
                             reusable thing here and the most worth understanding
scripts/build-palette.ts     solves a palette from hue angles; app-agnostic
scripts/palette/colour.ts    sRGB / OKLab / OKLCH / WCAG maths, pure functions
src/components/AppShell      header + main + nav, one h1 and one main per screen
src/components/AppNav        tab bar on a phone, rail on a desktop
src/components/Button        variants, the pressable edge, the elevation scale
src/components/Chip          a filled pill whose selected state is aria-pressed
src/components/Sheet         overlay that never pushes the page
src/components/Icon          the icon seam
src/components/ThemeToggle   segmented control, compact and full
src/components/UpdateBanner  the service worker's "a new version is ready"
src/components/useFocusTrap  focus containment for any dialog
src/features/design/**       the live style guide
src/storage/**               IndexedDB + in-memory, behind one interface
src/utils/**                 seeded RNG, clipboard
tests/a11y/{contrast,motion,hover-states,axe}   zero app-specific references
tests/setup.ts               jest-dom, fake-indexeddb, a matchMedia stub
eslint.config.js  tsconfig.*  .github/workflows/ci.yml  .prettierrc.json
```

### Delete or replace

```text
src/domain/**        content, exercises, sessions, progress — the learning engine
src/languages/**     Spanish morphology, conjugation, numerals
src/data/**          the pack loader; the *pattern* is reusable, the zod schemas are not
src/audio/**         TTS and speech recognition seams
src/ai/**            the AI seam and learner-context builder
src/features/**      every screen except design/
content/  public/packs/  scripts/{build,validate,review}-dataset.ts
src/app/course.ts    "a course is a language plus a level" — this app's scoping concept
src/components/{CourseBar,TokenizedText,UsageBadges,Voice*,WordInfoSheet}
tests/{domain,languages,data,audio,ai,features}/**
tests/a11y/{agent-surface,screens}.test.tsx    same shape, different screens
```

### Worth understanding before you copy it

`src/app/course.ts` and the `/:language/:level` routing are specific to this app,
but the _idea_ generalises and is worth stealing: **the URL is the state**. Every
screen lives under a path that says what it is scoped to, and a session is
described entirely by its query string, so it can be reloaded, shared, scripted
and driven by an agent. If your app has a scope — a workspace, a project, a
dataset — put it in the path rather than in a context.

---

## 3. Launching a new app

In this order. Each step leaves the tree in a state where `npm run check` means
something.

1. **Copy the repository, then edit `src/app/identity.ts`.** Name, id, tagline,
   base path. That is the whole of the rename — `vite.config.ts`, `index.html`,
   the IndexedDB database, the `localStorage` prefix, document titles, the PWA
   manifest and the service-worker cache names all derive from it. Also change
   `name` and `description` in `package.json`, which npm owns rather than the app.

2. **Delete the app-specific tree** from the list above. Delete its tests in the
   same commit — a test suite that still references deleted modules is a broken
   build, and it is tempting to comment things out instead.

3. **Empty the coverage thresholds.** `vite.config.ts` names `src/domain/**` and
   `src/languages/**` at 88–97%. Those figures describe _this_ app's pure layers.
   Drop the per-directory entries, set the global floors to whatever your first
   real suite reaches, and raise them as it grows. Never lower one to make a
   change fit.

4. **Rewrite `src/app/services.ts`** for the seams your app actually has. Keep the
   shape: one async factory returning one object, every vendor chosen there and
   nowhere else.

5. **Re-point the lint boundaries.** `eslint.config.js` restricts `src/domain/**`
   and `src/languages/**`. Rename those globs to your pure layers. If you have
   none, say so out loud rather than deleting the block — a project with no pure
   core is a decision, not an omission.

6. **Keep the four app-agnostic a11y tests from the start.** They cost nothing on
   an empty project and they are almost impossible to retrofit: by the time a
   palette has forty hand-mixed colours in it, making `contrast.test.ts` pass is a
   redesign. Add your colour roles to its `PAIRS` list as you create them.

7. **Rewrite `AGENTS.md`.** It is the file every agent reads first. State your
   architecture rules and, for each one, name what enforces it. A rule with no
   enforcement should say so.

---

## 4. Conventions worth keeping

These are cheap to adopt and expensive to add later.

- **Comments explain _why_.** The repository is unusually heavily commented and
  the comments are almost all rationale: what failed, what was tried, what
  constraint forced the shape. This is what lets an agent change code safely six
  months later — and several times during the design work it was a comment that
  stopped a previous decision being silently undone.
- **A test names the bug it prevents.** Every test file here opens with the
  failure it exists to catch. "Should work correctly" tells a future reader
  nothing about whether it is safe to delete.
- **One `<h1>`, one `<main>`, a matching document title per screen.** Cheap, and
  it is what makes the app drivable through the accessibility tree by a screen
  reader and an automated agent alike.
- **State in the URL, not in a context**, wherever it is shareable.
- **`npm run check` is the gate**, and CI runs the same command. Nothing is
  "landable but red".

---

## 5. Known gaps

Honest list. These are the things a second project will hit.

- **No end-to-end tests.** jsdom cannot do layout, cannot compute contrast and
  freezes animations at their first keyframe, so a claim like "the option and the
  slot look different" is unverifiable in the current suite — during the design
  work it was checked by reading `getBoundingClientRect` through a browser and
  computing WCAG ratios by hand. Playwright is the obvious addition and is not
  here yet.
- **No dead-code detection.** Step 2 above deletes a large subtree, and nothing
  reports what became unreachable as a result. `knip` would.
- **`@/*` is configured and unused.** `tsconfig.app.json` declares the alias;
  every one of the 167 relative imports in `src` ignores it. Pick one before the
  tree grows — deep relative paths make moving a file a rewrite, and aliases make
  the lint boundaries easier to express.
- **No i18n seam.** UI strings are English literals in components. Fine for one
  app, a real decision for a skeleton.
- **No telemetry or error-reporting seam.** `ErrorBoundary` takes an `onError`
  callback and that is the whole of it, deliberately — but if your app needs
  reporting, that is where it goes.
- **No bundle budget.** The PWA precaches everything it builds; nothing fails when
  that grows.

---

## 6. Two agents, one tree

Worth stating because it has already gone wrong here. If more than one agent works
in this repository at once, give each its own **git worktree** or clone:

```bash
git worktree add ../lingo-ui design-work
```

A shared working tree means `git add -A` picks up the other agent's in-flight
edits and commits them under your message — which happened during the design
work, and was caught by reading the staged file list rather than by anything
automatic. Distinct worktrees share the same `.git` and cost nothing.

## The appearance system

The part of this repository most likely to be reused unchanged, so it is worth
saying exactly what is generic and what is this app.

**Generic — take as-is:**

- `src/styles/appearance.ts` — the axis mechanism. One `defineAxis` gives an axis
  its storage key, validator and `apply`. It knows nothing about palettes,
  contrast or language, and it does not assume a DOM: outside a browser `apply` is
  a no-op, which is what lets `vite.config.ts` read the registry at build time
  without the config project having to compile against the DOM lib.
- `src/styles/axes.ts` — the registry, and the `%APPEARANCE_AXES%` injection that
  removes the pre-paint duplication entirely.
- `src/styles/contrast/**` and `contrast.ts` — the four levels are expressed as
  positions along each palette's own `ink → paper` line, so they work for palettes
  authored later. Nothing in them is Spanish or even language-shaped.
- `scripts/build-palette.ts` — solves palettes and regenerates intensity blocks.
  Every decision it makes comes from one `SHAPE` object at the top: the role list,
  the target tones, where `normal` sits on the axis. A different app edits `SHAPE`.
- `tests/a11y/contrast.test.ts` — discovers palettes and levels from the
  directories rather than listing them, so it holds a palette added in another app
  to the same bar with no edit.

**This app — replace:**

- The palette list itself, and the seven `src/styles/themes/*.css` pairs. Generate
  new ones rather than editing hex by hand.
- `src/styles/kinds.ts` and `semantics.ts`. The _mechanism_ (a stable id hashed to
  a hue; a chosen hue per grammatical fact) ports; the assignments are about
  Spanish, and an app with no grammar has no use for `semantics.ts` at all.
- The role list, if the app needs different meanings. Adding a role means adding a
  row to `PAIRS` in the contrast test naming what it sits on and at what ratio — a
  role absent from `PAIRS` is unchecked, which is the same as unspecified.

**The two invariants to preserve when porting**, because everything else rests on
them: a contrast level declares no hue, and an intensity declares no neutral. They
are what let five axes compose instead of multiplying into a matrix of themes, and
both are asserted rather than documented.
