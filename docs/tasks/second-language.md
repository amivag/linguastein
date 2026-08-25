# Task: a second target language, and a switchable base language

**Status:** briefed, partly landed — the app-side fixes are in, the decisions are not
**Written:** 2026-08-24
**For:** a fresh agent session, no prior context assumed
**Scope:** the authoring pipeline, id namespacing, the morphology model and the
base-language seam. No German, Greek or Chinese content is authored here — this
is what has to be true _before_ it is.

Read [`AGENTS.md`](../../AGENTS.md) — **Architecture rules** 6 and 8, **Courses
and the URL**, and **Datasets** — and
[`docs/tasks/pack-addressing.md`](pack-addressing.md), which briefs §3 below from
the one-language side and is now overtaken by events.

§2–§5 are what a second European language needs. **§6 is a different question**:
Chinese breaks assumptions the code treats as universal rather than as Spanish,
and two of its findings are cheap today and migrations later — read that section
even if Chinese is not on the roadmap.

---

## 1. Where this stands

The runtime is in better shape than the pipeline. The engine was built so that
"one target language" is a scope rather than an assumption, and the parts that
hold it are real:

- `courseOptions` derives the languages on offer from the packs, so a second
  pack appears in the picker and in the URL with no code change
- a course is an `ItemFilter`, so nothing downstream knows courses exist
- progress references item ids that carry their pack, so switching course cannot
  invalidate anything practised
- translations are separate records resolved through a fallback chain, exactly
  as rule 6 requires
- `tests/fixtures/pack.ts` ships a French pack, and `tests/features/courses.test.tsx`
  drives two languages through the real routes

Four app-side gaps were found alongside this brief and **are fixed**:

| Was                                               | Now                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `lang="es"` typed into 20 elements                | `useTargetLanguage()` / `repository.languageOfItem`                                                 |
| Reference languages a constant of one             | `referenceLanguages(repository)`, counted from the translations actually loaded                     |
| Accents a Spanish-only constant                   | `pronunciationLocales(repository, language)`, from the manifest, its voices, or the bare tag        |
| The accent stayed `es-ES` through a course switch | `resolvePronunciationFor` moves it with the language, and drops the voice chosen inside the old one |
| `validateAcrossPacks` checked passages and skills | …and items, which is what missions address                                                          |

A second pass then landed the groundwork that is additive — the changes that
cost nothing today and become a back-fill across every authored row once content
exists:

| Was                                      | Now                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `Morphology` could not express a case    | `case?: GrammaticalCase` over the German and Greek inventories (§4)             |
| Nowhere to put a transliteration         | `reading?` on `LearningItem` and `Token` (§6)                                   |
| `PUNCTUATION` knew only Latin marks      | Greek and CJK marks too, asserted in `tests/domain/phrase-inspect.test.ts` (§6) |
| Chrome that named Spanish in nine places | Derived from the course, or from the item's own pack where one is in hand (§8)  |

None of those has a consumer yet, and that is the point: each is a field or a
character class that is invisible when missing and a migration once it is late.

What is **not** fixed is everything below. None of it is hard; all of it is a
decision, and every one of them is cheaper to make before there is content
shaped by the wrong answer.

---

## 2. The build is one language's build — **landed 2026-08-25**

`scripts/build-dataset.ts` is 3,000 lines and is `core-es`'s build, not a build:

```text
scripts/build-dataset.ts:21-32   imports es/conjugation, es/irregulars,
                                 es/alphabet, es/morphology, es/numerals
scripts/build-dataset.ts:36      CONTENT_DIR defaults to content/es
scripts/build-dataset.ts:2738    targetLanguage: 'es'
scripts/build-dataset.ts:2752    "High-frequency Spanish verbs, nouns…"
scripts/build-dataset.ts:2756    pronunciationLocales: ['es-ES', 'es-MX']
scripts/build-dataset.ts:2114    vosotros ⇒ regions: ['es-ES']
…:catalog                        packs: [{ id: PACK_ID, manifest: 'core-es/pack.json' }]
```

