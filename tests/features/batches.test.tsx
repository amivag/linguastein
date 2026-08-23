/**
 * The three surfaces a batch has: made on Browse, listed on Study, resumed on
 * Home.
 *
 * What each of them has to get right is different. Browse must freeze the sheet
 * the learner is actually looking at. Study must not offer a section that opens
 * an empty page, and must say that practising a set records — the rest of that
 * screen promises the opposite. Home must not let a set displace due reviews,
 * because items outside a set keep coming due while a learner drills one.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { BatchDefinition } from '../../src/domain/batches';
import type { ItemId } from '../../src/domain/content';
import { newItemProgress } from '../../src/domain/progress';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { StudyScreen } from '../../src/features/study/StudyScreen';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

const item = (n: string) => id<ItemId>(`test-es:item:${n}`);

function batch(overrides: Partial<BatchDefinition> = {}): BatchDefinition {
  return {
    id: 'batch-1',
    label: 'Words · Nouns',
    course: { language: 'es', level: 'a1' },
    itemIds: [item('001'), item('002')],
    createdAt: 1_700_000_000_000,
    perSession: 10,
    ...overrides,
  };
}

/** Surfaces the router's URL so a navigation can be asserted on. */
function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

const where = () => screen.getByTestId('where').textContent ?? '';

describe('making a set on Browse', () => {
  /**
   * The set is frozen from the *sorted* list, which is the distinction worth
   * testing: which items a set holds is the filter's answer, and the order they
   * are dealt in is the session's. A learner reading an A–Z sheet and asking for
   * its first two means those two.
   */
  it('freezes the sheet on screen, in the order shown', async () => {
    const user = userEvent.setup();
    const saveBatch = vi.fn();
    const { unmount } = renderWithServices(
      <>
        <BrowseScreen />
        <Where />
      </>,
      { route: '/es/all/browse?type=word&sort=az', saveBatch },
    );

    await user.click(await screen.findByRole('button', { name: 'Save as a set' }));
    await user.click(screen.getByRole('button', { name: /^All \d+$/ }));

    expect(saveBatch).toHaveBeenCalledTimes(1);
    const ascending = saveBatch.mock.calls[0]?.[0] as BatchDefinition;
    // Named after the filter, so a learner recognises which sheet it came from.
    expect(ascending.label).toMatch(/words/i);
    expect(ascending.itemIds.length).toBeGreaterThan(1);
    expect(ascending.course.language).toBe('es');
    // Straight to the list, so the press has a visible result.
    expect(where()).toContain('/study?tab=batches');

    // Saved from the sorted list, not from pack order: the same sheet under the
    // opposite sort freezes the same items the other way round. Which items a
    // set holds is the filter's answer; the order shown is what the learner
    // pointed at when they asked for "the first N".
    unmount();
    renderWithServices(<BrowseScreen />, {
      route: '/es/all/browse?type=word&sort=za',
      saveBatch,
    });
    await user.click(await screen.findByRole('button', { name: 'Save as a set' }));
    await user.click(screen.getByRole('button', { name: /^All \d+$/ }));

    const descending = saveBatch.mock.calls[1]?.[0] as BatchDefinition;
    expect(descending.itemIds).toEqual([...ascending.itemIds].reverse());
  });

  /** A size bigger than the sheet is not offered; the whole sheet always is. */
  it('offers only sizes the sheet can fill', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/es/all/browse?type=word&topic=food-drink' });

    await user.click(await screen.findByRole('button', { name: 'Save as a set' }));

    // The fixture matches four items on this filter.
    expect(screen.getByRole('button', { name: 'All 4' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'First 10' })).not.toBeInTheDocument();
  });
});

