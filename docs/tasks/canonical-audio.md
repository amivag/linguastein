# Task: the canonical audio pipeline

> **Status update (2026-08-23):** both code halves are done. The generator was
> already written; the dataset build now reads `content/es/audio-ledger.tsv`
> and emits one `audio` file per locale plus the voices from
> `content/es/voices.tsv`, covered by `tests/data/canonical-audio.test.ts`.
> Only `approved` rows ship. What remains is the two things no code can decide:
> the voice licence question in §4.1, and the listening that approval means.

**Status:** ready to start — the runtime seams exist; nothing has been generated
**Written:** 2026-08-17
**Revised:** 2026-08-17 — audio became a **pack file kind that references items**
rather than a field on them, so voices are addable without regenerating content
and a pack stays importable/exportable. Storage size is explicitly not a
constraint; §4 and §5 were rewritten around that, and §9 is new.
**Revised:** 2026-08-17 — `scripts/generate-audio.ts` and its tests exist, so
§6 describes something running rather than something planned.
**Revised:** 2026-08-17 — the `audio` record kind, its schema, the repository
index and the integrity checks have landed. Choosing a TTS engine is **deferred
pending proper research**; §4.0 records what the first pass ruled out and why.
Nothing else in the task depends on that choice.
**For:** a fresh agent session, no prior context assumed
**Scope:** a new pack file kind, a batch generator, a voice ledger, a build step
and a review pass. The audio service, playback controls and service-worker
caching are already in place and should not need redesigning.

---

## 1. Orientation

Read these first, in order:

1. [`AGENTS.md`](../../AGENTS.md) — commands, architecture rules, conventions
2. [`docs/spec/spanish_learning_app_spec_v0.1.md`](../spec/spanish_learning_app_spec_v0.1.md)
   §6 (audio and pronunciation) and §25 (public/free service constraints)
3. [`docs/dataset-format.md`](../dataset-format.md) — record shapes and the pack layout
4. [`src/audio/types.ts`](../../src/audio/types.ts) and
   [`src/audio/audio-service.ts`](../../src/audio/audio-service.ts) — the seam
   this task feeds
5. [`docs/tasks/dataset-expansion.md`](dataset-expansion.md) §4 — why an item id
   survives a typo fix, which is what §4.2 below has to work around

Then run `npm run check`. It must pass before you start.

**The pipeline in one line:** generate in batches → review the voice → approve →
store as records that reference items → replay from the pack, with device speech
as the fallback where no clip exists and silence where the device cannot speak
Spanish either.

---

## 2. What already exists — do not rebuild it

The runtime half is done, and the extension point for the data half is clean.

| Piece                      | Where                                                                      | State                                                                       |
| -------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Canonical-audio-first play | [`audio-service.ts:90`](../../src/audio/audio-service.ts)                  | `repository.audioOf(item, locale)` is consulted before the TTS seam         |
| Locale resolution          | [`repository.ts:226`](../../src/domain/content/repository.ts)              | falls back across pronunciation locales, so one locale is a valid start     |
| Record shape               | [`schemas.ts:91`](../../src/data/validation/schemas.ts)                    | `audioRefSchema`: `locale`, `src`, `durationMs?`, `voice?`, `provenance?`   |
| Pack file kinds            | [`model.ts:199`](../../src/domain/content/model.ts)                        | `PACK_FILE_KINDS` + `RECORD_SCHEMAS` — adding a kind is a three-line change |
| Generic loading            | [`pack.ts:95`](../../src/data/loaders/pack.ts)                             | validates and collects by `file.kind`; a new kind needs no loader change    |
| Asset base URL             | [`services.ts:54`](../../src/app/services.ts)                              | pack-relative `src` resolves against the dataset base URL                   |
| On-demand caching          | [`vite.config.ts:37`](../../vite.config.ts)                                | audio requests are `CacheFirst`, deliberately **not** precached             |
| Playback controls          | [`AudioControls.tsx`](../../src/features/practice/AudioControls.tsx)       | normal, slow, replay, loop ×3, auto-play                                    |
| Voice preference           | [`types.ts:44`](../../src/audio/types.ts)                                  | `PlayOptions.voice` already exists, currently only for device voices        |
| Dialogue speakers          | [`schemas.ts:197`](../../src/data/validation/schemas.ts)                   | `passageSchema.speakers` — the hook for voicing a dialogue with two voices  |
| Honest silence             | [`SettingsScreen.tsx:113`](../../src/features/settings/SettingsScreen.tsx) | explains itself when no voice exists, and promises dataset audio wins       |

