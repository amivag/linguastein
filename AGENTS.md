# Working in this repository

Guidance for AI agents and new contributors. Read this before changing code.

## Commands

```bash
npm run dev            # dev server
npm run check          # typecheck + lint + test + validate:data — run before finishing
npm test               # vitest
npx vitest run tests/a11y   # accessibility suite alone
npm run build:data     # regenerate public/packs from content/es
npm run review:data    # editorial review aid: content questions, by exception
npm run build          # production PWA build
```

`npm run check` is the gate. If it passes, the change is landable; if it fails,
fix it rather than working around it.

## Architecture rules

These are load-bearing. Breaking one is a design change, not a refactor.

1. **Content, exercises and learner state are separate systems.** `src/domain`
   is pure TypeScript — no React, no DOM, no fetch, no vendor SDKs.
2. **Exercises are derived, never stored.** One sentence becomes a flashcard, a
   cloze or a multiple-choice question through `domain/exercises/generators.ts`.
   If you find yourself adding an exercise-shaped field to a content record,
   stop.
3. **Store semantic data, derive presentation.** Tokens carry ids and order;
   character offsets are computed at render time.
4. **Progress references stable ids only** (`core-es:item:000123`), so datasets
   can change without invalidating what a learner has done.
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

## Layout

```text
src/app/         composition root, routing, the current course (`course.ts`)
src/domain/      the engine (content, exercises, sessions, progress)
src/languages/   language-specific morphology — build-time, not engine
src/data/        dataset loading + the zod validation boundary
src/storage/     IndexedDB and in-memory LearnerStorage
src/audio/       audio service + TTS seam
src/ai/          AI seam and learner-context builder (no vendor, no network)
src/features/    screens: home, browse, read, progress, practice, settings, sharing
src/components/  shared UI: AppShell, AppNav, Button, CourseBar, ThemeToggle,
                 VoiceInput, TokenizedText, WordInfoSheet and useWordSelection
                 (used by practice, reading, browse and progress alike)
src/styles/      primitives + one file per theme
content/es/      hand-authored dataset sources (TSV)
public/packs/    GENERATED datasets — never edit by hand
```

## Courses and the URL

Every screen lives under `/<language>/<level>` — `/es/a1/browse`,
`/es/all/read/700001`, `/es/a2/session?preset=verbs`. `/` is a redirect, not a
screen: it sends the learner to the course they left, from the stored
`targetLanguage` and `level`.

The path is the source of truth, exactly as the query string is for a session.
The preference exists only to decide where `/` lands. Build a course-scoped link
with `coursePath` and a session link with `sessionPath(course, …)` — never by
concatenation, for the reason `session-url.ts` records: a hand-spelled prefix is
one that can go stale.

A language or level that is not loaded resolves to the widest real course rather
than an error, so a stale bookmark degrades instead of breaking. Paths written
before courses existed (`/session?…`, `/read/700001`) redirect into a course and
keep their query string.

`courseOptions(repository)` derives what is on offer from the packs themselves,
so a second language pack appears in the picker — and in the URL — with no code
change. `tests/fixtures/pack.ts` ships a small French pack for exactly this:
anything that assumes one language or one pack fails there.

## What a session practises

Three things narrow it, and they are deliberately different kinds of thing:

- the **course** (path) — the standing context: which packs, which levels
- the **focus** (`?focus=`, stored as a preference) — which items to _lead with_
- the **filter** (`?topic=`, `?type=`, `?pos=`, …) — an explicit narrowing a
  learner picked

A focus is a bias, never a filter. `SESSION_FOCUSES` reorders the four buckets
the planner already sorts into — due, weak, new, the rest — so "the ones I keep
getting wrong" cannot hand back an empty session on the day nothing is weak. Do
not turn one into a filter; that is the whole reason it is expressed as an
ordering.

The stored focus and topics are written _into the session link_ by whoever starts
the session, rather than read from preferences by the session screen. A session
that is not fully described by its URL cannot be reloaded, shared or scripted —
and a shared link must not practise the sharer's categories on someone else's
device.

`maxNewItems` still caps unseen material in an open-ended session, except under
`focus=fresh`, where new material is exactly what was asked for.

A word kind (`?pos=verb,noun`) is a filter like any other, and deliberately a
_kind_ rather than a list: `ItemFilter.lexemes` answers "these exact words", and
spelling "the verbs" that way meant enumerating every verb lexeme in the pack at
the call site. Which kinds a picker offers comes from `partsOfSpeech(scope)` — the
packs' own counts, empty ones dropped — narrowed to `STUDYABLE_POS`, because `de`
and `el` are not a category anyone asks for.

`ordering` is the session's, not the preset author's taste: `sequential` means
pack order and must be _asked for_, since a preset that defaults to it deals the
same first N items on every press for the life of the install. Study sessions
record nothing, so nothing else varies what they show.

## Datasets

A briefed, ready-to-start task for growing the pack lives in
[docs/tasks/dataset-expansion.md](docs/tasks/dataset-expansion.md). Read it before
adding content.

A briefed task for numbers as a generative system — `spellCardinal(1042)` rather
than a thousand rows — lives in [docs/tasks/numerals.md](docs/tasks/numerals.md),
and one for making the UI more enjoyable without making it loud lives in
[docs/tasks/game-feel.md](docs/tasks/game-feel.md).

`content/es/*.tsv` is the source of truth. `public/packs/**` is generated by
`npm run build:data` and CI fails if the two disagree.

