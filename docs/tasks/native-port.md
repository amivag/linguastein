# Task: ship the app on Android and iOS

**Status:** briefed, not started. One spike (§3) has to run before the rest is
schedulable, and one non-technical decision (§2) blocks iOS entirely.
**Written:** 2026-08-24
**For:** a fresh agent session, no prior context assumed
**Scope:** the shell, the four seams a WebView does not satisfy, and the build.
No engine changes, no URL changes, no content changes. Every address the web app
answers must keep answering, because the web build stays the primary one.

Read [`AGENTS.md`](../../AGENTS.md) first — architecture rule 5 (_no vendor above
a seam_) and **This repository is also a skeleton**. Most of this task is
collecting on rule 5; the parts that hurt are the two places it was never
applied.

Claims marked _(verified)_ were checked against this tree on 2026-08-24. Claims
marked _(unverified)_ are the ones a spike exists to settle — do not build on
them.

---

## 1. The shape of the decision

**Use Capacitor. Do not use React Native or Expo.**

The app is already an offline-first PWA: Workbox precaches the shell and all
5.0 MB of packs, learner state is in IndexedDB, and there is no network call
beyond same-origin static assets _(verified)_. Capacitor wraps the existing
`dist/` in a native WebView, so the store build and the web build are the same
artifact plus four native providers.

React Native would keep `src/domain` — it is pure TypeScript with no React, no
DOM and no fetch, which is exactly the property that makes it portable — and
throw away everything in `src/features` and `src/components`: nine screens, the
seven-palette × four-contrast × three-intensity token system, the axe and
contrast suites that enforce it, and the CSS-module surface recipes. That is
months, to arrive at the same product.

The honest cost of Capacitor is that four browser APIs stop being browser APIs.
Three of the four already have seams. The fourth is the service worker, and it
does not need one — see §5.

## 2. Decide the licence before anything else

The code is **AGPL-3.0-only** and the content **CC-BY-SA-4.0** _(verified:
`LICENSE`, `LICENSE-CONTENT`)_.

