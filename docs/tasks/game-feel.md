# Task: make it feel good to use

**Status:** ready to start — no prerequisites; the constraints it must respect
all already exist
**Written:** 2026-08-20
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

| Measure                                | Now                                              |
| -------------------------------------- | ------------------------------------------------ |
| Motion tokens in `primitives.css`      | **one** (`--transition-fast: 120ms ease`)        |
| Easing curves defined                  | 0 — `ease` is the browser default                |
| `prefers-reduced-motion` handling      | already global, in `global.css`                  |
| Colour roles for feedback              | `--color-success`, `--color-danger`, `--color-accent` |
| Colour role for celebration or reward  | none                                             |
| End-of-session reward                  | a bare `correct/answered` fraction               |
| Streak, of any kind, anywhere          | none                                             |
| Sound, other than TTS                  | none                                             |
| Haptics                                | none                                             |

Two of these are unusually good news. `prefers-reduced-motion` is already
respected globally, so motion can be added without each component re-solving
accessibility. And there is exactly one motion token, so there is no accumulated
mess to unpick — the scale can be designed once, before components start
inventing their own.

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

### 4.1 A motion scale (do this first)

Add durations and easings to `primitives.css` beside the spacing and type
scales — a fast, a base and a slow duration, plus a standard easing and one
with a slight overshoot for things that should feel physical. Themes are
colour-only, so this belongs in primitives and nowhere else.

Doing this first means every later step reaches for a token instead of typing
`180ms cubic-bezier(...)` inline, which is how a codebase ends up with eleven
slightly different transitions.

### 4.2 Answer feedback with weight

Right now an answer is correct or it is not, and the difference is a colour and
a line of text. Give the answered option a short settle — a small scale, a
border that firms up — so the tap feels received. Keep `role="status"` exactly as
it is; this is additive.

The wrong-answer case deserves more thought than the right one. It should feel
like information, not like a buzzer.

### 4.3 Session progress that reads as progress

`role="progressbar"` is already in place. A continuous bar under-sells a
ten-item session; segmented pips, one per item, filling as you go, tell a learner
where they are at a glance and make the last two items feel close. Keep the
accessible name and value the progressbar already exposes.

### 4.4 An earned end-of-session summary

The biggest single win, and the least risky. Replace the bare fraction with what
actually happened: which words moved up a stage, what is now scheduled sooner,
how many sentences were read. All of it is derivable from data already stored.

Two hard requirements. A study session must show its own honest version — what
was reviewed, and that nothing was recorded — rather than a dimmed copy of the
practice one. And a bad session must not be spun; "4 of 10" is information a
learner can use, and hiding it is a small lie that makes every good result
worthless.

### 4.5 Home that knows what day it is

Home currently lists presets. It could lead with what is due, what was last
practised, and one obvious next action — the same information, ordered by what a
returning learner actually wants. Note the React Compiler constraint: do not call
`Date.now()` during render. Read the clock in an effect or an event handler.

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

- [ ] A motion scale exists in `primitives.css`, and components use it rather
      than inline values
- [ ] Answer feedback has weight, without changing what `role="status"` announces
- [ ] Session progress reads as progress, with the progressbar contract intact
- [ ] End of session says what was achieved; study mode says its honest version
- [ ] Home leads with what is due
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
