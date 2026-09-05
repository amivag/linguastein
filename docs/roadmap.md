# Roadmap

Tracks the v0.1 requirements in §28 of the spec against what exists today.

## In place

- React / TypeScript / Vite PWA foundation
- Dataset abstraction: catalog → manifest → JSONL records → validated pack
- Validation boundary + `npm run validate:data`
- Normalised content repository with filters, facets and translation fallback
- Exercise engine: listen & repeat, reveal, think & say, multiple choice,
  cloze choice, tap to build
- Session planner: filters, sequential / random / smart ordering, item- and
  time-based sizing, seeded determinism
- Sessions fully described by their URL — preset, size, passage, the faceted
  filters, review-only, focus, ordering and seed — built and parsed in one place,
  so a session can be filtered from Browse, resumed, shared or scripted
- Courses: one target language narrowed to one CEFR level, in the path
  (`/es/a1/browse`), derived from the packs actually loaded. Level is a ceiling
  rather than a chapter, so A2 keeps A1 material in rotation, and every count,
  list and session plan narrows to the course. A second language pack needs no
  code change; a French fixture pack in the suite keeps that honest
- Practice focus: a standing choice of categories plus one of balanced / shaky /
  reviews / new material. A bias on the planner's existing buckets, never a
  filter, so it cannot produce an empty session — and written into the session
  link rather than read from preferences by the session screen
- An elapsed-time readout during a session, with the total and per-card pace on
  the summary. No limit, no countdown, no penalty, and switchable off
- Review what is due: the due count on Home and Progress starts a session of
  exactly those items
- Progress model + FSRS scheduling behind a `Scheduler` seam, exercise
  composition that climbs recognition → cued recall → production, and derived
  word- and pattern-level mastery
- IndexedDB storage with an in-memory fallback and identical contract tests
- Settings split into what belongs to the device and what belongs to a course:
  the level, the chosen categories, the practice focus, the accent and the voice
  are stored per target language, so Spanish-at-A2 and French-at-A1 are both true
  at once and a French course is no longer read aloud by a Spanish voice. Screens
  read them through `useCourse().state`, never from a global record, and what
  comes back out of storage goes through a zod boundary that repairs a bad value
  per field rather than rejecting the record — groundwork for the export/import
  under _Later_, and the same four things a sync would need
- Progress about **any content entity**, not only an item: a verb form, a
  grammatical pattern, a passage. Three roadmap items were separately blocked on
  this and none of them needed a new identity scheme — the packs already ship
  9,206 form records and seven numeral patterns with stable ids. A generated
  target still gets no id: a drill on 1042 records against the patterns it
  exercises, so the scheduler sees a closed, small set while the questions stay
  unbounded. Item-shaped screens stay item-shaped by construction, through one
  narrowing (`itemProgressIn`) with one test that fails if a new reader forgets
- Numbers as a system, drilled: generated targets in two directions, scored
  against pattern ids. See item 4
- Backup and restore: everything a learner owns as one dated JSON file, and an
  import that **merges** rather than replaces. Answers and sessions union by id, so
  running the same file twice changes nothing the second time and a device that has
  been practised on keeps what the file does not know about; the review schedule is
  **rebuilt by folding the merged answer log** rather than copied, which is what
  makes merging two devices safe — copying counters would be last-write-wins on an
  accumulator, and the schedule would end up disagreeing with the log it came from
  with nothing able to notice. Settings are a separate, defaulted-off choice, since
  history adds and a theme replaces. Rows naming an uninstalled pack are kept and
  reported, never pruned. The same four things a sync would need, which is the point
- Audio service with pre-generated-audio-first resolution and a TTS seam
- Word and phrase inspection: tap any word for its meaning, grammar, the pattern
  it belongs to, its other forms and other phrases that use it — or grow the
  selection a word at a time for the pattern a run of words forms, a word-by-word
  breakdown and other phrases built the same way. Available in practice (a cloze
  included, before it is answered), reading, Browse, Progress and the example
  sentences under a card
