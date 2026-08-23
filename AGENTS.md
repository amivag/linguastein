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
npm run review:data    # editorial review aid: content questions, by exception
npm run build          # production PWA build
```

`npm run check` is the gate. If it passes, the change is landable; if it fails,
fix it rather than working around it.

That claim only holds while the gate runs **every** step CI runs, in the same
order, so keep the two together when either changes. It came apart once: `check`
omitted `format:check` while `.github/workflows/ci.yml` ran it third, ahead of
the tests, the dataset checks and the build. Fourteen commits landed on `main`
with the formatting step red — and because a failed step skips the ones after it,
none of those commits had its tests or datasets verified by CI at all. A gate
that is a subset of CI is worse than no gate, because it is believed.

Formatting now runs **last** in both, which is the cheap insurance against a
repeat: if the two ever drift again, the step that drifts is the one that cannot
hide a real failure behind it.

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
1, 5 and the icon seam are enforced by `eslint.config.js`; a violation fails
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

## Layout

```text
src/app/         composition root, routing, the current course (`course.ts`)
src/domain/      the engine (content, exercises, sessions, progress, missions)
src/languages/   language-specific morphology — build-time, not engine
src/data/        dataset loading + the zod validation boundary
src/storage/     IndexedDB and in-memory LearnerStorage
src/audio/       audio service + TTS seam
src/ai/          AI seam and learner-context builder (no vendor, no network)
src/features/    screens: home, study, browse, read, progress, practice, missions,
                 settings (one file per section), sharing
src/components/  shared UI: AppShell, AppNav, Button, Chip, Sheet, Icon, CourseBar,
                 ThemeToggle, PaletteControl, ContrastControl, ReadingSizeControl,
                 VoiceInput, TokenizedText, WordInfoSheet and
                 useWordSelection (used by practice, reading, browse and progress
                 alike). `icons.ts` is the icon-set seam
src/features/design/  the live style guide at /design
src/styles/      primitives, shared surface recipes, the token reader, the
                 categorical hue assignment (kinds.ts), one file per palette per
                 mode (themes/) and one per contrast level (contrast/)
