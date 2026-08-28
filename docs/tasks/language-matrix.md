# Task: any-direction language pairs, and datasets that arrive on demand

**Status:** briefed, decisions open — supersedes [`second-language.md`](second-language.md) §7
**Written:** 2026-08-25
**For:** a fresh agent session, no prior context assumed
**Scope:** the direction model, the id scheme's non-Latin half, the pack
transport, and the runtime language seam. No German, Greek or Chinese content is
authored here.

Read [`AGENTS.md`](../../AGENTS.md) — **Architecture rules** 5, 6 and 8,
**Courses and the URL**, and **Datasets** — then
[`second-language.md`](second-language.md), which briefs the _second target
language_ from one direction. This brief is the other direction: a learner
choosing **which way round** the pair goes, and doing it in an installed PWA that
cannot afford to ship five languages up front.

§1 is a bug with a deadline. §2–§4 are the direction model. §5–§6 are transport
and the runtime seam. Everything here is cheaper before German exists than after.

---

## 1. `slug` is Latin-only, and that is a Greek and German problem now

`second-language.md` §6 files this under Chinese. It is not a Chinese problem; it
is the next two languages on the roadmap. `slug`
([`build-dataset.ts:897`](../../scripts/build-dataset.ts)) ends
`.replace(/[^a-z0-9]+/g, '-')`, and every lexeme id and every form-id stem is
built from it:

| Lemma                                               | `slug`             | Consequence                              |
| --------------------------------------------------- | ------------------ | ---------------------------------------- |
| `καλημέρα`, `θάλασσα`, `σπίτι`                      | `""`               | every Greek lexeme shares one empty stem |
| `银行`, `我`                                        | `""`               | as §6 already records                    |
| `schon` / `schön`                                   | `schon` / `schon`  | **collide** — "already" / "beautiful"    |
| `fordern` / `fördern`                               | `fordern`          | **collide** — "demand" / "promote"       |
| `Bar` / `Bär`, `Hute` / `Hüte`, `musste` / `müsste` | one stem each pair | **collide**                              |
| `Straße`                                            | `stra-e`           | ß becomes a hyphen                       |

Nothing failed on any of this before 2026-08-25, and that is the finding. `lexemeId`
([`build-dataset.ts:853`](../../scripts/build-dataset.ts)) resolves a taken id by
appending the part of speech, because `mañana` is legitimately both a noun and an
adverb. It compares **stems**, not lemmas — so `schön` colliding with `schon`
looks exactly like `mañana` colliding with `mañana`, and ships as
`lexeme:schon-adj`: a distinct id, named after a different word, with no warning.
The suffix absorbs the accident instead of exposing it.

This is the `ñ`/`n` class of bug the code documents having shipped once and fixed.

**And Spanish already has it.** Building with the collision reported rather than
absorbed names eight pairs, every one a `tilde diacrítica` pair where the accent
_is_ the difference between two words:

```text
té,te   tú,tu   él,el   qué,que   cuándo,cuando   cómo,como   si,sí   mi,mí
```

The lemma listed first is the one holding the bare id, and it is first only
because of which source file the build reads first. So **`lexeme:te` means tea**,
not the pronoun, and **`lexeme:el` means "he"**, not the commonest word in the
pack. Worse than the misnaming: moving `té` out of `nouns.tsv` would silently
_swap_ two lexeme ids, and mastery is keyed on them. Item ids have
`id-ledger.tsv` to stop exactly this; lexeme ids had nothing.

**Two changes, in order.**

1. **A ratchet, now — landed with this brief.** Not an error, for the reason the
   recycling ratchet is not one: those eight ids are permanent, and failing on
   them would block every other kind of work behind a rename nobody can safely
   do. So `content/es/stem-collisions.tsv` records them with their claim order,
   and `checkStemCollisions` fails on a collision the file does not name, on a
   recorded pair whose order has changed, and on a recorded pair that no longer
   collides. An empty stem is never recordable — with nothing to disambiguate,
   every lexeme in the language is the same id. `core-es` rebuilds
   byte-identically; German's first collision fails its first build.
