/** End-to-end wiring check: content → planner → engine → UI → stored progress. */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { renderWithServices, testServices } from '../fixtures/services';

describe('HomeScreen', () => {
  it('offers quick sessions and practice presets', async () => {
    renderWithServices(<HomeScreen />);

    expect(await screen.findByRole('heading', { name: 'Español' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 min' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Flashcards/ })).toBeInTheDocument();
    // The scope the buttons above will practise, stated where it is chosen.
    expect(screen.getByText(/Español · 7 items in scope/)).toBeInTheDocument();
  });
});

describe('SessionScreen', () => {
  /**
   * Flashcards are a study session: browsing, not testing. A self-rated reveal
   * is not evidence of retrieval, and Browse routes into this preset — so
   * flipping through cards must not move an item's schedule.
   */
  it('runs a flashcard session without recording anything', async () => {
    const user = userEvent.setup();
    const services = testServices();

    renderWithServices(<SessionScreen />, {
      services,
      route: '/session?preset=flashcards&size=items:2&order=sequential',
    });

    expect(await screen.findByText('1/2')).toBeInTheDocument();
    // The phrase renders as individually tappable words (see word-info tests).
    expect(screen.getByRole('button', { name: 'About “Tengo”' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.getByText('I have to work.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Good' }));
    expect(await screen.findByText('2/2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    // Studying is reported as a count, and says plainly that it did not count.
    expect(await screen.findByText(/not scored/)).toBeInTheDocument();
    expect(await services.storage.progress.all()).toHaveLength(0);
    expect(await services.storage.attempts.recent(5)).toHaveLength(0);
    expect(await services.storage.sessions.recent(5)).toHaveLength(0);
  });

  it('records a self-rated answer in a tracked session', async () => {
    const user = userEvent.setup();
    const services = testServices();

    renderWithServices(<SessionScreen />, {
      services,
      route: '/session?preset=listen&size=items:1',
    });

    // Listen & repeat is self-rated too — the audio-first loop of spec §4.2.
    await user.click(await screen.findByRole('button', { name: 'Meaning' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    await waitFor(async () => {
      expect(await services.storage.progress.all()).toHaveLength(1);
    });

    const [progress] = await services.storage.progress.all();
    expect(progress?.status).toBe('learning');
    expect(progress?.dueAt).toBeGreaterThan(Date.now());
    expect(await services.storage.attempts.recent(5)).toHaveLength(1);
  });

  it('grades a multiple-choice answer and moves on', async () => {
    const user = userEvent.setup();
    const services = testServices();

    renderWithServices(<SessionScreen />, {
      services,
      route: '/session?preset=vocabulary&size=items:1',
    });

    // A vocabulary item is shown in Spanish with four reference-language choices.
    expect(await screen.findByText('1/1')).toBeInTheDocument();
    const choices = await screen.findAllByRole('button', { name: /beer|water|bread|coffee/ });
    expect(choices).toHaveLength(4);

    await user.click(choices[0]!);

    expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
    await waitFor(async () => {
      expect(await services.storage.progress.all()).toHaveLength(1);
    });
  });
});
