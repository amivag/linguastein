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
2. **A per-language transliteration**, as part of the language module (§6).
   German folds `ä ö ü ß` → `ae oe ue ss`, which is the language's own
   convention and resolves all five pairs above; Greek and Chinese romanise.
   Spanish keeps today's behaviour exactly, because its ids are permanent — which
   is what makes its eight rows a record rather than a backlog.

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

**One model gap English introduces that Spanish never did.** `Token.lexeme`
([`annotation.ts:131`](../../src/domain/content/annotation.ts)) is one lexeme per
token, and English has discontinuous multi-token lexemes: `look up` is one
dictionary entry, and `look it up` splits it. Today the options are two tokens
both pointing at the phrasal lexeme — which breaks "tap this word → this lemma" —
or an `Annotation` spanning them, which loses the dictionary entry. Spanish's
enclitics are the near-miss that already has bespoke handling
(`resolveEnclitic`), but those are _one_ surface, so the model never had to face
it. Settle it before English content, not after.

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
  download a learner is now choosing.
- **Version in the path** so `CacheFirst` is safe and an update is a new URL
  rather than a revalidation. Note this retires a workaround: the build currently
  deletes any `.jsonl` it did not write, because appending left the old set beside
  the new one for the service worker to precache. Versioned paths make that
  deletion unnecessary rather than load-bearing.
- **Shard by level.** `sentences.jsonl` is 3.5 MB and `forms.jsonl` 1.8 MB —
  88% of the pack in two files. A course is a level _ceiling_, so an A1 learner
  currently downloads the entire B1 corpus to study A1. `filePrefix` already
  derives file names from `presentLevels`, so the machinery is there; the change
  is one shard per level rather than one file per kind.

Level sharding and the level scheme are the same decision, which is why they
belong in one pass — see §7.

---

## 6. The language module needs a runtime half

`src/languages/es` is imported only by `scripts/build-dataset.ts` and by tests —
never by `src/`. That is an elegant property, it is load-bearing in how the
architecture reads, and **Greek and Chinese will end it.**

Runtime language behaviour is already being called, just not by that name:

| Caller                       | Needs                          |
| ---------------------------- | ------------------------------ |
| `domain/exercises/speech.ts` | `normalise`, `splitWords`      |
| `ItemFilter.search`          | diacritic-insensitive matching |
| `initialLetter` / `byLetter` | bucketing and collation        |
| `ExerciseView`'s `PRAISE`    | a target-language string       |
| `UsageBadges`                | address-form pronouns          |

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

---

## 7. Decisions, and which are permanent

| Decide now (schema, URL, ids, cache keys)                         | Can wait                       |
| ----------------------------------------------------------------- | ------------------------------ |
| §1 transliteration, per language                                  | Chinese segmentation, pinyin   |
| Level: an open per-pack ladder, not the closed `CEFR_LEVELS` enum | Token-level alignment records  |
| §3 translation addressing and versioning                          | The twelve non-English pairs   |
| §5 pack path versioning and level sharding                        | Per-pair translation authoring |
| `ADDRESS_FORMS` → neutral concepts + per-language pronouns        |                                |
| §6 `LanguageModule`, both halves                                  |                                |
| `second-language.md` §3 local-id resolution scope                 |                                |

`CEFR_LEVELS` ([`model.ts:15`](../../src/domain/content/model.ts)) is the most
urgent of these, because Chinese is taught in HSK bands and the level reaches the
zod schema, the URL path, mission filtering, `session-url.ts` and `ReadScreen`.
It is a URL migration and a data migration at once, and §5's shard names come out
of it.

`ADDRESS_FORMS` gains a third case with Chinese: German makes the T–V choice with
`du`/`Sie`/`ihr` and Greek with `εσύ`/`εσείς`, but Chinese barely makes it at all.
So the field must be **droppable**, and `UsageBadges` must render nothing rather
than guess a label — which is a stronger requirement than "one label table per
language".

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

1. **§1's gate and transliteration.** Before any German or Greek row exists.
2. **The schema decisions** — level ladder, address forms,
   `second-language.md` §3 — together, because every authored row depends on all
   three.
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
- `schön` and `schon` are distinct lexemes with ids naming the right word, and
  `content/de` needs no `stem-collisions.tsv` at all
- `slug` is reached through the language module, and no caller assumes ASCII
- a pack declares a level ladder that is not CEFR, and the URL carries it
- an A1 learner's first session downloads A1 shards, and no B1 file is fetched
- `translations-zh` can be added to a shipped `core-de` without re-versioning it
- a learner can install and remove one pack from Settings → Packs, offline after
- `npm run build:data -- de` builds `core-de` with no Spanish module loaded
- `tests/features/courses.test.tsx` passes with a third fixture language
