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

### Fixed

- **A second course no longer inherits the first one's settings.** Five things a
  learner chooses — how far up the levels they are working, which categories they
  are practising, what a session leads with, the accent, and the voice — were stored
  once for the whole device. That was correct while there was one course and quietly
  wrong the moment a second pack could load: Spanish-at-A2 and French-at-A1 cannot
  both be true of one level, `food-drink` means nothing to a French pack, and a device
  voice that can read Spanish cannot read French. The last was the worst of them,
  because there is nothing on screen to explain it — the play button simply goes quiet.

  They are stored per target language now. Switching away from a course and back
  finds its level, its categories and its voice as that course left them, rather
  than as the last course did. Which course `/` reopens is still one setting,
  because it is one pointer; everything about _that_ course travels with it.

  Two workarounds went with the change, and their absence is the point. The course
  switcher used to carry the accent across a language switch and reset the voice
  along with it, correcting a value that could not be right for two courses at
  once. It does not have to any more. The narrowing that happens when a course is
  _opened_ stays, and stays necessary: a learner can still have stored an accent
  that the pack has since stopped offering, which is a resolution rather than a
  correction.

- **Settings that come back malformed are repaired rather than obeyed.** What is
  read out of storage was trusted exactly as written, so a palette id retired by a
  later build reached the theme attribute and a nonsense level reached the course
  resolver. Every field is now checked on its own: an unreadable value is replaced
  by its default and reported, a key this build does not know is dropped, and the
  rest of the record survives — losing a name, a reading size and a reference
  language to one bad palette id would be a worse answer than the bad palette.
  Practice never fails because a setting is malformed.

### Changed

- **The journey on Home is a strip you can move through.** The mission card showed
  the next rung and nothing else; the whole ladder lived in Study, so "not that
  one, the one after" — a one-gesture decision — was a two-screen trip.

  Every mission the course offers is now a card on Home, swipeable on a phone and
  with arrows and a `3 of 13` readout for everyone the swipe does not serve.
  Missions were never gated, so nothing about this skips a lock: Study has always
  linked to any of them.

  The recommendation survives it. The strip opens on what the app suggests doing
  next — review when anything is due, otherwise the first unfinished mission — and
  marks that card rather than leaving it to whichever one the strip happens to be
  scrolled to, which is not something a screen reader can convey. Study still holds
  the ladder and still says more about a rung than a card can.

  Whole cards only, and as many as fit: two on a wide screen, one on a phone. The
  card is sized from the strip rather than being fixed, so nothing is ever cut off
  at the edge — a mission card's cropped edge is a fragment of a title over a
  fragment of a Spanish phrase, which reads as a layout that has gone wrong rather
  than as the invitation a peeking card is supposed to be. The arrows and the
  `5 of 17` beneath say there is more, plainly.

  It is a scrolling list rather than a carousel, and that is the whole of the
  accessibility story: every card is a real list item that is always in the
  accessibility tree, the strip itself takes keyboard focus so it can be moved
  without a pointer, and each card's button names its own mission — thirteen rows
  reading `Begin mission · 18 min` would be unusable in the control list a learner
  is choosing from. The estimate moved into the card's facts, beside the line
  count, where a duration belongs.

- **The level is a dropdown, and Home's practice choice sits with the button it
  changes.** Two small things about the screen a learner opens most.

  The level was a row of chips carrying every count at once, which was the right
  trade for four CEFR rungs and the wrong one now that a pack declares its own
  ladder — an HSK pack is six rungs plus "all levels", and even four chips wrapped
  onto a second row on a phone and took the top of the screen away from the search
  and the first mission. One control now, reading `A1 · 2059 items`, with the count
  kept because in the compact bar it is the only place the in-scope figure appears.

  And **Practising** — the standing choice of categories and what a session leads
  with — has moved from the very bottom of Home to directly above the Free practice
  button, as one block with it. It was last on the page and on the bare background,
  which read as a footnote to a screen it has nothing to do with. It is not a filter
  on Home: the mission, the course counts and the due figure all ignore it. What it
  governs is the sessions Home starts, so it now sits with the button that starts
  them.

