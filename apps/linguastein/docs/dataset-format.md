# Dataset format

Canonical learning data is **JSON + JSONL**:

- `.json` for small hierarchical documents (catalog, pack manifest)
- `.jsonl` for collections of independent records (items, lexemes, forms,
  skills, translations)

CSV may be used for import/export and spreadsheet editing; canonical data never
depends on it.

Lines beginning with `#` are treated as comments, and blank lines are ignored.

## Authoring vs. generated

Two directories, one direction of flow:

```text
content/capabilities.tsv   SHARED by every language — slug, neutral description,
                           prerequisites. Belongs to no one language, so it sits
                           beside the language directories rather than in one.

content/es/            ← humans edit this (TSV, one row per lemma or sentence)
├── verbs.tsv              lemma, gloss, level, regular|irregular, topics
├── nouns.tsv              id, lemma, gloss, gender, plural, level, topics, regions, register
├── modifiers.tsv          id, adjectives, adverbs, function words, extra forms
├── sentences-*.tsv        id, spanish, english, level, topics, note, register, address,
│                          regions, passage, speaker, skills
├── passages.tsv           id, key, kind, title (es), title (en), level, topics
├── topics.tsv             slug, label (en), group (en) — the topic vocabulary
├── skills.tsv             authored skill slug, kind, label (es), level,
│                          gloss override (optional) — see below
└── id-ledger.tsv          GENERATED — every item id ever issued, active or retired

        │  npm run build:data
        ▼

public/packs/          ← generated, shipped, never hand-edited
├── catalog.json                          the packs and the units, unversioned
├── core-es/
│   └── 0.16.0/                           the pack's version is in its path
│       ├── pack.json
│       ├── es-a1-b1-core-skills.jsonl
│       ├── es-a1-b1-core-verbs.jsonl          lexemes
│       ├── es-a1-b1-core-nouns.jsonl          lexemes
│       ├── es-a1-b1-core-modifiers.jsonl      lexemes
│       ├── es-a1-b1-core-forms-a1.jsonl       generated forms, per level
│       ├── es-a1-b1-core-vocabulary-a1.jsonl  word cards, per level
│       ├── es-a1-b1-core-sentences-a1.jsonl   sentences, per level
│       └── es-a1-b1-core-passages.jsonl       ordered runs of those sentences
└── translations/                         meanings, addressed apart from the pack
    └── core-es/
        └── en/
            └── 0.16.0/                   and versioned apart from it too
                ├── translations.json
                └── es-a1-b1-core-translations-en.jsonl
```

Two things in that tree are load-bearing rather than tidy.

**The version is in the path.** An update is a new URL rather than a
revalidation of an old one, which is the only way `CacheFirst` is safe for a
6 MB file. `catalog.json` is the sole unversioned file, because something has to
be fetched fresh to learn what the current versions are.

**The meanings are not in the pack.** A translation set is keyed
`(pack, referenceLanguage)`, addressed under `translations/` and versioned on its
own. While it was a file inside `pack.json`, adding a reference language edited
that manifest, which re-versioned the pack, which changed every one of its file
URLs — so giving Chinese speakers a Spanish course cost every existing learner a
re-download of Spanish that had not changed. Split out, adding a language is a
new directory and one more line in the catalog, and the pack does not move. See
[`docs/tasks/language-matrix.md`](tasks/language-matrix.md) §3.

The build derives everything mechanical: conjugations (`src/languages/es`),
plurals and adjective agreement, stable ids, sentence tokenisation, token →
lexeme links, grammar-pattern annotations, and translation records for items,
lexemes and skills. It also reports coverage — which lemmas appear in no
sentence — and refuses to run when a verb is tagged `irregular` without an entry
in the irregularity table, or a row uses a topic that `topics.tsv` does not
declare. CI re-runs it and fails on any diff.