describe('listing sets on Study', () => {
  it('offers no Sets section until there is a set', async () => {
    renderWithServices(<StudyScreen />, { route: '/es/all/study' });

    const tabs = within(await screen.findByRole('navigation', { name: 'Study sections' }));
    expect(tabs.queryByRole('link', { name: /sets/i })).not.toBeInTheDocument();
  });

  it('lists a set with how much of it has landed', async () => {
    renderWithServices(<StudyScreen />, {
      services: testServices({ batches: [batch()] }),
      route: '/es/all/study?tab=batches',
    });

    const link = await screen.findByRole('link', { name: /Words · Nouns/ });
    // The standing is inside the link's own text: a list of links called
    // "Practise" gives a screen reader and an agent nothing to choose between.
    expect(link).toHaveAccessibleName(/0 of 2 absorbed/);
    expect(link).toHaveAttribute('href', expect.stringContaining('batch=batch-1'));
  });

  /**
   * The rest of Study promises nothing is recorded. A set feeds the scheduler, so
   * the section has to qualify that promise rather than quietly break it — the
   * same thing the missions note already does.
   */
  it('says that practising a set is recorded', async () => {
    renderWithServices(<StudyScreen />, {
      services: testServices({ batches: [batch()] }),
      route: '/es/all/study?tab=batches',
    });

    const heading = await screen.findByRole('heading', { name: /^sets$/i, level: 2 });
    expect(heading.closest('section')?.textContent).toMatch(/recorded/i);
  });

  it('reports material the current course cannot reach', async () => {
    const wider = batch({ itemIds: [item('001'), id<ItemId>('test-fr:item:001')] });
    renderWithServices(<StudyScreen />, {
      services: testServices({ batches: [wider] }),
      route: '/es/all/study?tab=batches',
    });

    expect(await screen.findByText(/1 outside this course/)).toBeInTheDocument();
  });
});

describe('resuming a set on Home', () => {
  /**
   * The one ordering rule that matters. FSRS items outside a set keep coming due
   * while a learner drills it, so a set that took the primary action would build
   * exactly the review debt that gets people to stop.
   */
  it('never displaces due reviews as the leading action', async () => {
    const services = testServices({ batches: [batch()] });
    await services.storage.progress.put({
      ...newItemProgress(item('003')),
      status: 'review',
      attempts: 3,
      correct: 3,
      stability: 2,
      dueAt: Date.now() - 60_000,
    });

    renderWithServices(<HomeScreen />, { services, route: '/es/all' });

    expect(await screen.findByRole('button', { name: /Review 1 due/ })).toBeInTheDocument();
    // Still offered, just not first.
    expect(screen.getByRole('button', { name: /Continue Words · Nouns/ })).toBeInTheDocument();
  });

  it('resumes the set at its own slot size', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <HomeScreen />
        <Where />
      </>,
      { services: testServices({ batches: [batch({ perSession: 5 })] }), route: '/es/all' },
    );

    await user.click(await screen.findByRole('button', { name: /Continue Words · Nouns/ }));

    expect(where()).toContain('batch=batch-1');
    expect(where()).toContain('size=items%3A5');
  });

  /**
   * A finished set is finished. Re-offering it would be the app asking for work
   * it has already decided was absorbed — which is why `nextBatchStanding`
   * deliberately does not fall back to the last one the way missions do.
   */
  it('stops offering a set once it is absorbed', async () => {
    const services = testServices({ batches: [batch({ itemIds: [item('001')] })] });
    const DAY = 86_400_000;
    await services.storage.progress.put({
      ...newItemProgress(item('001')),
      status: 'review',
      attempts: 4,
      correct: 4,
      stability: 30,
    });
    for (const at of [Date.now() - 3 * DAY, Date.now() - 2 * DAY]) {
      await services.storage.attempts.append({
        id: `a-${at}`,
        itemId: item('001'),
        exerciseKind: 'think-say',
        grade: 'good',
        at,
      });
    }

    renderWithServices(<HomeScreen />, { services, route: '/es/all' });

    await screen.findByRole('heading', { level: 1 });
    expect(
      screen.queryByRole('button', { name: /Continue Words · Nouns/ }),
    ).not.toBeInTheDocument();
  });
});