- Copy / share, including "copy as AI prompt"
- Mobile-first UI: home, session, settings
- Dataset authoring pipeline: TSV sources → generated pack, with a Spanish
  conjugator, coverage reporting and a CI drift check
- Stable item ids: a row owns its id, keeps it through edits, reordering and file
  moves, and a deleted row's id is retired rather than reused
- Appearance as five independent axes: light or dark, one of seven palettes, one
  of four contrast levels, one of three colour intensities and one of three type
  scales. Every palette is checked against every contrast level × every intensity
  at WCAG AA, and the two invariants that let them compose are asserted rather
  than documented — a contrast level declares no hue (it restates the neutrals
  along the palette's own ink-to-paper line, so one level serves a palette written
  after it) and an intensity declares no neutral
- Passages: connected texts and dialogues as containers over sentences that stay
  individually practisable, with a reading view and passage-scoped sessions
- A seventeen-mission communicative journey (Understand → Practise → Use), with a
  three-context transfer ladder for every mission. The first variations retain
  meaning cues; the final rung uses communicative intentions, and narration models
  sit alongside the dialogues. Thirteen are A1; saying what hurts is the first A2
  mission, because the exchange that teaches it is; three are B1 (see below)
- Response palettes now run through every mission: wellbeing, café orders,
  destinations, clothing needs, hotel details, reactions to suggestions and real
  morning actions. Each reveals alternatives progressively with meaning and
  pragmatic nuance, and accepts any context-appropriate answer through the
  existing speech seam instead of grading against one scripted line
- Variation Labs across fourteen of the seventeen missions: pure generators
  recombine ordered slots into 658 valid study phrases covering wellbeing, café
  orders, directions, clothes, hotel stays, plans, routines, symptoms, work,
  homes, tickets, market quantities and introductions. Learners can hear and
  produce them from meaning without generating fake stable ids or progress;
  the evidence-bearing palette sentences remain ordinary content items. The three
  B1 missions have none yet — `tests/domain/variations.test.ts` enumerates the
  fourteen that do, so adding one is a visible change rather than a silent gap
- An adaptive daily path on Home: one primary action followed by at most two
  useful next steps. Due reviews lead without hiding the current mission;
  returning learners can strengthen their weakest recall, new learners can request a
  bounded fresh-material session, and course-scoped history says when they last
  practised without turning attendance into a resettable streak
- Affirmative commands (tú, usted, vosotros, ustedes) generated per verb, with
  `imperativo` as a practisable skill and address derived from the command form
- Present subjunctive generated per verb, and the usted/ustedes commands read off
  it rather than declared beside it — a `presente de subjuntivo` skill, plus
  `no hables` as a pattern, because the negative command is the one place the
  mood is not optional-feeling
- core-es pack: 185 verbs (7,770 generated forms), 476 nouns, 327 modifiers,
  3,016 sentences — 3,816 practisable items in 800 word cards and the sentences,
  plus 1,372 nominal forms and 123 passages. Token linking is 99% (see item 0 for
  the three principled classes that make up the rest)
- Three B1 missions — a complaint, a flatshare negotiation and asking for advice
  — each a model passage plus three transfers, and the mission list now says
  which level a mission is: `MissionDefinition.level` had always existed and
  nothing rendered it, which only became a lie of omission once a B1 course
  existed for the A1 ladder to sit unchanged inside
- B1 as a level inside `core-es` rather than a separate pack: 136 B1 lexemes and
  573 new sentences at that level, every one of those lexemes in four or more of
  them, plus six passages. The file names carry the range and the build derives it, so
  `es-a1-b1-core-*` renamed itself when the first B1 sentence landed