- **Meanings are their own download now.** A pack's translations were a file inside
  its manifest, which made the language matrix multiplicative in the worst place:
  adding Chinese meanings to a Spanish pack meant editing that manifest, which
  re-versions the pack, which changes every one of its file URLs — so serving one
  new audience cost every existing learner a 6.4 MB re-download of Spanish that had
  not changed a byte.

  A translation set is now keyed `(pack, reference language)` and addressed on its
  own: `packs/translations/core-es/en/0.16.0/`, versioned in its path, listed in
  `catalog.json`, and named nowhere in `pack.json`. Adding a language is a new
  directory and one more line in the catalog. `catalog.json` is the only unversioned
  file in the tree, which is exactly what lets it name a unit published _after_ the
  pack it explains.

  `referenceLanguages` came off the pack manifest with the files. It was derived
  from the translations the pack shipped and was honest while it shipped them — and
  it was also the last field that would have forced a re-version to add a language.
  The picker reads what is loaded plus what the catalog can supply; Settings → Packs
  reports what is on the device by reading each meaning's `ref` back through the id
  parser.

  For a learner the visible half is the download. Boot fetches **one** reference
  language rather than every language a pack was ever published in, and choosing a
  different one in Settings fetches it then — the setting applies after the meanings
  arrive, because a preference pointing at glosses that have not landed shows the
  English fallback and reads as a control that did nothing. Keeping a course offline
  still keeps its meanings: they are priced, downloaded and removed with the pack,
  since a pack held without them opens offline and cannot explain a single word.

  Two failures that could not previously exist are checked, because a unit and its
  pack now move at different speeds by design. A unit whose records are not in the
  language its address claims is reported at load — the fetch is decided by the
  directory and the index is built from each record's own `lang`, so a German gloss
  under `en/` would be downloaded by an English learner and then be invisible in
  both languages. And the dangling-reference check moved to where it can now fail:
  a gloss explaining an item the pack has since dropped.

### Added

- **A set can be removed.** A learner could assemble a set on Browse and had no way
  to unmake one: `BatchStore.remove` existed and only the full local reset called it,
  so the way out of a set you regretted was erasing every attempt, session and review
  schedule on the device. That is not a way out; it is a reason to stop making sets.

  Each set on Study → Sets now carries its own remove control, named with the set —
  `Remove Words · Food and drink` — rather than a column of buttons all called
  "Remove", which is the one thing the agent-surface rule forbids and exactly the
  shape this list would have produced. It sits beside the card rather than inside it,
  because the card is the thing you press to practise and a button nested in a link is
  invalid markup reachable in an order it does not look like it is in.

  **The confirm says what is actually being deleted, and that is the substance of it.**
  Removing a set forgets the _grouping_. The items were practised; the attempts, the
  review schedule and the progress all belong to the items, and nothing about them
  changes — so the sheet says so in those words. A learner who reads "remove" as
  "throw away the work" keeps a set they no longer want rather than risk it, which
  leaves the feature in the state it was already in.

  Removing the last set takes the Sets tab with it, and a URL still asking for
  `?tab=batches` opens the first section the course has. That is the rule the screen
  already followed for a tab this course does not offer, rather than a case added for
  this one.

  Renaming is still not offered, and deliberately: the label is derived from the
  filter, which is right at creation and wrong a week later when two sets both read
  "Words · Nouns". It needs a text input and the accessible naming that comes with
  one, which is a change of a different size.

- **Playback you can follow.** Audio used to be a button that made a sound: nothing
  said it had started, nothing said where it had got to, and a text or a dialogue was
  spoken as one enormous utterance built by joining every sentence with a space. That
  shape rules out everything else by construction — there is no position to report, no
  line to start from, and nothing to hold, because the engine was handed a paragraph
  and asked to deal with it.

  A passage and a mission's exchange now play **one line at a time**, with a transport
  that fits reading along: **Pause** where a word needs looking up, **Resume**,
  **Stop**, `Sentence 3 of 12`, and a line's own play button that means "read this one"
  when nothing is playing and **"carry on from here"** when something is — the name
  changes with it, so the offer is stated rather than inferred. A practice card's Play
  becomes Stop while it speaks.

  Inside the line, the **word being spoken is lit**, from the boundary events the
  speech engine reports as it goes. Character offsets stop at the provider seam and
  `deriveTokenSpans` maps them onto tokens at render time, which is what §15 has always
  said those offsets are for. It degrades honestly: Safari reports no `charLength` and
  measures the word instead, a network voice on Android reports nothing at all and the
  line-level state carries it alone, and recorded canonical audio has no word marks in
  the dataset yet, so it plays with the line marked and no word lit.

  Which line is speaking is `aria-current` on the line — a fact about the list, at a
  rate a screen reader can follow. The word inside it deliberately carries no ARIA and
  no name change: it moves three or four times a second, and a control whose state
  changed that fast would wreck the tree for the reader being read to already. The
  playing state lives on the audio service rather than in a screen, so a row in Browse
  can no longer sit lit while a different row is the one speaking.