2. **A per-language transliteration** — landed 2026-08-26, as
   `LanguageModule.transliterate` and `src/languages/es/orthography.ts`. German
   folds `ä ö ü ß` → `ae oe ue ss`, which is the language's own convention and
   resolves all five pairs above; Greek and Chinese romanise. Spanish keeps
   today's behaviour exactly, because its ids are permanent — which is what makes
   its eight rows a record rather than a backlog.

   The split is between the language's convention and the id scheme's
   **reduction**, which no language owns: NFC, the module's say, NFD, drop the
   combining marks, lowercase, hyphenate the rest. So Spanish contributes one rule
   (`ñ` → `nn`, before anything strips a diacritic) and the accents still fold,
   which is why the eight recorded pairs stay recorded. `core-es` rebuilds
   **byte-identically** across the move, and that is the whole evidence that the
   ids did not shift — a wiring mistake would have silently renamed nineteen
   lexemes.

   A module that declines the seam gets the bare fold, right for a Latin-script
   language whose accents carry no id-level distinction. For a non-Latin one it
   yields an empty stem, and `lexemeId` already refuses that: `stem-collisions.tsv`
   is explicitly not the answer where every word in the language collides at once.
   `tests/languages/orthography.test.ts` holds both halves, the refusal included.

**One region facet is still Spanish, and it is a product call rather than a fix.**
`isRegion` in `session-url.ts` policed `?region=` against `FILTERABLE_REGIONS` —
five Spanish locales — so `?region=en-GB` was dropped from an English course's
link without a word. That is fixed: a region is pack vocabulary, so it is
canonicalised and carried like a topic. `BrowseScreen` still builds its region
chips from the same constant, and that half is deliberately left: on an English
course every count is zero so the filter simply does not appear, which is benign,
but deriving the candidates changes the _shipped Spanish_ chips. The content
declares `es-ES`, `es-419`, `es-MX`, `es-CO`, `es-VE`, `es-CU`, `es-DO`, `es-PR`
while the constant offers `es-419`, `es-ES`, `es-MX`, `es-AR`, `es-CO` — so
deriving them gains four Caribbean locales and **loses Argentina**, which a
learner can select today. Decide which list a chip should come from; do not
migrate it as a refactor.

### Decided, 2026-08-26: two variations, Spain and Latin America

Neither list. **Spanish carries the Spain / Latin America split and nothing
finer**, so both sides collapse to the same two and the question of which one to
derive from stops mattering.

The finer chips were never earning their place. `es-AR` had **no** content behind
it at all and `es-MX` had exactly one word — so a learner could pick Argentina and
be told, in effect, that the whole pack was Argentinian. That is precisely what
_Nothing on a screen is a hard-coded list_ exists to prevent, and this was the
hard-coded list.

Two content rows had to move, and only one of them was mechanical.

- **`nevera`** was `es-ES,es-CO,es-VE,es-CU,es-DO,es-PR` — every locale that
  really says it, which is true and is more precision than the app now carries. It
  is `es-ES`, and a Colombian learner meets `refrigerador`. The trade is
  deliberate: "also said in Colombia and Venezuela but not Mexico" is trivia to a
  learner, while Spain against Latin America is the split they choose between.
- **`camión`** was `es-MX`, and that tag was never a Spain/Latin America
  variation — it marked a **sense**. `camión` means lorry everywhere Spanish is
  spoken, Spain included; Mexico _additionally_ uses it for a bus. So it carries no
  region now and says the Mexican reading in its gloss, where a sense belongs. It
  was not half of a regional pair and had been filed as one.

**The accents stay four.** `PRONUNCIATION_LOCALES` is what a TTS engine is asked
for, and `es-419` is not a voice any engine has — a voice is not a variation. A
learner who picks the Colombian accent still reads Latin American wording, because
`regionCovers` resolves `es-CO` through `es-419`.

**And the chip counts were saying the wrong thing.** `Spain (95)` returns 3,786
items, because the count is words _particular to_ a region while the filter also
keeps everything region-neutral. `repository.regions` argues at length for
counting it that way and the argument is right — counting what the filter returns
would have every region report nearly the whole pack. So the number stayed and the
control now says what it counts. Found by checking the chips after the collapse,
which is the same shape of gap as the letter index's and would have gone on
unnoticed.

**Do not** widen `slug` to accept non-ASCII instead. Ids are permanent, appear in
`id-ledger.tsv` and are referenced by learner progress; a scheme that admits any
codepoint makes the collision _harder_ to see rather than impossible.

---

## 2. The matrix is linear, not quadratic — pick a hub

For _n_ languages there are _n_ × (_n_ − 1) directions, and that number is what
makes "any direction" look unaffordable. It is the wrong number, because the
directions are not equally wanted and one of them is free.

Take `en`, `es`, `de`, `el`, `zh`. Twenty directions. But:

- **X from English** — `core-X` + `translations-en`. This is what the pipeline
  already produces; English is the authoring language.
- **English from X** — `core-en` + `translations-X`. **One** target pack, one
  translation set per language.

