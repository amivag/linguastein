# Linguastein product audit — 2026-08-22

> **Historical record. Much of this has since been acted on — read it for the
> reasoning, not for the current state.** Its central finding was "no guided
> learning arc, and a first screen that communicates backlog rather than
> possibility". Since then: the missions ladder landed (seventeen missions, each
> Understand → Practise → Use with a three-context transfer ladder), Test was
> renamed **Home** and rebuilt to answer "what is this course and where had I got
> to" before recommending anything, and the pack grew from 1,043 items and 14
> texts to 3,798 items and 123 passages. Its numbers are all from that day.
>
> What it raised that is **still open**: editorial review of the pack (nothing is
> signed off), canonical audio (both code halves exist, no clip has been
> generated), and Progress as a capability map rather than a measurement readout.
> Those are items 0, 3 and 8 of [docs/roadmap.md](../../docs/roadmap.md).

## Audit scope

Fresh mobile run at 390 × 844 through the current Spanish course: course home, Study, Browse, word details, Quick practice, answer feedback, Progress, Settings, reading library, and a short text. The review combines visible UX/accessibility evidence with a read-only inspection of the scheduling, exercise composition, mastery, speech, and content provenance code.

## Overall verdict

Linguastein already has a better learning engine than its product experience communicates. Its strongest ideas—FSRS scheduling, a recognition-to-production ladder, interleaving, contextual word/pattern mastery, tappable language, study/practice honesty, deterministic sessions, and local-first operation—form a credible anti-Duolingo foundation. The current app is best described as an excellent practice laboratory, not yet a complete guided learning product.

The central product problem is orientation. The first screen presents 1,043 new items, three level scopes, four session lengths, a focus control, and six practice modes without first learning who the learner is or giving them one trustworthy next action. Study and Browse then expose the content taxonomy more readily than a learning path. A motivated expert can self-direct; a beginner must design their own curriculum.

## Flow evidence

1. **Course home — needs work.** `01-course-home.png`. Strong visual hierarchy and short-session affordances, but “All levels / 1043 new” is an intimidating and pedagogically weak first-run default. The screen asks the learner to choose a mechanism before it has established a goal, level, or next lesson.
2. **Study hub — mixed.** `02-study.png`. The Study/Test distinction is unusually honest and useful. The hub is clear at the top, but it becomes a long catalogue of grammatical and topical taxonomies rather than a guided exposure plan.
3. **Browse nouns — needs work.** `03-browse-nouns.png`. Search, alphabet, topic, type, word kind, region, register, sort, and two practice actions are powerful, but too many controls are simultaneously prominent on mobile. Category exploration occupies most of the first viewport and delays results.
4. **Word details — healthy.** `04-word-details.png`. A strong just-in-time explanation pattern: meaning, gender, pronunciation, and a contextual example without leaving the source material. The dimmed background and bottom sheet work well.
5. **Practice question — healthy with a critical dependency risk.** `05-practice-question.png`. Large language, plausible choices, visible progress, and tap-any-word behavior are excellent. On this device audio is absent, so an audio-led product promise degrades into a text quiz and a repeated technical warning.
6. **Practice feedback — healthy.** `06-practice-feedback.png`. Correctness is unambiguous without being punitive; the next action is obvious; regional usage survives the grading state. The share control is secondary, as it should be.
7. **Progress — mixed.** `07-progress.png`. Honest item, mastery, due, accuracy, word/pattern, and revisit signals are valuable. However, the screen reports measurement rather than direction: it does not turn evidence into a recommended practice plan or communicate broader communicative capability.
8. **Settings — healthy.** `08-settings.png`. Clear grouping, strong explanations, transparent audio fallback, and no account pressure. The first-run level and accent choices would be more useful during onboarding than buried here.
9. **Reading library — mixed.** `09-reading-library.png`. This is the most promising route toward a differentiated product, but 14 texts of five to seven sentences are too thin to support extensive reading, sustained listening, or narrative progression.
10. **Reading — healthy foundation.** `10-reading.png`. Tappable words, sentence playback, hidden meaning, and a one-tap bridge to practice are excellent. The prose is readable and uncluttered.
11. **Revealed meaning — healthy.** `11-reading-meaning.png`. Sentence-aligned meanings are easy to scan. Future modes should add partial scaffolding (unknown-word hints, staged translations, cloze/retell) so reveal is not only all-or-nothing.

## What is genuinely differentiated