Ambiguous surface forms are resolved by the words on either side: `el trabajo`
is the noun and `trabajo en una oficina` is the verb, `canta muy mal` is the
adverb and `mal tiempo` the adjective. Where neither side is decisive the token
is left unlinked — `fue` is `ser` or `ir` and nothing nearby says which, so a
missing lemma is preferred to a wrong one.

### Authored communicative skills

`content/es/skills.tsv` declares abilities that cannot be inferred from morphology,
especially communicative functions. A topic says what material is about; a
function says what the learner is trying to accomplish. For example,
`restaurant` is a topic while `order-food-drink` is a function. Sentence rows
attach one or more registered skill slugs in their `skills` column.

A function row is split across two files, because only half of it is about
Spanish. `content/capabilities.tsv` — a sibling of the language directories, not
inside one — owns the slug, the neutral description and the prerequisite graph;
`content/es/skills.tsv` owns the target-language label and the CEFR level. The
build resolves slugs to namespaced ids, emits the description as a translation,
and fails on a function the registry does not name, on a prerequisite the
registry requires but this language has not authored, and on a registry row that
is duplicated, undescribed or depends on a capability that does not exist.

That split is what stops a second direction forking the curriculum. `core-en`
does not restate that `handle-add-on` follows `order-food-drink`; it says how
English spells them. Ids stay pack-namespaced —
`core-es:skill:order-food-drink` and `core-en:skill:order-food-drink` are two
things to be good at, and mastery of one is not evidence of the other. What is
shared is the capability, not the skill.

A language may append a fifth column to its own row to override the neutral
description where it can be more concrete: Spanish glosses
`confirm-with-a-tag` as "with ¿verdad? or ¿no?", which is worth more to a learner
here than "a tag question" and worthless to a learner of English. An override
that merely restates the shared description is rejected, or the default quietly
stops being the default.

Grammar and morphology skills remain derived; do not duplicate them in either
file. A non-`function` authored row is language-specific by definition and needs
no registry entry.

## File naming

```text
<language>[-<region>]-<level>-<scope>-<content-type>.jsonl
```

Lowercase, kebab-case, no version numbers in filenames — versioning belongs in
the manifest.

```text
es-a1-core-verbs.jsonl
es-a1-travel-phrases.jsonl
es-mx-a1-everyday-phrases.jsonl
es-b1-b2-storytelling-phrases.jsonl
```

## Usage: register, address and region

Three fields say _when_ a phrase is safe to use. They matter as much as the
translation: address a stranger as `tú` and you are rude; order a `zumo` in
Bogotá and nobody knows what you mean.

| Field      | Values                                         | Meaning                               |
| ---------- | ---------------------------------------------- | ------------------------------------- |
| `register` | `neutral` · `colloquial` · `formal` · `vulgar` | how casual it is; unmarked = neutral  |
| `address`  | `tu` · `usted` · `vosotros` · `ustedes`        | who it is said to                     |
| `regions`  | BCP 47 tags, e.g. `es-ES`, `es-419`, `es-MX`   | where it is said; unmarked = anywhere |

`address` is derived automatically where the morphology is unambiguous: a
second-person singular verb means `tu`, a second-person plural means `vosotros`
(and marks the sentence `es-ES`), and a command says outright who it is aimed at —
`Siga` can only be `usted`. Third person is never inferred — `está` is `usted` or
`él`/`ella` depending on context — so those are declared by hand.

`address` is also the signal that a sentence is a **command**. A tú command is
spelled exactly like the third person present, so `Cierra la puerta` and `La
tienda cierra a las dos` are indistinguishable to the build. Declaring the address
on the first resolves it: a non-question that opens with a verb having that
address's command form is read as a command, and everything else stays indicative.
Guessing from word order instead would turn `Hace frío` into an order to be cold.

### Who is speaking

A fourth field says who the sentence is _about_, and only self-description sets
it:

| Field           | Values                   | Meaning                                      |
| --------------- | ------------------------ | -------------------------------------------- |
| `speakerGender` | `masculine` · `feminine` | the gender the speaker commits themselves to |

`Estoy cansado` and `Estoy cansada` are the same sentence and exactly one of them
is a given learner's, so the pack ships both and a learner's own setting decides
which they meet first — a bias, never a filter, since the other half is said to
them by other people. Unmarked is the common case and means the sentence says
nothing about who is speaking, which is nearly all of it.

Derived, like `address`, and on the same principle: only where the morphology is
unambiguous. A first-person copula whose _adjective_ agrees with the speaker
(`Estoy cansada`, `Soy alta`) is read; everything else is left alone. Three cases
are deliberately not derived, and each of them is a false positive somebody would
have had to find by noticing content missing:

- **The imperfect.** `estaba` and `era` are spelled the same in the first and
  third person, so `El comedor estaba vacío` says nothing about a speaker.
- **A predicate noun.** `Soy una persona tranquila` agrees with `persona`, which
  is feminine whoever says it. The scan stops at a noun, which costs the
  professions — `Soy profesora` is declared in the column instead.
- **A line in a passage.** Its speaker is a character, not the learner, so
  narrowing it would delete a line from the middle of a text.

**Ship both halves of a pair**, the same rule regional variants follow: a marked
sentence with no counterpart leaves one learner practising a form they will never
be asked to vary. `tests/data/speaker-gender.test.ts` fails on an unpaired one.

Regions propagate. A word marked `es-419` marks every sentence that uses it,
and its word card, so a learner aiming at Spain is not taught `papa`. Content
with no region passes everywhere, which is the common case; `es-419` covers any
Latin American locale.

Where a language has two words for one thing, ship both sides of the pair:
`papa`/`patata`, `coche`/`carro`, `jugo`/`zumo`, `ordenador`/`computadora`,
`móvil`/`celular`, `billete`/`boleto`, `gafas`/`lentes`. Shipping one silently
teaches a dialect as if it were universal — and shipping one side with an example
sentence and the other as a bare word card does the same thing more quietly.

## Identity

```text
<namespace>:<kind>:<local>
```

Kinds: `item`, `lexeme`, `sense`, `form`, `skill`, `passage`.

```text
demo-es:item:000201
demo-es:lexeme:tener
demo-es:skill:tener-que-infinitive
```

Rules:

- published IDs are stable forever; learner progress references them
- independent datasets must not collide — that is what the namespace is for
- display labels are not identity
- a typo fix keeps the ID; a materially different learning object gets a new one

Lexeme, form and skill ids derive from the lemma. Item ids are owned by the
source row: they sit in the first column of `sentences-*.tsv`, `nouns.tsv` and
`modifiers.tsv`, and `build:data` assigns one to any row that lacks it and writes
it back. A row therefore keeps its id through a typo fix, a reordering, or a move
to a different file — which a content hash could not do, since the hash changes
when the typo is fixed.

Ranges keep the kinds from disturbing each other: sentences `000001+`, noun word
cards `500001+`, adjective word cards `600001+`, passages `700001+`.

`content/es/id-ledger.tsv` records every id the pack has ever issued, with the
ones no row claims any more marked `retired`, so a deleted row's id is never
handed to a new row. It is generated — do not hand-edit it, and do not hand-edit
an assigned id.

## Records

### Item

The unit of practice: a word, phrase or sentence in the target language.

```json
{
  "id": "demo-es:item:000201",
  "pack": "demo-es",
  "type": "sentence",
  "text": "Tengo que trabajar.",
  "level": "a1",
  "topics": ["work"],
  "lexemes": ["demo-es:lexeme:tener"],
  "skills": ["demo-es:skill:tener-que-infinitive"],
  "examples": ["demo-es:item:000202"],
  "tokens": [
    { "id": "t1", "text": "Tengo", "lemma": "tener", "pos": "VERB" },
    { "id": "t2", "text": "que", "lemma": "que", "pos": "SCONJ" },
    { "id": "t3", "text": "trabajar", "lemma": "trabajar", "pos": "VERB" }
  ],
  "annotations": [
    {
      "tokens": ["t1", "t2", "t3"],
      "type": "construction",
      "skill": "demo-es:skill:tener-que-infinitive"
    }
  ],
  "audio": [{ "locale": "es-ES", "src": "audio/es-ES/000201.mp3" }]
}
```

