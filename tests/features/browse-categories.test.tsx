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

async function openFilters(user = userEvent.setup()) {
  await user.click(screen.getByRole('button', { name: /^Filters:/ }));
  return within(screen.getByRole('dialog', { name: 'Filter results' }));
}

/** Surfaces the router's current URL, since MemoryRouter never touches window. */
function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

describe('browsing by category', () => {
  it('shows a tile per category, under the group heading the pack declared', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openFilters();

    expect(categories().getByRole('button', { name: /Food and drink/ })).toBeInTheDocument();
    expect(categories().getByRole('heading', { name: 'Everyday life' })).toBeInTheDocument();
  });

  it('names the size of a category on its tile', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openFilters();

    // The count is in the accessible name, not just the pixels: whether a
    // category is worth opening has to reach a screen reader and an agent too.
    expect(
      categories().getByRole('button', { name: 'Food and drink, 4 items' }),
    ).toBeInTheDocument();
  });

  it('hides a category that has no content yet', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openFilters();

    // Declared in the fixture manifest, used by nothing. A tile leading to an
    // empty list is worse than not offering the category yet.
    expect(categories().queryByRole('button', { name: /Colours/ })).not.toBeInTheDocument();
  });

  it('filters the results and reports the selection as ARIA state', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    expect(await screen.findByRole('status')).toHaveTextContent('7 items');
    await openFilters(user);

    const tile = categories().getByRole('button', { name: /Food and drink/ });
    await user.click(tile);

    expect(tile).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('status')).toHaveTextContent('4 items');
  });

  it('keeps detailed choices out of the page until the filter sheet opens', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    expect(screen.queryByRole('region', { name: 'Categories' })).not.toBeInTheDocument();
    await openFilters();
    expect(categories().getByRole('button', { name: /Food and drink/ })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Topic' })).not.toBeInTheDocument();
  });

  it('summarises the selected category on the collapsed control', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openFilters(user);

    await user.click(categories().getByRole('button', { name: /Food and drink/ }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(
      screen.getByRole('button', { name: 'Filters: Food and drink, 1 active' }),
    ).toBeInTheDocument();
  });

  it('clears the category when its tile is pressed again', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openFilters(user);

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
    await openFilters(user);

    await user.click(categories().getByRole('button', { name: /Food and drink/ }));
    await user.click(screen.getByRole('button', { name: 'Practise these' }));

    // Built through `sessionPath`, so the session screen reads what was picked
    // rather than silently practising the whole pack.
    expect(screen.getByTestId('where').textContent).toContain('topic=food-drink');
  });

  it('shows a category label rather than its slug', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openFilters();

    expect(categories().getByRole('button', { name: /Food and drink/ })).toBeInTheDocument();
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

  it('leaves scrolling to the containing sheet', () => {
    const pane = block('.pane');
    expect(pane).not.toMatch(/max-height:/);
    expect(pane).not.toMatch(/overflow-y:/);
  });

  it('does not create sticky headings inside a second scroll surface', () => {
    const heading = block('.groupHeading');
    expect(heading).not.toMatch(/position:\s*sticky/);
    expect(heading).toMatch(/background:/);
  });
});

/**
 * Word kinds: the way to pull up "the nouns" and study them as a batch.
 *
 * Only the kinds the packs have something for are offered — the same rule the
 * category tiles follow, and the reason a pack that grows adverbs gets the
 * option without a code change.
 */
describe('browsing by word kind', () => {
  it('offers the kinds the pack has, and nothing it does not', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openFilters();

    const kinds = await screen.findByLabelText('Word kind');
    const offered = [...kinds.querySelectorAll('option')].map((option) => option.textContent);

    // The fixture carries one verb lexeme and four nouns, and no adjectives.
    expect(offered).toEqual(['Any word kind', 'Verbs', 'Nouns']);
  });

  it('narrows to one kind', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openFilters(user);

    await user.selectOptions(await screen.findByLabelText('Word kind'), 'NOUN');

    expect(screen.getByText('4 items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About “cerveza”' })).toBeInTheDocument();
  });

  /**
   * Told to shorten a search they never typed, a learner has no way to find out
   * that it was the two filters together that came to nothing.
   */
  it('blames the filters, not a search, when the filters are what emptied it', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openFilters(user);

    await user.selectOptions(await screen.findByLabelText('Type'), 'word');
    await user.selectOptions(screen.getByLabelText('Word kind'), 'VERB');

    expect(screen.getByText(/matches those filters yet/)).toBeInTheDocument();
    expect(screen.queryByText(/shorter search/)).not.toBeInTheDocument();
  });
});
