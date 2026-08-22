# Task: make it feel good to use

**Status:** in progress — §4.1 (motion scale), §4.2 (answer feedback), §4.3
(segmented progress), §4.4 (the earned summary) and §4.5 (adaptive Home) have
landed. §4.6 remains.
**Written:** 2026-08-20
**Revised:** 2026-08-21 — §4.2 landed as part of the design-language pass; see
[docs/design-language.md](../design-language.md), which now owns the visual rules
this task was working towards.
**For:** a fresh agent session, no prior context assumed
**Scope:** `src/styles`, `src/components`, `src/features` and the preferences
record. No content, no dataset, no scheduler. If a change here needs a change in
`src/domain`, that is a signal to stop and reconsider the change.

---

## 1. Orientation

Read these first, in order:

1. [`AGENTS.md`](../../AGENTS.md) — especially **Accessibility is the agent
   interface** and **Theming**. Both constrain everything below, and neither is
   negotiable in exchange for polish
2. [`src/styles/primitives.css`](../../src/styles/primitives.css) — every
   non-colour design token there is, which is fewer than you expect
3. [`src/styles/themes/light.css`](../../src/styles/themes/light.css) — the full
   set of colour roles
4. [`src/features/practice/SessionScreen.tsx`](../../src/features/practice/SessionScreen.tsx)
   — the loop that matters most, and the end-of-session state that currently
   rewards a learner with a fraction
5. [`docs/spec/spanish_learning_app_spec_v0.1.md`](../spec/spanish_learning_app_spec_v0.1.md)
   — check the product intent before adding a mechanic it argues against

Then run `npm run check` and `npx vitest run tests/a11y`. Both must pass before
you start, and both must pass after every step.

**The task in one line:** the app is clean, correct and slightly austere; make it
feel alive without making it loud.

---

## 2. Where things stand, measured

Not opinion — this is what is in the tree:

| Measure                               | Now                                                   |
| ------------------------------------- | ----------------------------------------------------- |
| Motion tokens in `primitives.css`     | 3 durations, 2 curves, 3 composed pairs (§4.1)        |
| Easing curves defined                 | `--ease-out`, `--ease-spring` (§4.1)                  |
| `prefers-reduced-motion` handling     | already global, in `global.css`                       |
| Colour roles for feedback             | `--color-success`, `--color-danger`, `--color-accent` |
| Colour role for celebration or reward | none                                                  |
| End-of-session reward                 | the fraction, plus what moved (§4.4)                  |
| Streak, of any kind, anywhere         | none                                                  |
| Sound, other than TTS                 | none                                                  |
| Haptics                               | none                                                  |

`prefers-reduced-motion` being already global is the load-bearing one: motion can
be added without each component re-solving accessibility, which is why §4.1 could
be a scale rather than a negotiation. The scale itself landed before any component
had invented much of its own, so there was no accumulated mess to unpick — the
remaining sections inherit it.

---

## 3. What "more of a game" must not mean

This is the load-bearing section. The brief was explicitly _subtle, while still
clean_, and the ways this goes wrong are well known and mostly shipped by
competitors:

- **No punishing streaks.** A daily counter that resets to zero is a
  loss-aversion mechanic. It makes missing one day feel like destroying
  something, drives 11pm cramming that teaches nothing, and turns a tool into a
  creditor. If a streak ships at all, make it non-destructible: days practised in
  the last seven, or a personal best that is never taken away. Never a chain that
  breaks.
- **No reward that overstates the evidence.** A study session records nothing —
  no attempt, no progress, no score — because a self-rated reveal is not
  retrieval. The copy already says so. A celebration animation at the end of a
  study session would contradict the sentence directly underneath it. Reward
  must scale with what was actually proven.
- **No manufactured scarcity or pressure.** No lives, no hearts, no timers that
  fail a learner, no notification guilt. Speed pressure in particular fights the
  pedagogy: recall under panic is not the recall being scheduled for.
- **No points that mean nothing.** A number that goes up regardless of whether
  anything was learnt is noise dressed as feedback. If something is counted, it
  should be something a learner would care about being told: words that moved up
  a stage, sentences read, patterns that stabilised. Mastery is already derived
  from item history, so this data exists and needs no new storage.
- **Motion is never the only signal.** State is exposed as ARIA — `role="status"`
  for results, `aria-expanded` on word buttons, `role="progressbar"` for session
  position. An animation may accompany a state change; it may never _be_ the
  state change. The same rule that rules out colour-only feedback rules out
  motion-only feedback.