Item ids live in the first column of the sentence, noun and modifier sources.
Leave the column off a new row — the build assigns an id and writes it back — and
never edit or reorder one afterwards: learner progress references it, so a row
must keep the same id through a typo fix, a reordering or a move to another file.
`content/es/id-ledger.tsv` records every id ever issued so a deleted row's id is
retired rather than reused; it is generated, like the pack. Verb forms come from
`src/languages/es/conjugation.ts` plus the irregularity table — never type a
conjugation by hand, and add an `irregulars.ts` entry when a verb needs one
(the build refuses to run otherwise).

A tú command is spelled like the third person present, so the build cannot tell
`Cierra la puerta` from `La tienda cierra` on its own. Declare `address` on a
sentence that is a command and it is read as one; leave it off and it stays
indicative. Do not "fix" this by guessing from word order — `Hace frío` and
`Está muy cerca` would both become commands.

The shipped pack is marked `source: generated, review: unreviewed`. Do not
describe it as reviewed curriculum.

Editorial review is per item and incremental. `content/es/reviewed.tsv` is the
one file in `content/es` a human writes _about_ content: an entry marks that item
`review: reviewed` in the pack. Sign-off is pinned to the wording that was read,
because an id deliberately survives a typo fix — edit a row after sign-off and
the build fails rather than letting it inherit an approval nobody gave. Never add
an entry for content you have not read: the field exists to keep generated
material distinguishable from checked material, and a forged signature destroys
that. `npm run review:data` finds the rows worth a reviewer's attention, and
stops raising a finding once every item in it is signed off.

A row whose id column holds `-` contributes a lexeme and its meaning but no word
card. Two things use it. A noun and an adjective sharing a surface form — the noun `frío`
and the adjective `frío` would otherwise be two identical cards splitting one
word into two ids. And a word no sentence uses yet: every word card must have an
example sentence to show it in, so `dieciséis` is a lexeme with a gloss until one
exists, and becomes a card the day it does — with no edit to its own row. The
word stays practisable in sentences and inspectable when tapped either way.

Numerals are generated, not authored. `content/es/modifiers.tsv` carries the
`NUM` rows, but the build cross-checks every lemma against
`src/languages/es/numerals.ts` and refuses a spelling that module would not
produce, so `dieciseis` without its accent fails rather than shipping. Numbers
above the card set are not rows at all — `spellCardinal` composes them, which is
why 1042 is askable without existing anywhere. See
[docs/tasks/numerals.md](docs/tasks/numerals.md). No two items may carry the same text, and the build checks this across
sentences and word cards together.

Passages group several sentences into one connected text (a paragraph or a
dialogue). Membership is authored in the `passage` column of a sentence row; the
build derives a container record that _references_ items rather than holding
text, so each sentence stays independently practisable and mastery keeps counting
distinct sentences per word. Never give a passage its own copy of the text — the
build fails on that, as it does on the duplicate text it tends to produce.

Thematic categories are a controlled vocabulary. `content/es/topics.tsv` is the
registry: slug, label and display group, in the order the category picker shows
them. The build fails on a topic no row declares, which is what stops `colours`
and `colors` both quietly existing with half the content each; it reports
registered topics that nothing uses rather than failing, so a category can be
declared before the content that fills it. A slug is referenced by content and by
links (`?topic=clock`), so renaming one is a breaking change — change the label.
Sort the file by hand, never alphabetically: its order is the UI's order.

Content carries usage as data, not prose: `register`, `address` (tú/usted) and
`regions`. `address` is derived from morphology where unambiguous and declared
otherwise; third person is never guessed. When adding a word that differs by
region, add both sides of the pair — one alone teaches a dialect as universal.

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
- colour contrast is asserted against every file in `src/styles/themes/` by
  `tests/a11y/contrast.test.ts`; use `--color-border-strong` for interactive
  boundaries and `--color-border` for decoration

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

Content packs version separately in their own `pack.json` — a dataset can ship
without an app release, and does.

JS and CSS are content-hashed, so they need no cache-busting of their own.
`index.html` and `sw.js` cannot be hashed and must be served no-store; a service
worker update is offered to the learner rather than force-reloading the page. The
reasoning is in [docs/architecture.md](docs/architecture.md#updates-and-caching) —
read it before changing `registerSW` options or the workbox config.

## Theming

Themes are colour-only and live in `src/styles/themes/<id>.css`, registered in
`src/styles/themes.ts`. Primitives (spacing, type, layout) are theme-independent
and belong in `primitives.css`. Never hard-code a colour in a component — use a
role token, and add a role rather than inventing a one-off. Adding a theme is
documented in [docs/theming.md](docs/theming.md); the contrast test discovers
theme files automatically, so a new theme is held to WCAG AA the moment it
appears.

`<html>` always carries a resolved `data-theme`; the pre-paint script in
`index.html` and the key in `themes.ts` must stay in sync.

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

- **TypeScript is pinned to 5.9 on purpose.** TypeScript 7 is released, but
  `typescript-eslint` (latest 8.67) supports `<6.1.0`; upgrading would silently
  disable type-aware linting. Revisit when typescript-eslint supports 7.
- The React Compiler lint rules (`react-hooks` v7) are on. Do not call
  `Date.now()` or other impure functions during render — read the clock in an
  effect or an event handler.
- Device speech only speaks a language when a matching voice exists; silence
  plus an explanation is deliberate, not a bug.