content/es/      hand-authored dataset sources (TSV)
public/packs/    GENERATED datasets — never edit by hand
```

## Study and Test

There are two sections, and the split is the domain's rather than the nav's
invention: `mode: 'study'` records nothing and only `mode: 'practice'` feeds the
scheduler. **Study** (`/study`) is the material — sheets of words, phrases,
sentences, texts and grammar patterns; **Test** (the course home) is where a
session starts. Browse and Read are sheets _inside_ Study, not destinations of
their own: `AppNav` gives the Study item an `owns` list so the section stays
marked while a learner is on one, and both keep working as deep links.

Nothing on Study is a hard-coded list. Word kinds, categories and grammar
patterns are counted from the packs over the current course, so a second
language grows tiles with no edit — and a tile whose count is zero is not
offered, the same rule the categories and the letters already follow.

**Study is one section at a time, and a section is an address.** All of it on one
page came to about seventy rows in the shipped course, where thirty-five
categories buried the three sheets above them. `features/study/study-url.ts` owns
`?tab=grammar` in both directions, exactly as `browse-url.ts` owns the filters.
Two details are deliberate:

- **The section list is derived too**, not just the tiles in it. A course with no
  authored missions has no Missions tab, because a tab that opens an empty page
  is the same mistake as a tile advertising 546 verbs.
- **The default is data, so the link spells the tab out.** Browse omits its
  default sort and Settings its default section, because those defaults are
  constants; Study's first section depends on what the packs hold, and a link
  that meant Missions in one course and Words in another is exactly what a shared
  link must not be.

**Grammar and abilities are two sections, because they are two kinds of thing.**
A `pattern` is how the language works; a `function` is what a learner can
accomplish with it — the distinction the dataset already draws (see
`content/es/skills.tsv`). One list put `presente de indicativo` beside `Pedir
comida o bebida`, forty-one tiles deep. Only `function` is named in the split, so
a skill kind added later lands in Grammar rather than disappearing from the
screen.

The course scope is a one-line summary that opens `CourseBar` in a sheet, the
trade Test already makes for its session options: four lines at the top of every
screen is a lot to spend on something a learner changes once a week. It still has
to _state_ the scope, because every count under it is relative to that.

**Count a tile with the filter the tile links to.** This is easy to get wrong and
was: the word tiles were counted with `partsOfSpeech`, which counts every item
_exemplifying_ a part of speech — sentences included — while the tile links to a
sheet of word cards. That advertised 546 verbs where the sheet lists none.

**Missions belong to Study.** A mission is mostly material — an exchange to
understand, then the same language used somewhere new — so the catalogue lives on
Study, listed in authored order with each one's standing. Test keeps leading with
the next unfinished one, because a recommendation is what that screen is for, and
links across to the full ladder rather than being the only way in.

Only the Use stage records anything, and Study says so: the rest of that screen
promises the opposite, so a control that records has to qualify the promise rather
than quietly break it.

Where a learner stands is **derived, never stored** —
`domain/missions/progress.ts` computes it from the attempt log, and both screens
call it. It was inline in the home screen before, which is why Study could not
list missions without copying the calculation. The Use-stage session id
(`mission:<id>:use:<passage>:<stamp>`) is built and parsed there too, for the same
reason: it was spelled out in three places.

## Browse's URL, and the filter spelling

A study sheet is a thing you link to, so Browse's filters live in the query
string (`?type=word&pos=noun&topic=body&sort=az`) rather than in component
state. `features/browse/browse-url.ts` owns both directions, exactly as
`session-url.ts` does for a session.

The facet spelling itself belongs to neither: `writeItemFilter` and
`parseItemFilter` are exported from `session-url.ts` and used by both, so
`?pos=verb` cannot come to mean one thing in a sheet and another in a session.
Add a facet there, not in a screen.

`sort` is the exception and deliberately so — it narrows nothing, so it stays in
Browse's URL and never travels into a session link, where `ordering` is the
session's own business.

**A sheet carries the section that opened it.** Browse and Read send Back to
Study rather than into history, because a learner who followed three category
tiles should not have to tap Back three times to leave. The other half of that
choice was a bug: bare `/study` resolves to whichever section the course
_starts_ with, so leaving a category landed you on Missions — Back undid the
navigation the learner made and the section switch above it, then dropped them
on a screen they had never asked for. So every sheet link Study builds carries
`?from=<tab>` and each sheet's Back goes to `studyPath(course, from)`.
`study-url.ts` owns that spelling in both directions (`writeStudyOrigin` /
`parseStudyOrigin`), because the section names are Study's; `browse-url.ts` and
`read-url.ts` only pass it through. Three details matter:

- **It is provenance, not a facet.** It narrows nothing and never travels into a
  session link, so it lives beside `sort` rather than in `writeItemFilter`.
- **Narrowing the sheet must not drop it.** Every rewrite of Browse's query is a
  `replace` that carries `from` through: a Back button that forgets where you
  came from because you touched a filter is the original bug again.
- **Study reads it off the open section**, not out of a literal per link, so no
  two links on one screen can disagree and a section added later needs no edit.
  An absent or unrecognised name degrades to Study-wherever-it-opens, which is
  what a shared link and a reload get.

The general rule, worth stating because it is easy to break one control at a
time: **Back may cost a learner one step, and it may never cost two.** It must
also never land somewhere they have not been — the reason `MissionScreen`'s
"Back to missions" and its finish button go to the missions ladder on Study
rather than to `path()`, which is the course home and the one screen a mission
was not reached from.

## Settings, in sections

Five sections rather than one column, grouped by _whose_ setting it is: Learning,
Appearance and Audio are the learner's; Packs and About are the app's. One file
per section under `features/settings/`, and the shell only picks between them.

The open section is in the query string — `/es/a1/settings?tab=packs` — and
`settings-url.ts` owns both directions, exactly as Browse and a session do. The
default is left unsaid in the link, and an unrecognised name opens the default
rather than erroring. The switcher is a `nav` of links with `aria-current`, not a
`role="tablist"`: a section here _is_ an address, and half an ARIA tab widget
promises arrow-key semantics that a set of links does not have.

**A content pack is an add-on, and Settings treats it as one.** It ships,
versions and is licensed separately, so the Packs section lists each one with its
version, levels, accents, licence and provenance, and counts what it holds through
`domain/content/packs.ts` — counted from the repository rather than read out of
the manifest's prose, and with the filter each label describes. Two rules matter
here: a pack that has not been editorially reviewed says so, because generated
material must stay distinguishable from checked material; and a skipped record is
attributed to the pack whose file it came from, since a number floating on the
screen names nothing to fix.

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

A letter (`?initial=c`) is a filter too, and a sort is not. Browse offers both
and they are different kinds of thing: the letter changes which items exist, so it
belongs in `ItemFilter` and in the link, while `ItemSort` only decides the order
the list is dealt in on that screen and is deliberately not written into a session
— see `ordering` below for why a session's order has to be asked for. What
"alphabetical" means is defined once, in `domain/content/alphabet.ts`: leading
punctuation is stepped over so `¿Qué hora es?` files under Q, accents fold, and
`ñ` is a letter rather than an n. Do not re-derive any of that at a call site — a
letter index and a sort that disagree are two alphabets.

A **skill** (`?skill=preterite,imperfect`) is how a session asks for a tense or a
pattern, and it is the only way to: `ItemFilter` has no morphological field, but
the four grammar skills are attached to items, so the skill _is_ the tense.
Skills travel as local ids for the reason passages do — a shared link should not
carry a pack namespace it will outlive — and are resolved to `SkillId`s by the
screen, since `session-url.ts` deliberately parses without the repository. A slug
no loaded pack declares widens the session rather than emptying it.

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

**Author the content a mission teaches before authoring the mission.** Six
missions landed at once because the vocabulary was already there — travel had 148
items before `buy-a-ticket` existed. The past-tense mission
([docs/tasks/past-tense-mission.md](docs/tasks/past-tense-mission.md)) is briefed
rather than built for the opposite reason: writing the sequence and the language
it drills in one pass is how a mission ends up teaching whatever its author
happened to write that afternoon.

**Every kind of word has cards, and each kind has its own id range.** Sentences
take `1–499_999`, noun cards `500_001–599_999`, modifier cards
`600_001–699_999`, passages `700_001–799_999` and verb cards `800_001–899_999`.
Separate ranges are what stop appending a verb from renumbering an adjective.

Two consequences of verbs having cards, both easy to get wrong:

- **A card is not always the right home for a gloss.** `glossOf` reads
  `verbs.tsv` for a `VERB`, but `hay` is declared in `modifiers.tsv` — it is a
  form, not a conjugatable lemma, and nothing would generate it. So the lookup
  falls through instead of asserting.
- **The `verbs` preset is narrowed to sentences and phrases.** Its description
  promises "useful forms inside natural sentences", and a bare infinitive card is
  exactly what that is not. `vocabulary` is where the cards belong. A preset whose
  filter and description disagree is worse than either.

**Audio is a ledger, not a content column.** `scripts/generate-audio.ts`
synthesises and records into `content/es/audio-ledger.tsv`, and never touches the
pack; the dataset build reads that ledger and emits one `audio` file per locale,
and never synthesises. Three rules hold the seam: only rows a human has marked
`approved` ship, a clip is keyed by (item, locale, voice) rather than by the text
it speaks — an item keeps its id through a typo fix, so the `textHash` is what
tells a current clip from a stale one — and a row whose item has since been
deleted is dropped rather than failing the build. Voices are declared in
`content/es/voices.tsv`, because generated speech is not automatically yours to
redistribute and a voice carries its own licence. No ledger means no audio, and a
pack identical to one built without the feature.

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

Communicative functions are skills, not topics. `content/es/skills.tsv` declares
authored abilities such as ordering food, and sentence rows reference their local
slugs in the `skills` column. A topic says what a sentence is about; a function
says what the learner can accomplish with it. The build resolves both skill and
prerequisite slugs and rejects undeclared ones. Grammar and morphology skills are
still generated, so do not re-author them there.

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

JS and CSS are content-hashed, so they need no cache-busting of their own.
`index.html` and `sw.js` cannot be hashed and must be served no-store; a service
worker update is offered to the learner rather than force-reloading the page. The
reasoning is in [docs/architecture.md](docs/architecture.md#updates-and-caching) —
read it before changing `registerSW` options or the workbox config.

## Theming

Appearance is **four independent axes**, never one combined id: `data-theme`
(light/dark), `data-palette` (which hues), `data-contrast` (how far apart the
neutrals sit) and `data-reading-size` (the type scale). Combining them would need
`dark-teal-large-more`, and every palette added would multiply the files.

Palettes are colour-only and live in `src/styles/themes/<palette>-<mode>.css`,
registered in `src/styles/themes.ts`; contrast levels live in
`src/styles/contrast/<level>-<mode>.css`, registered in `src/styles/contrast.ts`.
Primitives (spacing, type, layout) are axis-independent and belong in
`primitives.css`. Never hard-code a colour in a component — use a role token, and
add a role rather than inventing a one-off. Adding a palette is documented in
[docs/theming.md](docs/theming.md).

Three rules do the load-bearing work, and all three are asserted:

- **A contrast level declares no hue.** It restates the neutral roles as mixes
  along the palette's own `--color-ink` → `--color-paper` axis, which is what lets
  one level serve a palette written after it — More contrast in Sand stays warm
  instead of turning grey.
- **Every combination is checked, not just the default.** `contrast.test.ts`
  discovers palettes and levels from the directories and holds each palette to
  WCAG AA at each level, evaluating the `color-mix` itself. Soft is quieter, not
  less legible, and the levels are asserted to come out in order.
- **A preview is the real palette.** Each palette file also selects a
  _descendant_ carrying `data-palette`, so the settings picker shows four live
  palettes with no colour leaving `src/styles/themes/`. Never build a swatch from
  a hex.

`<html>` always carries all four attributes. The pre-paint script in `index.html`
repeats the four lists as literals because it cannot import a module — that is the
one duplication, and the contrast test asserts it matches the registries.

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
   The one addition is `--color-kind-1…6`: six hues sharing the single meaning
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

- **TypeScript is pinned to 5.9 on purpose.** TypeScript 7 is released, but
  `typescript-eslint` (latest 8.67) supports `<6.1.0`; upgrading would silently
  disable type-aware linting. Revisit when typescript-eslint supports 7.
- The React Compiler lint rules (`react-hooks` v7) are on. Do not call
  `Date.now()` or other impure functions during render — read the clock in an
  effect or an event handler.
- Device speech only speaks a language when a matching voice exists; silence
  plus an explanation is deliberate, not a bug.
