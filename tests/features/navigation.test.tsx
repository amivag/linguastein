/** The app shell: navigation between sections, and what each section shows. */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { ProgressScreen } from '../../src/features/progress/ProgressScreen';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import type { ItemId } from '../../src/domain/content';
import { newItemProgress } from '../../src/domain/progress';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

describe('navigation', () => {
  it('offers the main sections', async () => {
    renderWithServices(<HomeScreen />);

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const label of ['Practice', 'Read', 'Browse', 'Progress', 'Settings']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the current section for screen readers, not just with colour', async () => {
    renderWithServices(<BrowseScreen />, { route: '/es/all/browse' });

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Browse' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Practice' })).not.toHaveAttribute('aria-current');
  });

  it('hides the chrome during a practice session', async () => {
    renderWithServices(<SessionScreen />, { route: '/session?preset=flashcards&size=items:1' });

    await screen.findByRole('button', { name: 'Reveal' });
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});

describe('browse', () => {
  it('lists the pack and narrows it by search', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    expect(await screen.findByText('7 items')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'cerveza');
    expect(await screen.findByText('1 item')).toBeInTheDocument();
    expect(screen.getByText('beer')).toBeInTheDocument();
  });

  it('filters by type', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    await screen.findByText('7 items');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'word');
    expect(await screen.findByText('4 items')).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/browse' });

    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'zzzz');
    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
  });
});

describe('progress', () => {
  it('invites a first session when there is nothing to show', async () => {
    renderWithServices(<ProgressScreen />, { route: '/progress' });
    expect(await screen.findByText('No practice recorded yet.')).toBeInTheDocument();
  });

  it('summarises what has been practised', async () => {
    const services = testServices();
    const itemId = id<ItemId>('test-es:item:001');
    await services.storage.progress.put({
      ...newItemProgress(itemId),
      status: 'mastered',
      attempts: 4,
      correct: 3,
      incorrect: 1,
      difficulty: 0.8,
    });

    renderWithServices(<ProgressScreen />, { services, route: '/progress' });

    const stats = await screen.findByRole('list', { name: 'Overall progress' });
    expect(within(stats).getByText('items practised')).toBeInTheDocument();
    expect(within(stats).getByText('75%')).toBeInTheDocument();
    expect(await screen.findByText('Sentences to revisit')).toBeInTheDocument();
    // Mastery is reported for the word and the pattern, not only the sentence.
    expect(screen.getByText('Words & patterns')).toBeInTheDocument();
    expect(screen.getByText('tener que + infinitivo')).toBeInTheDocument();
    // The sentence renders as tappable words: "which word is the problem" is
    // exactly the question this list provokes.
    expect(
      screen.getByRole('button', { name: 'About “Tengo” in “Tengo que trabajar.”' }),
    ).toBeInTheDocument();
  });
});