- The alphabet: `src/languages/es/alphabet.ts` holds the 27 letters and their
  names (with the regional ones — `ve corta`, `i griega`), `spellWord` reads any
  word out letter by letter, and 37 alphabet sentences teach the exchange it is
  for rather than the recital
- Noun plurals and adjective agreement shipped as `forms` records, so a paradigm
  is inspectable rather than only indexed at build time
- Editorial review machinery: per-item sign-off pinned to the reviewed wording,
  and `npm run review:data` reporting content questions by exception
- Thematic categories: a controlled topic vocabulary declared in
  `content/es/topics.tsv` and shipped in the pack manifest with a label and
  display group, a build gate that rejects an unregistered topic, and a category
  picker on Browse that both browses and practises a category
- An alphabetical way into the pack on Browse: a letter index derived from the
  initials the loaded packs actually have, a pack-order/A–Z/Z–A sort, and a play
  button on every result
- Reference-language architecture (English is the first, not the only), with the
  meanings addressed and versioned apart from the pack they explain:
  `packs/translations/core-es/en/0.16.0/`, listed in `catalog.json`, and named
  nowhere in `pack.json`. Adding a reference language is a new directory and one
  catalog line rather than a re-version of 6.4 MB of unchanged Spanish, and boot
  downloads the one language a learner reads instead of every language the pack
  was ever published in
- WCAG 2.2 AA accessibility, enforced by axe and contrast tests in CI
- Switchable dark/light themes on a modular, extensible token system
- Small, Medium and Large reading sizes, persisted independently of colour theme
- Responsive from phone to desktop, with pointer-aware interaction
- Optional speech-input pronunciation check on speaking exercises
- AI seam plus a learner-context builder (no vendor, no network)

## Next

The dataset work is briefed in full for a fresh session:
[docs/tasks/dataset-expansion.md](tasks/dataset-expansion.md). Three content gaps
are briefed on their own because each needs deciding before authoring:
[feelings, mood and state](tasks/feelings-mood-state.md) — fifty-two sentences
and ten lexemes for the question the greeting mission opens with — the
[past-tense mission](tasks/past-tense-mission.md), and
[the function words](tasks/function-words.md), **decided 2026-08-26**: no function
word becomes a card, `ADV` came off `STUDYABLE_POS` rather than being filled, the
demonstrative contrast is a named skill, and the pronoun paradigms got their
missing members. The follow-up it created has landed too: the closed-class
paradigms are records rather than index entries, so word inspection shows them and
the cloze drills **agreement** — the commonest beginner error in Spanish, and the
one thing the exercise could not ask while it blanked only verbs. What is left is
object `la`/`los`/`las`, which is a senses problem rather than authoring.

Two more are briefed as decisions rather than as content:
[pack addressing](tasks/pack-addressing.md) — a link identifies a passage and a
skill by local id, which two packs can both claim — and
[more missions](tasks/more-missions.md), which records the audit showing the
existing missions are already dense (every capability has a palette, none under
eight alternatives) and that the real gap is level rather than variation.

