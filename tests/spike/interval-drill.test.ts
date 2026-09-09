/**
 * SPIKE — not a test of this app. Throwaway, on branch `spike/interval-drill`.
 *
 * It exists to falsify one claim in `docs/framework.md`: that Tier 1 —
 * `progress/fsrs.ts`, `progress/scheduler.ts`, `drills/select.ts` — schedules a
 * subject that is not language, with **no edits to those files**.
 *
 * The subject here is ear training: twelve interval classes, drilled by hearing
 * two notes and naming the gap. It is chosen because it is the case
 * `framework.md` §4 says to try first — a small closed set of durable subjects,
 * which is the shape `drills/select.ts` was written for and nothing about it is
 * Spanish.
 *
 * **Pre-registered failure condition**, so the spike cannot succeed by
 * definition: if driving a full drill loop requires editing any Tier 1 file, the
 * tier table is wrong and the document gets corrected. Frictions that do *not*
 * count as failure, because they were predicted in advance: an `ExerciseKind`
 * with no honest value, and a cast to mint a branded id outside the dataset
 * build.
 *
 * Every import below is from `src/`, unmodified, at 5df0897.
 */

import { describe, expect, it } from 'vitest';

import { nextSubject } from '../../src/domain/drills/select';
import { fsrsScheduler, intervalDays } from '../../src/domain/progress/fsrs';
import type { Scheduler } from '../../src/domain/progress/scheduler';
import { newProgress, type SubjectProgress } from '../../src/domain/progress/types';
import type { EntityId, SkillId } from '../../src/domain/content/ids';
import { seededRng } from '../../src/utils/random';

// ---------------------------------------------------------------------------
// The subject. This is the whole of what a music app would have to supply.
// ---------------------------------------------------------------------------

/** A gap between two pitches, in semitones. The drill's `Target`. */
interface Interval {
  readonly semitones: number;
}

/**
 * The twelve interval classes, in teaching order rather than in semitone order.
 *
 * The order is load-bearing exactly as it is for numerals: `nextSubject` step 2
 * returns unmet subjects *in the order given*, so this is a curriculum. Octave
 * and fifth first because they are the easiest to hear; tritone and minor
 * seconds last.
 */
const INTERVALS: readonly { readonly slug: string; readonly semitones: number }[] = [
  { slug: 'octave', semitones: 12 },
  { slug: 'perfect-fifth', semitones: 7 },
  { slug: 'perfect-fourth', semitones: 5 },
  { slug: 'major-third', semitones: 4 },
  { slug: 'minor-third', semitones: 3 },
  { slug: 'major-sixth', semitones: 9 },
  { slug: 'minor-sixth', semitones: 8 },
  { slug: 'major-second', semitones: 2 },
  { slug: 'major-seventh', semitones: 11 },
  { slug: 'minor-seventh', semitones: 10 },
  { slug: 'minor-second', semitones: 1 },
  { slug: 'tritone', semitones: 6 },
];

/**
 * FRICTION 1 (predicted). Ids are branded and only the dataset build constructs
 * them, so a subject minted outside a build needs a cast. `parseEntityId`
 * accepts the shape — `core-music` matches the namespace pattern and `skill` is
 * already an entity kind — so this is a type-level obstacle only, not a
 * validation one.
 */
const subjectOf = (slug: string): SkillId => `core-music:skill:${slug}` as SkillId;

const SUBJECTS: readonly EntityId[] = INTERVALS.map((entry) => subjectOf(entry.slug));

/**
 * `DrillGuide<Interval>` — the second `Target`, which is the only thing that can
 * say whether generalising `NumeralGuide` is worth doing (`framework.md` §4.4).
 *
 * Written against that interface's five members without adjusting them, to see
 * whether they fit something that is not a number.
 */
const guide = {
  rules: INTERVALS.map((entry) => entry.slug),
  sampleFor: (rule: string): Interval => {
    const found = INTERVALS.find((entry) => entry.slug === rule);
    if (!found) throw new Error(`not an interval class: ${rule}`);
    return { semitones: found.semitones };
  },
  rulesFor: (target: Interval): readonly string[] =>
    INTERVALS.filter((entry) => entry.semitones === target.semitones).map((entry) => entry.slug),
  render: (target: Interval): string =>
    INTERVALS.find((entry) => entry.semitones === target.semitones)?.slug ?? '',
  parse: (text: string): Interval | null => {
    const found = INTERVALS.find((entry) => entry.slug === text.trim().toLowerCase());
    return found ? { semitones: found.semitones } : null;
  },
};

// ---------------------------------------------------------------------------
// The loop, driven through unmodified Tier 1.
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const T0 = 1_760_000_000_000;

/**
 * One answer, scheduled. Deliberately **not** `recordAttempt` — see FRICTION 2
 * in the final test. `Scheduler.review` is the whole of what scheduling needs
 * and it takes no exercise kind at all.
 */
function answer(
  progress: SubjectProgress | undefined,
  subject: EntityId,
  grade: 'again' | 'hard' | 'good' | 'easy',
  now: number,
  scheduler: Scheduler = fsrsScheduler,
): SubjectProgress {
  return scheduler.review(progress ?? newProgress(subject, now), grade, now);
}