- **Retrieval grows harder with memory.** New/fragile material starts with recognition, then moves to cued recall and production as stability rises; a lapse drops it back. This is far more defensible than a fixed carousel of exercise types.
- **The scheduler and the session composer are separate.** What to review and how to review it can improve independently.
- **Mastery requires contextual breadth.** A word or pattern is not considered strong because one sentence was memorized; the model rewards encounters across distinct items.
- **Study is not fake progress.** Reveal-based browsing records nothing. This protects the meaning of mastery and avoids the flattering metrics common in gamified apps.
- **Language remains inspectable during practice.** Every word can be opened without leaving the task, while graded information can be selectively withheld.
- **The product is local-first, vendor-agnostic, accessible, and deterministic.** These are strategic advantages for trust, offline use, testing, and future language expansion.

## Highest-impact product risks

### 1. No guided learning arc

The app optimizes sessions, but it does not yet design a journey. “Balanced,” “Verbs,” “Vocabulary,” and CEFR ceilings are tools, not a curriculum. Add a visible path built around communicative missions and gradually expanding stories: introduce → notice → comprehend → retrieve → manipulate → use. Keep Browse as the library and Test as the training room; add a coach layer that chooses the next meaningful set.

### 2. First run communicates backlog, not possibility

`1043 new` reads like debt. Default a new learner to A1 and a tiny first mission, then reveal the wider corpus as freedom rather than obligation. A short onboarding should ask only: current ability, why Spanish matters, preferred accent, and realistic session rhythm. It should immediately produce a first success and a recommended plan.

### 3. Audio is structurally important but operationally optional

Device TTS absence removes the core listen-and-repeat loop. Ship reviewed canonical audio for core material, cache it offline, and use device TTS only as fallback. Add slow playback, phrase looping, shadowing gaps, A/B native-vs-self recording, and minimal-pair or chunk practice. Transcript matching is useful for comprehensibility, but it is not pronunciation scoring and should be labelled accordingly.

### 4. Content breadth exceeds content depth and trust

The pack is explicitly generated and has no editorial sign-offs. Its 1,043 items create surface area, but only 14 short texts create limited context, repetition, voice, and narrative continuity. Prioritize human review and deeper content clusters over raw item count: one situation should contain a dialogue, a short story, audio, useful chunks, controlled variations, and a retell prompt.

### 5. The app trains answers more than communication

Production currently culminates mainly in saying a predetermined sentence. Add transformations polyglots use: substitution drills with meaning, bidirectional translation, dictation, shadowing, sentence expansion, point-of-view/tense changes, role-play turns, personalized monologues, and story retelling. These should reuse the current item/skill graph rather than become stored exercise records.

### 6. Progress lacks an actionable language model

Accuracy and item counts are necessary but not motivating enough. Show communicative capabilities (“can order a drink,” “can describe a routine”), exposure breadth, listening vs speaking vs recall strength, and the next bottleneck. Avoid XP and breakable streaks; reward durable evidence such as a pattern stabilizing, a story retold, or a five-minute conversation completed.

## Recommended product shape

Use three layers:

1. **Coach:** one recommended next action based on goals, due material, weak skills, and recent context.
2. **Journeys:** communicative missions and recurring stories that organize content into meaningful progression.
3. **Laboratory:** the current Study, Browse, filters, presets, and share tools for self-directed learners.

This preserves everything strong in the current architecture while solving the beginner-orientation problem. It also creates a distinctive promise: not “do a lesson and earn points,” but “understand, remember, and use increasingly rich Spanish.”

## Suggested sequence

1. Redesign first run and Home around one coach recommendation; default new learners to A1.
2. Build one exemplary eight-to-ten-session “Everyday morning” journey using existing items, with reviewed audio and a final retell.
3. Add a listening/shadowing loop with record-and-compare playback.
4. Turn Progress into a capability map with a next-action explanation.
5. Expand human-reviewed, interconnected stories/dialogues before expanding the raw item inventory.

## Accessibility and verification

The visible flow showed strong heading structure, landmark use, accessible names, ARIA state, large targets, focusable word tokens, and non-colour grading signals. The dedicated accessibility suite passed 124/124 tests. This is not a claim of full WCAG compliance: screen-reader announcements, keyboard order, zoom/reflow, touch behavior, real device speech permissions, and motion preferences still need hands-on checks.

The full repository gate currently fails one environment-sensitive audio-generation test because the machine reports `no SAPI voices found`, while the assertion accepts only a language-specific missing-voice or Windows-only message. All other test files passed (74 passed, 1 failed; 804/805 tests), and the dedicated accessibility suite passed.
