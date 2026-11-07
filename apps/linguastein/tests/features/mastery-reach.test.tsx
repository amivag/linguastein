/**
 * What the "Words & skills" rows say about *how* a word has been recalled.
 *
 * `strength` is one number and cannot tell a word recognised among four options
 * from the same word produced from nothing — which is the difference a learner
 * acts on. Stage C of `docs/tasks/retrieval-evidence.md`: the row names the
 * hardest mode passed, and says nothing at all where there is no evidence to
 * name, because a row practised before evidence was recorded has not shown that
 * the word was never produced.
 */

import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { newProgress, type SubjectProgress } from '../../src/domain/progress';
import { ProgressScreen } from '../../src/features/progress/ProgressScreen';
import { createMemoryStorage } from '../../src/storage';
import { id, testRepository } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const AT = 1_700_000_000_000;
const passed = (correct = 3) => ({ attempts: correct, correct, lastAt: AT });

/** Both fixture sentences that use `tener`, so the word clears the mastery floor. */
function rows(evidence?: SubjectProgress['evidence']): readonly SubjectProgress[] {
  return ['001', '002'].map((local) => ({
    ...newProgress(id<ItemId>(`test-es:item:${local}`), AT),
    status: 'review' as const,
    attempts: 4,
    correct: 4,
    stability: 20,
    ...(evidence ? { evidence } : {}),
  }));
}

/**
 * The rows themselves, as text.
 *
 * Asserted on `textContent` rather than through `getByText` because the row is
 * several spans and a conditional fragment — and scoped to the list rather than
 * the section, because the caption below it explains what the three words mean
 * and would satisfy every query in here on its own.
 */
async function renderRows(evidence?: SubjectProgress['evidence']): Promise<string> {
  const storage = createMemoryStorage();
  for (const row of rows(evidence)) await storage.progress.put(row);

  renderWithServices(
    <Routes>
      <Route path="/:language/:level/progress" element={<ProgressScreen />} />
    </Routes>,
    {
      services: testServices({ repository: testRepository(), storage }),
      route: '/es/all/progress',
    },
  );

  const heading = await screen.findByRole('heading', { name: /words & skills/i });
  const section = heading.closest('section');
  if (!section) throw new Error('the Words & skills heading is not inside a section');

  return within(section)
    .getAllByRole('listitem')
    .map((row) => row.textContent ?? '')
    .join(' | ');
}

describe('the reach shown beside a word', () => {
  it('names the hardest mode the learner has passed', async () => {
    const text = await renderRows({ recognition: passed(), 'cued-recall': passed() });

    expect(text).toMatch(/· recalled ·/);
    expect(text).not.toMatch(/produced/);
  });

  it('says produced once the word has been produced', async () => {
    const text = await renderRows({ recognition: passed(), production: passed() });

    expect(text).toMatch(/· produced ·/);
  });

  it('claims nothing for a word practised before evidence was recorded', async () => {
    const text = await renderRows();

    // The rows are strong by every other measure, so they are on screen and it
    // is only the middle term that is missing.
    expect(text).toMatch(/seen in 2 sentences/);
    expect(text).not.toMatch(/recognised|recalled|produced/);
  });
});