`senses` is already a declared kind with zero shipped records, so a pack that
declares a kind it does not yet ship is an established pattern rather than a new
one.

The generator half now exists too — [`scripts/generate-audio.ts`](../../scripts/generate-audio.ts)
(`npm run generate:audio`), covered by
[`tests/data/audio-generation.test.ts`](../../tests/data/audio-generation.test.ts):
provider seam, the twenty-item sample of §4.1, hash-keyed naming, dedupe on text,
the ledger, resumable batches, ffmpeg post-processing, and `--compare` for blind
listening. It ships a `stub` provider that writes a padded tone, so all of that
is testable with no TTS installed.

The `audio` record kind has landed too: schema, generic loading, a repository
index, voice-aware resolution and integrity checks, with tests in
[`tests/domain/repository.test.ts`](../../tests/domain/repository.test.ts).

What is still missing: **an engine and a voice** (§4.0), the build step that turns
ledger rows into records, and the review pass.

---

## 3. Size, measured — then set aside

Reproduce from the shipped pack rather than trusting the table:

```bash
npm run build:data
```

| Measure                                     | Now                                                 |
| ------------------------------------------- | --------------------------------------------------- |
| Items that would get a clip                 | **1,028** (592 sentences, 436 word cards)           |
| Distinct spoken strings across those items  | 1,027 — `frío` is both a noun and an adjective card |
| Characters of speech, one voice             | 18,222 (15,620 + 2,602)                             |
| Estimated duration, one voice               | ~27 minutes                                         |
| Estimated size, one voice, 48 kbps mono     | ~10 MB                                              |
| Verb forms (a later batch)                  | 2,808 forms, 20,354 chars, ~34 minutes              |
| Pronunciation locales declared in pack.json | 2 (`es-ES`, `es-MX`)                                |
| All JSONL in the pack today                 | 1.4 MB                                              |
| Items with audio                            | **0**                                               |

Duration assumes ~14 characters per second of Spanish narration plus ~0.3 s of
padding per clip; redo it against real output once a sample exists.

**Bytes are not a constraint on this design.** Audio takes space; that is what
audio does. Multiply the table by voices and locales without concern — four
voices across two locales is on the order of 80 MB, which is unremarkable for
media and is fetched on demand rather than precached. Two things replace size as
the real budget:

- **Review attention.** 1,028 clips is roughly 1½–2 hours of listening _per
  voice_. This does not scale to voices × locales × verb forms, which is why §8
  reviews the _voice_ and spot-checks the batch rather than auditioning every
  clip.
- **Generation throughput.** A free tier's quota or a local model's speed decides
  how long a batch takes, which is why §6 is built around resumable batches.

Generation cost is likewise a rounding error — cents to a couple of dollars for
everything at commercial rates — and the app pays nothing today, since device
speech via `createWebSpeechTtsProvider` is free. Neither number should shape a
decision. Quality and licence should.

---

## 4. Three decisions to make before generating a batch

Settle these on a twenty-item sample. Getting them wrong means regenerating.

### 4.0 Status: open, deliberately

**No engine has been chosen and none is installed.** A first pass tried and
backed out; this section records what it established so the eventual research
starts from evidence rather than from scratch.