Eight translation sets cover all eight directions with an English end. The other
twelve — a German speaker learning Greek — are the low-demand ones, and they are
already **not blocked**: `referenceLanguageChain` falls back _selected → base →
English → target-only_, so a Greek course carrying only English translations is
usable by a German speaker reading English glosses, and improves the day someone
authors `translations-de` for it.

**Recommendation: commit to English as the hub.** Author X↔English for every
language; treat the remaining pairs as per-pair opt-in, ordered by demand. The
fallback chain is the coverage story, and it exists.

Two things already in place make this cheap. A translation set is **already its
own file** — `es-a1-b1-core-translations-en.jsonl` is 476 KB of a 6.0 MB pack,
under 8%. And `Translation` carries `provenance`, so a machine-produced set ships
marked `generated / unreviewed` exactly as the Spanish pack does, and is reviewed
per pair afterwards. The twelve deferred directions have an honest cheap path
that does not pretend to be edited prose.

**One thing to resist:** pivoting `de → en → zh` at runtime to synthesise a
missing pair. A gloss translated twice is wrong in ways a learner cannot detect,
and the chain's honest English fallback is better than a confident bad answer.
Pivot at _authoring_ time if you must, and mark it `generated`.

---

## 3. Translations become their own loadable unit

This is the pivot decision of the whole brief.

A translation set is currently a file _inside_ a pack's manifest, so adding a
base language re-versions and re-ships the pack it belongs to. Key it
`(pack, referenceLanguage)`, fetch it separately, version it separately.

Three problems collapse at once: the matrix becomes additive, the download
becomes small, and a base language can be added to an already-shipped pack
without touching it.

The seam exists. [`loadPack`](../../src/data/loaders/pack.ts) walks
`manifest.files`, each entry carrying a `kind`, over the `DatasetSource`
abstraction — so selective loading is a filter on that list plus a second
manifest for the pairs, not new machinery. `referenceLanguages(repository)`
already derives the picker from the translations _actually loaded_, so a set
arriving later needs no UI change.

**Decide the addressing now**, because it becomes cache keys and effectively an
API: `packs/core-de/2.1.0/translations-zh.jsonl` versioned independently of
`packs/core-de/2.1.0/sentences-a1.jsonl`, or a separate `pairs/` tree. Either
works; changing it after a pack ships invalidates every installed cache.

---

## 4. `core-en` is the highest-leverage single asset

One pack is one end of every linear direction in §2 — it serves Chinese, German,
Greek and Spanish speakers alike, and it is the direction most learners actually
want.

Author it **first-class and graded for English learners**, not derived from any
one language's gloss column. The previous session's finding stands: the English
columns in `content/es/*.tsv` give you sentence _text_ and never levels, skills
or frequency. `Tengo que trabajar` is A1 Spanish and its English is A1 by luck;
the B1 subjunctive sentences are mostly A2 English, and English present perfect
is B1-ish English sitting under A2 Spanish. English needs its own `skills.tsv` —
articles, phrasal verbs, present perfect, question inversion — none of which
appear in `content/es/skills.tsv`.

**One model gap English introduces that Spanish never did — settled 2026-08-25.**
`Token.lexeme` was one lexeme per token, and English has discontinuous
multi-token lexemes: `look up` is one dictionary entry, and `look it up` splits
it. Spanish never forced the question — the shipped pack has exactly **one**
multi-word lexeme, `por qué`, and it is contiguous. Spanish's enclitics are the
near-miss that already has bespoke handling (`resolveEnclitic`), but those are
_one_ surface.

`Annotation` now carries an optional `lexeme`, so the **span** is the headword
and the tokens keep their own words. Three reasons that is the right home:

- **Not `Token.lexeme`.** Pointing both `look` and `up` at `lexeme:look-up` makes
  a token answer "what unit am I part of" rather than "what word am I", so
  tapping `look` would stop reaching `look`. A span keeps both answers.
- **Not a `Skill`.** `tener que + infinitivo` is a pattern — how the language
  works — and the pack rightly models twelve of those as skills. `look up` is a
  _meaning_, and only a lexeme can carry one: `Sense` hangs off a `LexemeId`, so
  a phrasal verb filed as a skill could never be glossed, which is the one thing
  a learner tapping it wants.
- **The mechanism already existed.** 398 annotations already span tokens and name
  a skill; `tokens` is a list of ids rather than a range, so discontinuity is
  free. And `collocation` has sat in `ANNOTATION_TYPES` unused since the type
  existed — every shipped annotation is a `construction`. This is what it was for.

Nothing reads the field yet, deliberately, exactly as `case` and `reading`
landed: invisible while missing, a back-fill across every authored row once late.
What remains is a consumer — `inspectToken` answering "part of `look up`, which
means to search for" — and that wants English content to answer it about.

