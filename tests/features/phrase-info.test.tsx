/**
 * Asking what a *phrase* means, and asking it in more of the app.
 *
 * Two separate gaps. Selection could only ever be one word, so a multi-token
 * annotation like `tener que + infinitivo` was unreachable as a unit. And
 * inspection existed only inside a practice card and a passage, so the two
 * screens where a learner is most likely to be reading — Browse and Progress —
 * had no way to ask at all.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExerciseEngine } from '../../src/domain/exercises';
import type { Exercise } from '../../src/domain/exercises';
import type { ItemId } from '../../src/domain/content';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { ExerciseView } from '../../src/features/practice/ExerciseView';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import type { SessionRunner } from '../../src/features/practice/useSessionRunner';
import { seededRng } from '../../src/utils/random';
import { id, testRepository } from '../fixtures/pack';
import { renderWithServices } from '../fixtures/services';

describe('selecting a phrase', () => {
  const openTengo = async (user: ReturnType<typeof userEvent.setup>) => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });
    await user.click(await screen.findByRole('button', { name: 'About “Tengo”' }));
    return screen.findByRole('dialog', { name: 'About Tengo' });
  };

  it('offers to grow the selection by the next word, naming it', async () => {
    const user = userEvent.setup();
    const panel = await openTengo(user);

    // The control says which word it would add, so it cannot mislead.
    expect(within(panel).getByRole('button', { name: 'Add “que” after' })).toBeInTheDocument();
    // Nothing before the first word, so no control for it.
    expect(within(panel).queryByRole('button', { name: /before$/ })).not.toBeInTheDocument();
  });

  it('explains the pattern once the phrase is selected', async () => {
    const user = userEvent.setup();
    const panel = await openTengo(user);

    await user.click(within(panel).getByRole('button', { name: 'Add “que” after' }));

    const phrase = await screen.findByRole('dialog', { name: 'About Tengo que' });
    expect(phrase).toHaveTextContent('tener que + infinitivo');
    // And still says what each word is, because "you have to" does not tell
    // anyone which of those words is `que`.
    expect(phrase).toHaveTextContent('Word by word');
    expect(phrase).toHaveTextContent('to have');
  });

  it('reports every selected word as expanded, not just the first', async () => {
    const user = userEvent.setup();
    const panel = await openTengo(user);
    await user.click(within(panel).getByRole('button', { name: 'Add “que” after' }));

    await screen.findByRole('dialog', { name: 'About Tengo que' });
    for (const word of ['Tengo', 'que']) {
      expect(screen.getByRole('button', { name: `About “${word}”` })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    }
    expect(screen.getByRole('button', { name: 'About “trabajar”' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('shrinks back to one word', async () => {
    const user = userEvent.setup();
    const panel = await openTengo(user);
    await user.click(within(panel).getByRole('button', { name: 'Add “que” after' }));

    const phrase = await screen.findByRole('dialog', { name: 'About Tengo que' });
    await user.click(within(phrase).getByRole('button', { name: 'One word' }));

    expect(await screen.findByRole('dialog', { name: 'About Tengo' })).toBeInTheDocument();
  });

  it('never offers to select the punctuation', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

    await user.click(await screen.findByRole('button', { name: 'About “trabajar”' }));
    const panel = await screen.findByRole('dialog', { name: 'About trabajar' });

    // `Tengo que trabajar .` would be nonsense, so the last word has no
    // control after it at all.
    expect(within(panel).queryByRole('button', { name: /＋$/ })).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Add “que” before' })).toBeInTheDocument();
  });

  it('leaves a word card without span controls, having nothing to grow into', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&type=word&size=items:1&order=sequential',
    });

    await user.click(await screen.findByRole('button', { name: 'About “cerveza”' }));
    const panel = await screen.findByRole('dialog', { name: 'About cerveza' });

    expect(within(panel).queryByText('Phrase')).not.toBeInTheDocument();
  });
});

/**
 * The cloze is the one machine-graded card whose prompt can open up before it is
 * answered: its answer is the *missing* word, which is drawn as the blank rather
 * than as a button. Quick practice leans on cloze, so this is most of what "not
 * available in quick practice" meant.
 */