| Candidate                      | Licence              | Maintained            | Spanish                                            |
| ------------------------------ | -------------------- | --------------------- | -------------------------------------------------- |
| piper (`OHF-Voice/piper1-gpl`) | **GPL-3.0-or-later** | yes, v1.7.0           | es-ES + es-MX, but **voice licences unstated**     |
| `kokoro-js` (npm)              | Apache-2.0           | last publish May 2025 | **English only**                                   |
| `sherpa-onnx-node`             | Apache-2.0           | very active           | its Kokoro build is **English + Chinese only**     |
| Kokoro-82M (Python)            | Apache-2.0           | v1.0 Jan 2025         | 3 voices, **all Latin American — no Spain accent** |

Findings worth keeping:

- **`rhasspy/piper` (MIT) was archived in October 2025.** Development moved to
  `OHF-Voice/piper1-gpl`, which is GPL-3.0-or-later. The licence on the code is
  the lesser problem: its Spanish voice configs state **no licence at all**,
  which is precisely the §4.1 hazard.
- **The accent question constrains the engine.** The cleanly-licensed options are
  Latin American. Choosing that is defensible but not free: the pack declares
  `es-ES` first, ships Spain-side vocabulary (`patata`, `móvil`, `ordenador`) and
  now generates **vosotros** commands, which a Latin American voice does not use.
- **Python 3.14 blocks most of the ecosystem here.** Kokoro pulls
  `spacy`→`thinc`, which has no 3.14 wheels, so any Python route needs a
  project-local 3.12.
- **Spanish needs no system espeak-ng.** `espeakng-loader` bundles the library
  and arrives with `misaki[en]`, so phonemisation stays inside a venv.
- **This folder breaks atomic renames.** `uv` fails with "access is denied" when
  its cache or its managed interpreters live inside the repo — something here (a
  dev-server watcher, or the virus scanner) holds handles on new files. A venv in
  the project is fine; caches have to sit outside it.

None of this blocks the rest of the task: the record kind, the generator and the
review flow are all engine-agnostic, and the engine is reached through a command
template, so adopting one later is an environment variable rather than a rewrite.

### 4.1 Which voice — and may you ship its output?

The one that can invalidate a finished batch.
[`pack.json`](../../public/packs/core-es/pack.json) declares
`"license": "CC0-1.0"`. Most hosted TTS terms permit commercial _use_ of the
output while forbidding redistribution as a standalone asset library — which is
exactly what shipping `audio/**` inside an exportable pack is. **Free tiers are
usually the most restrictive**, not the least: free often means non-commercial,
no-redistribution, or attribution-bound.

So the intersection of what you want — free, batchable, and redistributable
inside a CC0 pack that learners can export — points at a **self-hosted local
model with a permissively licensed voice**. That also removes quotas, rate
limits, network failures and per-character cost from the generator, and matches
spec §25 (core learning must not depend on paid APIs).

Treat a hosted service as an optional second provider for comparison, not the
default. If one is used for a shipped voice, that voice carries its own licence:
per-clip `provenance.license` and per-voice licence in the manifest (§5.3) exist
for exactly this, and the pack then stops being uniformly CC0 — say so in the
manifest and in `docs/dataset-format.md`.

Do not decide from a spec sheet. `--sample` picks the twenty items for you and
prints what each one is listening for; generate them on each candidate, then
`--compare` and listen without knowing which voice is which. Let licence break a
tie. Record the winner, the settings and the reasoning in this file.

Two things the first pass over this established:

- **The `sapi` provider cannot serve Spanish here.** This machine has en-US and
  el-GR voices and nothing else, so the generator refuses rather than reading
  Spanish with an English voice — the same choice the app makes at runtime. That
  is the problem this whole task exists to fix, visible on the development
  machine itself.
- **The sample cannot test exclamation prosody**, because not one of the 1,028
  items contains `¡`. The generator reports the gap rather than quietly dropping
  the criterion. It is a content gap, noted in the dataset task.

### 4.2 Key clips by a hash of the spoken text, not by item id