0. **Editorial review of core-es** — the pack is machine-generated and marked
   unreviewed. Genders, glosses and sentence naturalness need a human pass
   before any of it can be called canonical.

   The machinery for that pass is now in place, and it is only machinery: review
   is per item via `content/es/reviewed.tsv`, so a slice can be signed off without
   reading all 3,816 at once, and `npm run review:data` reports the rows worth
   attention rather than asking anyone to scan the lot. Sign-off is pinned to the
   wording that was read, so an edit afterwards fails the build instead of
   inheriting the approval. **Nothing is signed off yet** — the pack is still
   generated and unreviewed, and only a human reading the Spanish changes that.

   What the report currently raises: seven glosses shared by two sentences that
   need distinguishing, and one word (`dinero`) to confirm as universal rather
   than regional. Both are wording questions, which is what a reviewer is for.

   **The vocabulary gap behind them is closed.** Token linking is 99% (5,282 of
   5,311), up from 96%: every content word the pack uses now has a lexeme, so
   tapping it answers something. Proper nouns are declared as `PROPN` — a part of
   speech `inspect.ts` has always known and no content had ever used — so a name
   is tappable and says it is a name, instead of counting as vocabulary the
   dataset forgot.

   The occurrences still unlinked are three principled classes, not an
   authoring backlog — with one caveat added 2026-08-24: `segunda` was in this
   list for four sentences and was neither principled nor structural, just a
   missing ordinal row, and `el segundo piso` was linked to the _wrong_ lexeme
   beside it. A missing lemma is visible in the coverage report; a wrong one is
   counted as a success. Read the ambiguous resolutions, not only the percentage.

   - **`ser` and `ir` share a preterite** (`fue`, `fui`, `fuimos` — 10). Two
     lexemes, one surface, and the tokeniser declines to guess which. Linking to
     either would be wrong half the time; the real fix is a token that can carry
     more than one candidate, which is a model change.
   - **Enclitic pronouns** (`ayudarme`, `probarlo`, `verte`, `dígame` — 17). An
     infinitive, gerund or imperative with a pronoun stuck to it. Stripping the
     enclitic and re-matching the stem would resolve most; the imperatives also
     move their accent (`diga` → `dígame`), so it is a small piece of morphology
     rather than a suffix trim.
   - **Conditional and imperfect subjunctive** (`gustaría`, `quisiera` — 2). Tenses
     the conjugator does not generate; they are in _Later_ with the subjunctive
     proper.

1. **More passages** — 123 exist (59 texts, 64 dialogues). The route from 36 to
   57 to here was the intended one: every passage added since arrived as part of
   a mission rather than as disconnected text raising a count. The ones nothing
   points at are all monologue texts — a Saturday, feeling unwell, last summer,
   the market and a rainy day among them. `El verano pasado` is the seed
   of the past-tense mission briefed in
   [docs/tasks/past-tense-mission.md](tasks/past-tense-mission.md); the others
   read as supporting material for missions that already exist.
2. ~~**Study mode for flashcards**~~ — **done.** Previous/next and no scoring
   were already in place; the order toggle landed 2026-08-26. Three links under
   the transport controls — in order, shuffled, needs work — offered in a study
   session only, since a tracked session's order is the scheduler's opinion about
   what to lead with. Links rather than buttons because the URL is the state, so a
   switch is a different address for the same material: it restarts the set, which
   is the honest consequence of asking for a different order and costs nothing in
   a session that records nothing.
3. **Canonical audio pipeline** — generate in batches → review the voice →
   approve → store, plus an `audio/<locale>/<voice>/` layout in packs. This is the
   real fix for pronunciation quality: device voices vary wildly between platforms,
   and many devices ship no Spanish voice at all. Until then the app uses device
   speech where a suitable voice exists, and says so where none does.

   **Both code halves are now done.** The runtime resolves canonical audio before
   the TTS seam and the service worker fetches it on demand; the build reads
   `content/es/audio-ledger.tsv` and emits one `audio` file per locale, plus the
   voices declared in `content/es/voices.tsv`. Only rows a human has marked
   `approved` ship, a clip is keyed by (item, locale, voice) so a typo fix cannot
   mint a duplicate, and a row whose item has since been deleted is dropped rather
   than failing the build. No ledger means no audio and a pack identical to
   today's, which is why this could land before a single clip existed.

   **What remains is not code.** Choosing a voice whose licence permits shipping
   its output from a CC0, exportable pack, and the ~2 hours of listening per voice
   that approving it honestly costs. `tsx scripts/generate-audio.ts --sample
--compare` is the way in: it writes a blind A/B page over the twenty or so clips
   that decide a voice, beside its own ledger rather than the shipping one.
   Several voices per phrase are a feature, not a special case: dialogues can voice
   their speakers separately, and rotating voices stops a learner recognising a
   waveform instead of a word.

   Storage size is not a constraint — audio takes space, and it is fetched on demand.
   Review attention is the real budget (~2 hours of listening per voice), which is
   why the voice is reviewed from a sample and clips are flagged by exception. The
   two decisions that bind: whether the chosen voice's licence permits shipping its
   output from a CC0, exportable pack — free tiers are usually the most restrictive,
   so a self-hosted model is the cleanest fit — and keying clips by a hash of the
   spoken text, so a typo fix cannot leave stale audio behind a deliberately stable
   item id. Briefed in full in
   [docs/tasks/canonical-audio.md](tasks/canonical-audio.md).