AGPL and GPL terms are widely held to conflict with the Apple App Store's terms
of service, and submissions have been pulled over it _(unverified — this is a
licence question, not a code question, and it wants a real answer rather than an
agent's recollection)_. Android/Play is not understood to have the same problem.

The repository has a single copyright holder (`amivag`), so this is a choice
rather than an obstacle: relicense, or dual-license the app under something
store-compatible while the engine stays AGPL. But it **is** a choice, it gates
every iOS line of work below, and it costs a day of thought and no code. Do it
first.

The content licence needs no change. CC-BY-SA permits commercial use, so a paid
or ad-supported build is already allowed — see
[monetisation.md](monetisation.md) for why that is less of a win than it sounds.

## 3. The spike that has to run first: speech

This is the largest functional risk in the task and the only one that could
change the recommendation in §1.

The practice loop is built on two browser speech APIs:

| Seam                        | Web implementation                                        | Chosen in         |
| --------------------------- | --------------------------------------------------------- | ----------------- |
| `TtsProvider`               | `audio/web-speech-provider.ts` (`speechSynthesis`)        | `app/services.ts` |
| `SpeechRecognitionProvider` | `audio/speech-recognition.ts` (`webkitSpeechRecognition`) | `app/services.ts` |
| `MicrophoneLevels`          | `audio/microphone.ts` (`getUserMedia` + analyser)         | `app/services.ts` |

All three are declared in `audio/types.ts` and chosen exactly once _(verified)_.

What is _(unverified)_ and must be measured on real devices, not read about:

1. Does `SpeechRecognition` exist in WKWebView on iOS? The working assumption is
   **no** — Safari has it, the embedded WebView is understood not to expose it —
   which would mean the pronunciation check needs a native plugin on iOS.
2. Does Android's WebView implement it? Working assumption: no.
3. Does `speechSynthesis` work in both WebViews, and with which Spanish voices?
   Working assumption: it works, and voice availability is worse and more
   variable than on the desktop web — which is already the argument for the
   canonical-audio pipeline (roadmap item 3), and would become the argument for
   finishing it.

Write the spike as a throwaway Capacitor shell that loads a page calling all
three, run it on one Android device and one iPhone, and write the answers into
this file. Nothing else here should start until §3 has numbers in it.

**If the answers are bad, the seams are why it is contained**: a
`CapacitorTtsProvider` and a `CapacitorSpeechRecognitionProvider` are new files
plus one line each in `services.ts`. Nothing in `features/` or `domain/` learns
that anything changed. That is the whole return on rule 5, and this is the task
that collects it.

## 4. The base path

`APP.basePath` is `'/linguastein/'` _(verified: `src/app/identity.ts`)_ because
the app is served from a GitHub Pages project page. It reaches:

- Vite's `base` (`vite.config.ts`)
- the PWA manifest's `start_url`, `scope` and both icon paths
- the router's basename, via `import.meta.env.BASE_URL`
- `datasetBaseUrl` in `services.ts`, which defaults to `${BASE_URL}packs/`

A Capacitor build serves from the root of a custom scheme, so the base path has
to become `'/'` there. `identity.ts` is the reason this is a build-mode switch
rather than a hunt through eleven files — which is what it was written for. Keep
it plain data with no imports: `vite.config.ts` reads it, and a config file
cannot import anything that touches the DOM.

Do **not** turn `basePath` into a function of `import.meta.env` inside
`identity.ts`. The cleanest shape found so far is a separate build mode that
overrides it, with the web default unchanged, so a mistake shows up as a broken
native build rather than as a broken deploy.

## 5. The service worker, and what replaces it

`main.tsx` calls `registerSW({ immediate: true, onNeedReload: markUpdateReady })`
_(verified)_, and `app/updates.ts` plus `components/UpdateBanner.tsx` turn that
into the "reload when you are ready" banner — deliberately, so an update cannot
land mid-answer and drop a learner back at the start of a session (see
[architecture.md](../architecture.md#updates-and-caching)).

In a native build there is no service worker and no precache. Two consequences:

- **Registration must be guarded**, and the banner must not be reachable. A
  native app updates through the store, so "a new version is ready, reload" is a
  sentence with no meaning there.
- **Packs come from the app bundle**, not from HTTP. This is the `DatasetSource`
  seam (`data/loaders/source.ts`) doing its job: write a source that reads the
  bundled asset directory and pass it in `services.ts`. 5.0 MB of JSONL as native
  assets is unremarkable; the largest single file is 2.74 MB, and the 8 MiB
  Workbox ceiling in `vite.config.ts` stops applying at all _(verified)_.

The architecture note about deferring the reload being safe "because the app
builds to a single bundle" still holds and still has one lazy chunk
(`StyleGuideScreen`). Re-read that paragraph before touching update handling.

## 6. Storage

`LearnerStorage` is one interface with an IndexedDB implementation at schema
version 3 and real migrations, plus an in-memory fallback held to identical
contract tests _(verified: `src/storage/`)_. The database is named `APP.id`.

IndexedDB works in both WebViews, so the cheapest correct first step is to
change nothing. The reason to revisit it is that **iOS evicts WebView storage
under pressure**, and losing a learner's FSRS history to an eviction is worse
than losing it to a reinstall because nobody chose it. The fix is a native
storage provider behind the same interface — and it is the same seam cloud sync
lands behind, so read [accounts-and-sync.md](accounts-and-sync.md) §3 before
designing one. Doing export/import first (that task's Stage C) makes an eviction
survivable without any native work at all, which is a good argument for
sequencing it ahead of this task.

## 7. Two places rule 5 was never applied

Both are small, both are pre-existing, and both get worse on a second platform.
They are listed here because a native port is when they start costing something.

**The router has no seam.** `react-router` is named in 18 files under `src/` and
15 under `tests/` _(verified)_. It is the last vendor above a seam in the
codebase. It is not a native-port blocker, but the routing layer is what a
custom-scheme base path and any deep-linking work both go through, so doing
[tanstack-router.md](tanstack-router.md)'s first commit — which introduces the
seam and is worth landing whichever router wins — before this task is cheaper
than doing it after.

**Pronunciation locales and the voice sample are hard-coded Spanish** — or were.
Work addressing both was in progress on 2026-08-24, unlanded, so **verify the
current shape before quoting this paragraph**; see
[stack-survey.md](stack-survey.md) §4.3–4.4. The description below is how it stood
when this task was written.
`PRONUNCIATION_LOCALES` in `domain/content/language.ts` is a four-entry literal
that `VoiceSettings` renders, while `PackManifest.pronunciationLocales` exists,
is validated, is populated by the build with `['es-ES', 'es-MX']`, and is read by
nothing but the Packs settings display _(verified)_. `VOICE_SAMPLE =
'Tengo que trabajar.'` sits in the otherwise app-agnostic `VoiceSettings`
_(verified)_. Both are recorded in
[learner-profile.md](learner-profile.md) §4.4; deriving the list from the loaded
packs is the same move `courseOptions()` already makes for languages. Fix them
there, not here — but expect voice selection to be the part of the UI a native
TTS provider changes most, so the two tasks touch the same file.

## 8. Store assets and the pipeline

- **Icons are SVG-only** (`public/icons/icon.svg`, `icon-maskable.svg`)
  _(verified)_. Roadmap item 10 already asks for rasterised 192/512 PNGs; stores
  additionally want a 1024 marketing icon and splash screens.
- Bundle identifiers, signing, and both developer accounts.
- Privacy disclosures. The app currently collects nothing, which makes the first
  filing trivially honest — protect that. Microphone use needs a purpose string
  on iOS, and it is already an optional feature, which is the right answer to
  give a reviewer.
- **Ship Android to an internal track first.** Review is faster and cheaper, and
  it is where the §3 answers will bite first.

## 9. Suggested order

1. §2 licence decision (blocks iOS, costs no code)
2. §3 speech spike on real devices; write the answers into §3
3. `tanstack-router.md` first commit — the navigation seam
4. Base path build mode (§4), guarded `registerSW` (§5), asset `DatasetSource` (§5)
5. Native TTS / STT / microphone providers as §3 requires
6. Raster icons and splash screens (§8)
7. Android internal track, then iOS

## 10. Judgement calls left open

**10.1 Whether the web build stays primary.** It should, and everything above
assumes it: GitHub Pages is free, has no review queue, and is where a learner
who has not installed anything meets the app. But it means every native
capability has to degrade rather than be depended on — the same rule the AI seam
already follows.

**10.2 Whether canonical audio becomes a blocker.** If §3 finds device voices
are as bad in WebViews as expected, roadmap item 3 stops being an improvement and
becomes the reason the native app is usable. That changes its priority and it
changes the licence question in that task (a voice whose output may be shipped),
so re-read [canonical-audio.md](canonical-audio.md) once §3 has answers.

**10.3 Whether to ship the packs in the bundle or download them.** Bundling all
5.0 MB is simplest and matches the offline promise. Downloading is what a second
language pack would want, and it is the add-on story already briefed in
[pack-addressing.md](pack-addressing.md) §4. Do not decide it here — decide it
there, and let this task consume the answer.