- **The alphabet, shown rather than only filtered by.** Browse had a row of letter
  chips, Study had a category called "The alphabet" holding thirty-seven sentences
  about spelling, and `src/languages/es/alphabet.ts` had known every letter's name
  since it was written. Between them they answered every question except the two a
  learner actually arrives with: what are the letters, and how do I say them. A
  category of `¿Se escribe con be o con uve?` is the right material and is useless
  to somebody who does not yet know that `uve` is a v.

  Study has an **Alphabet** section now: all twenty-seven letters in both cases,
  what each is called, that name respelled for reading, what the letter sounds like
  _inside_ a word, two or three words to hear it in, and the cases where it does
  something else — `h` silent, `b` and `v` identical, `c` and `z` splitting between
  Spain and Latin America, `g` turning into a `jota` before `e`, `x` in `México`.
  Every letter and every example plays. Beside the twenty-seven, and deliberately
  not among them: `ch`, `ll`, `rr`, `qu` and `gu` as pairs that spell one sound, and
  the accent and the diaeresis as marks that are not letters. So the chart teaches
  `calle` while still counting twenty-seven.

  The letters are language knowledge rather than pack content, so they arrive
  through a new **runtime half** of the language module
  (`src/languages/runtime.ts`), the one `docs/tasks/language-matrix.md` §6 has
  briefed since before there was anything in it. It hands back a loader rather than
  a promise: whether a course has a chart is answered synchronously, so the tab is
  decided with every other tab, while the chart itself loads in its own chunk for
  the learner who opens it. A language with no chart shows no section.

- **The present subjunctive, generated — and B1 behind it.** The conjugator built
  seven indicative tenses and the affirmative commands, which is most of Spanish
  and none of B1: the level is more or less defined by the mood, so authoring B1
  content on top of an indicative-only engine would have shipped sentences
  labelled B1 that a B1 learner would notice were missing the thing that makes
  them B1.

  Now `conjugate` emits it from the yo form's stem plus the opposite
  conjugation's endings, with the boot broken the way each conjugation breaks it —
  `pensemos` and `podamos` reverting, `pidamos` and `durmamos` taking the
  preterite vowel. Seven verbs declare a paradigm instead: six that have no usable
  yo form (`soy` would give `soya`) and `reír`, whose stem loses its accent when
  the stress moves onto the ending.

  It also collapsed something that had been true all along. A usted command _is_
  the third person present subjunctive, so `imperativeFormal` was `sepa` declared
  twice with two places to be wrong; the commands are now read off the paradigm,
  checked across every verb the pack ships. `presente de subjuntivo` is a
  practisable skill and `no hables` a pattern, because the negative command is the
  one place the mood is not optional-feeling: a learner who says `no habla` has
  said "he does not speak".

  Three near-misses are worth recording, because none announced itself. Keying a
  form on tense and person alone gave `hablo` and `hable` the same id, the exact
  collision that key's own comment warns about. The skill loop read tense before
  mood, which would have filed every subjunctive sentence under `presente de
indicativo`. And `entre` — the preposition — lost every sentence it had the
  moment `entrar` gained a subjunctive, caught by the A2 recycling ratchet rather
  than by anything watching for it; a subjunctive reading now needs a trigger
  immediately before it, which is the same rule the skill's gloss states.

- **Pack file names state their level range, and the build derives it.**
  `es-a1-a2-core-*` was typed into ten paths, so the first B1 sentence would have
  made all ten claim a range the pack no longer had. Derived from the levels
  present, it renamed itself instead. The build now also deletes any `.jsonl` it
  did not write — appending to the directory had left the old nine beside the new
  nine for the service worker to precache — and nothing else spells these names:
  `generate-audio.ts` and the test fixtures both ask the manifest, which is what
  the app's loader has always done.

- **The alphabet.** `src/languages/es/alphabet.ts` holds the twenty-seven letters
  and what they are called, including the regional names a learner actually
  collides with — `ve corta`, `i griega`, `be larga` — and deliberately not `ch`
  and `ll`, which stopped being letters in 2010 and will still be in an older
  textbook. `spellWord` reads any word out letter by letter with the accent
  spoken, because `Gómez` spelled without one is a different surname.

  Eighteen of the names are word cards, not twenty-seven, and the nine missing are
  a decision rather than an oversight: the five vowels are named after themselves,
  and `de`, `te`, `ve` and `ese` are spelled exactly like a preposition, a pronoun,
  an imperative and a demonstrative. A card for `te` the letter would have made
  `te` the pronoun ambiguous in every sentence in the pack. They are taught in
  running text instead, where the context settles it.