The hazard is specific to this repository. §4 of
[`dataset-expansion.md`](dataset-expansion.md) guarantees a row **keeps its id
through a typo fix** — that is the entire point of the id ledger. So a clip named
for the item id keeps serving the old pronunciation after someone corrects the
text, and nothing notices.

Three consequences, all load-bearing:

- **The file name contains a short hash of the exact spoken text**, so a
  corrected row produces a _different_ file:
  `audio/es-ES/lucia/000201-9f3ab27c.m4a`. Content-addressed names also make the
  `CacheFirst` rule in [`vite.config.ts:37`](../../vite.config.ts) safe — under a
  stable name that cache would serve a stale clip for its full 90-day life.
- **The build compares hashes and reports drift**: _N current, M stale, K
  missing_, per voice. Once the pipeline is real, stale clips fail the build, in
  the same spirit as the existing pack drift check.
- **The generator deduplicates on `(textHash, locale, voice)`, not on item.**
  `frío` ships as both a noun and an adjective card (§3): one file, two audio
  records. Generating per item would synthesise it twice and, with a
  non-deterministic voice, produce two subtly different clips for identical text.

### 4.3 Format

Since size is not a constraint, choose for compatibility and quality: **AAC in
`.m4a`, mono, 48–64 kbps** is universally decodable by `<audio>` and leaves no
audible artefacts on speech. Opus is smaller at equal quality but carries a
Safari version floor; there is no longer a reason to take that risk.

**Pin the output sample rate.** `loudnorm` resamples to 192 kHz internally and
will leave the output there: the first run produced 96 kHz clips from a 16 kHz
source — larger files carrying no more speech. The generator forces 24 kHz mono,
which also stops two voices with different native rates landing in one pack at
different qualities.

Whatever the codec, **post-process every clip**: trim leading and trailing
silence to ~50 ms and loudness-normalise (around −16 LUFS). This matters more to
perceived quality than the choice of voice — listen-and-repeat with 300 ms of
dead air reads as a broken button, and clips that vary in level make the learner
ride the volume control. Normalisation matters _more_ once several voices are in
play, because level differences between voices are what make a mixed dialogue
sound amateurish. Needs `ffmpeg`: a dependency of the generator only, never of
the app or CI.

---

## 5. Pack organisation

This is the part the earlier draft got wrong, and it is the part that decides
whether voices can be added later and whether packs can be imported and
exported.

### 5.1 Audio is a record that references an item

`audioRefSchema` currently sits **on** the item, so a new voice would mean
rewriting `es-a1-a2-core-sentences.jsonl` — 582 KB of content churn to add a
speaker, and a merge conflict for anyone editing content at the same time. Worse,
one item can only hold one array, so variants and content are coupled forever.

Do it the way passages already work. `AGENTS.md`: a passage "references items
rather than holding text, so each sentence stays independently practisable."
Audio takes the same shape — a separate record kind, one record per clip:

```json
{
  "id": "core-es:audio:000201-es-ES-lucia",
  "item": "core-es:item:000201",
  "locale": "es-ES",
  "voice": "lucia",
  "src": "audio/es-ES/lucia/000201-9f3ab27c.m4a",
  "textHash": "9f3ab27c",
  "durationMs": 2180,
  "provenance": { "source": "generated", "license": "CC0-1.0", "review": "reviewed" }
}
```

Adding `'audio'` to `PACK_FILE_KINDS` and a schema to `RECORD_SCHEMAS` is a
three-line change; [`pack.ts:95`](../../src/data/loaders/pack.ts) collects by
kind and needs no edit. Add the array to `ContentPack`, index it by item in the
repository, and extend `audioOf` to prefer a requested voice while keeping its
present behaviour when none is asked for. Add a variants accessor for the UI.

Keep `item.audio[]` in the schema. A tiny hand-authored pack or a test fixture
embedding two clips inline is legitimate; the repository should merge both
sources. What the _generated_ pack ships is the separate file.

Fill `durationMs`. The hands-free sequence in spec §6.1 — audio, pause, learner
repeats, audio again — needs clip length to time the pause, and reading it off
the file at playback means waiting on metadata.

