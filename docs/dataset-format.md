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
content/es/            ← humans edit this (TSV, one row per lemma or sentence)
├── verbs.tsv              lemma, gloss, level, regular|irregular, topics
├── nouns.tsv              lemma, gloss, gender, plural, level, topics, regions, register
├── modifiers.tsv          adjectives, adverbs, function words, extra forms
└── sentences-*.tsv        spanish, english, level, topics, note, register, address, regions

        │  npm run build:data
        ▼

public/packs/          ← generated, shipped, never hand-edited
├── catalog.json
└── core-es/
    ├── pack.json
    ├── es-a1-a2-core-skills.jsonl
    ├── es-a1-a2-core-verbs.jsonl          lexemes
    ├── es-a1-a2-core-nouns.jsonl          lexemes
    ├── es-a1-a2-core-modifiers.jsonl      lexemes
    ├── es-a1-a2-core-verb-forms.jsonl     2,000 generated forms
    ├── es-a1-a2-core-vocabulary.jsonl     word cards
    ├── es-a1-a2-core-sentences.jsonl      tokenised, annotated sentences
    └── es-a1-a2-core-translations-en.jsonl
```

The build derives everything mechanical: conjugations (`src/languages/es`),
plurals and adjective agreement, stable ids, sentence tokenisation, token →
lexeme links, grammar-pattern annotations, and translation records for items,
lexemes and skills. It also reports coverage — which lemmas appear in no
sentence — and refuses to run when a verb is tagged `irregular` without an entry
in the irregularity table. CI re-runs it and fails on any diff.

Ambiguous surface forms are resolved by the preceding word (`el trabajo` is the
noun, `trabajo en una oficina` is the verb). Where that is not decisive, the
token is left unlinked: a missing lemma is better than a wrong one.

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
second-person singular verb means `tu`, a second-person plural means
`vosotros` (and marks the sentence `es-ES`). Third person is never inferred —
`está` is `usted` or `él`/`ella` depending on context — so those are declared
by hand.

Regions propagate. A word marked `es-419` marks every sentence that uses it,
and its word card, so a learner aiming at Spain is not taught `papa`. Content
with no region passes everywhere, which is the common case; `es-419` covers any
Latin American locale.

Where a language has two words for one thing, ship both sides of the pair:
`papa`/`patata`, `coche`/`carro`, `jugo`/`zumo`, `ordenador`/`computadora`,
`móvil`/`celular`, `billete`/`boleto`. Shipping one silently teaches a dialect
as if it were universal.

## Identity

```text
<namespace>:<kind>:<local>
```

Kinds: `item`, `lexeme`, `sense`, `form`, `skill`.

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

## Manifest

```json
{
  "id": "demo-es",
  "name": "Spanish Basics (demo)",
  "targetLanguage": "es",
  "version": "0.1.0",
  "license": "CC0-1.0",
  "levels": ["a1"],
  "referenceLanguages": ["en"],
  "pronunciationLocales": ["es-ES", "es-MX"],
  "files": [
    { "kind": "items", "path": "es-a1-core-phrases.jsonl" },
    { "kind": "translations", "path": "es-a1-core-translations-en.jsonl" }
  ]
}
```

`kind` is one of `items`, `lexemes`, `senses`, `verb-forms`, `skills`,
`translations`. A pack may list several files of the same kind.

## Validation

```bash
npm run validate:data
```

Checks every record against its schema, then the pack as a whole: duplicate
IDs, items declaring the wrong pack, dangling lexeme/skill/example references,
annotations naming tokens that do not exist, translations pointing at unknown
entities.

Errors fail the build; warnings (usually dangling references to content that
lives in another pack) are reported and the data still loads.

Unknown extra fields are preserved rather than rejected: a dataset may carry
richer annotation than the current app understands.
