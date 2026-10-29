# Learning and release conventions

Read for learning behavior or release work. Core architectural rules are in
[AGENTS.md](../AGENTS.md); this document owns the details below.

## Learning model

- Scheduling models memory through `src/engine/fsrs.ts`; the domain adapter
  preserves Spanish-owned progress fields. Default weights are not a per-user
  fit or a validated model of rhythm performance.
- `domain/sessions/composer.ts` chooses retrieval mode from evidence, climbing
  recognition → cued recall → production and falling back after lapses. Break
  runs of the same exercise kind. Do not restore a fixed preference order.
- `domain/progress/mastery.ts` derives word/pattern strength from item history
  and sentence diversity; mastery is not stored or a generic engine metric.
- Recognition is weaker evidence than production. `distractors()` ranks surface
  form before item type, level, theme and length. Keep ranking rather than hard
  filters that starve choices; a question should compete with questions.
- Every phrase remains inspectable during practice. Hide only the information
  being graded: multiple-choice uses `WordInfoSheet meanings={false}` and the
  shared `InspectOptions.meanings` seam; a cloze already hides its form and
  needs no extra withholding. Explain withheld meanings rather than looking
  like a missing dictionary entry.
- Study mode records no attempts, progress, session or score. Only practice
  affects scheduling. `maxNewItems` limits open-ended discovery, not a set the
  learner explicitly selected (such as a passage).

## Versions and content identity

`package.json` owns the application version. Build globals are read only through
`src/app/version.ts`. Releasing means bumping the version, moving `Unreleased`
in `CHANGELOG.md` beneath it, committing and tagging.

Packs are add-ons with independent identity and versions. Author version, update
date and cut item count in `content/es/pack.tsv`; authors and roles live in
`authors.tsv`. Credit generated material as generation, not human authorship.
Dates must be valid, non-future calendar dates; never generate them from a clock.
The build and count guards enforce reproducibility and require identity edits
when pack contents grow. Wording fixes need no count bump.

Translation sets version independently by `(pack, reference language)`, declared
in `translations.tsv` and catalog entries. Their paths are
`packs/translations/<pack>/<language>/<version>/`; `pack.json` does not list them.
Each set needs its authored date and record count; `translations` is a reserved
pack id. Read [content-authoring.md](content-authoring.md) and
[dataset-format.md](dataset-format.md) before changing those records.

JS/CSS are content-hashed. `index.html` and `sw.js` need no-store hosting headers;
updates are offered rather than force-reloading. Read
[architecture.md](architecture.md#updates-and-caching) before changing worker
registration, runtime caches or lazy chunks.

## Durable notes

Keep [current-state.md](current-state.md) as concise project memory: decisions,
open constraints and verified unresolved issues. Implementation and test results
belong in source, tests and change descriptions. Historical rationale can be
retrieved from Git history or a relevant task brief; do not duplicate it in the
agent entry point. New decisions replace superseded ones in their owning doc.
