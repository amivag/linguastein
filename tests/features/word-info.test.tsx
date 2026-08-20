/** Tapping a word — inside a phrase, or a word card — opens its meaning,
 *  grammar and forms. */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { renderWithServices } from '../fixtures/services';

describe('word inspection', () => {
  it('opens a panel with meaning, grammar, pattern and other forms', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

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

  it('keeps the way out in the header rather than at the end of the entry', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

    await user.click(await screen.findByRole('button', { name: 'About “Tengo”' }));
    const panel = await screen.findByRole('dialog', { name: 'About Tengo' });

    // The header is outside the scrolling region, so a verb with nine forms and
    // four examples cannot push the way out below the fold. jsdom has no layout
    // to measure, but the structure the layout rests on is checkable.
    const close = within(panel).getByRole('button', { name: 'Close' });
    expect(close.closest('header')).toBe(panel.querySelector('header'));

    await user.click(close);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('names the form in the phrase rather than only tinting it', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

    await user.click(await screen.findByRole('button', { name: 'About “Tengo”' }));
    const panel = await screen.findByRole('dialog', { name: 'About Tengo' });

    // Colour is never the only signal: the current card carries the fact as text.
    const marker = within(panel).getByText('the form in this phrase');
    expect(marker.closest('li')).toHaveTextContent('tengo');
  });

  it('leaves punctuation inert', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

    await screen.findByRole('button', { name: 'About “Tengo”' });
    expect(screen.queryByRole('button', { name: 'About “.”' })).not.toBeInTheDocument();
  });

  /**
   * A meaning-recognition card withholds the *meaning*, not the words.
   *
   * Locking the words themselves made the one screen a learner is actually
   * studying on the only place in the app where "what is this word?" had no
   * answer. What the card grades is still safe: the gloss waits, and the part of
   * speech, the gender and the other forms — which answer nothing this card is
   * asking — do not.
   */
  it('withholds the meaning, not the word, while a multiple choice is live', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=vocabulary&size=items:1&order=sequential',
    });

    await user.click(await screen.findByRole('button', { name: 'About “cerveza”' }));
    const panel = await screen.findByRole('dialog', { name: 'About cerveza' });

    expect(panel).toHaveTextContent('noun');
    expect(panel).toHaveTextContent('feminine');
    // Said out loud, so an empty entry does not read as an unknown word.
    expect(panel).toHaveTextContent('Meanings unlock once you answer.');
    expect(panel).not.toHaveTextContent('beer');

    await user.click(within(panel).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /^beer$/ }));
    await screen.findByRole('button', { name: 'Continue' });

    await user.click(screen.getByRole('button', { name: 'About “cerveza”' }));
    const answered = await screen.findByRole('dialog', { name: 'About cerveza' });
    expect(answered).toHaveTextContent('beer');
    expect(answered).not.toHaveTextContent('Meanings unlock');
  });

  /**
   * A word card carries a lexeme and no tokens, so there is no token to look up
   * and it used to render as inert text: the gloss, part of speech and gender
   * the dataset holds for it could not be reached from the card at all.
   */
  it('opens a word card itself, gender and all', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&type=word&size=items:1&order=sequential',
    });

    await user.click(await screen.findByRole('button', { name: 'About “cerveza”' }));

    const panel = await screen.findByRole('dialog', { name: 'About cerveza' });
    expect(panel).toHaveTextContent('beer');
    expect(panel).toHaveTextContent('noun');
    // Which of el or la it takes — the one piece of grammar a noun card has.
    expect(panel).toHaveTextContent('feminine');
    // Not "from cerveza": the card is already the lemma.
    expect(panel).not.toHaveTextContent('from cerveza');

    await user.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

    await screen.findByRole('button', { name: 'Reveal' });
    expect(screen.getByText('Copy & share')).toBeInTheDocument();
  });
});
