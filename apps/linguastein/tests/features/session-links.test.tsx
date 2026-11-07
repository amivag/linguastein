/**
 * What the buttons that start a session actually start.
 *
 * Each of these once promised something the session did not deliver: "Practise
 * these" dropped every filter, and "Review N due" planned an ordinary session
 * that could be mostly unseen material. The screen only ever read three
 * parameters, so a caller could append one that nothing consumed — these tests
 * assert the promise and the plan agree.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/domain/content';
import { newProgress } from '../../src/domain/progress';
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
    ...newProgress(id<ItemId>('test-es:item:001')),
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

    await user.click(await screen.findByRole('button', { name: /^Filters:/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'word');
    await user.click(screen.getByRole('button', { name: /Food and drink/ }));
    expect(screen.getByText('4 items')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

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

  /**
   * A whole word kind is a set worth studying as a batch, so it has to survive
   * the trip into a session — a filter the screen shows but the link drops is
   * the exact failure "Practise these" started out with.
   */
  it('carries the word kind, so a batch of nouns practises nouns', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <BrowseScreen />
        <Where />
      </>,
      { route: '/browse' },
    );

    await user.click(await screen.findByRole('button', { name: /^Filters:/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Word kind' }), 'NOUN');
    expect(screen.getByText('4 items')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Practise these' }));
    expect(new URLSearchParams(where().split('?')[1]).get('pos')).toBe('noun');
  });

  /**
   * A letter is a filter like the others, so it has to reach the session: a
   * learner who pulled up the C words and pressed "Practise these" has said
   * which items they mean.
   */
  it('carries the letter an A to Z jump was made with', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <BrowseScreen />
        <Where />
      </>,
      { route: '/browse' },
    );

    await user.click(await screen.findByRole('button', { name: /^Filters:/ }));
    const filters = within(screen.getByRole('dialog', { name: 'Filter results' }));
    await user.click(filters.getByRole('button', { name: 'Starting with C, 2 items' }));
    await user.click(filters.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Practise these' }));

    const url = new URLSearchParams(where().split('?')[1]);
    expect(url.get('initial')).toBe('C');
    expect(url.get('size')).toBe('items:2');
  });

  it('plans the word kind the link names', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=quick&size=items:10&pos=verb',
    });

    // The two sentences annotated with a verb lexeme, and neither word card.
    expect(await screen.findByText('1/2')).toBeInTheDocument();
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

  it('plans only the letter the link names', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=quick&size=items:10&initial=c',
    });

    // `cerveza` and `café`, and neither of the T sentences. Lowercase in the
    // link on purpose: a hand-typed or stale letter is normalised rather than
    // dropped, which would silently plan the whole pack.
    expect(await screen.findByText('1/2')).toBeInTheDocument();
  });

  /**
   * A skill is the only thing in the pack that names a tense, so `?skill=` is
   * what makes "practise the preterite" expressible. The repository has
   * supported the filter all along; nothing could ask for it.
   */
  it('plans only the items carrying the skill the link names', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=quick&size=items:10&skill=tener-que',
    });

    // One of the seven items carries it, so the whole pack must not be planned.
    expect(await screen.findByText('1/1')).toBeInTheDocument();
  });

  it('widens rather than emptying when no loaded pack declares the skill', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=quick&size=items:10&skill=from-another-pack',
    });

    // The rule the whole module is built on: a stale link degrades to a broader
    // session, never to a blank screen that reads as a broken app.
    expect(await screen.findByText('1/7')).toBeInTheDocument();
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

/**
 * The other side of naming a session by its subject: a session that has no
 * subject keeps the preset as its name, because then that genuinely is what the
 * screen is. A header reading "Practice · Quick practice" would be the shape of
 * an answer with nothing in it.
 */
describe('a session with nothing in particular to name', () => {
  it('keeps the preset as its title, with no second line', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:2&order=sequential',
    });

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Flashcards');
    expect(document.title).toBe('Flashcards · Linguastein');
  });
});