4. ~~**Numbers as a system**~~ — **done 2026-09-05.** `spellCardinal(1042)` gives
   `mil cuarenta y dos` from rules in `src/languages/es/numerals.ts`, the way verb
   forms already come from the conjugator, and both ways of practising it now
   exist: the closed set of number cards, and **the unbounded drill** at
   Study → Numbers.

   The drill asks generated numbers in two directions — digits to write in words,
   and a number spoken aloud to write in digits — and records against the
   **patterns** each number puts to work rather than against the number, which has
   no id and does not get one. Seven durable patterns for an unbounded set of
   questions. It is the first consumer of the progress widening listed under _In
   place_, and the reason that widening was worth doing rather than groundwork
   nobody had used.

   Building it turned up a bug the module had shipped with: the whole twenties
   range was being apocopated, so `veinticuatro mil` spelled as `veinticuatn mil`.
   Nothing had ever asked for one of those numbers. Found by spelling a number and
   reading it back, which is the check a table of examples cannot make.

5. **Game feel** — mostly landed. The motion scale, answer feedback, segmented
   session progress, the earned end-of-session summary and the adaptive daily
   path are all in. What remains is optional sound and haptics (§4.6 of
   [docs/tasks/game-feel.md](tasks/game-feel.md)) — and the constraints
   still bind: no resettable streak, no reward that overstates the evidence, and
   nothing where motion or colour is the only signal.
6. **Situations as communicative functions** — landed across all seventeen missions.
   `content/es/skills.tsv` now authors functions as a second axis to topics:
   `restaurant` is what a sentence is _about_, while ordering politely or
   understanding a price is what the learner is _trying to do_. Sentence rows
   attach those functions, session URLs preserve them, mastery derives evidence,
   and the mission reports the capabilities it trains. Fourteen missions use a dialogue
   model; describing a morning, a working day and a home add a connected-narration
   model for time, detail, sequence and destination. Every mission now has three ordered
   transfer contexts. Use records `think-say` attempts into the same FSRS schedule
   as ordinary practice: speech results map to Good/Hard/Again, while reveal has
   an explicit Not yet/Partly/Got it fallback. Home advances only after every
   learner turn in all three contexts has transfer evidence, and a communicative
   function cannot be labelled Reliable until its practised items span at least
   three passages. The final context uses intention cues instead of exact English
   lines, making the evidence less vulnerable to translation-script recall.
7. **Verb practice depth** — half done. Verbs now have word cards of their own
   (`800_001–899_999`), so `hablar` is a word a learner can look up and
   `Words × Verbs` in Browse lists 126 of them instead of nothing. The `verbs`
   preset stayed narrowed to sentences and phrases, because "useful forms inside
   natural sentences" is not what a bare infinitive card is.

   What remains is the harder half: surfacing `VerbForm` records directly as
   person and tense drills. Word inspection already shows the forms — **and the
   wall is down.** A progress row is about a subject now (see _In place_), a form
   ships as `core-es:form:ser-pres-1s`, and 9,206 of them are in the pack. The numbers
   drill is the worked example of what remains: a surface with its own loop, and
   `nextSubject` in `src/domain/drills/` to decide what to ask.