- **Latency is the enemy of fun.** Practice is a tight loop. An animation that
  delays the next item makes the app feel worse, not better, however pretty it
  is. Feedback should overlap the transition, not gate it.

Getting this section right is most of the task. Everything in §4 is
straightforward once these are settled.

---

## 4. Candidate work, roughly in order

Each item is independently shippable. Do them one at a time and run the a11y
suite between; do not land a sweeping restyle as one commit.

### 4.1 A motion scale — landed

`--duration-fast|base|slow`, `--ease-out`, `--ease-spring`, and three composed
`--transition-*` pairs, so a component names an intent rather than reassembling a
duration and a curve and getting one half wrong.

The drift it replaced was already there in miniature: `--transition-fast` used
twice, `120ms ease` typed out three times, and one lone `200ms ease` on the
progress bar — four spellings of two ideas. `--transition-fast` kept its name and
meaning, so nothing needed rewriting to adopt it.

`tests/a11y/motion.test.ts` is what makes it stick. It fails on any hard-coded
duration or easing outside `primitives.css` (naming the file), on a theme that
mentions motion at all, and if the global `prefers-reduced-motion` collapse is
ever deleted — that block is the reason a component may add motion without
thinking about accessibility, so it is asserted rather than assumed. Both guards
were verified by breaking them on purpose.

### 4.2 Answer feedback with weight — landed

The graded option settles by a hair and its ring firms up from nothing
(`@keyframes grade` in `Button.module.css`); the verdict band does the same
(`@keyframes settle` in `Practice.module.css`). `role="status"` is untouched.

Three things worth not undoing:

- **The end state is identical with motion off.** The animation carries nothing —
  the fill, the ring and the icon are all present either way — which is what
  makes it additive rather than informative.
- **Nothing waits for it.** Feedback overlaps the transition to the next card; it
  does not gate it. Latency is the enemy of fun, and a 200ms flourish in a loop
  this tight would be felt as slowness rather than as polish.
- **Right and wrong get the same weight.** The wrong answer is information, not a
  buzzer, so it does not shake, flash or take longer.

The verdict tints also became roles in the same pass — `--color-success-soft` and
`--color-danger-soft` — because the card, the graded option and the summary were
each mixing their own percentage and "correct" was coming out three shades of
green.

### 4.3 Session progress that reads as progress — landed

`SessionProgress` draws one pip per item, and the `role="progressbar"` is
untouched: same name, same value, minimum and maximum. The pips are `aria-hidden`
decoration on top, because the progressbar already says "Item 3 of 8" and twenty
anonymous spans repeating it would be noise.

Three decisions worth keeping:

- **Position only, never correctness.** Scoring each pip as it went would turn
  the header into a running scoreboard, which is the pressure §3 argues against —
  and it would have nothing to show in a study session, which is not scored.
- **The current pip is taller as well as accent-coloured**, so position survives a
  colour-vision difference and the reduced-motion path. Colour is never the only
  signal, and neither is the transition.
- **Above 20 items it falls back to the bar.** Measured rather than guessed: at
  the worst case — 20 pips on a 375px phone — each pip is 12.3px against a 3px
  gap, so it is still four times the gap and countable. Past that they stop
  reading as segments. "Review everything due" is what pushes over the line.

One thing a browser could not verify: the pane does not composite while hidden,
so paint-only values (`background-color` from a `[data-state]` selector) read
stale even though `data-state` and the layout-affecting height update correctly.
The colour contract is asserted against the stylesheet instead, as
`contrast.test.ts` and `hover-states.test.ts` already do.

### 4.4 An earned end-of-session summary — landed

`SessionOutcomeSummary` reports which words moved up a stage, which slipped back,
and when the set returns. All derived from progress the session was already
writing, so it cost one snapshot per answer and no new storage.

Both hard requirements hold, and both are tested: a study session gets **no panel
at all** — it records nothing, so a summary would contradict the line above it —
and the fraction still shows whatever it was.

Three things worth not undoing:

- **It renders nothing when nothing moved.** A session where every item held its
  stage is a normal session; an empty panel announcing that reads as a failure.
- **A lapse is named, not softened.** It is the more useful half of the report.
- **The interval is coarse** — "tomorrow", "in about a week". Stated to the hour
  it invites treating the schedule as a deadline, which is the opposite of how
  spacing works.