- **Asking, as a form rather than as a subject.** The pack held 376 questions and
  1,019 statements and not one place where the _same words_ appeared as both —
  which is the one thing an English speaker most needs, because Spanish adds no
  word and moves nothing: `Tienes tiempo.` and `¿Tienes tiempo?` differ by two
  marks. Twenty-five authored skills were about asking _something_ (the price, the
  way, who someone is) and every one was a situation; none said how a question is
  built.

  Now: `yes-no-question` and `question-word` are generated grammar skills beside
  `imperativo`, classified on what follows the opening `¿` — so `¿Sabes qué hora
es?` is correctly a yes/no question rather than a `qué` question. Mood itself is
  a **filter** (`?mood=question`), derived from the punctuation Spanish requires
  rather than stored, and a word card has no mood so it cannot be counted as a
  statement. Browse gains an "Asking or telling" facet with honest counts, where
  the `questions` topic had been standing in for it and covering under half.

  And the content: five minimal pairs, a dialogue of echo questions
  (`¿Tu hermana vive en Madrid?` answering `Mi hermana vive en Madrid.`) and one of
  tag questions — `¿verdad?`, `¿no?` and `¿vale?`, none of which appeared anywhere
  in the pack before. Written from vocabulary the pack already had, so it pays into
  the recycling target instead of borrowing from it.

  One build rule had to change to allow any of it: the duplicate-text check
  stripped punctuation, so it declared a statement a duplicate of its own question.
  Mood is now part of item identity — `Hola` and `Hola.` are still one item, and
  the pair the pack most needs is two.

- **A recycling ratchet, so a word met once cannot stay that way unnoticed.**
  Durable vocabulary takes six or more encounters in different sentences, and two
  content passes here added one-encounter lexemes as fast as they fixed them while
  the coverage report printed a number nobody had to act on.
  `content/es/recycling.tsv` records how many lexemes are still short per level;
  the build fails when the figure is **higher** — naming the short words, worst
  first — and also when it is **lower**, because an improvement left unrecorded
  hands the next pass back the room this one earned. Not the threshold itself:
  switching that on would fail the build on 397 A1 lexemes and block everything
  else, the same reason `vite.config.ts` sets coverage floors just under what the
  suite reaches.

- **A real 404, and missing content that says what is missing.** Every
  unrecognised address used to redirect to the course home silently, so a stale
  bookmark, a moved screen and a typo all produced a working page that was not the
  one asked for. `NotFoundScreen` now quotes the address back — the one fact the
  learner does not have, and what separates "the app is broken" from "that link is
  wrong" — and offers the course home and Study. `/:language/:level/*` is matched
  before the global `*` so the 404 keeps the course it was reached from; `/` is
  still a redirect, because there is no course-less home. A passage or mission id
  no loaded pack has now names the id, says it may belong to a pack that is not
  installed, and links to Settings → Packs.

- **Two packs can no longer disagree in silence.** A link addresses a passage and
  a skill by _local_ id, so `passageByLocalId` resolves by first match — free with
  one pack, and confidently wrong with two, which is worse than an error.
  `validateAcrossPacks` reports a collision as an error in both `validate:data`
  and `loadPacks`. Making two packs genuinely coexist is a decision rather than a
  patch, briefed in `docs/tasks/pack-addressing.md`.

- **Every noun its plural, every adjective its agreement forms.** `pluralOf` and
  `adjectiveForms` have generated these since the pack existed, and the build used
  the result only to link `verduras` in a sentence back to `verdura`. Nothing
  shipped, so nothing could show it: `formsOf` had verb conjugations to read and
  nothing else, and tapping a noun answered "what does it mean" but never "what is
  its plural" — the one question a Spanish noun always raises. The forms were
  already computed; only the emitting was missing. 1,118 records now ship beside
  the 3,024 verb forms, so **Other forms** appears on a noun and an adjective the
  way it always did on a verb.

  The record is `InflectedForm` rather than `VerbForm` and its pack file is
  `forms` rather than `verb-forms`, because a plural and a conjugation are the same
  kind of fact from the same language module — two record types for one idea meant
  two accessors, two schemas and two places to forget. The surface index is now
  driven from the same records, so what a learner can be shown and what a sentence
  can link to cannot drift apart.

  An invariable adjective's forms carry **no** gender now, rather than defaulting
  to masculine: `grande` is as feminine as it is masculine, and describing `una
casa grande` as masculine teaches the opposite of the rule the entry exists to
  illustrate. Those morphs are what a sentence token inherits, so the wrong label
  travelled.

