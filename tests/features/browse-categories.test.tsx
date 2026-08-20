/**
 * Browsing by theme.
 *
 * The topic filter always existed, buried in an unlabelled `<select>` of slugs
 * that nobody would find. The picker is the discoverable half; these tests hold
 * that it writes the *same* filter state as that select — a second source of
 * truth is exactly the bug `session-url.ts` was written to prevent — and that
 * the chosen category survives into the session the screen offers.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { renderWithServices } from '../fixtures/services';

function categories() {
  return within(screen.getByRole('region', { name: 'Categories' }));
}

/** Surfaces the router's current URL, since MemoryRouter never touches window. */
function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

describe('browsing by category', () => {
  it('shows a tile per category, under the group heading the pack declared', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    expect(categories().getByRole('button', { name: /Food and drink/ })).toBeInTheDocument();
    expect(categories().getByRole('heading', { name: 'Everyday life' })).toBeInTheDocument();
  });

  it('names the size of a category on its tile', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    // The count is in the accessible name, not just the pixels: whether a
    // category is worth opening has to reach a screen reader and an agent too.
    expect(
      categories().getByRole('button', { name: 'Food and drink, 4 items' }),
    ).toBeInTheDocument();
  });

  it('hides a category that has no content yet', () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    // Declared in the fixture manifest, used by nothing. A tile leading to an
    // empty list is worse than not offering the category yet.
    expect(categories().queryByRole('button', { name: /Colours/ })).not.toBeInTheDocument();
  });

  it('filters the results and reports the selection as ARIA state', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    expect(await screen.findByRole('status')).toHaveTextContent('7 items');

    const tile = categories().getByRole('button', { name: /Food and drink/ });
    await user.click(tile);

    expect(tile).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('status')).toHaveTextContent('4 items');
  });

  it('keeps the compact topic control inside the categories block', () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    // The select is the tiles' compact half, not a fifth entry in the row of
    // narrowing filters: the pane scrolls, so this is what still names the
    // chosen category when its tile is out of view.
    expect(categories().getByRole('combobox', { name: 'Topic' })).toBeInTheDocument();
  });

  it('keeps the picker and the topic select on one piece of state', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    await user.click(categories().getByRole('button', { name: /Food and drink/ }));
    expect(screen.getByRole('combobox', { name: 'Topic' })).toHaveValue('food-drink');

    // …and the other way round, so neither control can be the stale one.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Topic' }), 'work');
    expect(categories().getByRole('button', { name: /Food and drink/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(categories().getByRole('button', { name: /^Work/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('clears the category when its tile is pressed again', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    const tile = categories().getByRole('button', { name: /Food and drink/ });
    await user.click(tile);
    await user.click(tile);

    expect(tile).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByRole('status')).toHaveTextContent('7 items');
  });

  it('carries the category into the session it offers', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <BrowseScreen />
        <Where />
      </>,
      { route: '/browse' },
    );

    await user.click(categories().getByRole('button', { name: /Food and drink/ }));
    await user.click(screen.getByRole('button', { name: 'Practise these' }));

    // Built through `sessionPath`, so the session screen reads what was picked
    // rather than silently practising the whole pack.
    expect(screen.getByTestId('where').textContent).toContain('topic=food-drink');
  });

  it('shows a category label rather than its slug', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    const topics = screen.getByRole('combobox', { name: 'Topic' });
    expect(within(topics).getByRole('option', { name: 'Food and drink' })).toBeInTheDocument();
  });
});

/**
 * The filters' height must not be a function of how much the pack declares.
 * Thirty-five tiles laid out in full pushed the results themselves off the
 * screen, and every category added afterwards pushed them further. jsdom has no
 * layout, so the box is asserted against the stylesheet — the approach
 * `hover-states.test.ts` takes to the cascade.
 */
describe('CategoryPicker.module.css', () => {
  const css = readFileSync(
    resolve(process.cwd(), 'src/features/browse/CategoryPicker.module.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  /** Declaration block of the rule whose selector contains `needle`. */
  function block(needle: string): string {
    const rule = css.split('}').find((part) => part.includes(needle) && part.includes('{'));
    return rule?.slice(rule.indexOf('{') + 1) ?? '';
  }

  it('confines the tiles to a box of a fixed height, and scrolls the rest', () => {
    const pane = block('.pane');
    expect(pane).toMatch(/max-height:/);
    expect(pane).toMatch(/overflow-y:\s*auto/);
  });

  it('keeps a group heading visible while its own tiles scroll past', () => {
    const heading = block('.groupHeading');
    expect(heading).toMatch(/position:\s*sticky/);
    // Without a background of its own it would be a heading with tiles sliding
    // through it, which is worse than no sticky heading at all.
    expect(heading).toMatch(/background:/);
  });
});
