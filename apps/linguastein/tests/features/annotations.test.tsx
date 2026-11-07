/**
 * The facets of a phrase, told apart by more than reading them.
 *
 * A practice card can show five things *about* a phrase at once — what it means,
 * an authored note, what it lets you do, who you may say it to, where it is
 * said. They used to be five runs of muted small text in a column, so finding
 * the one you wanted meant reading all five.
 *
 * Each facet now carries a hue and a glyph. The hue is the part a test cannot
 * see through jsdom and does not need to: `tests/a11y/contrast.test.ts` already
 * holds every `--color-kind-N` against its own tint, and
 * `tests/styles/semantics.test.ts` holds the assignment. What is asserted here
 * is the half that makes the colour legal — **every facet says its own name**, so
 * a learner who cannot separate two hues reads exactly what everyone else reads.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { renderWithServices } from '../fixtures/services';

/** The first card of a self-rated session: `Tengo que trabajar.`, which the
 *  fixture gives a note, a skill and an example. */
const FIRST_CARD = '/session?preset=flashcards&size=items:1&order=sequential';

describe('the facets of a card', () => {
  it('names the English as the meaning rather than tinting it like a verdict', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: FIRST_CARD });

    await user.click(await screen.findByRole('button', { name: 'Reveal' }));

    /*
     * The label is the assertion, and `--color-success` going away is the reason
     * for it: a revealed translation used to be green, which rule 5 reserves for
     * a verdict — something the app just decided about an answer. A meaning is
     * not a verdict, and on a graded card the green said it was.
     */
    const meaning = screen.getByText('I have to work.');
    expect(meaning.parentElement).toHaveTextContent('Meaning');
  });

  it('separates the note, the abilities and the examples by name', async () => {
    renderWithServices(<SessionScreen />, { route: FIRST_CARD });

    /*
     * Found by their labels rather than by their text, which is the point: the
     * note on this item and the skill it names are the *same string*
     * (`tener que + infinitivo`), and before the labels existed there was nothing
     * on the card to say why it appeared twice.
     */
    const note = (await screen.findByText('Note')).parentElement!;
    expect(note).toHaveTextContent('tener que + infinitivo');

    // What the phrase lets a learner do. One label for the group rather than one
    // per row: these are facets of the same claim.
    const ability = screen.getByText('Ability').parentElement!;
    expect(ability).toHaveTextContent('tener que + infinitivo');
    expect(ability).not.toBe(note);

    // An example sentence, which is a list of separate things rather than facets
    // of one claim, and so is not labelled as a group. Its words are still
    // tappable — which is why it is found by one of them.
    expect(
      screen.getByRole('button', { name: 'About “irme” in “Tengo que irme.”' }),
    ).toBeInTheDocument();
  });

  it('says who you would say a phrase to, and how it sounds', async () => {
    renderWithServices(<BrowseScreen />, { route: '/browse?sort=az' });

    const question = (await screen.findByText('¿Tienes tiempo?')).closest('li')!;
    const usage = within(question).getByRole('list', { name: 'Usage' });

    // `tú` and `casual` are two different facts about one phrase, and each is
    // spelled out beside its own glyph. Neither is inferable from the other:
    // plenty of `usted` speech is casual, and plenty of `tú` speech is not.
    expect(usage).toHaveTextContent('tú');
    expect(usage).toHaveTextContent('casual');

    // The hue arrives as an attribute rather than an inline colour, which is
    // what lets `surfaces.module.css` stay the only place a number becomes a
    // pair of colours.
    const kinds = [...usage.querySelectorAll('[data-kind]')].map((badge) =>
      badge.getAttribute('data-kind'),
    );
    expect(kinds).toHaveLength(2);
    expect(new Set(kinds).size).toBe(2);
  });
});
