/**
 * A progress row that is not about an item, and every screen that must not
 * notice it.
 *
 * `SubjectProgress.subject` widened past `ItemId` so that a drill can record
 * evidence against the pattern it exercises. The risk that widening creates is
 * not that a drill fails — it is that a *pattern* leaks into somewhere shaped
 * for items and nothing looks wrong: a due count that includes something the
 * session planner cannot deal, a review session that plans a card for a skill
 * id, a "words to revisit" list with a blank row in it.
 *
 * The claim under test is that this is prevented **by construction** rather than
 * by remembering. Home, Progress and Study all narrow through the course's item
 * ids, and `itemProgressIn` is where that narrowing lives. These tests exist so
 * that a future screen reading `progress.all()` directly fails here rather than
 * in front of a learner.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EntityId, ItemId } from '../../src/domain/content';
import { itemProgressIn, newProgress, type SubjectProgress } from '../../src/domain/progress';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { ProgressScreen } from '../../src/features/progress/ProgressScreen';
import { createMemoryStorage, type LearnerStorage } from '../../src/storage';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const PATTERN = id<EntityId>('test-es:skill:numerals-y-joining');
const ITEM = id<ItemId>('test-es:item:001');

/** Due a long time ago, so nothing about the clock decides these tests. */
const overdue = (subject: EntityId): SubjectProgress => ({
  ...newProgress(subject),
  status: 'review',
  attempts: 4,
  correct: 1,
  incorrect: 3,
  stability: 1,
  dueAt: 1_000,
  updatedAt: 1_000,
});

async function withDrillHistory(): Promise<LearnerStorage> {
  const storage = createMemoryStorage();
  await storage.progress.put(overdue(PATTERN));
  await storage.attempts.append({
    id: 'a-pattern',
    subject: PATTERN,
    exerciseKind: 'think-say',
    grade: 'again',
    at: 1_000,
  });
  return storage;
}

describe('itemProgressIn', () => {
  it('keeps rows about items in the set, and drops everything else', () => {
    const outside = id<ItemId>('test-es:item:999');
    const rows = [overdue(PATTERN), overdue(ITEM), overdue(outside)];

    const found = itemProgressIn(rows, new Set([ITEM]));

    expect([...found.keys()]).toEqual([ITEM]);
  });

  /**
   * Two different reasons to drop a row, and both have to hold: a pattern is not
   * an item *and* would not be in the set anyway. Asserted separately because a
   * membership test alone would pass today and quietly stop being enough the
   * moment something puts a non-item id into a course's id set.
   */
  it('drops a pattern even when the set claims to contain it', () => {
    const pretend = new Set([PATTERN as unknown as ItemId]);

    expect(itemProgressIn([overdue(PATTERN)], pretend).size).toBe(0);
  });
});

describe('a drill’s history on the item-shaped screens', () => {
  it('is not counted as due on Home', async () => {
    renderWithServices(<HomeScreen />, {
      services: testServices({ storage: await withDrillHistory() }),
      route: '/es/all',
    });

    await screen.findByRole('heading', { level: 1 });
    // The review action is offered only when something the planner can deal is
    // due. A pattern is overdue in the store and must not produce one.
    expect(screen.queryByRole('button', { name: /Review \d+ due/ })).not.toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('does not appear among the sentences to revisit', async () => {
    renderWithServices(<ProgressScreen />, {
      services: testServices({ storage: await withDrillHistory() }),
      route: '/es/all/progress',
    });

    await screen.findByRole('heading', { level: 1 });
    // The weakest-items panel renders a row per progress record it is given, so
    // a pattern reaching it would be a row with no text in it.
    expect(screen.queryByText(/Sentences to revisit/)).not.toBeInTheDocument();
  });
});
