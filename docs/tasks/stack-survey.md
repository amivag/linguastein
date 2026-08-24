# Survey: where the stack stands, and what it costs to grow

**Written:** 2026-08-24
**Occasion:** a question — "we will want to port this to Android and iOS, allow
user accounts so settings and progress are saved, and monetise with subtle ads or
donations. Where do we stand, and what needs doing?"
**For:** a future session picking any of that up, or wanting to know what was
already looked at and what was not.

This is a findings log, not a plan. The plans it produced are three separate
briefs: [native-port.md](native-port.md), [accounts-and-sync.md](accounts-and-sync.md)
and [monetisation.md](monetisation.md). Read this first if you want to know **why**
they say what they say, or to avoid re-deriving something.

Every claim below was checked against the tree on 2026-08-24. §6 lists what was
_not_ checked, which is the part of a survey that usually goes unwritten and is
the part that misleads.

---

## 1. The stack, as it actually is

| Layer      | What is there                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Runtime    | React 19, TypeScript 5.9 (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Vite 8    |
| Routing    | `react-router` 7 — named in **18 files under `src/`**, 15 under `tests/`                       |
| Offline    | `vite-plugin-pwa` / Workbox: shell + 5.0 MB of packs precached, audio `CacheFirst` for 90 days |
| State      | IndexedDB via `idb`, schema version 3 with real migrations; `localStorage` for appearance      |
| Validation | zod 4 at the dataset boundary                                                                  |
| Hosting    | GitHub Pages, static artifact, base path `/linguastein/`, full `npm run check` on deploy       |
| Quality    | Vitest + Testing Library + axe, coverage floors, oxlint rules that enforce architecture        |
| Licence    | AGPL-3.0-only (code), CC-BY-SA-4.0 (content)                                                   |
| Network    | **None.** No third-party request, no analytics, no account, no backend                         |

Largest single pack file is 2.74 MB of JSONL; the Workbox precache ceiling is set
to 8 MiB in `vite.config.ts` and the comment there explains why raising it again
is the wrong move.

## 2. Why all three tracks are cheaper than they look

Two properties of this codebase do most of the work, and neither was built for
these goals.

**`src/domain` is pure TypeScript** — no React, no DOM, no fetch, enforced by
`.oxlintrc.json`. It is the engine: content, exercises, sessions, progress,
missions. Any second front end keeps it unchanged, which is what makes the
native-port question "which shell?" rather than "which rewrite?".

**Every vendor but one sits behind a seam** chosen exactly once in
`src/app/services.ts`. The seam ledger, annotated with which growth track
collects on it:

| Seam                        | Declared in                    | Pays out for                             |
| --------------------------- | ------------------------------ | ---------------------------------------- |
| `LearnerStorage`            | `storage/types.ts`             | cloud sync; native storage on iOS        |
| `DatasetSource`             | `data/loaders/source.ts`       | packs from an app bundle instead of HTTP |
| `TtsProvider`               | `audio/types.ts`               | native TTS where a WebView has none      |
| `SpeechRecognitionProvider` | `audio/types.ts`               | native STT, same reason                  |
| `MicrophoneLevels`          | `audio/types.ts`               | the permission, and the level meter      |
| `Scheduler`                 | `domain/progress/scheduler.ts` | per-user FSRS weights later              |
| `AiTutorProvider`           | `ai/types.ts`                  | not needed by any of the three           |
| Icon set                    | `components/icons.ts`          | not needed by any of the three           |

`src/app/identity.ts` is the ninth seam in spirit: app id, name and base path in
one file, which is why a Capacitor build's `/` base is a build-mode switch rather
than a hunt through eleven files.

**The exception is the router**, and it is the reason
[tanstack-router.md](tanstack-router.md)'s first commit is recommended ahead of
the native port: that commit introduces the navigation seam and is worth landing
whichever router wins.

## 3. What each track actually needs

Summarised so this document stands alone; the briefs carry the detail and the
open decisions.

**Android and iOS** — Capacitor, not React Native. Four browser APIs stop being
browser APIs; three already have seams and the fourth (the service worker) needs
replacing rather than abstracting. The blocking unknown is whether the two speech
APIs exist in WKWebView and Android's WebView, and it needs a device spike rather
than an opinion. The blocking _decision_ is the licence: AGPL is understood to
conflict with App Store terms, the repository has one copyright holder, and it
costs a day of thought and no code.

**Accounts and sync** — the best-prepared, because Stage B of
[learner-profile.md](learner-profile.md) already landed the record clock
(`updatedAt`) and the collision-free ids a merge has to trust. Missing: a
serialisation format, a bulk write path, and a merge policy. The first two are
that task's Stage C and are worth shipping alone, before any server exists. The
third (§9.1 there) is the real decision and must be settled before the envelope
is fixed.

**Monetisation** — donations in Settings → About are nearly free and the only
part worth doing now. Ads are argued against on the web build for reasons that
are _enforced_ rather than aesthetic: four test files read the stylesheets as text
and fail the build on a colour outside a theme file or a border outside two
exceptions, and an ad iframe is neither. The content is CC-BY-SA, so the
curriculum is not the moat — sell convenience.

## 4. Findings, and where each one stands

Statuses are as of 2026-08-24. **Re-verify before acting**: three of these were
in files another session was editing the same afternoon.

| #   | Finding                                                           | Status                    |
| --- | ----------------------------------------------------------------- | ------------------------- |
| 1   | Unreachable category written into a session link                  | **fixed** (§4.1)          |
| 2   | `SkillProgress` and `showRomanisationHints` dead                  | **fixed** (§4.2)          |
| 3   | `VOICE_SAMPLE` hard-coded Spanish in an app-agnostic component    | fixed by concurrent work  |
| 4   | `PackManifest.pronunciationLocales` populated and read by nothing | concurrent work in flight |
| 5   | `pronunciationLocale`, `voiceName`, `level` stored globally       | **open** — see §4.5       |
| 6   | Docs claimed backend/accounts/native were out of scope            | **fixed** (§4.6)          |

### 4.1 An unreachable category reached the session link — fixed

The sharpest finding of the survey, and a genuine bug rather than an
architectural observation.

`FocusPicker` deliberately narrowed the stored `focusTopics` to categories the
current course can reach — its own comment says "switching down to A1 must not
leave the bar boasting about a B1 category". `HomeScreen` then wrote the **raw**
stored list into every session link, at three sites. So the bar read
`Everything · balanced` while the link it produced said `?topic=hotel`, and the
session came back "Nothing to practise here yet."

A topic is a filter rather than a bias, so the planner has nothing to widen back
to — which is the one outcome a focus is supposed to be incapable of.

[learner-profile.md](learner-profile.md) §4.2 had found this with the French
fixture pack. It is reachable in the **shipped single-pack app** without a second
language: choose a category whose content is all B1, then drop the course to A1.

Fixed by `reachableTopics` in `domain/content/course.ts`, used by both the summary
and all three writers, so the two halves cannot disagree again. Seven tests
added; the two feature tests were confirmed to fail without the fix.

### 4.2 Two dead declarations — fixed

`SkillProgress` (`domain/progress/types.ts`) and `showRomanisationHints`
(`Preferences`) were referenced nowhere in `src` or `tests`. Both deleted, with
the reasoning recorded where someone would look: `mastery.ts`'s module comment for
the first, and a note where the field used to be for the second. See
[learner-profile.md](learner-profile.md) §9.5, now settled.

The reason to do this ahead of the rest of that task: a dead field costs nothing
until it reaches a file format, and then costs every future reader a decision.

### 4.3–4.4 Pronunciation locales — mostly not ours

`PRONUNCIATION_LOCALES` in `domain/content/language.ts` was a four-entry
Spanish-only literal that `VoiceSettings` rendered, while
`PackManifest.pronunciationLocales` existed, was validated, was populated by the
build with `['es-ES', 'es-MX']`, and was read by nothing but the Packs settings
display. `VOICE_SAMPLE = 'Tengo que trabajar.'` sat in the otherwise
app-agnostic `VoiceSettings`.

Both were being fixed by concurrent work while this survey was written —
a `pronunciationLocales(repository, language)` derived from the packs, a
`regionLabel` that falls through to `Intl.DisplayNames` so a new language needs no
table entry, and a `useVoiceSample` hook reading a phrase out of the course.
**Verify the current shape before quoting any of it**; the descriptions in
[native-port.md](native-port.md) §7 carry the same caveat.

### 4.5 Course-shaped preferences stored globally — open

`pronunciationLocale`, `voiceName` and `level` are single global values, so a
French course speaks French text through a Spanish voice, and Spanish-at-A2 and
French-at-A1 cannot both be true. This is Stage A of
[learner-profile.md](learner-profile.md) §4.1 and it is the one finding from this
survey that is still genuinely open.

Deliberately not attempted here, and the reason is worth recording: concurrent
work was addressing it with a **different design** than Stage A proposes — keeping
the record flat and re-resolving the locale in `CourseBar` when the course
changes, rather than splitting `Preferences` into device settings plus course
state. Editing underneath that would have reverted a design choice by accident.
Whoever picks this up should decide which of the two shapes is wanted, and say so
in §5.1 of that task.

### 4.6 The docs said this was all out of scope — fixed

[roadmap.md](../roadmap.md) ended with "Explicitly out of scope for now: Backend,
accounts, social features, moderation, native app, app-store pipeline,
gamification", and [architecture.md](../architecture.md) said the same under
"Deliberately not built yet". Both now point at the three briefs instead, because
a repository this careful about drift should not have its own roadmap contradict
its own task docs.

## 5. Two things that constrain all three tracks

**The pack is unreviewed.** `core-es` ships `source: generated,
review: unreviewed` and nothing is signed off — roadmap item 0. This is a
prerequisite for monetisation rather than a parallel track: charging for
unreviewed machine-generated Spanish is a credibility risk, and the review
machinery already exists (`content/es/reviewed.tsv`, `npm run review:data`), so
what is missing is a human reading the Spanish.

**Collecting nothing is an asset being spent.** No third-party request, no
analytics, no account, no privacy policy needed to be honest. Accounts spend it
(GDPR, deletion, a second origin, the first CSP surface the app has ever had) and
ads would spend it again (consent management, ATT). Each is defensible; neither
should happen as a side effect of a commit about something else. In particular:
do not add analytics as part of the sync work.

## 6. What this survey did **not** check

The honest edges, so nobody trusts it further than it goes.

- **No engine audit.** `src/domain` was read for structure, not for defects.
  Finding §4.1 came from following up a claim in an existing task doc, not from a
  sweep. There has been no bug hunt over exercises, grading, FSRS or the planner.
- **No device testing.** Every claim about WebView speech support, iOS storage
  eviction and store review is marked _(unverified)_ in
  [native-port.md](native-port.md) and is an expectation, not a measurement.
- **No legal advice.** The AGPL/App Store question and the Apple donation rules
  are flagged as decisions needing a real answer, not settled here.
- **No content review.** None of the 3,000-odd items was read.
- **No performance work.** Bundle size, boot time and the cost of
  `repository.query` over the grown pack were not measured. Worth knowing before
  the native port, since a phone WebView is the slowest place this runs.
- **The suite was red throughout**, from a concurrent dataset rebuild. A baseline
  was taken (10 failing files, all dataset-count and voice-preference suites) and
  every change made during this survey was verified against it, but "the gate is
  green" was never true on this tree that afternoon.