- **Ordinals generated rather than typed, and a floor number that is no longer a
  unit of time.** `spellOrdinal` was written, tested, and called by nothing. The
  build now cross-checks an ordinal the way it already cross-checks a cardinal —
  `parseOrdinal` accepts exactly the twenty citation forms, so `septimo` fails the
  round trip instead of shipping — and derives `primer` and `tercer` instead of
  reading them out of the extra-surfaces column, which is a place a human types
  Spanish and therefore the thing `numerals.ts` exists to prevent.

  `segundo` the ordinal was simply missing, so `segundo` the noun claimed `el
segundo piso`: a **wrong** link, which the coverage report counts as a success,
  with four unlinked `segunda` tokens beside it. It is a lexeme now — carded as
  `-`, since the noun already owns that text — and `disambiguate` reads an ordinal
  before a noun as the ordinal. Narrowed to ordinals deliberately: the general
  "adjective before a noun" rule would reopen `la cara` and `mucho frío`. Token
  linking went from 99% to **100%** (7,497 of 7,531), and the new `ordinals`
  pattern names the agreement and the shortening.

- **A home screen that says where you are, before it says what to do.** `/es/a1`
  was the coach and was called **Test** in the navigation — accurate about what it
  did, wrong about where it sat. It is the address `/` redirects to and the one a
  learner reaches after three days away, so naming it after an activity meant the
  app opened _inside_ one of four things you could be doing, with no screen saying
  what this course holds or where you had got to. It is **Home** now, and it
  answers that first: the recommendation still leads, then **Where you left off**
  (the last five distinct items practised, tappable, with the last three sessions
  under them), then **In this course** (one row per kind of material, with its
  count and its hue, linking to the Study section that holds it), then the glance
  version of Progress. Nothing moved: practice is still started from the top of
  Home and from Free practice underneath it.
- **"Practise this again", as a link rather than a list of ids.** The new
  `?focus=recent` orders by what was practised most recently. It is a bias like
  every other focus, so a fresh install gets an ordinary session rather than an
  empty screen — but it is the one focus that orders _across_ the planner's
  buckets instead of permuting them, because "what I was just working on" is
  orthogonal to whether an item is due, weak or settled. Spelling it as `?ids=`
  was the alternative and is exactly what `session-url.ts` rules out.
- **Twelve categorical hues instead of six, and tints that cannot drift.** Six
  hues over thirty-six categories collided every third row, so a learner never got
  to learn that Body is the teal one; twelve halves that, and twelve is where it
  stops — a wheel divided finer than 30 degrees hands neighbours two colours a
  person cannot reliably separate. Each `-soft` is now a `color-mix` of its own
  hue with the palette's `paper`, which no contrast level may touch, so a hue and
  its companion move together and nobody hand-tunes twenty-four values per file.
- **Colour that teaches: gender, part of speech, tense.** The same wheel, but at
  _chosen_ positions rather than hashed ones, for the facts about a Spanish word
  that carry no information a learner can reason their way to — `el mapa` is
  masculine and `la mano` is feminine and nothing in either word says so. Gender is
  blue and orange rather than the blue and pink every textbook uses, for two
  reasons: red-green deficiency collapses pink towards grey-blue, turning the most
  useful pair in the app into two shades of one thing for roughly one man in
  twelve, and grammatical gender is not gender. The preterite and the imperfect sit
  on opposite sides of the wheel, because adjacent hues would be teaching the
  confusion they exist to prevent. Every hue rides beside the word it means and is
  `aria-hidden`, so a learner who cannot see the difference loses a mnemonic and no
  information.
- **Three more palettes — Slate, Rose and Olive — and they were solved, not
  picked.** A palette is a few hundred contrast constraints, and hand-tuning
  converges on mud because the colours easy to find by eye are the desaturated
  ones. `npm run build:palette` takes hue angles and finds values that clear WCAG
  AA against every ground the contrast levels can produce, staying as close as it
  can to one target tone — which is what makes twelve hues read as a family rather
  than as a rainbow. Maximising chroma instead walks every hue to the edge of the
  sRGB gamut, and the result is neon.