The Spanish imports are the load-bearing half. `conjugate`, `adjectiveForms`,
`pluralOf`, `spellCardinal` and `isLetterName` are called unconditionally, and
the build **refuses to run** when a verb has no irregularity entry — which is
correct for Spanish and meaningless for a language whose module does not exist.

**Do not fork this file.** Two copies drift on the id ledger, the review gate,
the duplicate-text check and the topic registry, which is nine gates that then
have to be fixed twice.

**What shipped** is the shape below, with three departures worth knowing:
the interface is in `src/languages/types.ts` and `index.ts` is the loader; the
module is loaded with a dynamic `import()` rather than a static map, because
only that makes "no Spanish module loaded" true and testable; and instead of
"a declaration of which gates apply", **every capability is optional and the
gates key on its presence** — a language with no `numerals` skips the numeral
checks because there is nothing to check against, which needs no second list to
keep in step. The manifest's prose moved to `content/<tag>/manifest.tsv` as
recommended, `referenceLanguages` is derived from the translations actually
emitted, and the catalog is derived from the packs on disk.

**Recommended shape.** A `LanguageModule` interface in `src/languages/index.ts`
that a per-language directory implements — `conjugate`, `nominalForms`,
`spellCardinal`, `isLetterName`, `alphabet`, plus a declaration of which gates
apply. The build takes a language tag, loads that module, and everything
language-neutral (ids, ledger, topics, skills, passages, review, duplicate text,
file naming, manifest assembly) stays exactly where it is. `content/<tag>/` and
`public/packs/core-<tag>/` follow from the tag. The catalog becomes the list of
packs built rather than a literal.

The honest estimate is that roughly 80% of the file is already language-neutral
and reads as though it were written for this. The work is drawing the line, not
moving the code.

**Also note:** the manifest's `name` and `description` are English prose built
from a literal. Move them beside the content, in `content/<tag>/pack.tsv`, which
already owns the version.

---

## 3. Ids collide across packs, and a second language guarantees it

This is [`pack-addressing.md`](pack-addressing.md)'s decision, arriving from a
direction that brief did not consider: not a second _Spanish_ pack, but a second
_language_.

Two packs from one generator both number their sentences from `000001` and their
passages from `700001`. `validateAcrossPacks` reports that as an **error**, so
`core-es` + `core-de` does not load at all — the build gate fires before anything
subtle can happen. That is the right failure and it is still a wall.

The three options in `pack-addressing.md` all remain open. But a second language
adds a fourth that a second Spanish pack could not:

### D. Resolve a local id within the course

The path already carries the language — `/de/a1/read/700001` cannot mean the
Spanish passage. Scoping `passageByRef`, `skillByRef` and `itemByLocalId` to the
packs of the current course makes `700001` unambiguous again for _cross-language_
collisions, at no cost to link spelling, and leaves `validateAcrossPacks` to
police the case it was written for: two packs of the **same** language.