**The curriculum half is now shared — landed 2026-08-25.** §4's warning is about
_grading_: levels, skills and frequency do not transfer, and `core-en` must not be
derived from the Spanish gloss column. That is still true, and it left a separate
question unanswered — how much of the curriculum is not about a language at all.

The answer was 92 rows of 93. `content/es/skills.tsv` held the slug, the neutral
description and the prerequisite graph for every `function` skill, so
`content/en/skills.tsv` would have restated all three and nothing would have
noticed when they drifted. `content/capabilities.tsv` now owns that half, beside
the language directories rather than inside one; a language contributes the label
and the level. Ids stay pack-namespaced, so this cost no id migration and no
progress migration: ordering food in Spanish and in English remain separately
masterable, which is correct.

The one row that resisted is the useful finding. `confirm-with-a-tag` was
described as "with ¿verdad? or ¿no?" — true, and no help to a learner of English,
who needs "right?" or "isn't it?". A neutral description and a learner-facing
gloss are **not the same string**, which the old file could not express because it
had only one column for both. So the registry holds the neutral default and a
language may override it, with a gate rejecting an override that merely restates
the default — otherwise the shared description becomes decoration one row at a
time. Expect the same split wherever else a "neutral" string turns out to name a
particle: `ADDRESS_FORMS`' labels in §7 are the next candidate.

**Missions are split the same way — landed 2026-08-25.** `MissionDefinition.id`
was already documented as independent of a pack and `passage` was already a
_local_ id resolved against whichever compatible pack is loaded, so a mission was
always a spine plus per-language references with `language: 'es'` the field that
forced a duplicate. `MISSION_SPINES` now holds the curriculum — order, title,
goal, capabilities, estimated minutes, and the transfer ladder's support arc —
and `SPANISH_MISSIONS` holds the passages, the spotlight line, the learner's
speaker part and the response palettes. `resolveMissions` joins them and returns
the same `MissionDefinition` every screen already read, which is why the split
touched none of the nine importers.

**Be honest about what it saves.** Not lines: the response palettes are 1,569 of
the 1,932 and are irreducibly Spanish, because a nuance like "the same request in
tú" describes one sentence and transfers nowhere. What it saves is the
_sequencing_ — which mission comes first, what each aims at, and the
guided→guided→independent arc — which is the part that took judgement and would
otherwise be re-derived per language. Expect a second language's mission file to
be roughly as large as Spanish's, and its spine file to be empty.

Two design notes worth keeping. `rungs` is **index-aligned** with the spine's
`ladder`, the way `Passage.speakers` aligns with its `items`; the ladder is
ordered and that order is its meaning, so a key per rung would only restate the
position. A length disagreement is a bug rather than a shorter ladder, and
`tests/domain/mission-spines.test.ts` is the gate. And `level` sits on the
realisation, not the spine, because §4's grading finding applies: the same
capability is not the same difficulty in two languages.

The override pattern recurred exactly as the capability registry predicted. 49 of
51 transfer briefs are neutral; two name `usted` and `tú`, where the
formal/informal choice _is_ the situation and neutral prose cannot carry it. Same
mechanism, same gate — an override restating its neutral default is rejected.
That is now twice, so treat "a neutral default plus a per-language override, with
a gate against redundant overrides" as the house pattern for this whole class.

One caveat unchanged: `goal`, `title`, `scenarioPartner`, `brief`, `nuance` and
`cue` are learner-facing English prose. Neutral about the _target_ language and
still English, so a Spanish-speaking learner needs them translated — they belong
with the UI chrome, not here.

---

## 5. Transport: precache the shell, install the packs

`workbox.globPatterns` precaches `**/*.jsonl`
([`vite.config.ts`](../../vite.config.ts)). `core-es` alone is 6.0 MB; five
languages is ~30 MB fetched before a learner sees the first screen. The ceiling
comment in that file already says what to do — this is the moment it does.

- **Precache the shell and `catalog.json`.** The catalog is small and is what
  makes the course picker work offline.
- **Runtime-cache packs, `CacheFirst`, explicitly installed.** Settings → Packs
  already lists each pack with its version, levels, accents and licence; it
  becomes the install and remove surface, which is the honest UI for a 6 MB
  download a learner is now choosing. **Still open**, and it is the half that
  needs a real browser: a service worker's behaviour is not something the test
  suite or a dev server exercises, so it wants verifying against an installed app
  going offline rather than against a build log.

  Measured before starting, so the change has a number to beat: **7.1 MB across 22
  precached entries**, of which `sentences.jsonl` is 3.6 MB (52%) and
  `forms.jsonl` 1.8 MB (25%).