Notes:

- **No character offsets.** Token order carries sequence; annotations reference
  local token IDs. Offsets are derived at render time.
- POS tags follow Universal Dependencies.
- `audio.src` is relative to the pack root, one entry per pronunciation locale.

### Lexeme, verb form, skill

```json
{ "id": "demo-es:lexeme:tener", "lemma": "tener", "pos": "VERB", "level": "a1" }
```

```json
{
  "id": "demo-es:form:tener-pres-1s",
  "lexeme": "demo-es:lexeme:tener",
  "form": "tengo",
  "morph": { "person": 1, "number": "singular", "tense": "present", "mood": "indicative" }
}
```

```json
{
  "id": "demo-es:skill:tener-que-infinitive",
  "kind": "pattern",
  "label": "tener que + infinitivo",
  "level": "a1"
}
```

### Passage

Several sentences read as one connected text: a paragraph or a dialogue
(spec §16). A passage is a **container**, not a longer item — it references
sentences that stay independently practisable.

```json
{
  "id": "core-es:passage:700009",
  "pack": "core-es",
  "kind": "dialogue",
  "title": "En la cafetería",
  "level": "a1",
  "topics": ["restaurant"],
  "items": ["core-es:item:000556", "core-es:item:000557", "core-es:item:000558"],
  "speakers": ["Camarero", "Cliente", "Camarero"]
}
```

`kind` is `text` or `dialogue`; a dialogue names a speaker per line, index-aligned
with `items`. A passage carries no text of its own, because the text _is_ its
sentences, in order. It inherits the union of their `regions`, so a paragraph
using `jugo` is marked `es-419` like the sentence that uses it.

Two reasons it references items rather than holding text:

- exercises are derived per item (Rule 2), so a passage's sentences stay usable
  as cloze, flashcards and speaking practice
- mastery weights a word by how many _different sentences_ it appears in, so a
  paragraph earns its recycling honestly instead of counting as one long sentence

Authoring is the other way round: membership lives on the sentence rows, in the
`passage` column, so a paragraph stays together in the file a human is reading
and the build derives the container. Reading order is the order of the rows. Two
sentences is the minimum — one is an item with extra steps — and no two items may
carry the same text, which the build enforces: duplicated text would split a
learner's progress across two ids.

### Translation

Separate records, never fields on the Spanish content — a sentence stays usable
in any reference language, or none.

```json
{ "ref": "demo-es:item:000201", "lang": "en", "text": "I have to work.", "type": "natural" }
```

`type` is `natural` (default), `literal` or `alternative`. `ref` may point at an
item, sense, skill or lexeme.

Lexeme translations are what a learner sees when they tap a word inside a
phrase, so give every content word one:

```json
{ "ref": "demo-es:lexeme:tener", "lang": "en", "text": "to have" }
```

Word inspection also uses `tokens[].lexeme`, `tokens[].morph` and the
annotations covering the token, so the richer those are, the more the app can
say about a word without any extra data being authored per phrase.

### Provenance

Any record may carry provenance. Imported, community and AI-generated material
must remain distinguishable from reviewed editorial content.

```json
{ "source": "editorial", "review": "reviewed", "revision": 2, "license": "CC0-1.0" }
```

`source`: `editorial` · `community` · `imported` · `generated`

`review`: `unreviewed` · `reviewed` · `deprecated`

