/**
 * The journey on Home, as a strip you can move through.
 *
 * Home used to show one card — the next rung — with the whole ladder in Study.
 * The strip keeps the recommendation and makes the rest reachable without
 * leaving the screen, so what is worth pinning is that both halves are true: it
 * opens on what the app suggests and says so, *and* every other mission is
 * genuinely there rather than hidden behind a widget.
 *
 * The scroll positions are deliberately not asserted. jsdom has no layout, so
 * every width is zero and `scrollTo` does not exist — a test written against
 * them would pass on numbers that mean nothing. What it can hold is the part a
 * learner actually reads: which card is announced, which controls are offered,
 * and where a card's button goes.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import {
  loadCatalog,
  loadPack,
  loadTranslationUnit,
  type DatasetSource,
} from '../../src/data/loaders';
import { ContentRepository } from '../../src/domain/content';
import { renderWithServices, testServices } from '../fixtures/services';

const packRoot = resolve(process.cwd(), 'public/packs');
const packSource: DatasetSource = {
  name: packRoot,
  read: (path) => readFile(resolve(packRoot, path), 'utf8'),
};

/**
 * The shipped pack, for the one case that needs more than two missions.
 *
 * The fixture authors two, and against two every clamp looks like every other
 * clamp: one press and two presses both land on the last card, so a test written
 * against it would pass whether or not the strip advanced twice. Thirteen
 * missions is what makes `3 of 13` mean something.
 */
async function shippedServices() {
  const catalog = await loadCatalog(packSource);
  const loaded = await Promise.all(
    catalog.packs.map((entry) => loadPack(packSource, entry.manifest)),
  );
  const units = await Promise.all(
    (catalog.translations ?? []).map((entry) => loadTranslationUnit(packSource, entry.manifest)),
  );
  const repository = ContentRepository.from(loaded.map((result) => result.pack));
  for (const unit of units) repository.addTranslations(unit.translations);

  return testServices({ repository });
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}</output>;
}

const strip = () => screen.getByRole('group', { name: 'The mission journey' });
const cards = () => within(strip()).getAllByRole('listitem');
const readout = () => screen.getByText(/^\d+ of \d+$/).textContent;

describe('the mission strip', () => {
  it('offers every mission the course has, not only the next one', async () => {
    renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });

    // The fixture authors two missions against the passages it holds.
    expect(cards()).toHaveLength(2);
    // Each card's button names its own mission: thirteen identical `Begin
    // mission` rows would be unusable in a screen reader's control list, which
    // is the list a learner choosing between them is reading.
    expect(screen.getByRole('button', { name: /Begin Describe your morning/ })).toBeInTheDocument();
  });

  /**
   * The recommendation survives the strip.
   *
   * A picker that treats every card the same has thrown away the one thing the
   * adaptive path is for. `aria-current` is how that reaches a reader, since
   * "the card it happens to be scrolled to" is not something a screen reader
   * can convey.
   */
  it('marks the card the app recommends', async () => {
    renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });

    const current = cards().filter((card) => card.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(within(current[0]!).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Describe your morning',
    );
  });

  it('moves through the strip, and stops at both ends', async () => {
    const user = userEvent.setup();
    renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });

    expect(readout()).toBe('1 of 2');
    expect(screen.getByRole('button', { name: 'Previous mission' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next mission' }));
    expect(readout()).toBe('2 of 2');
    expect(screen.getByRole('button', { name: 'Next mission' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous mission' }));
    expect(readout()).toBe('1 of 2');
  });

  /**
   * Two presses move two cards.
   *
   * They did not: the handler read the current index out of the render it was
   * created in, so a second press before React had re-rendered computed the same
   * target as the first and the strip advanced once for two taps. Anyone
   * browsing thirteen missions taps that button repeatedly, so this is the
   * ordinary case rather than an edge one — and it is invisible in a screenshot,
   * which is how it survived being looked at.
   */
  it('advances once per press, however fast they come', async () => {
    // The shipped thirteen, so the assertion is about counting rather than
    // about the clamp — against the fixture's two, one press and two presses
    // both land on the last card and the bug survives the test.
    renderWithServices(<HomeScreen />, { services: await shippedServices(), route: '/es/a1' });
    await screen.findByRole('heading', { level: 1 });

    const next = screen.getByRole('button', { name: 'Next mission' });
    // The total is read rather than written down: it is however many missions
    // the shipped pack authors for this course, and this test is about the
    // number on the left.
    const total = readout()?.split(' of ')[1];
    expect(readout()).toBe(`1 of ${total}`);
    expect(Number(total)).toBeGreaterThan(3);

    /*
     * Two native clicks inside one `act`, which is the only way to reproduce
     * this. `userEvent.click` awaits its own work and lets React commit in
     * between, so two of those are two renders and the stale read never happens
     * — the first version of this test passed with the bug still in place.
     * Batched into one render, the second press sees whatever the first wrote.
     */
    await act(async () => {
      next.click();
      next.click();
      await Promise.resolve();
    });

    expect(readout()).toBe(`3 of ${total}`);
  });

  it('opens the mission whose card was chosen', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <HomeScreen />
        <Where />
      </>,
      { route: '/es/a1' },
    );
    await screen.findByRole('heading', { level: 1 });

    const second = cards()[1]!;
    await user.click(within(second).getByRole('button'));

    // Not the recommended one: choosing a card is the point of the strip.
    expect(screen.getByTestId('where')).toHaveTextContent('/mission/');
    expect(screen.getByTestId('where')).not.toHaveTextContent('morning-routine');
  });

  /**
   * A strip that only a swipe can move is a strip half the people using it
   * cannot move at all.
   *
   * axe reports this as `scrollable-region-focusable`, and it is the commonest
   * way a carousel is unusable rather than merely awkward: no pointer gesture,
   * no keyboard route, no content.
   */
  it('lets the keyboard reach the strip itself', async () => {
    renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });

    expect(strip()).toHaveAttribute('tabindex', '0');
  });

  /**
   * Review still leads when something is due.
   *
   * The strip is where the alternatives live, not a reason to stop making a
   * recommendation — so a learner with reviews waiting opens on those, and the
   * missions are one press away rather than gone.
   */
  it('leads with review when anything is due', async () => {
    const services = testServices();
    const itemId = (await services.repository.allItems())[0]!.id;
    await services.storage.progress.put({
      itemId,
      status: 'review',
      attempts: 1,
      correct: 1,
      incorrect: 0,
      difficulty: 0.5,
      hintsUsed: 0,
      streak: 1,
      updatedAt: 0,
      dueAt: 0,
    });

    renderWithServices(<HomeScreen />, { services });
    await screen.findByRole('heading', { level: 1 });

    const first = cards()[0]!;
    expect(within(first).getByRole('heading', { level: 3 })).toHaveTextContent('Keep it fresh');
    expect(first).toHaveAttribute('aria-current', 'step');
    // And the missions are still in the strip behind it.
    expect(cards().length).toBeGreaterThan(1);
  });
});
