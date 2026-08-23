# Changelog

Notable changes to Linguastein, newest first. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are
[semver](https://semver.org/).

The version in `package.json` is the single source of truth: the build injects it,
Settings displays it as `Linguastein <version> (<commit>)`, and that is the string a bug
report should quote. Content packs version independently — `core-es` carries its
own version in `pack.json`, shown next to the app's.

This file records changes to the **app**. The full feature inventory and what is
planned next live in [docs/roadmap.md](docs/roadmap.md); dataset growth is visible
in the pack's own counts.

## Unreleased

### Added

- **Verbs have word cards.** All 126 of them, in an id range of their own, so
  `hablar` is a word you can look up rather than only meet, and `Words × Verbs` in
  Browse lists 126 entries where it used to be an empty page. Study grew a Verbs
  tile with no edit, which is what deriving that list from the packs was for. The
  `verbs` preset stayed narrowed to sentences and phrases: "useful forms inside
  natural sentences" is precisely what a bare infinitive is not.
- **The dataset build carries canonical audio.** It reads the ledger
  `scripts/generate-audio.ts` writes and emits one audio file per locale, plus the
  voices declared in `content/es/voices.tsv`. Only clips a human has marked
  `approved` ship; a clip is keyed by item, locale and voice rather than by the
  text it speaks, so a typo fix cannot mint a duplicate; and a row whose item has
  been deleted is dropped rather than failing the build. No ledger means no audio
  and a byte-identical pack, which is why this could land before any clip exists.
  What is left is not code: a voice whose licence permits shipping its output from
  a CC0 pack, and the listening that approving it honestly costs.

### Fixed

- **Every content word the pack uses now has a lexeme.** Token linking went from
  96% to 99%: `kilo` appeared twelve times and answered nothing when tapped, in an
  app whose rule is that every word of every phrase is tappable. 32 nouns, 23
  modifiers and 9 verbs were added — the verbs only needed declaring, since forms
  are generated.
- **Proper nouns are declared as `PROPN`**, a part of speech `inspect.ts` has
  always known and no content had ever used. A name is now tappable and says it is
  a name, instead of counting as vocabulary the dataset had forgotten.
- The 30 occurrences still unlinked are three principled classes rather than a
  backlog, and `docs/roadmap.md` names them: `ser` and `ir` sharing a preterite
  (the tokeniser declines to guess), enclitic pronouns, and the two tenses the
  conjugator does not generate.

### Changed

- CI runs its format check **last**, after the tests and the dataset checks, and
  `npm run check` matches. A whitespace disagreement can no longer mask a real
  failure by failing before it.

### Added

- **Six new missions, taking the journey from seven to thirteen.** Five are A1;
  saying what hurts is the first A2 mission, because the exchange that teaches it
  is. Each brings the full shape: a taught passage, a three-rung transfer ladder,
  four communicative functions, a response palette and a variation pattern.
  - **Say what hurts** — health was the survival scenario the seven A1 missions
    left out, and `En el médico` was the one dialogue in the pack nothing pointed
    at. Its ladder leaves the surgery: a pharmacy, a second doctor, and a phone
    call to make an appointment.
  - **Buy a ticket** — travel was the biggest topic in the pack and its only
    dialogues were asking directions and checking into a hotel. Train, bus, return
    fare and a metro machine.
  - **Shop at the market** — quantities and a price per kilo rather than the sizes
    the clothes missions drill. The independent rung has the stall out of what you
    asked for, so the script cannot be followed.
  - **Introduce your family** — the next thing anyone is asked after hello, with
    thirty-seven family items and no exchange to use them in. It reuses the
    characters of the greetings mission, so the two read as one person's life.
  - **Talk about your work** and **Describe where you live** — built on the office
    and flat texts, two passages that had sat in the pack unclaimed. Narration
    missions like describing a morning, not dialogues.
- 120 sentences, 12 passages and 24 communicative functions of content, all
  generated and **unreviewed** like the rest of the pack — `npm run review:data`
  lists the new rows for an editor.
- A briefed task for the past-tense mission
  ([docs/tasks/past-tense-mission.md](docs/tasks/past-tense-mission.md)),
  deliberately not built: the content it would teach is not in the pack yet, and
  authoring the sequence and the language at the same time is how a mission ends
  up drilling whatever its author happened to write.

### Fixed

- A variation slot can no longer offer a choice with no text. A slot renders as a
  `<select>`, so an empty target was a blank line in a dropdown rather than an
  option — `variationProblems` refuses one now, which caught two while the new
  missions were being written.
- `languageOption` searched only the target languages, so a pack's meanings were
  reported as available in "en" rather than in English.

### Changed

- **Study is one section at a time.** It had grown to about seventy rows in one
  column — seven missions, three word kinds, three sheets, forty-one patterns and
  thirty-five categories — so the thirty-five categories buried everything above
  them. The sections are now a strip of links with the open one in the URL
  (`/es/a1/study?tab=grammar`), and a section with nothing in it is not offered at
  all. On a desktop, four of the six sections now fit on one screen.
- **Grammar and abilities are separate sections.** A grammar pattern is how the
  language works; a communicative function is what you can do with it, and the
  dataset has drawn that distinction since skills existed. One list mixed
  `presente de indicativo` with `Pedir comida o bebida`.
- **Grammar tiles get a grid of their own.** A pattern's title is
  target-language text with its translation under it, and the narrow grid the
  one-word sections use broke both across three lines each on a desktop.
- The course and level control on Study is a one-line summary that opens over the
  page, the same trade Test makes for its session options — it was four lines of
  chips and prose above the material.
- The section switcher Settings introduced is now a shared component, so the two
  screens cannot drift apart on keyboard or screen-reader behaviour.

### Added

- **Four palettes, in light and dark.** Indigo (the original), Teal, Plum and
  Sand — the last inverting the temperature, with warm paper, a bronze accent and
  therefore a cool second accent. A palette is its own axis, so it survives the
  theme switching around it, and the picker's swatches are the real palettes
  rather than copies of their colours.
- **A contrast scale with four steps**: Soft, Normal, More and Maximum. A level
  restates a palette's neutrals as positions along that palette's own ink-to-paper
  axis and touches no hue, so one level serves every palette — including ones
  written later. Soft is quieter, not less legible: every palette is checked
  against every level at WCAG AA, and the levels are asserted to come out in
  order.
- **Content packs are treated as add-ons.** Settings lists each pack with its
  version, language, levels, accents, recorded voices, licence and review state,
  and counts what it actually holds — word cards, phrases, sentences, texts,
  patterns, categories — from the repository rather than from the manifest's
  description. A skipped record is now attributed to the pack whose file it came
  from instead of appearing as a lone number.
- **Missions have a home in Study.** The whole ladder is listed in authored order
  with each mission's standing, so an earlier one can be revisited and the route
  ahead is visible. Test still leads with the next unfinished mission and links
  across to the list.

### Changed

- **Settings is five sections instead of one column of eleven cards**, grouped by
  whose setting it is: Learning, Appearance and Audio are the learner's, Packs and
  About are the app's. The open section lives in the URL
  (`/es/a1/settings?tab=appearance`), so it survives a reload and can be linked
  to; an unrecognised one opens the default rather than breaking.
- Study's promise is now scoped rather than absolute: the sheets record nothing,
  and the missions section says out loud that a mission's last stage does.
- Where a learner stands in a mission is computed in one place
  (`domain/missions/progress.ts`) instead of inline on the home screen, so the two
  screens that ask cannot answer differently.

## 0.1.0-alpha.4 — 2026-08-22

### Changed

- **Browse filters stay out of the material's way.** Search remains immediately
  available, while letter, content, category, usage and region filters now live
  in one labelled sheet behind a compact active-filter summary.
  This removes the duplicated topic control and the clipped nested category
  scroller, hides empty style choices, and brings results back above the fold.
  The letter index is now a balanced responsive grid with an explicit reset
  inside the filter sheet instead of a clipped row with a horizontal scrollbar;
  long filter sheets also offer their clear action at both the top and bottom.

## 0.1.0-alpha.3 — 2026-08-22

### Added

- **An adaptive daily path.** Home keeps one obvious first action, then offers at
  most two useful next steps from existing evidence: continue the mission after
  due reviews, strengthen recall, or meet five new items. Learning rhythm
  also reports when the current course was last practised, without a streak that
  can be lost.

## 0.1.0-alpha.2 — 2026-08-22

The first tagged alpha. Breaking changes are expected between alphas, including
to stored learner state, and are not called out individually until 0.1.0 is
tagged.

### Added

- **Response palettes and Variation Labs.** All seven missions teach several
  natural ways to perform their central communicative move instead of one
  theatre-script line. Learners can also swap meaningful slots to generate 314
  valid study phrases across wellbeing, café orders, directions, clothes, hotel
  stays, plans and routines; then listen, hide the Spanish and produce the result
  from meaning. Generated combinations remain transient rather than acquiring
  fake progress-bearing item ids.
- **Two sections: Study and Test.** The nav offered five verbs — Practice, Read,
  Browse — that gave no clue which of the two things a learner was about to do,
  and every entry point on the home screen started a session: six ways to be
  graded and none to be taught. `/study` is now the material, and the split is
  the domain's own rather than a new invention — `mode: 'study'` records nothing
  and only `mode: 'practice'` feeds the scheduler, so every link on that screen
  leads somewhere that cannot reschedule what it showed you. Browse and Read are
  sheets _inside_ Study rather than destinations of their own; both keep working
  as deep links, and the section stays marked while you are on one. Nothing on
  the screen is a hard-coded list: the word kinds, the categories and the
  grammar patterns are counted from the packs, so a second language grows tiles
  with no edit, and a tile that would lead nowhere is not offered — which is what
  hides the seven numeral skills no item carries.
- **A study sheet is a thing you can link to.** Browse's filters were component
  state, which made a filtered sheet the one view in the app with no address: no
  bookmarking "the nouns", no sharing it, nothing to restore after a reload,
  nothing for Study to put on a tile, and no way for an agent to drive it. They
  live in the query string now (`?type=word&pos=noun&topic=body&sort=az`), read
  and written through the same pair a session link uses, so `?pos=verb` cannot
  come to mean one thing in a sheet and another in a session.
- **Style is a filter you can pick two of.** "Formal or casual, just not slang"
  was not expressible: `ItemFilter.registers` has always been a list and the link
  has always carried `?register=a,b`, but the control was a single select. It is
  a row of chips now, each carrying its own count, so a style with nothing in it
  reads `0` rather than looking like a live option. `slang` joins the register
  vocabulary, because it is neither `colloquial` nor `vulgar` — `vale` is casual
  and completely standard where `chido` marks the speaker as Mexican.
- **The region filter stops pretending.** Argentina and Colombia were offered
  while no item was marked for either, and because region-neutral content passes
  every region check, choosing one returned almost the whole pack and looked like
  it had worked. Only regions the packs actually mark something for are listed
  now, each with its count, counted on _declared_ regions rather than on what the
  filter would return — the difference being the whole point.
- **Practise one grammar pattern, or one tense.** `?skill=preterite` narrows a
  session to the items a skill is attached to, so "the past tense" and "the
  `me gusta` pattern" are things a session can be asked for. The repository has
  supported the filter since skills existed; nothing could reach it — no preset
  set it and the URL did not carry it, which is the same "a link can hold a
  filter nothing reads" bug the session URL was centralised to prevent, in the
  other direction. Skills travel as their local id (`preterite`, not
  `core-es:skill:preterite`) for the reason passages do: a shared link should not
  carry a pack namespace it will outlive. A slug no loaded pack declares resolves
  to nothing and widens the session rather than emptying it.
- **Browse alphabetically, both ways round.** A row of letters sits above the
  results, and the list can be ordered pack order, A to Z or Z to A from the line
  that counts it. Only the letters the course has content under are offered,
  counted from the packs themselves exactly as the categories are, so the Spanish
  pack shows 23 of them and no K, and a pack that grows its first one gets the
  chip with no code change. The two controls are deliberately different kinds of
  thing: a letter narrows _which_ items there are, so it belongs to the filter and
  travels into the session link (`?initial=c`), while a sort only decides the
  order they are dealt in here — `ordering` is a session's own business, asked for
  rather than inherited. Both agree on what alphabetical means, from one
  definition in `domain/content/alphabet.ts`: `¿Qué hora es?` files under Q rather
  than under its punctuation, `está` under E, and `ñ` is a letter of its own
  rather than an n. An index and an order that disagree are two alphabets.
- **A play button on every Browse result.** Browse is where you go to look a word
  up, and it could show you Spanish without ever saying it. Each row has one now,
  named after its own phrase — `Listen to “cerveza”` — so a screen reader or an
  agent picks a row rather than one of forty identically-named controls. It plays
  the _item_ rather than reading its text, so a recording the pack ships is
  preferred over the device's voice. Where there is nothing to hear, because
  neither exists for that item, the button is absent rather than dead: forty
  controls that do nothing is worse than none.
- **A design language, written down and enforced.** The app read as a form: 138
  border declarations across 24 stylesheets, outlining every card, panel, row,
  badge, banner and button. Six rules replace that — depth rather than outlines,
  soft geometry, overlay rather than push, one display voice, colour that means
  something, motion that confirms without informing. Three borders are left, each
  enumerated with the reason it earns its place: native form fields, whose
  boundary genuinely is the only thing identifying them, and the rule between
  lines of a passage. `tests/a11y/design-language.test.ts` fails on a fourth, and
  on a hard-coded colour outside a theme file. The reasoning, including why
  Tailwind was considered and declined, is in
  [docs/design-language.md](docs/design-language.md).
- **The design system, at `/design`, showing itself.** Every colour role, token,
  icon and control the build is actually drawing with — read out of the loaded
  stylesheets rather than from a list someone has to remember to update. Add a
  token and it appears; rename a role and the old name goes; switch theme and
  every value re-reads. A token matching no group lands in "Everything else", so
  nothing can be silently missing. Code-split, so a learner who never opens it
  never downloads it. Reachable from Settings.
- **An icon set, behind a seam.** Lucide (ISC): one 24px grid, one stroke weight,
  tree-shaken per glyph, and `currentColor` throughout so an icon belongs to
  whatever it sits in. `src/components/icons.ts` is the only file allowed to know
  the vendor, the same rule TTS and storage already follow, and names are
  semantic — `listen`, not `ear` — so a better drawing can replace an old one
  without touching a call site. It replaces the unicode glyphs and emoji the
  chrome was built from, which rendered as a flat outline on one platform and a
  full-colour cartoon on another. About 8.6 kB gzipped for the whole redesign,
  icons included.
- **`Sheet`, `Chip` and shared surface recipes.** Three components that existed
  as near-copies: the overlay VoicePresence and WordInfoSheet each hand-rolled,
  the pill CourseBar and CategoryPicker each drew, and "a card" written out in six
  stylesheets with three radii between them. Each copy was missing a different
  part — a viewport cap, a selected-hover rule, an animation fill mode.

### Changed

- **Learner records now carry the three things nothing could work out later.**
  Stored state is at database version 2, migrated inside the version-change
  transaction rather than after it. A progress row keeps the `packId` its item id
  already contains, because an IndexedDB index is built from a stored key path and
  a row missing one is absent from the index rather than merely incomplete — which
  reads like lost history. It also keeps `updatedAt`, which is a fact about the
  row rather than about the learner and is what any future merge of two devices
  has to compare. And an attempt's id is no longer the item and the clock joined
  together: that was a value the tracker could compute on its own, so two answers
  to one item inside the same millisecond shared an id and the second silently
  replaced the first. Session ids gained the same treatment, drawn from the
  session's own rng _after_ the ordering so a seeded session still deals the same
  items and still reproduces its id exactly.
- **A control that expands now opens over the page, never inside it.** Opening
  the practising panel used to push the quick-session buttons, all six presets and
  the rest of Home down by around four hundred pixels, so narrowing _what_ you
  practise moved the button you were reaching for off the screen. It is a sheet on
  a phone and a panel on a pointer device, and the height of a screen is no longer
  a function of which disclosures happen to be open.
- **Answer feedback has weight.** The graded option settles and its ring firms up
  from nothing; the verdict band does the same. Additive only — `role="status"`
  still announces the result, the end state is identical with motion off, and
  nothing waits for the animation, because latency is the enemy of fun. Right and
  wrong get the same weight: a wrong answer is information, not a buzzer. This
  closes §4.2 of [docs/tasks/game-feel.md](docs/tasks/game-feel.md).
- **The navigation is an anchor rather than a strip.** Frosted, so content reads
  as passing underneath rather than vanishing at a hard line, and the active tab
  wears a filled pill behind its icon — a shape appearing rather than a hue
  changing, so position survives a colour-vision difference. Its height and the
  rail's width are single tokens that `AppShell` reserves space from; they used to
  be four hand-written numbers describing two things, which is how a taller bar
  ends up overlapping the last button on a page.
- **New colour roles, all contrast-checked in every theme.** Verdict tints
  (`--color-success-soft`, `--color-danger-soft`) so "correct" is one green rather
  than three hand-mixed percentages; `--color-track` for a bar that reports
  position, held to 3:1 against the fill; `--color-chrome` for the header and tab
  bar; `--color-accent-edge` for the band a filled button presses down onto. Plus
  a three-step elevation scale per theme, which is what carries the hierarchy the
  borders used to.
- **Word cards say what their buttons do.** Growing a phrase was labelled by its
  contents — `que ＋` and `＋ que` — so the accessible name depended on a
  fullwidth plus sign being read out, and two controls differed only by which side
  the glyph fell on. They are `Add “que” after` and `Add “que” before` now.

### Fixed

- **Android Chrome sheets no longer open with an empty body.** Shared sheets are
  portalled outside the sticky header's `backdrop-filter` stacking context, so
  their viewport overlay and z-index apply to the whole screen rather than only
  the header strip.
- **Recent sessions showed another language's history.** Every other panel on
  Progress is narrowed to the course, because a progress row carries an item id
  and an item id carries its pack. A finished session is counts and timestamps,
  so there was nothing in the row to narrow by — a French session listed under
  Spanish, and no migration could ever have worked out which was which. A session
  record now says which course it was practised in, and the screen asks for that
  language. Narrowing happens inside the store, before the limit, so a page of
  five is five; rows written before this stamp the language the learner had
  stored, which is the only evidence there is.
- **A cloze offered choices you could rule out without knowing any Spanish.**
  `cloze-choice` sampled three of a verb's two dozen forms at random, so a blank
  for `hablo` could be offered against `hablando` and `hablad` — two shapes that
  cannot stand in the gap at all. The choices are ranked now, by the same kind of
  weighted score the multiple-choice distractors already used: the finite,
  gerund or participle class first, then mood, then a preference for forms that
  differ from the answer on _one_ axis only. That last term is what makes the
  card teach something — hold the person and vary the tense and the learner is
  answering "when"; vary both at once and the card isolates nothing.

- **Multiple choice gave the answer away by punctuation.** `¿Tiene fiebre?`
  offered against three statements is answered by whoever spots the only option
  ending in `?`, with no Spanish involved — and that was true of every one of the
  pack's 76 question cards. Distractors are ranked by how much they look like the
  answer before anything else: same sentence form first, then item type, level,
  theme and comparable length, as a score rather than nested filters so a thin
  topic degrades to "a question from anywhere" instead of falling back to
  statements. Across all 1043 cards, choice lists mixing questions with statements
  went from 212 to none, and the number where one answer is visibly longer than
  the rest from 125 to 21 — with fewer off-topic distractors than before, not more.
- **Tap-to-build marked a correct sentence wrong over a comma.** The tiles
  included one for `,` and one for `.`, so `Abre la boca por favor` — the right
  words in the right order — failed for punctuation the exercise never set out to
  teach. Punctuation is not a tile any more and not graded; the answer is still
  shown as the sentence is actually written.
- **A sentence that says a word twice could not be built at all.** Tiles were
  tracked by their text, so the second `la` of `Veo la televisión por la noche.`
  went dead the moment the first was placed — leaving 46 of the pack's 592
  sentences impossible to finish, and graded wrong every time they came up. They
  are tracked by position now.
- A `<div>` wrapping the practising sheet collected a grid `gap` even with nothing
  but a fixed child in it, growing the page by 12px on open — the exact failure
  the sheet exists to prevent, reintroduced by the markup around it.
  `aria-controls` points at the dialog itself now, which is also the more accurate
  relationship to describe.
- The style guide read its token values one theme behind. `applyTheme` runs in an
  effect in `App` and a child's effects run first, so keying the read on the theme
  _preference_ meant the page rendered the previous palette; under
  `theme: 'system'` it would not have noticed an OS switch at all. It observes
  `data-theme` on the document instead — the thing the values actually depend on.

- **Word kinds: pull up the verbs, or the nouns, and study the batch.** A part of
  speech is a filter dimension now, in Browse and in a session link
  (`?pos=verb,noun`), so "everything that uses a verb" or "the nouns" is a set you
  can point at, look over and then hand to _Practise these_ or _Study these_. The
  kinds on offer are counted from the packs actually loaded and the empty ones are
  dropped, exactly as with categories — a pack that grows adverbs gets the
  category with no code change. The Verbs preset is the same filter rather than its
  own enumeration of every verb lexeme in the pack.
- **Courses: a language and a level, in the URL.** Every screen now lives under
  `/<language>/<level>` — `/es/a1/browse`, `/es/all/read/700001` — and `/` is a
  redirect into the course the learner left. A level is a _ceiling_, not a
  chapter: `a2` includes A1 material, because practising it is review rather than
  regression. The counts, the browse results, the reading list and what a session
  plans all narrow to the current course, and switching level keeps you on the
  screen you were on. Only Spanish A1–A2 ships, but the courses on offer are
  derived from the packs actually loaded, so a second language pack appears in
  the picker — and in the URL — with no code change; a French fixture pack in the
  test suite is what keeps that honest. Paths written before courses existed
  redirect into one and keep their query string.
- **Content preferences: what to practise, and what to lead with.** A standing
  choice on the practice screen — any number of categories, plus one of balanced,
  shaky items, reviews or new material. A focus is a bias and never a filter: it
  reorders the buckets the planner already sorts into, so "the ones I keep getting
  wrong" cannot hand back an empty session on the day nothing is shaky, and
  `focus=new` is the one case that lifts the cap on unseen items. The choice
  persists, so Quick practice respects it without being re-picked every time, and
  it is written into the session link, so a session stays fully described by its
  URL.
- **Phrases can be asked about, not only words.** `tener que` means "to have to"
  while `tener` alone means "to have", and the dataset has always recorded that
  as a multi-token annotation — but nothing could ask about a span. A selection
  now grows a word at a time from controls in the sheet, which name the word they
  would add, and a phrase gets its pattern, a word-by-word breakdown, the
  sentence it sits in, and other phrases built the same way. Buttons rather than
  a drag: a drag across two words is imprecise on a phone, invisible to a
  keyboard and unnameable to a screen reader.
- **Meanings everywhere they were missing.** Browse results, the "sentences to
  revisit" list on Progress, and the example sentences under a practice card are
  all tappable now — Browse being the worst place in the app to have lacked it.
  A cloze question is the one machine-graded card that opens up _before_ it is
  answered: its answer is the missing word, which is drawn as the blank rather
  than as a button, so the words around the gap give nothing away. Multiple
  choice stays shut, because the meaning of the sentence is what it is asking.
  On a screen showing several phrases each word names its own line, so an agent
  and a screen reader can tell four controls called "About “Tengo”" apart.
- **An elapsed-time readout in a session,** with the total and the pace on the
  summary. No limit, no countdown and no penalty — a countdown would turn
  practice into a test. It can be switched off in Settings, it does not announce
  itself to a screen reader every second, and it reports for a study session too:
  that session is not scored, but the time it took is still a fact about it.
  Progress now shows how long each recent session ran, which the stored record
  had always known.

- Practice loop with six exercise kinds derived from content, never stored:
  listen & repeat, reveal, think & say, multiple choice, cloze choice, tap to
  build.
- FSRS scheduling, exercise composition that climbs recognition → cued recall →
  production, and derived word- and pattern-level mastery.
- Sessions fully described by their URL, so one can be resumed, shared or driven
  by an agent.
- Browse, reading view with passages, progress, and grouped settings.
- Browsing and practising by thematic category. Topics are a controlled
  vocabulary declared in `content/es/topics.tsv` and shipped in the pack
  manifest with a label and display group, so the build rejects an unregistered
  topic and the picker can show "Days of the week" rather than `days-of-week`.
  Numbers, telling the time, days of the week, months and colours became real
  categories in the process — mostly by classifying sentences that already
  existed.
- Generated `core-es` A1–A2 pack, built from TSV sources with stable item ids and
  editorial sign-off machinery. Marked `source: generated, review: unreviewed`.
- Offline-capable installable PWA: app shell and datasets precached, audio cached
  on first play, all learner state local to the device.
- In-app version, build commit and build date, shown in Settings → Data.
- An update prompt: when the service worker has fetched a new build, the app
  offers a reload instead of taking one. See
  [docs/architecture.md](docs/architecture.md#updates-and-caching).
- Dark and light themes on a token system, held to WCAG 2.2 AA by axe and
  contrast tests in CI.
- Optional speech-input pronunciation check on speaking exercises.
- Deployment on GitHub Pages, live at `https://amivag.github.io/linguastein/`. A
  push to `main` checks, builds and uploads `dist/` as a Pages artifact — which,
  unlike serving a branch, publishes only the build and never the repository tree.
  Served from a project page, so the app now carries a base path: one `BASE`
  constant reaching Vite, the router's basename, the manifest's `start_url`,
  `scope` and icons, and the dataset fetches. Includes an SPA fallback, and
  `robots.txt` and `<meta>` opt-outs for crawlers and model training. Rationale
  and the known rough edges in [docs/deploy.md](docs/deploy.md).
- Production sourcemaps are on again, the repository being public: they give a
  visitor nothing GitHub does not, and they are the difference between debugging a
  phone-only problem and guessing at one.

### Changed

- **Words are tappable on a graded card too; only the meaning waits.** Multiple
  choice rendered its phrase as inert text until it was answered, which made the
  screen you actually study on the one place in the app where "what is this word?"
  had no answer. Every word opens now, and what the card is grading is still
  safe: a meaning-recognition card withholds the gloss, the pattern's explanation
  and the example translations until the choice is in — and says so, rather than
  leaving a gap that reads as an unknown word — while the lemma, the form, the
  gender and the verb's other forms, which answer nothing the card is asking, are
  there while the question is live. A cloze already blanked out the form it grades,
  so its sheet keeps everything.
- **Flashcards no longer deals the same cards every time.** The preset ordered by
  pack order, so pressing it handed over the first ten items of the pack on every
  press, for the life of the install — the one place "I keep seeing the same
  material" was literally true, and nothing to do with the scheduler. Studying is
  the mode with no memory, which is exactly why it must not start from the top.
  Pack order is still reachable with `?order=sequential`, which is what a text
  that has to be read in order asks for.
- **A livelier palette and a display face for the things you read.** The app was
  clean and slightly austere: one flat background, one hue, and headings that
  were body text set larger. The page now has a light source — a fixed wash from
  a second background role down to the first — the three counts on the practice
  screen are three tinted cards rather than one panel of grey numbers, and there
  is a warm second accent for the places where colour is liveliness rather than
  meaning. Two new tinted roles replace a dozen hand-written
  `color-mix(accent 14%)` values that had drifted into four slightly different
  shades, and both are held to the same contrast bar as everything else — nine
  new assertions across both themes. Typography gained a display face resolved
  from what the device already has, so nothing can fail to load offline, plus
  tracking and leading tokens by role; phrases, headings and big numbers use it.
- **Preferences saved in quick succession no longer overwrite one another.**
  `write` reads the stored record, merges and puts it back, so two overlapping
  calls both read the same starting point and the second silently discarded the
  first. Nothing hit it while every preference was a lone switch; picking three
  practice categories in a row hit it every time. Changes are now applied locally
  at once — so the next tap computes from the value the last one set, and a
  control does not sit unmarked while the write lands — and the writes are chained
  so they cannot interleave inside the store.
- Browse's level filter is gone, replaced by the course's own level control.
  Level was a select among five, and a course whose level said one thing while a
  select said another is two sources of truth for the same question.

- Renamed from Lingo to **Linguastein**, including the IndexedDB database and the
  `linguastein.theme` key. Local practice history from a pre-rename build is
  orphaned rather than migrated — done now, while the only device affected is a
  development one.
- Relicensed from MIT to **AGPL-3.0-only** for the code and **CC BY-SA 4.0** for
  the datasets, copyright amivag. Free and open with attribution, but a modified
  version served to others must publish its source. Contribution sign-off is now
  required ([CONTRIBUTING.md](CONTRIBUTING.md)) so a future commercial licence
  stays possible.
- "Reset progress" now asks for confirmation before erasing learner history. It
  is irreversible and there is no server copy, so a single mis-tap should not be
  enough.
- Browse's filters are confined to a fixed area instead of growing with the
  pack. The thirty-five category tiles scroll inside a box of a set height, the
  topic `<select>` moved up beside the "Categories" heading as their compact
  half, and the four remaining selects sit on one row. The results used to start
  a screen and a half down; they now start above the fold, and adding a category
  no longer pushes them further.
- The voice moved into the header, on every screen. A chip names the voice that
  would actually speak — or says plainly that none is installed for the locale —
  and opens the full set of audio controls in place. Pronunciation is a running
  condition rather than a setup step: the accent you want changes with what you
  are reading, and "why is this silent?" is best answered where it is asked.
  Settings shows the same component, so there is one source of truth for what it
  changes, and the audio seam gained `voiceFor` so the UI can name the voice
  instead of promising an unspecified best match.
- Playback on the graded cards, which had none. A fresh Quick practice session is
  almost entirely multiple choice, so the preset opened on a silent card. Multiple
  choice can now be heard straight away — the Spanish is on the card and the
  choices are meanings, so hearing it reveals nothing — while a cloze and a
  tap-to-build stay silent until answered, where the audio would say the missing
  word or read the parts out in order. Tap-to-build also shows the sentence once
  checked, so there is finally something to hear and to open words from.
- A word card can be opened like a word inside a phrase. A vocabulary item
  carries a lexeme and no tokens — the card _is_ the word — so `cerveza` rendered
  as inert text and the gloss, part of speech, gender and example sentences the
  dataset already held for it were unreachable from the card. `inspectItem`
  derives the same entry from the item's own lexeme, so a word card and a word
  inside a phrase are explained by one code path rather than two that drift. On a
  graded card it stays shut until answered, where the meaning is the answer.
- A listen can be ended. Both microphones — dictation in Browse, the
  pronunciation check in practice — disabled themselves while listening and
  offered no way out, on the assumption that the recogniser always ends a listen
  itself. It does not: it ends one when it judges the speaker to have finished,
  and background noise can keep it from ever judging that. Each mic is now a
  toggle that stops what it started, a listen nobody ends is abandoned after
  twenty seconds, and leaving the screen releases the microphone. Stopping on
  purpose reads as a cancelled listen rather than "could not hear that".
- Starting a second listen no longer strands the first. The aborted recogniser
  reported its end after the new one was already listening and cleared the
  provider's handle on it, leaving a live microphone that nothing could close —
  the state a stop button alone would not have rescued.

### Known gaps

- The pack is machine-generated and **not reviewed curriculum**. No item has been
  signed off yet.
- PWA icons are SVG-only, which does not satisfy Chrome's install criteria — the
  app runs offline but will not offer to install. Tracked as roadmap item 7.
