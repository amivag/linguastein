/**
 * Looking a word up from Home.
 *
 * The app could already *filter* — Browse narrows a sheet of cards by substring
 * — and could not answer "what is this word". The two are different questions and
 * these are the parts of the second one that are easy to get wrong twice: that it
 * reads both languages, that it resolves a form a learner actually typed, that a
 * query is an address, and that the course survey comes back when the box is
 * cleared.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { renderWithServices } from '../fixtures/services';

/** Surfaces the router's current URL so a rewrite can be asserted on. */
function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

const where = () => screen.getByTestId('where').textContent ?? '';

function home(route = '/') {
  return renderWithServices(
    <>
      <HomeScreen />
      <Where />
    </>,
    { route },
  );
}

const box = () => screen.getByRole('searchbox');
const wordEntries = () => screen.queryAllByRole('article');

async function type(text: string) {
  const user = userEvent.setup();
  await user.type(box(), text);
  return user;
}

describe('the box itself', () => {
  it('names both languages, because it searches both', () => {
    home();

    expect(screen.getByLabelText('Search Spanish or English')).toBe(box());
  });

  it('is on Home before anything is typed', () => {
    home();

    expect(box()).toHaveValue('');
    expect(wordEntries()).toHaveLength(0);
  });
});

describe('what a lookup answers', () => {
  it('gives a headword its meaning, kind and gender', async () => {
    home();
    await type('cerveza');

    const entry = within(wordEntries()[0]!);
    expect(entry.getByRole('heading', { level: 3 })).toHaveTextContent('cerveza');
    expect(entry.getByText('beer')).toBeInTheDocument();
    expect(entry.getByText('noun')).toBeInTheDocument();
    // `la`, not "feminine": `GrammarTags` shows the article, which is the form a
    // learner actually has to produce.
    expect(entry.getByText('la')).toBeInTheDocument();
  });

  /**
   * The case the app could not answer at all before: surfaces were resolved at
   * build time onto tokens, so a *typed* `tengo` reached nothing.
   */
  it('resolves a conjugated form, and says which form was typed', async () => {
    home();
    await type('tengo');

    const entry = within(wordEntries()[0]!);
    expect(entry.getByRole('heading', { level: 3 })).toHaveTextContent('tener');
    expect(entry.getByText(/^you typed/)).toHaveTextContent('tengo');
  });

  it('searches the reference language too', async () => {
    home();
    await type('water');

    expect(within(wordEntries()[0]!).getByRole('heading', { level: 3 })).toHaveTextContent('agua');
  });

  it('answers each word of a phrase separately', async () => {
    home();
    await type('cerveza agua');

    const headwords = wordEntries().map(
      (entry) => within(entry).getByRole('heading', { level: 3 }).textContent,
    );
    expect(headwords).toEqual(['cerveza', 'agua']);
  });

  it('shows the sentence itself when the query is one', async () => {
    home();
    await type('Tengo que trabajar.');

    expect(screen.getByRole('heading', { name: 'Phrases' })).toBeInTheDocument();
    expect(screen.getByText('I have to work.')).toBeInTheDocument();
  });

  /**
   * Regression, and a sharp one: trimming the query on its way into the URL threw
   * away a trailing space between keystrokes, so the next letter landed against
   * the previous word and no phrase could be typed at all.
   */
  it('lets a learner type a space', async () => {
    home();
    await type('cerveza agua');

    expect(box()).toHaveValue('cerveza agua');
  });

  it('offers somewhere to go for the words it found', async () => {
    home();
    await type('tener');

    expect(screen.getByRole('heading', { name: 'Where this is taught' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Un día de trabajo/ })).toBeInTheDocument();
  });

  /**
   * Two dead ends that need different next moves: nothing exists for this, and
   * this is not spelled the way the pack spells it.
   */
  it('says what it could not find rather than going blank', async () => {
    home();
    await type('xyzzy');

    expect(screen.getByText(/Nothing found for/)).toBeInTheDocument();
    expect(wordEntries()).toHaveLength(0);
  });
});

describe('a query is an address', () => {
  it('writes what was typed into the URL', async () => {
    home();
    await type('agua');

    expect(where()).toContain('q=agua');
  });

  it('answers a link that arrives with a query already in it', () => {
    home('/?q=cerveza');

    expect(box()).toHaveValue('cerveza');
    expect(within(wordEntries()[0]!).getByRole('heading', { level: 3 })).toHaveTextContent(
      'cerveza',
    );
  });

  it('leaves the query out of a bare address', () => {
    home();

    expect(where()).not.toContain('q=');
  });
});

describe('the course survey', () => {
  /**
   * Replaced rather than pushed down: nothing in the survey is about the word
   * being looked up, so leaving it above the answer buries it.
   */
  it('gives way to the results while a search is live', async () => {
    home();
    expect(screen.getByRole('button', { name: /Free practice/ })).toBeInTheDocument();

    await type('agua');

    expect(screen.queryByRole('button', { name: /Free practice/ })).not.toBeInTheDocument();
  });

  it('comes back when the box is cleared', async () => {
    home('/?q=agua');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(box()).toHaveValue('');
    expect(wordEntries()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Free practice/ })).toBeInTheDocument();
  });
});