- **A fifth appearance axis: colour intensity.** Calm, Normal and Vivid, beside
  the contrast axis in Settings, because those are the two halves of "this is too
  much" — the greys being too sharp, and the colour-coding being too loud. They
  cannot interfere: a contrast level restates only neutrals and an intensity only
  hues, which the test asserts rather than assumes. Every palette is now held to
  AA at every contrast level × every intensity, 84 combinations.

### Changed

- **The playback transport stopped rearranging itself under your thumb, and a
  speaking line now stops.** Two reports about reading a dialogue along, and both
  are about the same thing: a control that means one thing and does another.

  The transport was one button while idle and three controls while playing, on
  the argument that a learner reading along needs the control that is _next_
  rather than the full set. That is true of the controls and false of the layout —
  Pause and Stop appeared where the single button had been, so the row grew and
  everything under it jumped, at the moment a thumb was on its way back to the
  screen. The same three slots are there in every state now: the play button
  changes its word (`Listen` → `Pause` → `Resume`), Stop is disabled while there
  is nothing to stop, and the readout says how long the passage is before it
  starts rather than appearing once it has.

  And **a line being read swaps its play icon for moving bars, so pressing it
  stops the reading** — it played the line again. `Sequence.listen` has a third
  meaning rather than every line growing a second button: this line alone when
  nothing is playing, stop while this is the line speaking, carry on from here for
  any other. The accessible name says which offer is live, so the difference is
  not only in the icon. Held rather than speaking, the bars hold still and the
  button goes back to meaning "carry on from here", which is what a paused line
  honestly is.

- **Installing the app is 841 KB, not 7.1 MB — and the pack is a download you
  choose.** `**/*.jsonl` was in the service worker's precache list, so installing
  the app fetched the entire 6.4 MB dataset before a learner saw a screen: 28
  entries, of which the app itself was under a megabyte. That was the honest shape
  while boot loaded every file anyway. It stopped being honest the moment the app
  started fetching only the shards its course reads, and it was never the right
  shape for an add-on.

  The shell is precached — 13 entries — along with `catalog.json` and each
  `pack.json`, because a pack that cannot describe itself offline cannot be
  offered for installing. The packs themselves are `CacheFirst` at runtime, which
  their versioned path is what makes safe: a new cut is a new URL rather than a
  revalidation of an old one. So a pack accumulates as it is read, and an A1
  course leaves nine of its fifteen files on the device without asking for
  anything.

  **Settings → Packs is where the rest is chosen.** It says what is here — `Partly
on this device · 3.1 MB of 6.4 MB` — what finishing costs, `Keep offline
(3.3 MB)`, and offers to take it all off again. It can price the offer because
  the build now writes each file's `bytes` into the manifest; an offer that cannot
  say what it costs is not a fair one. The download runs a file at a time rather
  than as one `addAll`, so it can report progress and so one failure out of fifteen
  leaves fourteen on the device instead of none.

  The background read-ahead added with the sharding is now conditional on that
  choice: the levels above the course's ceiling are pulled into memory only when
  the device is already holding them. 3.3 MB of somebody's data plan is not the
  price of making a rare interaction instant, and a learner who has not asked for
  the pack waits a moment on a level switch instead — behind the loading state
  that shipped with it.

  Verified against a built worker with the origin server stopped: the app loads,
  browses and switches level with nothing serving it. That pass is what caught the
  one real bug here, which no test could have — the route matcher read
  `` `${BASE}packs/` ``, which type-checks in `vite.config.ts`, serialises into
  `sw.js` as source text, and throws `ReferenceError` inside the worker, where it
  matched no route and cached nothing while everything still appeared to work.
  `tests/app/precache.test.ts` refuses a `urlPattern` that closes over anything now.

