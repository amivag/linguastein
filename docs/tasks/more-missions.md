# Task: more missions, and where the existing ones are actually thin

**Status:** briefed, not started — the audit is done, the content is the blocker
**Written:** 2026-08-24
**For:** a fresh agent session, no prior context assumed
**Scope:** content first, then sequencing records. The engine needs no changes.

Read [`AGENTS.md`](../../AGENTS.md) and follow the rule it states twice:
**author the content a mission teaches before authoring the mission.** Six
missions landed at once because their vocabulary was already there — travel had
148 items before `buy-a-ticket` existed.

---

## 1. The audit, so it is not repeated

Measured against `src/app/missions.ts` as it ships:

| Measure                                       | Now                     |
| --------------------------------------------- | ----------------------- |
| Missions                                      | 14                      |
| — at a1                                       | 13                      |
| — at a2                                       | 1 (`doctor-visit`)      |
| Transfer passages per mission                 | 3, in every single case |
| Named capabilities                            | 67                      |
| — with a response palette behind them         | **67 (all of them)**    |
| Response palettes                             | 69                      |
| Alternatives per palette (min / median / max) | **8 / 8 / 10**          |
| Total authored alternatives                   | 569                     |

**The headline: the existing missions are not thin.** Every capability a mission
names has a palette, and no palette offers fewer than eight alternatives. The
one-line answer to "can these be enriched with more variations" is _not
meaningfully_ — commit `72bef42` ("Widen the other twelve missions the way the
greeting was widened") already did that pass, and it did it thoroughly.

`greet-and-respond` looks like an outlier at 11 palettes and 91 alternatives, and
is not: it names 11 capabilities because it is the longest conversation in the
pack. Per capability it is the same density as the rest.

So effort spent widening palettes further would be effort spent on the part that
is already done. The gaps are elsewhere.

## 2. Where the real gaps are

### 2.1 Level, not variation

Thirteen of fourteen missions are a1. A learner who finishes the ladder has one
a2 mission and then nothing — and the pack behind it is thin in the same shape:
1,185 of 1,425 sentences are a1, and 81% of all sentences are present-tense.

This is the gap worth naming as _the_ gap. It is not solved by writing more a1
missions.

### 2.2 Uniform transfer counts

Every mission has exactly three transfers, which is a template rather than a
judgment. Some moves need one transfer and some need five; nothing in the domain
requires three, and `missionTransfers` reads whatever is authored. Worth a pass
that asks per mission, but low value next to §2.1.

### 2.3 Areas with content but no mission

Candidates, with the content that already exists behind them:

| Area                   | Content now                        | Verdict                            |
| ---------------------- | ---------------------------------- | ---------------------------------- |
| **Past tense**         | 45 sentences (35 pret, 10 imperf)  | Briefed separately — content first |
| **Feelings and state** | 52 sentences, 9 word cards         | Briefed separately — content first |
| **Asking vs telling**  | 30 sentences, 2 dialogues, 5 pairs | **Closest to ready** — see §3      |
| School and study       | 44 sentences, no mission           | Needs a dialogue set first         |
| Phone call             | almost nothing                     | Content first                      |
| Asking for help        | scattered across `communication`   | Content first                      |
| Making an appointment  | overlaps `clock` and `health`      | Content first                      |

Two of these are already briefed on their own because each needs deciding before
authoring: [`past-tense-mission.md`](past-tense-mission.md) and
[`feelings-mood-state.md`](feelings-mood-state.md). Neither should be started by
writing the mission.

## 3. The one that is nearly ready

`content/es/sentences-asking.tsv` now holds the statement/question contrast: five
minimal pairs, an echo-question dialogue (`preguntar-contar`) and a tag-question
dialogue (`confirmar-verdad`), plus three authored function skills
(`echo-to-check`, `confirm-with-a-tag`, `answer-a-tag`) and two generated grammar
skills (`yes-no-question`, `question-word`).

A mission needs **four** passages — a model plus three transfers — and this has
two. So the honest state is "half the content for a mission exists". What it
needs before a mission is written:

- Two more dialogues in the same shape, in different situations: the echo and the
  tag both belong anywhere, which makes them cheap to transfer. A shop, a station,
  a doctor's waiting room.
- A response palette for each of the three authored capabilities, at 8+
  alternatives to match the density of every other mission in the pack.
- Then, and only then, the `MissionDefinition`.

That is the recommended next mission, because the teaching is already proven
missing and the vocabulary is already in the pack. Do not shortcut it to two
passages — a mission with one transfer would be the first in the pack and would
read as unfinished rather than as a deliberate choice.

## 4. Definition of done

Whatever is picked up, done means:

- [ ] The content exists before the `MissionDefinition` does
- [ ] Every capability the mission names has a palette of 8+ alternatives, which
      is the density the other 69 palettes set
- [ ] Four passages: a model and three transfers, or a documented reason for a
      different number
- [ ] `npm run check` passes; `npm run validate:data` reports 0 / 0
- [ ] The recycling ratchet in `content/es/recycling.tsv` is not worse, and is
      re-recorded if it improved

## 5. Verification

```bash
npm run build:data && npm run check
```

Then walk the mission in the running app, including the Use stage, and confirm
the transfer ladder is reachable from Study rather than only from Home.
