/**
 * What the Progress screen counts, and whose history it shows.
 *
 * Every other panel on the screen is already narrowed to the course: progress
 * rows carry item ids, and an item id carries its pack, so a Spanish learner's
 * accuracy is not diluted by French items they have never met. Recent sessions
 * was the exception, because a finished session is counts and timestamps — there
 * was nothing in the row to narrow *by* until it started recording its course.
 */

import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ProgressScreen } from '../../src/features/progress/ProgressScreen';
import { newProgress } from '../../src/domain/progress';
import { createMemoryStorage, type LearnerStorage } from '../../src/storage';
import type { PackId } from '../../src/domain/content';
import { id, multilingualRepository } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const STARTED_AT = 1_700_000_000_000;

/** One Spanish session and one French one, plus enough progress to leave the empty state. */
async function storageWithBothLanguages(): Promise<LearnerStorage> {
  const storage = createMemoryStorage();
  const spanish = multilingualRepository()
    .query({ packs: [id<PackId>('test-es')] })
    .map((item) => item.id);

  await storage.progress.put({
    ...newProgress(spanish[0]!, STARTED_AT),
    status: 'review',
    attempts: 1,
    correct: 1,
  });

  await storage.sessions.put({
    id: 'es-1',
    course: { language: 'es', level: 'all' },
    startedAt: STARTED_AT,
    planned: 3,
    completed: 3,
    correct: 3,
  });
  await storage.sessions.put({
    id: 'fr-1',
    course: { language: 'fr', level: 'all' },
    startedAt: STARTED_AT + 1_000,
    planned: 5,
    completed: 5,
    correct: 5,
  });

  return storage;
}

describe('recent sessions', () => {
  it('shows this course’s history and not another language’s', async () => {
    const services = testServices({
      repository: multilingualRepository(),
      storage: await storageWithBothLanguages(),
    });

    renderWithServices(
      <Routes>
        <Route path="/:language/:level/progress" element={<ProgressScreen />} />
      </Routes>,
      { services, route: '/es/all/progress' },
    );

    expect(await screen.findByText(/3\/3 correct/)).toBeInTheDocument();
    // The French session is newer, so an unscoped page of five would lead with it.
    expect(screen.queryByText(/5\/5 correct/)).not.toBeInTheDocument();
  });
});