- **Boot fetches the course, not the pack.** The dataset has shipped sharded by
  level since the build learned to split it, and the loader has known how to skip
  a shard for just as long — but the app asked for all of it anyway, so nothing
  had got faster. It asks for the level in the address now: **3.0 MB rather than
  6.3** for an A1 course, with the levels above it fetched in the background once
  the first screen is up, so a level chip is usually instant and the saving is in
  what a learner waits for rather than in what they eventually hold.

  The address is read before the router exists, so `parseCoursePath` is the
  inverse of `coursePath` — one module owning that spelling in both directions —
  and `/`, which names no course and is the commonest way in, reads the level the
  learner left off at, since that is exactly where it is about to redirect them.
  A ceiling no pack declares fetches everything rather than nothing: a stale link
  is corrected against the courses that exist, and at boot there are none yet.

  Two things had to be true for that to be honest rather than merely smaller. A
  course is now **described by its packs rather than by its contents** — the
  chips read `manifest.levels` and the counts read `manifest.levelItems`, so B1
  is on offer, with its real 3,816, before a byte of it is loaded; counting items
  in memory would have hidden the chip a learner taps to _get_ B1 and reported
  the rungs below as a smaller course than they are. And a level tapped before
  the background load lands now **waits behind the loading state** instead of
  showing an empty course — not a navigation, because the chips sit on most
  screens and are tapped often. Narrowing waits for nothing at all, since a lower
  ceiling is already in memory.

  `ContentRepository` grows after the first render as a result, so it says when:
  a revision and a `subscribe`, read through `useSyncExternalStore` in
  `useCourse`, which is the one hook every screen reads its scope through. A
  screen open when late shards arrive shows them without a navigation.

- **You is a Settings section now, not a screen only Settings linked to.** The
  learner's own page lived at `/user`, outside the course routes, on the argument
  that a name is not a property of what is being studied. True, and not the
  deciding fact — a theme is not a property of Spanish either, and Appearance has
  always been in Settings. What the separate address bought was one link above
  the tab strip pointing at a screen nothing else reached, so a learner opening
  Settings to set their name, or to find out what this device was holding, was
  looking at the one screen that did not contain it.

  It is the first of six sections now (`?tab=user`), and `/user` redirects into
  it through `settingsPath` rather than a second spelling of the tab. First and
  default stayed separate on purpose: `learning` is still what a bare
  `/settings` opens, because a name and a gender are set once and then read.

  The data half also stopped gesturing. "Stored on this device" was the whole
  answer to _where_, so the section now names it — the IndexedDB database (read
  from `identity.ts`, never typed out), the `localStorage` mirrors that keep the
  first paint from being the wrong colour, the packs as the app's material rather
  than the learner's, whether the browser has promised not to evict any of it,
  and **no servers**, as its own row: "where is my data" has an answer about the
  network too, and a learner is entitled to it before they type their name in.

- **Colours that mean different things now have to stay apart, and it is
  tested.** A WCAG ratio is a _lightness_ comparison, so a crimson accent and a
  crimson `danger` pass every floor in the suite and are still the same colour to
  look at. The contrast test measures the six meaning pairs in OKLab with lightness
  excluded. It caught three generated palettes the day it was written — an Ember
  whose accent sat 0.011 from `danger`, a Forest whose accent sat 0.012 from
  `success`, and a Slate whose highlight sat 0.011 from `danger` — two of which had
  to be redesigned rather than nudged, because a palette whose identity _is_
  crimson cannot coexist with a crimson verdict.
- **One mechanism for all five appearance axes.** Each axis used to write out its
  own storage key, validator, `apply` and `try`/`catch` around a storage write:
  five copies of one shape, and five chances to spell a dataset key differently
  from the CSS reading it. `defineAxis` in `src/styles/appearance.ts` is that shape
  once, and adding an axis is now a declaration rather than six edits.
- **The pre-paint duplication is gone rather than guarded.** `index.html` could
  not import a module, so its script repeated every axis's values as literal
  arrays with a test comparing the two lists. `vite.config.ts` now injects the
  registry as `%APPEARANCE_AXES%`, exactly as it injects the app id, so adding a
  palette or a whole new axis needs no edit to the HTML. The test that compared the
  copies now only checks that nobody puts one back.

- **The pack versions itself now, and cannot freeze again.** `core-es` versions
  independently of the app, but the version was a literal inside
  `scripts/build-dataset.ts` and had been written exactly once: the pack went from
  443 sentences to 1,395 across four expansions still calling itself `0.1.0`, and
  Settings showed that number to every learner the whole time. It is now authored
  in `content/es/pack.tsv`, beside the content it describes, and it is `0.2.0`.
  The same row records the item count the version was cut at — the build reports a
  disagreement and `tests/data/pack-version.test.ts` fails on one, so changing
  what the pack contains forces an edit to the line the version sits on. A wording
  fix changes no count and needs no bump. This is the guard `doc-stats.test.ts`
  already gives the README's figures, in the one place that was still unwatched.
