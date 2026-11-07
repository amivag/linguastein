/** The FSRS scheduler, through its public contract only. */
import { describe, expect, it } from 'vitest';
import { fsrsScheduler, intervalDays, isDue, retrievability, type MemoryState } from '../src';

const DAY = 86_400_000;

const fresh: MemoryState = {
  status: 'new',
  attempts: 0,
  correct: 0,
  incorrect: 0,
  difficulty: 0.3,
  streak: 0,
};

function after(grades: readonly ('again' | 'hard' | 'good' | 'easy')[], gapDays = 3): MemoryState {
  let state = fresh;
  let now = 0;
  for (const grade of grades) {
    state = fsrsScheduler.review(state, grade, now);
    now += gapDays * DAY;
  }
  return state;
}

describe('retrievability and intervals', () => {
  it('is certain at no elapsed time, falls with time, and is zero with no memory', () => {
    expect(retrievability(0, 5)).toBe(1);
    expect(retrievability(10, 5)).toBeLessThan(retrievability(1, 5));
    expect(retrievability(3, 0)).toBe(0);
  });

  it('waits longer for a stronger memory, and less for a higher retention target', () => {
    expect(intervalDays(20)).toBeGreaterThan(intervalDays(5));
    expect(intervalDays(20, 0.95)).toBeLessThan(intervalDays(20, 0.8));
  });
});

describe('fsrsScheduler.review', () => {
  it('counts the attempt, and an easier first answer starts a stronger memory', () => {
    const good = fsrsScheduler.review(fresh, 'good', 0);
    const easy = fsrsScheduler.review(fresh, 'easy', 0);

    expect(good).toMatchObject({ attempts: 1, correct: 1, incorrect: 0, streak: 1 });
    expect(easy.stability!).toBeGreaterThan(good.stability!);
    expect(good.status).toBe('learning');
  });

  it('grows the memory on spaced successes, faster for easy than for hard', () => {
    const hard = after(['good', 'hard']);
    const good = after(['good', 'good']);
    const easy = after(['good', 'easy']);

    expect(hard.stability!).toBeLessThan(good.stability!);
    expect(easy.stability!).toBeGreaterThan(good.stability!);
  });

  it('shortens the memory on a lapse, resets the streak and brings it back soon', () => {
    const before = after(['good', 'good', 'good']);
    const lapsed = fsrsScheduler.review(before, 'again', 20 * DAY);

    expect(lapsed.stability!).toBeLessThanOrEqual(before.stability!);
    expect(lapsed).toMatchObject({ streak: 0, status: 'learning', incorrect: 1 });
    expect(lapsed.dueAt! - 20 * DAY).toBeLessThan(DAY);
  });

  it('reaches review and then mastered on a run of long, successful gaps', () => {
    const states = [after(['good', 'good'], 10), after(['easy', 'easy', 'easy', 'easy'], 40)];

    expect(states[0]!.status).toBe('review');
    expect(states[1]!.status).toBe('mastered');
  });

  it('schedules the next review in the future, which is when it becomes due', () => {
    const reviewed = fsrsScheduler.review(fresh, 'good', 0);

    expect(isDue(reviewed, 0)).toBe(false);
    expect(isDue(reviewed, reviewed.dueAt!)).toBe(true);
  });
});