describe('a cloze question', () => {
  function clozeExercise(): Exercise {
    const repository = testRepository();
    const item = repository.getItem(id<ItemId>('test-es:item:001'))!;
    const exercise = new ExerciseEngine().generate(item, 'cloze-choice', {
      repository,
      referenceLanguage: 'en',
      rng: seededRng(3),
    });
    if (!exercise) throw new Error('the fixture no longer supports a cloze');
    return exercise;
  }

  /** Enough of a runner for one card; the session loop is tested elsewhere. */
  const stubRunner = (): SessionRunner =>
    ({
      status: 'active',
      lastResult: null,
      submitAnswer: () => null,
      submitGrade: () => {},
      next: () => {},
      previous: () => {},
      restart: () => {},
    }) as unknown as SessionRunner;

  it('lets the words around the gap be opened while the question is live', async () => {
    const user = userEvent.setup();
    const exercise = clozeExercise();
    renderWithServices(<ExerciseView exercise={exercise} runner={stubRunner()} />);

    await user.click(await screen.findByRole('button', { name: 'About “que”' }));
    expect(await screen.findByRole('dialog', { name: 'About que' })).toBeInTheDocument();
  });

  it('keeps the blanked word out of reach, since it is the answer', async () => {
    const exercise = clozeExercise();
    renderWithServices(<ExerciseView exercise={exercise} runner={stubRunner()} />);

    await screen.findByRole('button', { name: 'About “que”' });
    // `Tengo` is what the card is asking for, so it is the blank, not a button.
    expect(screen.queryByRole('button', { name: 'About “Tengo”' })).not.toBeInTheDocument();
    expect(screen.getByText(/___/)).toBeInTheDocument();
  });
});

describe('the example sentences under a card', () => {
  /**
   * The examples are ordinary items. A word inside one being less answerable
   * than a word in the phrase above it is exactly the gap "meanings everywhere"
   * was asked to close.
   */
  it('opens a word of an example sentence', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

    // Item 001's example is item 002, `Tengo que irme.`
    await user.click(
      await screen.findByRole('button', { name: 'About “irme” in “Tengo que irme.”' }),
    );

    expect(await screen.findByRole('dialog', { name: 'About irme' })).toBeInTheDocument();
  });
});

describe('inspection outside a practice card', () => {
  /**
   * A list of sentences all containing `Tengo` would otherwise offer several
   * controls with one name, which neither a screen reader nor an agent can tell
   * apart — the problem the per-line play buttons in a passage already solved by
   * naming their line.
   */
  it('names a word by the phrase it is in, so a list stays pickable', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/es/all/browse' });

    await screen.findByText('7 items');
    await user.click(
      screen.getByRole('button', { name: 'About “Tengo” in “Tengo que trabajar.”' }),
    );

    const panel = await screen.findByRole('dialog', { name: 'About Tengo' });
    expect(panel).toHaveTextContent('to have');
  });

  it('opens a phrase from a Browse result', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/es/all/browse' });

    await screen.findByText('7 items');
    await user.click(
      screen.getByRole('button', { name: 'About “Tengo” in “Tengo que trabajar.”' }),
    );
    const panel = await screen.findByRole('dialog', { name: 'About Tengo' });
    await user.click(within(panel).getByRole('button', { name: 'Add “que” after' }));

    expect(await screen.findByRole('dialog', { name: 'About Tengo que' })).toHaveTextContent(
      'tener que + infinitivo',
    );
  });

  /**
   * Token ids are item-scoped — every sentence has a `t1` — so a selection that
   * did not remember its item would light up the first word of every row.
   */
  it('lights up one row of a list, not the same word in all of them', async () => {
    const user = userEvent.setup();
    renderWithServices(<BrowseScreen />, { route: '/es/all/browse' });

    await screen.findByText('7 items');
    const first = screen.getByRole('button', { name: 'About “Tengo” in “Tengo que trabajar.”' });
    const second = screen.getByRole('button', { name: 'About “Tengo” in “Tengo que irme.”' });

    await user.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(second).toHaveAttribute('aria-expanded', 'false');
  });
});
