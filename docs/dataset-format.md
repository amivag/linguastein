# Dataset format

Canonical learning data is **JSON + JSONL**:

- `.json` for small hierarchical documents (catalog, pack manifest)
- `.jsonl` for collections of independent records (items, lexemes, forms,
  skills, translations)

CSV may be used for import/export and spreadsheet editing; canonical data never
depends on it.

Lines beginning with `#` are treated as comments, and blank lines are ignored.

## Layout

```text
public/demo-data/
├── catalog.json                     which packs ship with this build
└── demo-es/
    ├── pack.json                    manifest
    ├── es-a1-core-skills.jsonl
    ├── es-a1-core-lexemes.jsonl
    ├── es-a1-core-verb-forms.jsonl
    ├── es-a1-core-vocabulary.jsonl
    ├── es-a1-core-phrases.jsonl
    └── es-a1-core-translations-en.jsonl
```

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
