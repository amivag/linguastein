/**
 * Browsing alphabetically: the letter index, and the sort.
 *
 * Both exist because a pack is now long enough that "scroll until you see it" is
 * not a way to find a word. They are deliberately two controls rather than one:
 * a letter narrows *which* items there are, so it belongs in the filter and in
 * the session link, and a sort only decides what order they are dealt in here.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { renderWithServices } from '../fixtures/services';

function letters() {
  return within(screen.getByRole('region', { name: 'Letters' }));
}

async function openLetters(user = userEvent.setup()) {
  await user.click(screen.getByRole('button', { name: /^Filters:/ }));
  return letters();
}

/** The target-language line of each result, in the order they are rendered. */
function shown(): string[] {
  const list = screen.getByRole('list', { name: 'Results' });
  return [...list.querySelectorAll('p[lang="es"]')].map((line) => (line.textContent ?? '').trim());
}

describe('the letter index', () => {
  it('offers the letters the course has content under, and no others', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await screen.findByRole('searchbox');
    const index = await openLetters();

    // A, C, P, T — plus the explicit reset. The fixture has nothing under B,
    // and a chip leading to an empty list is worse than not offering the letter.
    expect(
      index
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['Any', 'A', 'C', 'P', 'T']);
  });

  it('names the size of a letter, since that is what decides the tap', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await openLetters();

    // The count is in the accessible name rather than on the chip: twenty-six
    // pills each carrying a number is a paragraph of digits.
    expect(await screen.findByRole('button', { name: 'Starting with C, 2 items' })).toBeVisible();
  });

  it('filters the results and reports the selection as ARIA state', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    const index = await openLetters(user);
    const chip = index.getByRole('button', { name: /Starting with C/ });
    await user.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('status')).toHaveTextContent('2 items');
    expect(
      screen.getByRole('button', { name: 'Filters: Starts with C, 1 active' }),
    ).toBeInTheDocument();
    expect(shown()).toEqual(['cerveza', 'café']);
  });

  it('files a question under its first word, not its punctuation', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    const index = await openLetters(user);
    await user.click(index.getByRole('button', { name: /Starting with T/ }));

    // `¿Tienes tiempo?` is a T, which is where a learner reading it would look.
    expect(shown()).toContain('¿Tienes tiempo?');
    expect(await screen.findByRole('status')).toHaveTextContent('3 items');
  });

  it('clears the letter when its chip is pressed again', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    const index = await openLetters(user);
    const chip = index.getByRole('button', { name: /Starting with C/ });
    await user.click(chip);
    await user.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(await screen.findByRole('status')).toHaveTextContent('7 items');
  });

  it('also provides a visible reset for the current letter', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse?initial=c' });

    const index = await openLetters(user);
    const any = index.getByRole('button', { name: 'Any starting letter' });
    expect(any).toHaveAttribute('aria-pressed', 'false');
    await user.click(any);

    expect(any).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('status')).toHaveTextContent('7 items');
  });
});

describe('LetterIndex.module.css', () => {
  const css = readFileSync(
    resolve(process.cwd(), 'src/features/browse/LetterIndex.module.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  it('lays letters out as a grid without a horizontal scroller', () => {
    expect(css).toMatch(/grid-template-columns:/);
    expect(css).not.toMatch(/overflow-x\s*:/);
    expect(css).not.toMatch(/overscroll-behavior-x\s*:/);
  });
});

describe('sorting', () => {
  it('leads with the pack’s own order, which is a teaching order', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse' });
    await screen.findByRole('searchbox');

    expect(screen.getByLabelText('Sort')).toHaveValue('pack');
    expect(shown()[0]).toBe('Tengo que trabajar.');
  });

  it('sorts alphabetically, ignoring accents and opening punctuation', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    await user.selectOptions(await screen.findByLabelText('Sort'), 'az');

    expect(shown()).toEqual([
      'agua',
      'café',
      'cerveza',
      'pan',
      'Tengo que irme.',
      'Tengo que trabajar.',
      // Last, not first: the letter index files it under T, and a list ordered
      // by its punctuation would disagree with its own index.
      '¿Tienes tiempo?',
    ]);
  });

  it('reverses without changing which items are listed', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    await user.selectOptions(await screen.findByLabelText('Sort'), 'za');

    expect(shown()[0]).toBe('¿Tienes tiempo?');
    expect(await screen.findByRole('status')).toHaveTextContent('7 items');
  });

  it('orders what the filters left, rather than the whole pack', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    await user.click(await screen.findByRole('button', { name: /^Filters:/ }));
    const filters = within(screen.getByRole('dialog', { name: 'Filter results' }));
    await user.selectOptions(filters.getByLabelText('Type'), 'word');
    await user.selectOptions(screen.getByLabelText('Sort'), 'az');

    expect(shown()).toEqual(['agua', 'café', 'cerveza', 'pan']);
  });
});
