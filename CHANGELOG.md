# Changelog

Notable changes to Linguastein, newest first. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are
[semver](https://semver.org/).

The version in `package.json` is the single source of truth: the build injects it,
Settings displays it as `Linguastein <version> (<commit>)`, and that is the string a bug
report should quote. Content packs version independently — `core-es` carries its
own version in `pack.json`, shown next to the app's.

This file records changes to the **app**. The full feature inventory and what is
planned next live in [docs/roadmap.md](docs/roadmap.md); dataset growth is visible
in the pack's own counts.

## Unreleased

`0.1.0-alpha.1` — an alpha, untagged. Everything below is what a first release
would contain. Breaking changes are expected between alphas, including to stored
learner state, and are not called out individually until 0.1.0 is tagged.

### Added

- **Courses: a language and a level, in the URL.** Every screen now lives under
  `/<language>/<level>` — `/es/a1/browse`, `/es/all/read/700001` — and `/` is a
  redirect into the course the learner left. A level is a _ceiling_, not a
  chapter: `a2` includes A1 material, because practising it is review rather than
  regression. The counts, the browse results, the reading list and what a session
  plans all narrow to the current course, and switching level keeps you on the
  screen you were on. Only Spanish A1–A2 ships, but the courses on offer are
  derived from the packs actually loaded, so a second language pack appears in
  the picker — and in the URL — with no code change; a French fixture pack in the
  test suite is what keeps that honest. Paths written before courses existed
  redirect into one and keep their query string.
- **Content preferences: what to practise, and what to lead with.** A standing
  choice on the practice screen — any number of categories, plus one of balanced,
  shaky items, reviews or new material. A focus is a bias and never a filter: it
  reorders the buckets the planner already sorts into, so "the ones I keep getting
  wrong" cannot hand back an empty session on the day nothing is shaky, and
  `focus=new` is the one case that lifts the cap on unseen items. The choice
  persists, so Quick practice respects it without being re-picked every time, and
  it is written into the session link, so a session stays fully described by its
  URL.
- **Phrases can be asked about, not only words.** `tener que` means "to have to"
  while `tener` alone means "to have", and the dataset has always recorded that
  as a multi-token annotation — but nothing could ask about a span. A selection
  now grows a word at a time from controls in the sheet, which name the word they
  would add, and a phrase gets its pattern, a word-by-word breakdown, the
  sentence it sits in, and other phrases built the same way. Buttons rather than
  a drag: a drag across two words is imprecise on a phone, invisible to a
  keyboard and unnameable to a screen reader.
- **Meanings everywhere they were missing.** Browse results, the "sentences to
  revisit" list on Progress, and the example sentences under a practice card are
  all tappable now — Browse being the worst place in the app to have lacked it.
  A cloze question is the one machine-graded card that opens up _before_ it is
  answered: its answer is the missing word, which is drawn as the blank rather
  than as a button, so the words around the gap give nothing away. Multiple
  choice stays shut, because the meaning of the sentence is what it is asking.
  On a screen showing several phrases each word names its own line, so an agent
  and a screen reader can tell four controls called "About “Tengo”" apart.
- **An elapsed-time readout in a session,** with the total and the pace on the
  summary. No limit, no countdown and no penalty — a countdown would turn
  practice into a test. It can be switched off in Settings, it does not announce
  itself to a screen reader every second, and it reports for a study session too:
  that session is not scored, but the time it took is still a fact about it.
  Progress now shows how long each recent session ran, which the stored record
  had always known.

- Practice loop with six exercise kinds derived from content, never stored:
  listen & repeat, reveal, think & say, multiple choice, cloze choice, tap to
  build.
- FSRS scheduling, exercise composition that climbs recognition → cued recall →
  production, and derived word- and pattern-level mastery.
- Sessions fully described by their URL, so one can be resumed, shared or driven
  by an agent.
- Browse, reading view with passages, progress, and grouped settings.
- Browsing and practising by thematic category. Topics are a controlled
  vocabulary declared in `content/es/topics.tsv` and shipped in the pack
  manifest with a label and display group, so the build rejects an unregistered
  topic and the picker can show "Days of the week" rather than `days-of-week`.
  Numbers, telling the time, days of the week, months and colours became real
  categories in the process — mostly by classifying sentences that already
  existed.
- Generated `core-es` A1–A2 pack, built from TSV sources with stable item ids and
  editorial sign-off machinery. Marked `source: generated, review: unreviewed`.
- Offline-capable installable PWA: app shell and datasets precached, audio cached
  on first play, all learner state local to the device.
- In-app version, build commit and build date, shown in Settings → Data.
- An update prompt: when the service worker has fetched a new build, the app
  offers a reload instead of taking one. See
  [docs/architecture.md](docs/architecture.md#updates-and-caching).
- Dark and light themes on a token system, held to WCAG 2.2 AA by axe and
  contrast tests in CI.
- Optional speech-input pronunciation check on speaking exercises.
- Deployment on GitHub Pages, live at `https://amivag.github.io/linguastein/`. A
  push to `main` checks, builds and uploads `dist/` as a Pages artifact — which,
  unlike serving a branch, publishes only the build and never the repository tree.
  Served from a project page, so the app now carries a base path: one `BASE`
  constant reaching Vite, the router's basename, the manifest's `start_url`,
  `scope` and icons, and the dataset fetches. Includes an SPA fallback, and
  `robots.txt` and `<meta>` opt-outs for crawlers and model training. Rationale
  and the known rough edges in [docs/deploy.md](docs/deploy.md).
- Production sourcemaps are on again, the repository being public: they give a
  visitor nothing GitHub does not, and they are the difference between debugging a
  phone-only problem and guessing at one.

### Changed

- **A livelier palette and a display face for the things you read.** The app was
  clean and slightly austere: one flat background, one hue, and headings that
  were body text set larger. The page now has a light source — a fixed wash from
  a second background role down to the first — the three counts on the practice
  screen are three tinted cards rather than one panel of grey numbers, and there
  is a warm second accent for the places where colour is liveliness rather than
  meaning. Two new tinted roles replace a dozen hand-written
  `color-mix(accent 14%)` values that had drifted into four slightly different
  shades, and both are held to the same contrast bar as everything else — nine
  new assertions across both themes. Typography gained a display face resolved
  from what the device already has, so nothing can fail to load offline, plus
  tracking and leading tokens by role; phrases, headings and big numbers use it.
- **Preferences saved in quick succession no longer overwrite one another.**
  `write` reads the stored record, merges and puts it back, so two overlapping
  calls both read the same starting point and the second silently discarded the
  first. Nothing hit it while every preference was a lone switch; picking three
  practice categories in a row hit it every time. Changes are now applied locally
  at once — so the next tap computes from the value the last one set, and a
  control does not sit unmarked while the write lands — and the writes are chained
  so they cannot interleave inside the store.
- Browse's level filter is gone, replaced by the course's own level control.
  Level was a select among five, and a course whose level said one thing while a
  select said another is two sources of truth for the same question.

- Renamed from Lingo to **Linguastein**, including the IndexedDB database and the
  `linguastein.theme` key. Local practice history from a pre-rename build is
  orphaned rather than migrated — done now, while the only device affected is a
  development one.
- Relicensed from MIT to **AGPL-3.0-only** for the code and **CC BY-SA 4.0** for
  the datasets, copyright amivag. Free and open with attribution, but a modified
  version served to others must publish its source. Contribution sign-off is now
  required ([CONTRIBUTING.md](CONTRIBUTING.md)) so a future commercial licence
  stays possible.
- "Reset progress" now asks for confirmation before erasing learner history. It
  is irreversible and there is no server copy, so a single mis-tap should not be
  enough.
- Browse's filters are confined to a fixed area instead of growing with the
  pack. The thirty-five category tiles scroll inside a box of a set height, the
  topic `<select>` moved up beside the "Categories" heading as their compact
  half, and the four remaining selects sit on one row. The results used to start
  a screen and a half down; they now start above the fold, and adding a category
  no longer pushes them further.
- The voice moved into the header, on every screen. A chip names the voice that
  would actually speak — or says plainly that none is installed for the locale —
  and opens the full set of audio controls in place. Pronunciation is a running
  condition rather than a setup step: the accent you want changes with what you
  are reading, and "why is this silent?" is best answered where it is asked.
  Settings shows the same component, so there is one source of truth for what it
  changes, and the audio seam gained `voiceFor` so the UI can name the voice
  instead of promising an unspecified best match.
- Playback on the graded cards, which had none. A fresh Quick practice session is
  almost entirely multiple choice, so the preset opened on a silent card. Multiple
  choice can now be heard straight away — the Spanish is on the card and the
  choices are meanings, so hearing it reveals nothing — while a cloze and a
  tap-to-build stay silent until answered, where the audio would say the missing
  word or read the parts out in order. Tap-to-build also shows the sentence once
  checked, so there is finally something to hear and to open words from.
- A word card can be opened like a word inside a phrase. A vocabulary item
  carries a lexeme and no tokens — the card _is_ the word — so `cerveza` rendered
  as inert text and the gloss, part of speech, gender and example sentences the
  dataset already held for it were unreachable from the card. `inspectItem`
  derives the same entry from the item's own lexeme, so a word card and a word
  inside a phrase are explained by one code path rather than two that drift. On a
  graded card it stays shut until answered, where the meaning is the answer.
- A listen can be ended. Both microphones — dictation in Browse, the
  pronunciation check in practice — disabled themselves while listening and
  offered no way out, on the assumption that the recogniser always ends a listen
  itself. It does not: it ends one when it judges the speaker to have finished,
  and background noise can keep it from ever judging that. Each mic is now a
  toggle that stops what it started, a listen nobody ends is abandoned after
  twenty seconds, and leaving the screen releases the microphone. Stopping on
  purpose reads as a cancelled listen rather than "could not hear that".
- Starting a second listen no longer strands the first. The aborted recogniser
  reported its end after the new one was already listening and cleared the
  provider's handle on it, leaving a live microphone that nothing could close —
  the state a stop button alone would not have rescued.

### Known gaps

- The pack is machine-generated and **not reviewed curriculum**. No item has been
  signed off yet.
- PWA icons are SVG-only, which does not satisfy Chrome's install criteria — the
  app runs offline but will not offer to install. Tracked as roadmap item 7.