- ~~**Version in the path**~~ — **done 2026-08-26.** `packs/core-es/0.16.0/…`,
  with the version in `catalog.json` beside the manifest path. `CacheFirst` is now
  safe to add: an update is a new URL rather than a revalidation.

  **The loader needed no change at all**, which is worth recording because it is
  why this half was cheap: `loadPack` derives its root from the manifest path it
  was handed and resolves every `files` entry beside it, so moving the manifest
  moved everything. What did have the flat path typed into it was nine test files
  and `generate-audio.ts`; they resolve through `packManifestPath` now, the same
  question the app asks.

  It retired the workaround as promised. The build deleted any `.jsonl` it had not
  written, because a level change renames every file and the old set stayed on
  disk for `globPatterns` to precache. Under a version the old set is a different
  directory, so the deletion is housekeeping — one copy in the artifact — rather
  than a correctness guard. The build removes other version directories, and any
  file left loose from the flat layout, for that reason and no other.

- **Shard by level.** `sentences.jsonl` is 3.5 MB and `forms.jsonl` 1.8 MB —
  88% of the pack in two files. A course is a level _ceiling_, so an A1 learner
  currently downloads the entire B1 corpus to study A1. `filePrefix` already
  derives file names from `presentLevels`, so the machinery is there; the change
  is one shard per level rather than one file per kind.

  **The build half and the loader half landed 2026-08-26; the app half has not.**

  `sentences`, `forms` and `vocabulary` are one file per level, each declaring its
  level in the manifest so a loader decides without opening it. `loadPack(source,
path, { upTo })` fetches the shards at or below a ceiling plus everything
  unsharded, and `levelsUpTo` is the same rule the course filter uses — a level is
  in the session and in the download together, because two answers to "is this in
  scope" would be one too many. **An A1 course is 3.0 MB of the 6.3.**

  The half worth the care was not the arithmetic. **A partly loaded pack has to be
  a valid one**, and every _cross-record_ check reads as a defect when a shard is
  missing — a B1 passage naming B1 sentences looks exactly like a broken passage,
  and 1,757 translations point at items that were not fetched. Reporting those
  would teach a reader to ignore the issue list, which is worse than not having
  one. So `validatePackIntegrity(pack, { partial })` skips the checks that need
  the whole pack and keeps every check a single record can fail on its own.
  `tests/data/level-shards.test.ts` asserts both halves of that.

  **The app half landed 2026-08-28**, and it is where the bytes are actually
  saved: boot fetches the shards the address asks for — **3.0 MB of the 6.3** for
  an A1 course — and the rest arrives behind the first screen. It was briefed on
  its own in [`shard-loading.md`](shard-loading.md), whose §0 records what was
  built; that file is the place to read for how, rather than this one. The three
  things it asked for, all done:

  1. `courseOptions` derived a course's levels from the items _loaded_, so
     skipping B1 would have hidden the B1 course. It reads `manifest.levels` now —
     the ladder is declared (§7) — and `manifest.levelItems` for the chip counts,
     which the build emits for exactly this: a count taken from memory would
     report a smaller course rather than an unfetched one.
  2. Boot loads up to the ceiling in the URL, then prefetches the rest in the
     background so a level chip is usually instant. The ceiling comes from
     `parseCoursePath`, and from the stored level for `/`, which names no course
     and is where most sessions start.
  3. A chip tapped before the prefetch lands awaits it behind the loading state
     the app already has. **Not a reload** — the level chips sit on most screens
     and are tapped often. A _language_ switch may reload: rare, a different pack,
     and unreachable today because the picker hides itself with one pack loaded.

  (2) and (3) needed the change signal, which is a revision and a `subscribe` on
  `ContentRepository` read through `useSyncExternalStore` in `useCourse`.

Level sharding and the level scheme are the same decision, which is why they
belong in one pass — see §7.

---

## 6. The language module needs a runtime half

`src/languages/es` is imported only by `scripts/build-dataset.ts` and by tests —
never by `src/`. That is an elegant property, it is load-bearing in how the
architecture reads, and **Greek and Chinese will end it.**

Runtime language behaviour is already being called, just not by that name:

| Caller                       | Needs                          | State                          |
| ---------------------------- | ------------------------------ | ------------------------------ |
| `domain/exercises/speech.ts` | `normalise`, `splitWords`      | open                           |
| `ItemFilter.search`          | diacritic-insensitive matching | open                           |
| `initialLetter` / `byLetter` | bucketing and collation        | **done** — `standaloneLetters` |
| `ExerciseView`'s `PRAISE`    | a target-language string       | **done** — `correctnessPraise` |
| `UsageBadges`                | address-form pronouns          | **done** — `addressForms`      |