### 5.2 On-disk layout

```text
public/packs/core-es/
  pack.json
  es-a1-a2-core-sentences.jsonl        content, unchanged when a voice is added
  es-a1-a2-core-audio-es-ES.jsonl      one file per locale
  es-a1-a2-core-audio-es-MX.jsonl
  audio/
    es-ES/lucia/000201-9f3ab27c.m4a    voice in the path, hash in the name
    es-ES/mateo/000201-9f3ab27c.m4a
    es-MX/…
```

One JSONL per locale keeps files reviewable and lets a locale be dropped from a
build by removing one manifest entry. The voice lives in the directory rather
than the filename so a whole voice can be deleted, archived or shipped alone with
a directory move.

### 5.3 Voices are declared in the manifest

A voice is a thing with provenance, so the manifest describes it:

```json
"voices": [
  {
    "id": "lucia",
    "locale": "es-ES",
    "label": "Lucía",
    "provider": "<model or service>",
    "license": "…",
    "review": "reviewed"
  }
]
```

This is what makes a voice self-describing for import, export and the settings
picker, and it is where §4.1's licence answer is recorded when it differs from
the pack's.

### 5.4 Import and export

Not in scope to build, but two cheap constraints now keep it possible later, and
both are expensive to retrofit:

- **Every path in a pack stays relative to the pack root, always.** No absolute
  URLs, no host names, no build-time base baked into a record. A pack directory
  is then a self-contained unit that zips, ships and imports as-is.
- **Route `src` resolution through one function instead of inlining
  `new URL(audio.src, assetBaseUrl)`** at
  [`audio-service.ts:93`](../../src/audio/audio-service.ts). An imported pack's
  clips will live in IndexedDB as blobs, not under a URL base, so playback needs
  one resolver that can return either an HTTP URL or a blob URL. One indirection
  now; a rewrite of the playback path later if skipped.

Note also that `catalog.json` lists shipped packs, so an imported pack needs a
second source of packs at load time. Leave that to the import task — just do not
assume in new code that the catalog is the only way a pack arrives.

---

## 6. Batch generation

`scripts/generate-audio.ts`, built for interrupted, quota-limited, possibly slow
runs, because that is what free services and local models both give you.

- **Provider behind a small local interface**, with at least two implementations
  expected: a local model and one hosted service. Keep any vendor name in a
  single file. This is a script, so it does not go through
  `src/app/services.ts` — but architecture rule 5 still applies to anything under
  `src/`.
- **Resumable and idempotent.** Diff the pack against the ledger, generate only
  what is missing or stale, append to the ledger after **each** clip so a
  `Ctrl-C` or a quota rejection loses at most one. A second run with no content
  change generates nothing and writes nothing.
- **`--dry-run`** prints clip count, character total and estimated duration
  before anything is spent or generated.
- **`--limit N`, `--voice`, `--locale`, `--items <file|id…>`** so a batch can be
  sized to a daily quota, an overnight local run, or one file's worth of new
  sentences.
- **Deduplicates on `(textHash, locale, voice)`** — see §4.2.
- **Never invents the text it speaks:** the item's `text`, verbatim. If a clip
  genuinely needs different text from what is displayed, that is an authored
  column in the TSV, not a heuristic in the generator.
- **Retries with backoff and records failures** in the ledger as `failed` with a
  reason, so a rerun retries only those rather than starting over.

`content/es/audio-ledger.tsv` records every clip:

```text
item	locale	voice	textHash	file	durationMs	generated	review
000201	es-ES	lucia	9f3ab27c	audio/es-ES/lucia/000201-9f3ab27c.m4a	2180	2026-08-17	approved
```

**Unlike [`id-ledger.tsv`](../../content/es/id-ledger.tsv), this one is not purely
generated.** The generator fills every column except `review`; a human owns that
one. The file says so in its own header, because otherwise a future session
regenerates it and throws the review work away.

Three things that follow from a human owning a file a script also appends to:

- **A sample must never write to the shipping ledger.** `--sample` or any
  explicit `--out` keeps its ledger beside its own output; only a default run
  touches `content/es/audio-ledger.tsv`. Without that rule the first test run
  wrote rows for a temp directory into the real ledger.
- **Append defensively.** Plenty of editors strip a trailing newline on save, and
  the next appended row would then be glued onto the reviewer's last line.
- **Prune orphans deliberately.** Fixing a typo gives the text a new hash and so a
  new file; the old clip stays on disk, referenced by nothing. That is the safe
  direction to fail, but it needs a `--prune` that deletes clips no ledger row
  points at — never an automatic delete, since an unreferenced file is also what
  a half-finished batch looks like.

The build step reads the **ledger**, not the audio files, and emits the records
of §5.1. It must succeed with no clips on disk — that keeps CI honest without
downloading media, and makes "every referenced file exists" a separate check to
run at release.

---

## 7. Playing one of several variants

Variants are the point, so decide how one is chosen.

- **Learner preference wins** when set: `PlayOptions.voice` already exists and
  the settings picker already lists voices — it just needs to list pack voices
  alongside device ones, which the manifest's `voices` array makes possible.
- **Otherwise vary deliberately.** Hearing the same sentence in different voices
  is pedagogically valuable, not a bug: it is what stops a learner from
  recognising a waveform instead of a word. Rotating variants across reviews is a
  feature worth having.
- **Any variation goes through the injected `Rng`** (architecture rule 7,
  [`src/utils/random.ts`](../../src/utils/random.ts)). A seeded session must
  replay with the same voices, so `Math.random()` in the audio path would break
  reproducibility — the one way this feature can quietly violate an architecture
  rule.
- **Dialogues can voice their speakers separately.** `passageSchema.speakers`
  already exists; mapping speaker → voice makes a two-person dialogue actually
  sound like two people. This is the strongest reason to treat voice as a
  first-class dimension rather than a per-clip label, and it is a natural
  follow-on once two voices exist.

---

## 8. Review that scales

Spec §6 wants generate → review → approve. Full audition does not survive
multiplication (§3: ~2 hours per voice), so review at two levels:

- **Per voice, thoroughly.** A ~30-clip sample covering questions,
  exclamations, long sentences, single words and regional vocabulary. If the
  voice and post-processing are right on those, they are right generally — the
  failures that remain are per-clip accidents, not systematic. The manifest
  records the voice as `reviewed`.
- **Per clip, by exception.** Spot-check a random sample, and flag individual
  clips as `redo` in the ledger; those regenerate on the next run. A learner-facing
  "this sounds wrong" report is the natural extension, and fits the community
  review flow already in the roadmap's Later section.

A clip inherits its voice's review state unless it carries its own. Cheapest
tool: a local page that walks the ledger, plays each clip beside its text, and
writes `approved` or `redo` back. That satisfies the spec's chain without
building an editor.

---

## 9. One caching change

`maxEntries: 500` in [`vite.config.ts:43`](../../vite.config.ts) is below the
1,028 clip count, and variants multiply it further, so a learner working through
the pack evicts clips for items they have already met and loses offline replay of
exactly what they studied most. Raise it past the expected clip count, or precache
a chosen voice behind an explicit "available offline" action — which is roadmap
item 7, so the two are worth doing together. Note that adding voices raises this
ceiling every time; the limit should be derived from what a pack actually ships
rather than hard-coded again.

---

## 10. Rules and constraints

- **Never pre-generate a slow variant.** `element.playbackRate` at
  [`audio-service.ts:49`](../../src/audio/audio-service.ts) implements the slow
  control and browsers preserve pitch by default. A `0.7×` file is pure waste —
  and this is the one place where "we do not care about size" does not apply,
  because it doubles review surface for nothing.
- **Word cards are synthesised as their own clips.** Do not slice them out of
  sentence audio: isolated synthesis gives citation form, which is what a
  vocabulary card wants, while a fragment lifted from a sentence is
  coarticulated, sounds wrong alone, and needs forced alignment to locate.
