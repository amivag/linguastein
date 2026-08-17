/** Tapping a word inside a phrase opens its meaning, grammar and forms. */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { renderWithServices } from '../fixtures/services';

describe('word inspection', () => {
  it('opens a panel with meaning, grammar, pattern and other forms', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: '/session?preset=flashcards&size=items:1' });

    const word = await screen.findByRole('button', { name: 'About “Tengo”' });
    await user.click(word);

    const panel = await screen.findByRole('dialog', { name: 'About Tengo' });
    expect(panel).toHaveTextContent('to have');
    expect(panel).toHaveTextContent('1st sg · present');
    expect(panel).toHaveTextContent('tener que + infinitivo');
    // Other forms of the same verb — the "variations" of tener.
    expect(panel).toHaveTextContent('tienes');
    expect(panel).toHaveTextContent('tenemos');
    // Another phrase that uses the word.
    expect(panel).toHaveTextContent('Tengo que irme.');

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves punctuation inert', async () => {
    renderWithServices(<SessionScreen />, { route: '/session?preset=flashcards&size=items:1' });

    await screen.findByRole('button', { name: 'About “Tengo”' });
    expect(screen.queryByRole('button', { name: 'About “.”' })).not.toBeInTheDocument();
  });

  it('keeps words locked until a multiple-choice question is answered', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: '/session?preset=vocabulary&size=items:1' });

    const choices = await screen.findAllByRole('button', { name: /beer|water|bread|coffee/ });
    expect(screen.queryByRole('button', { name: /^About/ })).not.toBeInTheDocument();

    await user.click(choices[0]!);
    // Vocabulary items carry no tokens, so nothing becomes tappable — but the
    // answer state is what gates it, not the exercise being over.
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('keeps the details below the card shut until the answer is in', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: '/session?preset=vocabulary&size=items:1' });

    // The block lists example sentences beside their translations, so on a
    // graded card it hands over the answer the engine is about to check.
    const choices = await screen.findAllByRole('button', { name: /beer|water|bread|coffee/ });
    expect(screen.queryByText('Copy & share')).not.toBeInTheDocument();

    await user.click(choices[0]!);
    expect(await screen.findByText('Copy & share')).toBeInTheDocument();
  });

  it('leaves the details open on a self-rated card', async () => {
    renderWithServices(<SessionScreen />, { route: '/session?preset=flashcards&size=items:1' });

    await screen.findByRole('button', { name: 'Reveal' });
    expect(screen.getByText('Copy & share')).toBeInTheDocument();
  });
});