For Greek that means final sigma and accent handling; for Chinese, segmentation
and pinyin bucketing. `Ñ` is already special-cased inside the language-neutral
`alphabet.ts`, which is the same leak in miniature.

**Recommendation:** one `LanguageModule` interface, two halves.

- **build-time** — conjugation, nominal forms, numerals, the §1
  transliteration, and which gates apply
- **runtime** — segment, normalise, bucket, collate, address pronouns, praise

Load the runtime half when the course resolves, hold it in
[`services.ts`](../../src/app/services.ts) per rule 5, and it stays synchronous
at every call site while shipping as a per-language chunk — the same story as the
datasets. Keeping both halves under one `src/languages/<tag>/` directory is what
stops a language being half-added.

**Three of the five rows are done, 2026-08-26 (address forms with the schema
decisions).** `src/languages/runtime.ts` is the half a screen asks, and the two
new answers went in the way rule 1 requires rather than the way §6's sketch
implies: **the engine is handed the behaviour, it does not import it.** `Ñ` was a
literal inside the language-neutral `alphabet.ts` — §6 calls it "the same leak in
miniature" — so `standaloneLetters` is now the language's answer, `initialLetter`
takes it as a parameter, and `services.ts` hands the resolver to the repository
once. `src/domain` importing `src/languages` would have been a cycle _and_ a
layering inversion; a parameter is neither.

**One thing was subtly wrong and the test caught it.** Folding the requested
letter by each _item's_ language looks obviously right and is not: with a Spanish
and a French pack loaded, `Ñ` folds to `N` for the French rows, so the Ñ chip
returned three French words it had never counted. A chip _came from_ the index, so
it is read in the index's vocabulary — the union of the loaded languages — and
then the count a learner reads and the rows a tap produces are the same set.
`tests/domain/letter-index.test.ts` asserts that round trip over every chip, which
nothing did before: the two halves live in one file precisely so they cannot
disagree, and the layer above had no such guarantee.

`PRAISE` moved on its own terms. Its comment named its expiry — _when there is a
second of these strings, they move somewhere together_ — and both halves of the
reason it gave had since become false: the runtime half exists, the app does
import it, and the address-form labels are the second string.

**What is left of §6** is the pair that matters for Greek and Chinese rather than
for a second Latin-script language: `normalise`/`splitWords` in
`domain/exercises/speech.ts`, and the diacritic-insensitive matching behind
`ItemFilter.search`. Both work correctly for any language whose accents fold, so
the urgency arrives with final sigma and with segmentation — and both thread
through grading and the repository's search index, which is a wider change than
either of the two above.

---

## 7. Decisions, and which are permanent

| Decide now (schema, URL, ids, cache keys)            | Can wait                       |
| ---------------------------------------------------- | ------------------------------ |
| §1 transliteration, per language                     | Chinese segmentation, pinyin   |
| ~~Level: an open per-pack ladder~~ **done**          | Token-level alignment records  |
| §3 translation addressing and versioning             | The twelve non-English pairs   |
| §5 pack path versioning and level sharding           | Per-pair translation authoring |
| ~~`ADDRESS_FORMS` → per-language pronouns~~ **done** |                                |
| §6 `LanguageModule`, both halves                     |                                |
| `second-language.md` §3 local-id resolution scope    |                                |

`CEFR_LEVELS` ([`model.ts:15`](../../src/domain/content/model.ts)) is the most
urgent of these, because Chinese is taught in HSK bands and the level reaches the
zod schema, the URL path, mission filtering, `session-url.ts` and `ReadScreen`.
It is a URL migration and a data migration at once, and §5's shard names come out
of it.

**Landed 2026-08-26 — and it was neither migration.** That is worth recording,
because the fear is what kept it late. The _values_ never changed: `core-es` still
authors `a1`, `a2`, `b1`, still ships them, and rebuilds **byte-identically**. What
opened was the type and the ordering, so no link and no stored record moved. A
migration only arrives with a pack that is not CEFR, and by then the seam is there
to receive it.

The ladder is declared in `content/<tag>/levels.tsv` — **the row order is the
ladder** — and the build emits it into `PackManifest.levels`, in that order, with
the levels that have content. `levelLadder(repository, language)` reads it back,
and every ordering question now goes through it:

- `CEFR_LEVELS.indexOf(...)` is gone from all six call sites. `levelsUpTo` takes a
  ladder; `courseOptions` derives the rungs and the cumulative counts from it;
  `missionsForCourse` takes it as a parameter and `CourseScope.ladder` carries it
  to the three screens that need it.
- `ReadScreen` stopped re-deriving a ceiling at all. The course filter has
  _already_ resolved its ceiling into the explicit set of levels in scope, so
  membership is the whole test — one copy of the rule instead of two.
- `isLevelScope` checks the **shape** of an id, not membership. `/zh/hsk1/browse`
  parses now; an id no pack declares is widened by `resolveCourse`, which is where
  a stale bookmark was always handled.
- `?level=` is carried like `?topic=` and `?region=`. `list(..., CEFR_LEVELS)`
  silently dropped `?level=hsk1` from a Chinese course's own link.
- The zod boundary checks a slug. `z.enum(CEFR_LEVELS)` would have rejected a
  Chinese pack at load, so the guarantee moved to the build, which can hold a row
  against the pack's own declaration — the third time this division has been the
  answer, after the topic slugs and the address forms.
- `PackManifest.levelLabels` names a rung that does not name itself. Absent for
  CEFR on purpose: `a1` reads correctly as `A1`, and a label repeating it is a
  second place for it to go stale. `hsk1` is not, so the four screens that show a
  level pass the declared labels through.

`tests/domain/non-cefr-ladder.test.ts` is the proof §9 asks for, on an HSK ladder
chosen because it breaks two things CEFR happens to get right: `hsk10` sorts
before `hsk2`, so any order but the declared one puts the hardest band second, and
the bands do not name themselves.

**One pre-existing bug fell out of the new gate.** `second-language-build.test.ts`
wrote its German sentence row with a _leading tab_ — the id column left empty
rather than omitted, which is the trap the sentences header documents — so the
gloss parsed as the level and the fixture shipped an item with no text. It built
for as long as nothing compared a level against a ladder.

`ADDRESS_FORMS` gains a third case with Chinese: German makes the T–V choice with
`du`/`Sie`/`ihr` and Greek with `εσύ`/`εσείς`, but Chinese barely makes it at all.
So the field must be **droppable**, and `UsageBadges` must render nothing rather
than guess a label — which is a stronger requirement than "one label table per
language".

**Landed 2026-08-26.** The vocabulary is `LanguageModule.addressForms`, declared
in `src/languages/es/address.ts`, and each row carries both halves of the fact:
the pronoun a learner reads, and the neutral `number`/`formality` the build
reasons with when it matches a command to the audience its row declares. Both
neutral fields are optional, which is what German's `Sie` needs — formal in both
numbers, so a 2×2 would have forced two rows or a missing field — and a language
that marks nothing simply declares nothing.

Three consumers had a copy of the list and none of them owned it. `model.ts` held
the closed enum, so `AddressForm` is a slug now and the _build_ refuses a value
the language does not declare — the same place, and for the same reason, as a
topic or a skill slug; a shared zod schema could only ever have checked one
language's list, and `z.enum(ADDRESS_FORMS)` would have rejected a German pack for
saying `sie`. `UsageBadges` held a table of four Spanish pronouns, so it asks the
runtime module and **drops the badge for an id it cannot name**, keeping the
register and region badges beside it — which is also what a pack authored
elsewhere looks like when read on this course. And the build's own
`COMMAND_AUDIENCE` was a third copy.

`regionsForAddress` is gone with them, folded into the same rows. It answered one
question about address forms without listing them, so `vosotros` had its
Spain-only limit in one file and its existence in another, and a fifth form could
have been added and quietly got no region.

`core-es` rebuilds byte-identically: the ids a row authors are unchanged, only
where they are declared moved. `tests/languages/address-forms.test.tsx` holds the
build gate and both halves of the render-nothing rule.

### The reference language stays out of the URL

A link addresses _material_; the recipient reads it in their own base language.
That is the correct behaviour — the same sentence glossed for whoever opens it —
and it keeps the URL space from doubling. The preference already decides only
where `/` lands, and the fallback chain already covers a base language the pack
cannot serve.

`second-language.md` §7.1 notes nothing stops a learner setting both sides to the
same language. With _n_ languages that stops being an edge case, so resolve it as
a feature rather than an error: **filter the course's own language out of the
reference picker**, and offer "target language only" as an explicit choice, since
that is already the terminal step of `referenceLanguageChain` rather than a new
mechanism. The filter is landed with this brief; the explicit monolingual option
is not, because it wants a preference value and a sentence of UI copy.

---

## 8. Recommended order