Two React Compiler rules shaped the implementation, and both rejected the obvious
approach: reading `progressRef.current` inside a `useMemo` is a ref read during
render, and `useEffect(() => setNow(Date.now()), [])` is `setState` in an effect.
So the stage change _and_ the days-until-due are accumulated in the answer
handler, where a clock read is legitimate, and the component renders purely from
whole days. `SessionOutcome` carries `nextDueInDays` rather than a timestamp
deliberately, not incidentally.

### 4.5 Home that knows what day it is — landed

Home leads with one trustworthy action, then at most two useful next steps. Due
reviews no longer hide the current mission; a learner with history can ask for a
bounded shaky-first session, and one with unseen material can ask for a bounded
fresh-first session. Learning rhythm also names when this course was last
practised. The clock is read in the existing storage effect rather than during
render, preserving the React Compiler constraint.

### 4.6 Optional sound and haptics

Both off by default, both behind a preference in the existing preferences
record, both trivially ignorable. Sound goes through the existing audio seam —
do not introduce a second way to make noise. Haptics are `navigator.vibrate`
behind a capability check, and a no-op on desktop rather than an error.

Do this last. It is the item most likely to be wrong for a given learner, and
the least valuable if the earlier ones landed well.

---

## 5. Rules and constraints

- **Never hard-code a colour.** Use a role token, and add a role rather than
  inventing a one-off. A new role must pass the contrast test in **every** file
  under `src/styles/themes/`, which discovers themes automatically.
- **Themes are colour-only.** Motion, spacing and shape tokens go in
  `primitives.css`. A theme that changes a duration is a bug in the theme system.
- **Use `--color-border-strong` for interactive boundaries** and
  `--color-border` for decoration. This distinction is what the contrast test
  checks; polishing borders is the easiest way to break it.
- **Every control keeps a stable accessible name.**
  `tests/a11y/agent-surface.test.tsx` fails otherwise, and it is protecting the
  agent-driven interface as much as the screen-reader one. An icon that replaces
  a text label needs its name preserved.
- **One `<h1>`, one `<main>`, a matching document title, per screen.** A visual
  restructure must not quietly produce two headings.
- **Respect `prefers-reduced-motion`.** It is already handled globally, so the
  cost of compliance is zero. Do not add motion that routes around it, and do not
  make a reduced-motion user lose information the animation carried — which is
  another way of stating the rule in §3.
- **No impure calls during render.** React Compiler lint rules are on. Clocks,
  randomness and animation frames belong in effects or handlers.
- **Randomness stays injected.** If a flourish is randomised, take it from
  `src/utils/random.ts` so a seeded session stays reproducible.
- **Coverage floors are enforced.** New behaviour needs a test. Raise a floor
  when the real figure moves up; do not lower one to make a change fit.
- **Tap targets stay at `--tap-target`.** A denser, prettier layout that shrinks
  a button below it has made the app worse for the thumb it is used with.

---

## 6. Definition of done

- [x] A motion scale exists in `primitives.css`, and components use it rather
      than inline values — enforced by `tests/a11y/motion.test.ts`
- [x] Answer feedback has weight, without changing what `role="status"` announces
- [x] Session progress reads as progress, with the progressbar contract intact
- [x] End of session says what was achieved; study mode says its honest version
- [x] Home leads with what is due
- [ ] Sound and haptics exist, off by default, behind preferences
- [ ] No new hard-coded colour anywhere; any new role passes contrast in every
      theme
- [ ] `npm run check` passes; `npx vitest run tests/a11y` passes
- [ ] A reduced-motion pass loses no information
- [ ] Nothing in §3 has crept in

## 7. Verification

```bash
npm run check && npx vitest run tests/a11y
```

Automated checks cannot tell you whether this task succeeded, so also:

- Run a ten-item session with reduced motion on, and confirm nothing is missing
  rather than merely still. Then run one with it off, and confirm the animation
  was carrying nothing.
- Run a **study** session to the end and read the final screen. If it feels like
  a reward, it is lying.
- Drive one session entirely by keyboard, and one through the accessibility tree
  the way an agent would. Polish that only works with a mouse has broken the
  documented interface.
- Deliberately answer badly and finish the session. The summary should be useful
  and unembarrassing, and it should not pretend.
- Then leave it a day and come back to Home. That is the moment the whole task is
  really aimed at.