8. **Word-level progress** — inspection knows which lexeme a tapped word maps
   to, so "words I keep looking up" is a natural weak-item signal to feed back
   into session planning. That is still open.

   **One of the two smaller gaps is closed.** The "words & skills" rows on
   Progress are links now: a word opens a study session over the sentences that
   use it, a skill over the content that teaches it — the same destinations
   Study's own tiles use, so "this is shaky" and "practise this" are one tap
   apart. Reaching a word needed a new session parameter, `?word=`, because
   `ItemFilter.lexemes` was honoured by the repository and reachable from no link
   at all: a filter the engine supported that nothing could ask for. It goes by
   local id, like `?skill=`, so a shared link carries no pack namespace.

   **The other one is closed too.** The end-of-session summary named its
   sentences in a joined string — `3 words moved up: a, b and c` — which was
   unreadable, because each entry is a sentence with its own commas, and
   untappable, because a joined string is a string. They are rows now, tokenised
   through the same two components Progress and Browse use. That mattered most on
   this screen of all of them: it has just told you a word slipped back, which is
   exactly when "which word is the problem" is the question.

9. ~~**Offline dataset caching**~~ — **done 2026-08-28.** The pack is versioned in
   its path, sharded by level, fetched up to the course's ceiling, runtime-cached
   rather than precached, and offered as a download a learner chooses.

   Installing the app is **841 KB across 14 entries**, down from 7.1 MB across 28:
   the shell, plus `catalog.json`, each `pack.json` and each `translations.json` —
   a few kilobytes that are what let the app name its packs and say what is
   missing while offline. (Thirteen when this landed; the fourteenth is the
   translation unit's own manifest, which arrived when the meanings moved out of
   the pack — `language-matrix.md` §3 — and is precached by the same `json` glob,
   its 479 KB of records left runtime-cached like every other dataset file.) The
   packs themselves are `CacheFirst` into `linguastein-packs`, which the versioned
   path is what makes safe, and they accumulate as they are read: an A1 course
   leaves nine of the fifteen files on the device without asking for anything.

   Settings → Packs is the rest of it. It says what is here (`Partly on this
device · 3.1 MB of 6.4 MB`), what finishing would cost (`Keep offline
(3.3 MB)`, priced from the `bytes` the build now writes into the manifest), and
   offers to take it all off again. The background read-ahead of the levels above
   the ceiling is conditional on that choice — 3.3 MB of somebody's data plan is
   not the price of making a rare interaction instant — so a learner who has not
   asked for the pack waits a moment on a level switch, behind the loading state
   [shard-loading](tasks/shard-loading.md) put there.

   **Verified against a built worker with the origin server stopped**, which is
   what §5 said this half needed and no test could do: the app loads, browses and
   switches level with nothing serving it. That pass found the one bug worth
   recording — a `urlPattern` closing over `BASE` from `vite.config.ts`, which
   type-checks, serialises into `sw.js` as text, throws `ReferenceError` inside the
   worker, and silently caches nothing. `tests/app/precache.test.ts` refuses one now.