describe('spike: an interval drill on unmodified Tier 1', () => {
  it('mints a subject id the content id scheme already accepts', () => {
    // `newProgress` calls `packIdOf`, so a bad shape would silently drop the
    // pack and this is the cheapest place to notice.
    const row = newProgress(subjectOf('perfect-fifth'), T0);
    expect(row.packId).toBe('core-music');
    expect(row.status).toBe('new');
  });

  it('teaches unmet intervals in curriculum order, not id order', () => {
    const rng = seededRng(7);
    const progress = new Map<EntityId, SubjectProgress>();

    // Nothing practised: step 2 of `nextSubject` should hand back the first
    // unmet subject in the order given. Alphabetical would start at `major-second`.
    expect(nextSubject(SUBJECTS, progress, T0, rng)).toBe(subjectOf('octave'));

    progress.set(subjectOf('octave'), answer(undefined, subjectOf('octave'), 'good', T0));
    expect(nextSubject(SUBJECTS, progress, T0, rng)).toBe(subjectOf('perfect-fifth'));
  });

  it('schedules a real FSRS interval and brings the subject back when it is due', () => {
    const rng = seededRng(7);
    const subject = subjectOf('tritone');
    const progress = new Map<EntityId, SubjectProgress>();

    const first = answer(undefined, subject, 'good', T0);
    progress.set(subject, first);

    expect(first.stability).toBeGreaterThan(0);
    expect(first.dueAt).toBeGreaterThan(T0);
    expect(first.status).toBe('learning');

    // Before it is due, an unmet subject outranks it (step 2 beats step 3).
    expect(nextSubject(SUBJECTS, progress, T0 + 60_000, rng)).toBe(subjectOf('octave'));

    // Due, and now the only subject with a record: step 1 must return it.
    const due = first.dueAt ?? 0;
    expect(nextSubject([subject], progress, due + 1, rng)).toBe(subject);
  });

  it('grows the interval across successful reviews and collapses it on a lapse', () => {
    const subject = subjectOf('perfect-fifth');
    let row = answer(undefined, subject, 'good', T0);
    const firstStability = row.stability ?? 0;

    let now = T0;
    for (let review = 0; review < 4; review += 1) {
      now = (row.dueAt ?? now) + DAY;
      row = answer(row, subject, 'good', now);
    }

    expect(row.stability ?? 0).toBeGreaterThan(firstStability);
    expect(row.streak).toBe(5);
    expect(intervalDays(row.stability ?? 0)).toBeGreaterThan(1);

    const lapsed = answer(row, subject, 'again', (row.dueAt ?? now) + DAY);
    expect(lapsed.stability ?? 0).toBeLessThan(row.stability ?? 0);
    expect(lapsed.streak).toBe(0);
  });

  it('runs a twelve-interval drill for fifty answers without an item, a pack or a sentence', () => {
    const rng = seededRng(11);
    const progress = new Map<EntityId, SubjectProgress>();
    const asked: string[] = [];
    let now = T0;

    for (let turn = 0; turn < 50; turn += 1) {
      const subject = nextSubject(SUBJECTS, progress, now, rng);
      expect(subject).toBeDefined();
      if (!subject) break;

      // The drill's own half: the subject names a rule, the guide makes a target.
      const rule = subject.split(':')[2] ?? '';
      const target = guide.sampleFor(rule);
      // What the learner heard, and what an attempt on it is evidence about.
      expect(guide.rulesFor(target)).toContain(rule);
      expect(guide.parse(guide.render(target))).toEqual(target);
      asked.push(rule);

      // Tritones are hard; everything else is answered correctly.
      const grade = rule === 'tritone' ? 'again' : 'good';
      progress.set(subject, answer(progress.get(subject), subject, grade, now));
      now += 20_000;
    }

    // Every interval got taught, and the one being failed came back most.
    expect(new Set(asked).size).toBe(12);
    const tritones = asked.filter((rule) => rule === 'tritone').length;
    expect(tritones).toBeGreaterThan(1);
    for (const row of progress.values()) expect(row.packId).toBe('core-music');
  });

  it('FRICTION 2: the attempt log demands an exerciseKind an interval drill has not got', async () => {
    // Scheduling needed none of this. `recordAttempt` is the *logging* path, and
    // `AttemptInput.exerciseKind` is a closed enum of six language interactions:
    // listen-repeat, reveal, think-say, multiple-choice, cloze-choice,
    // tap-to-build. An ear-training drill is none of them — the nearest honest
    // name would be `listen-identify`, which does not exist.
    const { EXERCISE_KINDS } = await import('../../src/domain/exercises/types');
    expect(EXERCISE_KINDS).not.toContain('listen-identify');

    // So this is the one place a music app cannot reuse Tier 2 as it stands. It
    // is a field on a record, not a rule in the scheduler, which is why the loop
    // above ran without it.
    const { recordAttempt } = await import('../../src/domain/progress/tracker');
    const { progress, attempt } = recordAttempt(
      undefined,
      {
        subject: subjectOf('tritone'),
        // Wrong, and recorded here as the finding rather than hidden behind a
        // helper: the log now claims the learner was shown four choices.
        exerciseKind: 'multiple-choice',
        grade: 'good',
      },
      T0,
      fsrsScheduler,
      seededRng(3),
    );

    expect(progress.packId).toBe('core-music');
    expect(attempt.exerciseKind).toBe('multiple-choice');
  });
});