1. ~~**§1's gate and transliteration.**~~ **Done** — the gate landed with this
   brief, the transliteration on 2026-08-26. Both before any German or Greek row
   exists, which was the point.
2. ~~**The schema decisions** — level ladder, address forms,
   `second-language.md` §3.~~ **Done, all three, 2026-08-26.** The level ladder
   turned out to be neither a URL migration nor a data one: the values are
   unchanged and `core-es` rebuilds byte-identically, so only the type and the
   ordering opened, and §5's shard names can now be read off `manifest.levels`.
   Local-id resolution went the way §3 recommended — the course's packs narrow a
   curriculum reference where the caller means it, and `validateAcrossPacks`
   compares within a target language, so `core-es` + `core-de` loads while two
   packs of one language still fail loudly. `pack-addressing.md` §3 holds the
   reasoning, including why always-qualified links are deferred rather than
   rejected.
3. **§6, the language module**, and `second-language.md` §2's parameterised
   build. With 1 and 2 settled this is refactoring rather than design.
4. **§3 and §5 in one pass** — translation units, pack versioning, level
   sharding, runtime caching. They are one decision wearing four hats, and this
   is the step most likely to be deferred and most expensive to retrofit, because
   it changes URLs _and_ cache keys _and_ the manifest shape simultaneously.
5. **German**, to exercise the seam cheaply.
6. **`core-en`** (§4), which unlocks every reverse direction at once.
7. **Greek**, then **Chinese** — `second-language.md` §5 and §6 respectively.

Steps 1–4 are the whole "decide it in alpha" window.

---

## 9. Definition of done

- **done** — a stem collision the record does not name fails the build, and so
  does one whose claim order has moved; `core-es` rebuilds byte-identically
  (`tests/data/stem-collisions.test.ts`)
- **done** — the reference-language picker never offers the language being
  learned, and the AI summary names the course's language rather than `es`
- **the seam is done, the language is not** — `LanguageModule.transliterate` is
  where `schön`/`schon` gets fixed, and a German module folding `ä ö ü ß` is all
  it takes; `content/de` will then need no `stem-collisions.tsv` at all. Asserted
  as far as it can be without German content: Spanish's own rule, and the refusal
  of a script no module can romanise (`tests/languages/orthography.test.ts`)
- **done** — `build:data <tag>` builds `content/<tag>` into `core-<tag>` with
  only that language's module loaded, `core-es` rebuilds byte-identically, and
  the catalog lists the packs on disk rather than a literal
  (`tests/data/second-language-build.test.ts`)
- **done** — `slug` is reached through the language module, and a lemma it cannot
  reduce fails the build rather than taking an id belonging to another word;
  `core-es` rebuilds byte-identically across the change
- **done** — the address vocabulary is the language module's; the build refuses a
  form it does not declare, and a badge with no label for one renders nothing
  rather than a raw slug (`tests/languages/address-forms.test.tsx`)
- **done** — a pack declares a level ladder that is not CEFR and the URL carries
  it: the order is the pack's, `?level=` and `/<language>/<level>` accept its ids,
  the build refuses a level the ladder does not name, and `core-es` rebuilds
  byte-identically across the change (`tests/domain/non-cefr-ladder.test.ts`)
- **done** — two packs of different languages may number their content the same
  way and both load; a bare local id resolves inside the course that asked, and
  narrows rather than prefers, so a scope cannot reach past itself
  (`tests/domain/scoped-refs.test.ts`)
- **done** — a headword spanning tokens that do not touch is expressible, and a
  span naming a missing lexeme is reported (`tests/data/multi-word-lexeme.test.ts`)
- **done** — the capability vocabulary is shared rather than per-language: a
  function the registry does not name fails the build, so does a prerequisite the
  language has not authored, so does an override that restates the shared
  description, and `core-es` rebuilds byte-identically
  (`tests/data/capability-registry.test.ts`)
- **done** — a mission's curriculum half is authored once and its Spanish half
  separately; the spine names nothing about Spanish, a realisation supplies one
  passage per rung, and the join reproduces what every screen already read
  (`tests/domain/mission-spines.test.ts`)
- a second language declares its own labels against the shared registry and adds
  no capability rows of its own, and realises the existing spines rather than
  authoring new ones
- tapping `up` in `look it up` names the phrasal verb and glosses it
- an A1 learner's first session downloads A1 shards, and no B1 file is fetched
- `translations-zh` can be added to a shipped `core-de` without re-versioning it
- a learner can install and remove one pack from Settings → Packs, offline after
- a German pack exists to build, and `build:data de` derives its morphology
- `tests/features/courses.test.tsx` passes with a third fixture language
