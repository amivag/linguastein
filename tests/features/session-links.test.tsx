/**
 * What the buttons that start a session actually start.
 *
 * Each of these once promised something the session did not deliver: "Practise
 * these" dropped every filter, and "Review N due" planned an ordinary session
 * that could be mostly unseen material. The screen only ever read three
 * parameters, so a caller could append one that nothing consumed — these tests
 * assert the promise and the plan agree.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { newItemProgress } from '../../src/domain/progress';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { ProgressScreen } from '../../src/features/progress/ProgressScreen';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

/** Surfaces the router's current URL so a navigation can be asserted on. */
function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

const where = () => screen.getByTestId('where').textContent ?? '';

/** One item due for review, and one never seen. */
async function servicesWithDueItem() {
  const services = testServices();
  await services.storage.progress.put({
    ...newItemProgress(id<ItemId>('test-es:item:001')),
    status: 'review',
    attempts: 3,
    correct: 3,
    stability: 2,
    dueAt: Date.now() - 60_000,
  });
  return services;
}

describe('Browse → session', () => {
  it('practises the filtered set, not the whole pack', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <BrowseScreen />
        <Where />
      </>,
      { route: '/browse' },
    );

    await user.selectOptions(await screen.findByDisplayValue('Everything'), 'word');
    await user.selectOptions(screen.getByDisplayValue('Any topic'), 'food-drink');
    expect(screen.getByText('4 items')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Practise these' }));

    const url = new URLSearchParams(where().split('?')[1]);
    expect(url.get('type')).toBe('word');
    expect(url.get('topic')).toBe('food-drink');
    // Four matched, so four is what the session may offer.
    expect(url.get('size')).toBe('items:4');
  });

  it('carries the search text too, since that is part of "these"', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <BrowseScreen />
        <Where />
      </>,
      { route: '/browse' },
    );

    await user.type(await screen.findByLabelText('Search Spanish or English'), 'café');
    await user.click(screen.getByRole('button', { name: 'Practise these' }));

    expect(new URLSearchParams(where().split('?')[1]).get('q')).toBe('café');
  });

  it('offers studying the set as well as practising it', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <BrowseScreen />
        <Where />
      </>,
      { route: '/browse' },
    );

    await user.click(await screen.findByRole('button', { name: 'Study these' }));

    expect(new URLSearchParams(where().split('?')[1]).get('preset')).toBe('flashcards');
  });
});

describe('a filtered session', () => {
  it('plans only the items the link asked for', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=quick&size=items:10&type=word&topic=food-drink',
    });

    // Four words carry that topic; the three sentences must not be planned.
    expect(await screen.findByText('1/4')).toBeInTheDocument();
  });
});

describe('review due', () => {
  it('reviews exactly the due items from Progress', async () => {
    const user = userEvent.setup();
    const services = await servicesWithDueItem();

    renderWithServices(
      <>
        <ProgressScreen />
        <Where />
      </>,
      { services, route: '/progress' },
    );

    await user.click(await screen.findByRole('button', { name: 'Review 1 due' }));

    const url = new URLSearchParams(where().split('?')[1]);
    expect(url.get('due')).toBe('1');
    expect(url.get('size')).toBe('items:1');
  });

  it('offers the same review from home, where the due count is shown', async () => {
    const user = userEvent.setup();
    const services = await servicesWithDueItem();

    renderWithServices(
      <>
        <HomeScreen />
        <Where />
      </>,
      { services, route: '/' },
    );

    await user.click(await screen.findByRole('button', { name: 'Review 1 due' }));

    expect(new URLSearchParams(where().split('?')[1]).get('due')).toBe('1');
  });

  it('plans the due item and nothing else', async () => {
    const services = await servicesWithDueItem();

    renderWithServices(<SessionScreen />, {
      services,
      route: '/session?preset=quick&size=items:10&due=1',
    });

    // One item is due; the other six must not be padded in.
    expect(await screen.findByText('1/1')).toBeInTheDocument();
  });
});