10. **Icons** — replace the SVG-only PWA icons with rasterised 192/512 PNGs.
11. **Appearance axes** — landed, and further than this item asked for: seven
    palettes in light and dark, a four-step contrast scale rather than the
    Normal / High pair, and a three-step colour-intensity axis beside it. Every
    palette is held to WCAG AA at every contrast level × every intensity, the
    levels are asserted to come out in order, and the six colours that mean
    something are asserted to stay perceptually apart. Palettes are generated by
    `npm run build:palette` rather than hand-mixed. What remains is the optional
    half — resolving `system` through `prefers-contrast`, which needs a fifth
    value on that axis (`system`) rather than a fifth level. See
    [the theming note](theming.md#appearance-is-five-independent-axes).
12. **Practice batches** — **Stages A and B have landed, and the gap Stage B
    opened is closed**: `src/domain/batches/` holds the model and the derived
    standing, a sheet on Browse can be saved as a set, and a set can now be
    removed. A batch is a set the learner picks once and returns to across
    short sessions until it is absorbed, with where they stand derived from the
    attempt log the way a mission's standing already is.

    Removal was the one thing a learner could not undo without erasing every
    attempt on the device, and the confirm is the substance of it: deleting a set
    forgets the **grouping**, and the sheet says the attempts, the review schedule
    and the progress all stay, because they belong to the items rather than to the
    set. No archive field was added — a finished set is simply one the learner can
    delete, and `nextBatchStanding` already stops offering it. Renaming is still
    declined for a stated reason: the label is derived from the filter, and a text
    input is a change of a different size. Read
    [docs/tasks/practice-batches.md](tasks/practice-batches.md) for what remains,
    and for why
    this is not a mission and why its graduation bar cannot be lexeme mastery:
    most of the pack's words appear in too few sentences to reach that floor.
    It is also the first feature with a reason to read `Attempt.exerciseKind`,
    which item 8 and [learner-profile.md](tasks/learner-profile.md) §9.2 both
    circle.

## Later (architecture allows, code does not attempt)

Story mode · speech recognition and pronunciation scoring · AI tutor behind an
`AiTutorProvider` · community submissions and review flow · cloud sync behind
`LearnerStorage` · translation packs beyond English · the subjunctive proper (and
so negative commands), the future and the compound tenses · senses for polysemous
words · **importing and exporting language packs**, including their audio, as
self-contained units — a learner's own data now travels (see _In place_), but a
**pack** is a different problem: the audio task (item 3) keeps pack paths relative
and routes asset resolution through one seam so this stays possible.

## Growth tracks, briefed rather than scheduled

Three things the app will eventually want, each briefed so a fresh session can
pick one up, and each deliberately outside the numbered list above because none
of them is a v0.1 requirement. They are written down together because they
constrain each other: the licence decision gates two of them, and the export
format gates the third.

The survey that produced all three —
[the stack survey](tasks/stack-survey.md) — records where the stack stands, which
seam pays out for which track, the six findings it turned up and what became of
each, and, in its last section, what it deliberately did **not** check. Read it
before re-investigating any of this.

- **[Android and iOS](tasks/native-port.md)** — Capacitor rather than React
  Native, since `src/domain` is already portable and the screens are not the part
  worth rewriting. One spike has to run first (whether the two speech APIs exist
  in a WebView), and one non-technical decision blocks iOS entirely: AGPL is
  understood to conflict with the App Store's terms, and the repository has a
  single copyright holder who can settle that in a day and no code.
- **[Accounts and sync](tasks/accounts-and-sync.md)** — the best-prepared of the
  three, and better prepared again since **Stage C landed on 2026-09-05**. Stage B
  had already given a merge the record clock and the collision-free ids it has to
  trust; Stage C shipped the rest of what sync actually needs and proved it against
  a file. `replayItem` is the reconciler — merging a file's answer log into a local
  one is the same problem as merging a device's — and the invariant that keeps it
  honest (`fold(attempts) === stored progress`) is asserted over generated logs
  rather than argued for. What is left for the backend is the backend: an account,
  a transport, and the two gaps §9.1.2 names — a tombstone for a deleted set, which
  union-by-id cannot express, and a scheduler id per progress row, which only
  matters once two writers can disagree. Local stays authoritative and no screen
  ever awaits the network for a learner's own progress; an account is a backup and
  a second device, never a precondition.
- **[Paying for it](tasks/monetisation.md)** — donations in Settings → About are
  nearly free and the only part worth doing now. Ads are recommended against on
  the web build for reasons that are enforced rather than aesthetic, and the
  content licence means the curriculum is not the moat: sell convenience, not
  language. Editorial review (item 0) is a prerequisite rather than a parallel
  track.

## Explicitly out of scope for now

Social features, moderation, gamification, a complete grammar course, and the
production dataset itself.