Against it: the repository is deliberately course-unaware ("a lexeme lookup
should not care which pack it came from"), so this pushes course scope one layer
down. And it does nothing for `?skill=preterite` addressed from a screen with no
course, if one is ever added.

**Recommendation: D, narrowed.** Keep the repository course-blind and let the
_callers_ that already hold a course pass its packs into `resolveRef` — which
already accepts a candidate list. Then `validateAcrossPacks` should compare
**within a target language** rather than across all packs, because that is what
it was actually protecting.

Whichever wins, decide it before generating a second pack: the id ledger makes
ids permanent, and a scheme changed afterwards is a migration.

---

## 4. The morphology model has no case, and address is Spanish pronouns

`src/domain/content/annotation.ts` is close to Universal Dependencies and mostly
neutral. Two fields are not, and both are TSV schema — so both are far cheaper to
settle before a row exists.

**`Morphology` has no `case`.** German needs four (nominative, accusative,
dative, genitive); Greek needs four (nominative, genitive, accusative, vocative).
Nothing in the model can express "this is the dative", so a German pack cannot
teach the one thing German learners actually struggle with, and `formsOf` — which
is what makes tapping `verduras` answer "what is the plural" — could not list a
noun's paradigm at all. **Done:** `CASES` and `Morphology.case` are in
`annotation.ts` and in the zod schema, unused, covering the two inventories
between them. `gender` already covers three, which German and Greek both need.
What remains is a language module declaring which of them it uses.

**`ADDRESS_FORMS = ['tu', 'usted', 'vosotros', 'ustedes']`** is named after
Spanish pronouns, deliberately and with a good reason recorded: it is the choice
a learner is making. German makes the same choice with `du`/`Sie`/`ihr` and Greek
with `εσύ`/`εσείς`. The values cannot be shared, and `UsageBadges` renders the
label and the tooltip from a `Record<AddressForm, …>` that would have to grow
per language.

**Recommendation:** make the _concept_ language-neutral (`informal-singular`,
`formal-singular`, `informal-plural`, `formal-plural` — the distinction actually
being taught) and let each language module supply the pronoun each one is called
by. `Morphology.formality` already carries `informal | formal`, so the model half
of this is nearly written. Migrating Spanish's four values is a mechanical pass
over the TSVs plus the id-stable rewrite the build already does.

**`TENSES` is Romance-shaped** (`preterite`, `imperfect`) but it is an open list
of slugs with no logic keying on the Spanish ones outside `src/languages/es`, so
adding German's is additive. Not a blocker; note it and move on.

---

## 5. Greek is a second script, not just a second language

Everything below is fine for German and needs a decision for Greek:

- `alphabet.ts` folds accents through NFD, which is right for Greek (`ά` → `Α`)
  and files words correctly. `Ñ` is special-cased before the fold; that is
  Spanish knowledge sitting in a language-neutral module, and where Greek's
  final sigma (`ς`/`σ`) belongs is the same question
- there is nowhere to put a transliteration. `Preferences.showRomanisationHints`
  used to sit in the record unread and was deleted on 2026-08-24
  (`docs/tasks/learner-profile.md` §9.5) — correctly, because it was a
  _preference_ for data that did not exist. The data comes first: see §6's
  `reading` field, which is the thing a hint would have been a switch for
- speech recognition (`SpeakCheck`) grades against the written form. Greek
  normalisation — final sigma, accent stripping, sigma variants — is
  `domain/exercises/speech.ts`'s problem and is currently Spanish-tuned

---

## 6. Chinese is a different shape, not another instance

German and Greek are more inflection tables and a second script. Chinese is not
another instance of the same shape: it falsifies things the code assumes about
_language_, not about Spanish. The findings below are measured rather than
predicted — each is the real output of the real function.

| Call                                       | Result               | What it means                                                                                            |
| ------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------- |
| `joinTokens(['我','要','去','银行','。'])` | `"我 要 去 银行 。"` | Every sentence renders with spaces — and this feeds share payloads, AI prompts and accessible names      |
| `splitWords('我要去银行。')`               | `["我要去银行。"]`   | One "word", full stop included. Speech grading becomes all-or-nothing against a string ASR never returns |
| `isPunctuation('。')`                      | `false`              | `PUNCTUATION` has no CJK marks, so `。` becomes an inspectable, tappable word                            |
| `normalise('nǐ hǎo')`                      | `"ni hao"`           | Tone marks stripped: `mā/má/mǎ/mà` collapse to one word in search and in grading                         |
| `initialLetter('我要去银行')`              | `"我"`               | The letter index gets one chip per distinct first character — thousands of them                          |
| `slug('银行')`                             | `""`                 | **Every Chinese lexeme gets the same empty id stem**                                                     |
| `Intl.Collator('zh').compare`              | `爱 去 我 银行`      | Sorting is fine — ICU already collates by pinyin. It is the _bucketing_ that is not                      |

`slug` is the hardest stop. It ends `.replace(/[^a-z0-9]+/g, '-')`
([`scripts/build-dataset.ts:897`](../../scripts/build-dataset.ts)), so `银行`,
`我` and `你好` all return the empty string. The build's form-id guarantee — "a
form id's stem comes from the **lexeme id**, which `lexemeId` already keeps
unique" — collapses entirely, and the ñ/n collision that guarantee was written to
prevent becomes every word at once.

### The four assumptions

1. **Words are separated by spaces.** `needsSpaceBefore`, `joinTokens` and
   `splitWords` all encode it, in `domain/content` where nothing marks it as a
   language's habit. The CJK marks are now in the shared `PUNCTUATION` class, so
   `你好，世界！` splits into two words rather than one — but the _segmentation_
   still needs a per-language rule, and so does the join: `splitWords`
   ('我要去银行。') is still one word, because nothing has told it where the
   boundaries are.
2. **Text is alphabetic.** The letter index and the id slugs both assume a small
   closed set of initials. Chinese would index by pinyin initial, radical or
   stroke count — a per-language decision, not a tweak to `fold`.
3. **A word inflects.** `Morphology` is person/number/gender/tense/mood/degree,
   and Chinese has none of them, so `forms` records would be empty and "tap a
   word to see its paradigm" would show nothing. What Chinese _does_ need —
   measure words, aspect particles `了/着/过` — has no field. Compare §4: German
   wants a field added, Chinese wants the whole shape to be optional.
4. **The written form is what you practise.** There is no `reading` field on
   `LearningItem` or `Token`. Pinyin is not a hint for Chinese; it is how a
   learner searches (`yinhang` → 银行), sorts, and starts at all.

### Two things to settle now, even if Chinese never happens

Both are additive today and migrations once content exists. That asymmetry is the
whole argument for doing them with §4 rather than later.

**`level` should be an open per-pack scheme, not a closed CEFR enum.**
`CEFR_LEVELS` ([`model.ts:15`](../../src/domain/content/model.ts)) is a closed
list that reaches the zod schema, the URL path (`/zh/a1/browse`), mission
filtering, `session-url.ts` and `ReadScreen`. Chinese is taught in HSK bands, so
an HSK pack cannot declare its own level — and because the level is _in the URL_
and in id-stable data, changing this after a pack ships is a URL migration and a
data migration at once. A pack declaring its own ordered ladder, with the app
treating a level as an opaque ordered token, costs almost nothing now.

**An optional `reading` on `Token` and `LearningItem`** — **done.** Romanisation,
furigana, transliteration — one field, ignored by every language that does not
use it. Greek wants it too (§5). Note the ordering lesson already learnt here:
`showRomanisationHints` was a preference for data nothing held, and was rightly
deleted rather than wired up. The field is what makes the switch worth having.
Retrofitting it across an authored pack is not additive.

### Sequencing

**Do German first**, even if Chinese is the more interesting destination. German
exercises the `LanguageModule` seam (§2) cheaply and proves the parameterised
build without simultaneously forcing tokenisation, readings and the level scheme.
Chinese then arrives against a build that is already language-shaped, and its
work is the four assumptions above rather than those _plus_ everything in §2–§4.

---

## 7. A base language other than English

Structurally this is the closest to done and the furthest from usable.

`referenceLanguage` is threaded correctly through every screen, the exercise
generators, the session config, the AI context and the share payloads — 30-odd
call sites, none of them assuming English. `referenceLanguageChain` falls back
selected → base → English → target-only. The picker now offers what the packs
actually carry.

So the seam is real and the gap is content: `core-es` ships one translations
file, `…-translations-en.jsonl`. Offering Spanish as a base language means
authoring `…-translations-es.jsonl` for the German pack, and so on — **n × (n−1)**
translation sets for n languages, which is the real cost and the reason to decide
early which directions are actually supported.

Two things the code still needs:

1. **The reference language must not be the target language.** Nothing stops a
   learner setting both to `es` today; they would get Spanish glossed in Spanish.
   Filter the current course's language out of `referenceLanguages`, or say why
   not (a same-language definition is a legitimate advanced mode — but it should
   be a choice, not an accident).
2. **`REFERENCE_LANGUAGES` vs `TARGET_LANGUAGES`** in `language.ts` are two
   lists that exist only to spell a tag for a human, and `languageOption` already
   searches both. Once a language is on both sides, keep one table.

---

## 8. Two smaller things, both cheap

**UI copy that names Spanish.** These are chrome, not mission content, and each
reads wrong on a German course:

**Done, except two.** Nine strings now read the language off the course, or off
the item's own pack where the screen has one in hand — `ExerciseView`'s card
heading and hint, `payloads.ts`'s copy label and AI prompt, `BrowseScreen`'s
search label, three in `MissionScreen`, and `VoiceSettings`' "add a voice"
advice. The strings in `src/app/missions/es.ts` are the _content_ of Spanish
missions and correctly still say Spanish. `presets.ts` was reworded instead of
derived: a preset is static config with no course in hand, and the card it
launches already names the language where the learner is about to act.

Two are left, and both are product decisions rather than mechanical:

```text
src/app/identity.ts:33   tagline: 'Spanish Practice'
vite.config.ts:89        manifest description: 'Mobile-first Spanish practice…'
```

These are the app's _identity_, not its chrome: the tagline reaches the document
title, the install prompt and the PWA manifest's `name`, so changing it changes
what an installed app is called on a home screen. It should stop naming Spanish
before a German pack ships, but what it becomes is a naming decision, and
`identity.ts` is explicitly the one file a new project edits — so it is left for
a human to say.

`ExerciseView`'s `¡Correcto!` is already handled — there is a small `PRAISE`
table keyed by language with an English fallback. It is the first entry in what
will become "UI strings that are in the target language"; when there is a second,
move them somewhere together.

**The precache budget.** `core-es` is 5.6 MB across nine files, the largest
3.2 MB, against a `maximumFileSizeToCacheInBytes` of 8 MiB and a `globPatterns`
that precaches every `.jsonl` in the build. Three languages is ~17 MB downloaded
before a learner opens the first screen. The ceiling comment in `vite.config.ts`
already says what to do — "a pack heading past it wants `runtimeCaching` and an
install step" — and a second language is the moment it does. See
[`pack-addressing.md`](pack-addressing.md) §4.

---

## 9. Recommended order

1. **§3, the id scheme.** Permanent once content exists. Decide first.
2. **§4, `case` and address forms, together with §6's two additive changes** —
   the open level scheme and the `reading` field. All four are TSV schema, every
   authored row depends on them, and the two from §6 are free now and a
   migration later whether or not Chinese is ever built.
3. **§2, parameterise the build.** With 1 and 2 settled, this is refactoring
   rather than design.
4. **§8's precache decision**, before a second pack is in the artifact.
5. Author German — it is the cheapest exercise of the seam. Greek after, once §5
   is answered.
6. **Chinese (§6) after German has shipped**, never alongside it: its four
   assumptions are enough work without §2–§4 still being open underneath.
7. **§7**, whenever a second translation direction is actually wanted — it is
   independent of everything above.

Steps 1–3 want one session each. §8's copy pass is an afternoon and can happen
at any point.

## 10. Definition of done

- **done (2026-08-25)** — `npm run build:data -- de` builds `core-de` from
  `content/de` with no Spanish module loaded, and `core-es` still rebuilds
  byte-identically. §2 is landed; see
  [`language-matrix.md`](language-matrix.md) and
  `tests/data/second-language-build.test.ts`
- `core-es` and `core-de` load together with no validation errors
- a mission's `{ item: '001147' }` resolves within its own language, proven by a
  test with both packs loaded
- a German noun's four cases are expressible, and appear in `formsOf`
- a pack can declare a level ladder that is not CEFR, and the URL carries it
- no screen names Spanish unless the content it is showing is Spanish
- `tests/features/courses.test.tsx` passes with a third fixture language

For Chinese specifically, later and separately:

- `joinTokens` renders `我要去银行。` unspaced, and `splitWords` returns five words
- `slug('银行')` is not the empty string, and no two lexemes share a stem
- a learner can find 银行 by typing `yinhang`, and `mā` does not match `mà`