- **Passages generate nothing.** A passage is a container; it plays its
  sentences' clips in order. Never give a passage its own audio file, for the
  same reason it never holds its own copy of the text.
- **Provenance stays honest.** The pack is `source: generated, review:
unreviewed`. A voice is `unreviewed` until a human has listened to a sample, and
  a clip is not approved because the batch sounded fine in aggregate. Do not
  describe generated audio as reviewed in docs or commit messages.
- **No vendor above the seam** (architecture rule 5). Nothing in `src/` learns
  the name of a TTS provider or model.
- **The audio record describes audio, not presentation** (architecture rule 3).
  No exercise-shaped or UI-shaped fields.
- **Audio never becomes a requirement.** Every exercise stays completable with no
  clip, no device voice and no sound at all. `canPlay` models this and the a11y
  suite depends on it.
- **Do not commit media while the voice is still being chosen.** Content-addressed
  names mean a regenerated clip is a new file, so ten rounds of tuning leave ten
  copies in git history permanently. Gitignore the output during §4.1, then decide
  where the settled batch lives.
- **Validation stays clean.** `npm run validate:data` reports 0 errors and 0
  warnings.
- **`public/packs/**` is generated.** Never hand-edit a pack file, including a
  hand-added audio record.

---

## 11. Definition of done

- [ ] §4.1 decided: voice chosen from a blind comparison, licence recorded here
- [x] A sample of twenty items, chosen to expose how a Spanish voice fails, with
      the gaps in what it can test reported rather than hidden
- [x] A blind comparison page over every candidate voice (`--compare`)
- [ ] `'audio'` is a pack file kind with a schema, loaded generically, indexed by
      item in the repository
- [ ] `item.audio[]` still works for embedded packs; both sources merge
- [ ] Clips are content-addressed on the spoken text, with voice in the path
- [ ] Manifest declares `voices` with provider, licence and review state
- [ ] Every path in a pack is relative to the pack root
- [ ] `src` resolution goes through one resolver, ready for blob-backed packs
- [x] The ledger format exists, with its human-owned column documented in the file
- [x] `generate-audio.ts` is resumable, deduplicating, quota-limitable, `--dry-run`
- [x] Every clip is silence-trimmed, loudness-normalised and at a pinned rate
- [ ] `--prune` removes clips no ledger row points at
- [ ] `build:data` emits audio records, fills `durationMs`, reports current /
      stale / missing per voice
- [ ] Stale clips fail the build
- [ ] All 592 sentences and 436 word cards have an approved clip in one voice
- [ ] A second voice can be added without touching any content JSONL — proven by
      doing it, even with a handful of clips
- [ ] Variant selection uses the injected `Rng`, and a seeded session replays with
      the same voices
- [ ] The audio cache holds a full pack without evicting mid-use
- [ ] Playback works offline after first play, verified in a built PWA
- [ ] `npm run check` passes; `npm run build:data` produces no diff on a second run
- [ ] `docs/dataset-format.md` documents the audio record, the layout and the
      manifest's `voices`; `docs/roadmap.md` matches reality

## 12. Verification

```bash
npm run build:data && npm run check && npm run build
```

Then read the audio lines in the coverage report, and check five things by hand
that no test will catch:

- **Listen to a random twenty.** Clip-level defects — a clipped final syllable,
  wrong stress, a question read flat — pass every automated check there is.
- **Fix a typo in a sentence that has a clip, rebuild, and confirm the build
  reports it stale.** This is the failure §4.2 exists to prevent and it is
  invisible unless tested deliberately.
- **Add a second voice for ten items and confirm no content file changes.** That
  is the whole claim of §5.1; if a sentences JSONL shows in the diff, the design
  has not landed.
- **Run a session under a fixed seed twice** and confirm the same variants play.
- **Play an item, go offline, play it again.** Then confirm an item with no clip
  falls back to device speech, and one with neither says so rather than failing
  silently.
