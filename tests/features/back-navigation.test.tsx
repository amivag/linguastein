/**
 * Back, and what it is allowed to cost you.
 *
 * Browse and Read are sheets *inside* Study, so their Back button goes to Study
 * rather than into history: a learner who followed three category tiles should
 * not have to tap Back three times to leave. The bug was the other half of that
 * choice. Bare `/study` resolves to whichever section the course happens to
 * start with, so leaving a category landed you on Missions — Back undid the
 * navigation you made *and* the section switch above it, then dropped you on a
 * screen you had never asked for.
 *
 * The rule these hold: Back may cost one step. It may never cost two, and it may
 * never land somewhere the learner has not been.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { ReadScreen } from '../../src/features/read/ReadScreen';
import { StudyScreen } from '../../src/features/study/StudyScreen';
import { renderWithServices } from '../fixtures/services';

/** Surfaces the router's current URL, since MemoryRouter never touches window. */
function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

const where = () => screen.getByTestId('where').textContent ?? '';

function render(ui: React.ReactElement, route: string) {
  return renderWithServices(
    <>
      {ui}
      <Where />
    </>,
    { route },
  );
}

const goBack = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Go back' }));

describe('leaving a study sheet', () => {
  it('returns to the section that opened it', async () => {
    const user = userEvent.setup();
    render(<BrowseScreen />, '/es/all/browse?topic=food-drink&from=categories');

    await goBack(user);

    // Not bare `/study`, which would resolve to the first section this course
    // has — Missions — and so answer "back" with a screen nobody asked for.
    expect(where()).toContain('/study?tab=categories');
  });

  it('keeps the way back when the sheet itself is narrowed', async () => {
    const user = userEvent.setup();
    render(<BrowseScreen />, '/es/all/browse?from=categories');

    await user.click(screen.getByRole('button', { name: /^Filters:/ }));
    const filters = within(screen.getByRole('dialog', { name: 'Filter results' }));
    await user.selectOptions(filters.getByRole('combobox', { name: 'Type' }), 'word');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    // Using the screen must not make it forget where the learner came from:
    // every rewrite of the query is a `replace`, and it carries the origin.
    expect(where()).toContain('from=categories');
    await goBack(user);
    expect(where()).toContain('/study?tab=categories');
  });

  it('still leads out of a sheet reached without one', async () => {
    const user = userEvent.setup();
    render(<BrowseScreen />, '/es/all/browse?topic=food-drink');

    await goBack(user);

    // A shared link and a reload have no origin to carry, so Back degrades to
    // Study-wherever-it-opens rather than to nothing at all.
    expect(where()).toContain('/study');
    expect(where()).not.toContain('tab=');
  });

  it('ignores a section name it does not recognise', async () => {
    const user = userEvent.setup();
    render(<BrowseScreen />, '/es/all/browse?from=nonsense');

    await goBack(user);

    expect(where()).toContain('/study');
    expect(where()).not.toContain('nonsense');
  });

  it('returns from the reading list to the section that opened it', async () => {
    const user = userEvent.setup();
    render(<ReadScreen />, '/es/all/read?from=phrases');

    await goBack(user);

    expect(where()).toContain('/study?tab=phrases');
  });
});

describe('study links out to a sheet', () => {
  const study = (tab: string) =>
    renderWithServices(<StudyScreen />, { route: `/es/all/study?tab=${tab}` });

  it('tells a category sheet which section sent it there', async () => {
    study('categories');

    const tile = await screen.findByRole('link', { name: /Food and drink/ });
    expect(tile).toHaveAttribute('href', expect.stringContaining('from=categories'));
  });

  it('tells the reading list too', async () => {
    study('phrases');

    const tile = await screen.findByRole('link', { name: /Texts and dialogues/ });
    expect(tile).toHaveAttribute('href', expect.stringContaining('from=phrases'));
  });

  /**
   * Read off the open section rather than written out per link, so a section
   * added later carries the way back with no edit — and so no two links on the
   * same screen can disagree about where they came from.
   */
  it('names the open section, not the sheet, on every tile in it', async () => {
    study('words');

    const links = await screen.findAllByRole('link', { name: /\d/ });
    const sheets = links
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => href.includes('/browse'));

    expect(sheets.length).toBeGreaterThan(0);
    for (const href of sheets) expect(href).toContain('from=words');
  });
});
