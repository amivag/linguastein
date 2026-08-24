/**
 * What a `?batch=` link actually practises.
 *
 * A batch is the first thing a *learner* authors that a session link points at,
 * and the id travels rather than the items — so the resolution the screen does
 * is the whole contract, exactly as it is for `?passage=`. The three cases here
 * are the three a stale link can be in: resolving, unknown, and known but
 * pointing outside the course.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BatchDefinition } from '../../src/domain/batches';
import type { ItemId } from '../../src/domain/content';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { id, multilingualRepository } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const item = (n: string) => id<ItemId>(`test-es:item:${n}`);

function batch(overrides: Partial<BatchDefinition> = {}): BatchDefinition {
  return {
    id: 'batch-1',
    label: 'Two useful phrases',
    course: { language: 'es', level: 'a1' },
    itemIds: [item('001'), item('002')],
    createdAt: 1_000,
    ...overrides,
  };
}

const renderSession = (
  search: string,
  batches: readonly BatchDefinition[],
  overrides: Parameters<typeof testServices>[0] = {},
) =>
  renderWithServices(<SessionScreen />, {
    services: testServices({ batches, ...overrides }),
    route: `/es/all/session?${search}`,
  });

const total = async () => (await screen.findByRole('progressbar')).getAttribute('aria-valuemax');

describe('a session over a batch', () => {
  /**
   * The size asked for ten and the batch holds two, so two is what the session
   * may deal. A link that quietly practised the other items in the pack would be
   * the `ids`-dropped bug that `session-url.ts` exists to prevent, in a new
   * place.
   */
  it('plans exactly the batch, not the pack around it', async () => {
    renderSession('preset=flashcards&batch=batch-1&size=items:10', [batch()]);

    expect(await total()).toBe('2');
  });

  /**
   * Degrade to broader, never to empty — the rule the whole module is built on.
   * A learner who followed a link from a device where they had deleted the batch
   * should get a session, not a dead end.
   */
  it('widens rather than empties when no such batch exists', async () => {
    renderSession('preset=flashcards&batch=gone&size=items:10', [batch()]);

    // The test pack has more than the two items the batch named.
    expect(Number(await total())).toBeGreaterThan(2);
  });

  /**
   * The one case that must *not* widen. Practising the whole pack is not what
   * the link asked for, and "nothing to practise here yet" would send the
   * learner looking for content when the fix is to switch course.
   *
   * Both packs are loaded on purpose: the French item genuinely exists, so this
   * is a batch that is out of *scope* rather than one that points at nothing —
   * which is the case a learner actually reaches by switching course.
   */
  it('says so when the batch belongs to another course', async () => {
    const french = batch({
      id: 'batch-fr',
      label: 'French phrases',
      course: { language: 'fr', level: 'all' },
      itemIds: [id<ItemId>('test-fr:item:101')],
    });
    renderSession('preset=flashcards&batch=batch-fr&size=items:10', [french], {
      repository: multilingualRepository(),
    });

    expect(
      await screen.findByText(/None of “French phrases” is part of this course/),
    ).toBeInTheDocument();
  });
});