- **Teach the four questions the pack could not ask.** `qué`, `dónde`, `cuánto`
  and `cómo` were always well covered — you cannot order a coffee without them.
  The other four never were: outside the health passages `cuándo` had two plain
  examples, `cuál` had two, `quién` four and `por qué` exactly one, and no skill
  or mission pointed at any of them. A learner could confirm a hotel and describe
  a symptom but could not ask when the party starts, which of two shirts is
  cheaper, who the new boss is, or why not. Each of the four now gets what a
  mission gets: a dialogue that puts it in a real situation — a party, a clothes
  shop, a first morning in a new office, a plan being turned down — and a palette
  either side of it, because asking is one ability and understanding the answer
  is another. Ninety-nine sentences, four dialogues and eight paired skills, in
  `content/es/sentences-questions.tsv`.
- **`este`, `ese` and `aquel` as the three-way contrast Spanish actually makes.**
  `aquel` was not in the dataset at all, so the pack could teach two distances of
  "that" and not the third; `esto` and `ti` were missing too, next to an `eso` and
  a `mí` that had been there from the start. They are taught where they really
  occur — inside the answer to «¿cuál?» — and the closing section of the new file
  drills the contrast on its own. That also lifts `grammar` off the build's
  under-eight-items list, where it had been sitting on two.
- **The first mission is a conversation now, not a greeting.** `greet-and-respond`
  used to be seven lines: hello, how are you, goodbye. All four of its dialogues
  now carry on past the wellbeing answer into what actually happens next — where
  you are from, where you live now, whether you like it there, what you do, what
  you do with your time — and close on that instead. The model exchange runs
  seventeen lines, the mission claims eleven capabilities where it claimed four,
  and each transfer rehearses the whole arc rather than a slice of it: a friend
  who does not know you well, the same conversation in usted at work, and a
  neighbour where the learner does the asking. Nine response palettes sit behind
  it, eight of them new — because a learner who can only answer is still being
  interviewed, the asking side is drilled as its own move, with its own
  alternatives and its own tú/usted pair. Two variation-lab patterns build
  “Soy de X, pero vivo en Y” and an activity plus how often, from parts. The pack
  grew by 81 sentences and 7 communicative functions, written almost entirely
  from vocabulary it already had.
- **"Say it" shows what it hears, while it hears it.** A level meter beside the
  control, driven by the microphone rather than by a timer, and the words the
  recogniser has so far before it commits to them. Speech recognition is
  otherwise a black box — press, speak, and either a transcript appears or
  nothing does — so a failed listen was indistinguishable from a listen that
  never started, and the first thing anyone tries is saying it louder. That is
  the wrong fix for a blocked permission, and the meter is what tells the two
  apart. It also carries into the failure messages: a recogniser that returns
  nothing while the meter plainly saw a voice says so, instead of asking the
  learner to speak up. `MicrophoneLevels` in `audio/types.ts` is the seam; no
  audio is recorded, kept or sent anywhere.

- **Practice batches, in the engine.** A batch is a set of material the learner
  picks once — "these 30 nouns" — kept so that a week of short sessions can all
  draw on the same items until they hold. `?batch=<id>` in a session link scopes a
  session to exactly that set, resolved from the id rather than from the items,
  because thirty item ids in a query string is not a link anyone can share. Where
  a learner stands in one is derived from the attempt log, never stored, the way a
  mission's standing already is: an item counts as absorbed when it has been
  _produced_ — not recognised — on two separate days and is still held a week out,
  and a batch is done at 90% so one stubborn item cannot hold it hostage. There is
  no way to create a batch yet; that is the next stage, and it is briefed in
  [docs/tasks/practice-batches.md](docs/tasks/practice-batches.md) along with the
  measurement that decided the graduation bar. Local storage moves to version 3,
  which adds a store and rewrites nothing.
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

- **Speech input on Android.** The microphone is now opened through
  `getUserMedia` before the recogniser is started, and held for the length of
  the listen. Starting the recogniser does not reliably prompt for the
  microphone permission on Android — most reliably not in an installed PWA — and
  one started without the permission ends immediately and silently, which
  reaches the learner as "nothing happens when I press Say it". Asking for the
  device is what makes the browser ask the learner. Two smaller failures went
  with it: a recogniser that ends without committing a final result now returns
  what it did hear rather than reporting silence, which is how a correctly spoken
  sentence became "I did not hear anything", and a listen over a plain-HTTP page
  says so — there is no microphone to open there, and the browser reports that
  only to its console.
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