A pack carries provenance in its manifest, and an item may carry its own. An item
without one inherits the pack's, so review can be recorded item by item: `core-es`
ships `generated`/`unreviewed` at the pack level, and each item a human has signed
off in [`content/es/reviewed.tsv`](../content/es/reviewed.tsv) carries
`{ "source": "generated", "review": "reviewed" }` of its own. `generated` stays
accurate after review — `source` says where the wording came from, `review` says
whether a person has checked it.

## Manifest

```json
{
  "id": "demo-es",
  "name": "Spanish Basics (demo)",
  "targetLanguage": "es",
  "version": "0.1.0",
  "license": "CC0-1.0",
  "levels": ["a1"],
  "pronunciationLocales": ["es-ES", "es-MX"],
  "topics": [{ "id": "numbers", "label": "Numbers", "group": "Foundations" }],
  "files": [{ "kind": "items", "path": "es-a1-core-phrases.jsonl", "level": "a1", "bytes": 110093 }]
}
```

`kind` is one of `items`, `lexemes`, `senses`, `forms`, `skills`,
`translations`, `passages`, `audio`. A pack may list several files of the same
kind.

`level` marks a shard, so a loader can decline to fetch what the course cannot
show without opening the file to find out. `bytes` is what the file weighs, so a
download can be priced before it is started — Settings → Packs adds these up to
say `Keep offline (3.3 MB)`.

There is deliberately no `referenceLanguages`. A pack does not say which
languages explain it, because anything it says is something that has to be
edited — and the pack re-versioned — to add one.

## Translation unit

One pack's meanings in one language, as its own manifest at
`translations/<pack>/<language>/<version>/translations.json`:

```json
{
  "pack": "core-es",
  "referenceLanguage": "en",
  "version": "0.16.0",
  "updated": "2026-08-30",
  "name": "Spanish Core A1–B1 · English meanings",
  "license": "CC0-1.0",
  "files": [
    { "kind": "translations", "path": "es-a1-b1-core-translations-en.jsonl", "bytes": 479461 }
  ]
}
```

Not a `PackManifest` with fields left out: it has no target language, no level
ladder, no topics and nothing to shard by, and each of those absences is a fact
about what a translation unit _is_. It carries no levels for the same reason it
never could — a translation references an item, a lexeme or a skill, so its level
is a join rather than a field — which makes a unit whole or absent, never partial.

The version is authored in `content/<tag>/translations.tsv`, one row per
language, exactly the way the pack's own is authored in `pack.tsv`. Both carry a
record count beside the version so a build that changes the content and not the
file reports the disagreement; `tests/data/pack-version.test.ts` is where that
bites. A row is required rather than defaulted, because the version is in the
path: a unit shipped at `0.0.0` would be overwritten at the same URL by the next
build, which is the hazard the versioned path exists to remove.

`catalog.json` lists the units beside the packs. It is the only unversioned file
in the tree, which is exactly what lets it name a unit published _after_ the pack
it explains.

`topics` is the pack's thematic categories, built from `content/es/topics.tsv`.
It is declared here rather than inferred from the items because scanning items
yields slugs and nothing else — no label, no order, and no way to say a category
exists but is still empty. Array order is the order a picker shows, and a group's
position is where its first topic appears, so `topics.tsv` is sorted by hand and
never alphabetically. A slug is referenced by content and by links
(`?topic=clock`), so renaming one is a breaking change; change the label instead.

## Validation

```bash
npm run validate:data
```

Checks every record against its schema, then the pack as a whole: duplicate
IDs, items declaring the wrong pack, dangling lexeme/skill/example references,
annotations naming tokens that do not exist, translations pointing at unknown
entities, and passages referencing sentences that are missing or listing a
speaker count that does not match their lines.

Errors fail the build; warnings (usually dangling references to content that
lives in another pack) are reported and the data still loads.

Unknown extra fields are preserved rather than rejected: a dataset may carry
richer annotation than the current app understands.
