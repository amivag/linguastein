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
- Appearance as four independent axes: light or dark, one of four palettes, one of
  four contrast levels and one of three type scales. Every palette is checked
  against every contrast level at WCAG AA, and a contrast level declares no hue —
  it restates the neutrals along the palette's own ink-to-paper line, so one level
  serves a palette written after it
- Passages: connected texts and dialogues as containers over sentences that stay
  individually practisable, with a reading view and passage-scoped sessions
- A thirteen-mission communicative journey (Understand → Practise → Use), with a
  three-context transfer ladder for every mission. The first variations retain
  meaning cues; the final rung uses communicative intentions, and three narration
  models sit alongside the ten dialogues. Twelve are A1; saying what hurts is the
  first A2 mission, because the exchange that teaches it is
- Response palettes now run through every mission: wellbeing, café orders,
  destinations, clothing needs, hotel details, reactions to suggestions and real
  morning actions. Each reveals alternatives progressively with meaning and
  pragmatic nuance, and accepts any context-appropriate answer through the
  existing speech seam instead of grading against one scripted line
- Variation Labs across all thirteen missions: pure generators recombine ordered
  slots into 574 valid study phrases covering wellbeing, café orders, directions,
  clothes, hotel stays, plans, routines, symptoms, work, homes, tickets, market
  quantities and introductions. Learners can hear and
  produce them from meaning without generating fake stable ids or progress;
  the evidence-bearing palette sentences remain ordinary content items
- An adaptive daily path on Home: one primary action followed by at most two
  useful next steps. Due reviews lead without hiding the current mission;
  returning learners can strengthen their weakest recall, new learners can request a
  bounded fresh-material session, and course-scoped history says when they last
  practised without turning attendance into a resettable streak
- Affirmative commands (tú, usted, vosotros, ustedes) generated per verb, with
  `imperativo` as a practisable skill and address derived from the command form
- core-es pack: 126 verbs (3,024 generated forms), 390 nouns, 269 modifiers,
  984 sentences — 1,605 practisable items, 99% of sentence words linked to a lexeme
- Editorial review machinery: per-item sign-off pinned to the reviewed wording,
  and `npm run review:data` reporting content questions by exception
- Thematic categories: a controlled topic vocabulary declared in
  `content/es/topics.tsv` and shipped in the pack manifest with a label and
  display group, a build gate that rejects an unregistered topic, and a category
  picker on Browse that both browses and practises a category
- An alphabetical way into the pack on Browse: a letter index derived from the
  initials the loaded packs actually have, a pack-order/A–Z/Z–A sort, and a play
  button on every result
- Reference-language architecture (English is the first, not the only)
- WCAG 2.2 AA accessibility, enforced by axe and contrast tests in CI
- Switchable dark/light themes on a modular, extensible token system
- Small, Medium and Large reading sizes, persisted independently of colour theme
- Responsive from phone to desktop, with pointer-aware interaction
- Optional speech-input pronunciation check on speaking exercises
- AI seam plus a learner-context builder (no vendor, no network)

## Next

The dataset work is briefed in full for a fresh session:
[docs/tasks/dataset-expansion.md](tasks/dataset-expansion.md).

0. **Editorial review of core-es** — the pack is machine-generated and marked
   unreviewed. Genders, glosses and sentence naturalness need a human pass
   before any of it can be called canonical.

   The machinery for that pass is now in place, and it is only machinery: review
   is per item via `content/es/reviewed.tsv`, so a slice can be signed off without
   reading all 1,605 at once, and `npm run review:data` reports the rows worth
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

   The 30 occurrences still unlinked are three principled classes, not an
   authoring backlog:

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

1. **More passages** — 57 exist (17 texts, 40 dialogues), of which 52 belong to a
   mission. The route from 36 was the intended one: every passage added since
   arrived as part of a mission rather than as disconnected text raising a count.
   The five nothing points at are all monologue texts — a Saturday, feeling
   unwell, last summer, the market and a rainy day. `El verano pasado` is the seed
   of the past-tense mission briefed in
   [docs/tasks/past-tense-mission.md](tasks/past-tense-mission.md); the other four
   read as supporting material for missions that already exist.
2. **Study mode for flashcards** — previous/next and no scoring are in place: a
   study session records nothing and reports a count rather than a score. What
   remains is the order toggle in the UI; `?order=` already carries it.
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

4. **Numbers as a system** — `spellCardinal(1042)` gives `mil cuarenta y dos`
   from rules in `src/languages/es/numerals.ts`, the way verb forms already come
   from the conjugator. A learner's actual question is "how do I say 1042?", and
   no number of authored rows answers it: the value is in the joining rules, the
   solid teens, apocopation and hundreds agreement. Two ways to practise it,
   because progress references stable ids and an integer cannot have one — a
   closed set of number cards, plus an unbounded drill scored against pattern
   ids. Briefed in full in [docs/tasks/numerals.md](tasks/numerals.md).
5. **Game feel** — mostly landed. The motion scale, answer feedback, segmented
   session progress, the earned end-of-session summary and the adaptive daily
   path are all in. What remains is optional sound and haptics (§4.6 of
   [docs/tasks/game-feel.md](tasks/game-feel.md)) — and the constraints
   still bind: no resettable streak, no reward that overstates the evidence, and
   nothing where motion or colour is the only signal.
6. **Situations as communicative functions** — landed across all thirteen missions.
   `content/es/skills.tsv` now authors functions as a second axis to topics:
   `restaurant` is what a sentence is _about_, while ordering politely or
   understanding a price is what the learner is _trying to do_. Sentence rows
   attach those functions, session URLs preserve them, mastery derives evidence,
   and the mission reports the capabilities it trains. Ten missions use a dialogue
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
   person and tense drills. Word inspection already shows the forms; practising
   them needs progress against something that is not a `LearningItem`, which is
   the same wall [passage practice](tasks/passage-practice.md) hits.

8. **Word-level progress** — inspection knows which lexeme a tapped word maps
   to, so "words I keep looking up" is a natural weak-item signal to feed back
   into session planning. Two smaller gaps of the same shape: the "words &
   patterns" rows on Progress are lexemes and skills rather than items, so there
   is nothing to tap them open with yet (inspection is entered through an item),
   and the sentences named in the end-of-session summary are inline in a
   paragraph rather than tokenised.
9. **Offline dataset caching** — verify precache coverage and add a visible
   "available offline" state.
10. **Icons** — replace the SVG-only PWA icons with rasterised 192/512 PNGs.
11. **Appearance axes** — landed, and further than this item asked for: four
    palettes in light and dark, and a four-step contrast scale rather than the
    Normal / High pair. Every palette is held to WCAG AA at every level, and the
    levels are asserted to come out in order. What remains is the optional half —
    resolving `system` through `prefers-contrast`, which needs a fifth value on
    the axis (`system`) rather than a fifth level. See
    [the theming note](theming.md#appearance-is-four-independent-axes).
12. **Practice batches** — a set the learner picks once and returns to across
    short sessions until it is absorbed, with where they stand derived from the
    attempt log the way a mission's standing already is. Briefed in full in
    [docs/tasks/practice-batches.md](tasks/practice-batches.md), including why
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
self-contained units — the audio task (item 3) keeps pack paths relative and
routes asset resolution through one seam so this stays possible.

## Explicitly out of scope for now

Backend, accounts, social features, moderation, native app, app-store pipeline,
gamification, a complete grammar course, and the production dataset itself.
