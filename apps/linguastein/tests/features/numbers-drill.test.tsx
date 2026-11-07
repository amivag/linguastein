/**
 * The numbers drill, as a learner meets it.
 *
 * What is worth asserting here is the claim the whole feature rests on: an
 * answer about a number nobody authored lands as evidence about the **patterns**
 * that number puts to work. If that stopped being true the drill would still
 * look like it worked — questions, verdicts, a next number — while recording
 * nothing, or recording against the wrong thing.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StudyScreen } from '../../src/features/study/StudyScreen';
import { spellCardinal } from '../../src/languages/es/numerals';
import { createMemoryStorage, type LearnerStorage } from '../../src/storage';
import { renderWithServices, testServices } from '../fixtures/services';

const ROUTE = '/es/all/study?tab=numbers';

/** The number the drill is currently asking about, read off the screen. */
async function asked(): Promise<{ readonly value: number; readonly spoken: boolean }> {
  const digits = screen.queryByRole('status');
  const heard = screen.queryByRole('button', { name: 'Play the number again' });
  if (heard) return { value: NaN, spoken: true };
  const text = digits?.textContent ?? '';
  return { value: Number(text.replaceAll(/[^\d]/gu, '')), spoken: false };
}

async function openDrill(storage?: LearnerStorage) {
  const view = renderWithServices(<StudyScreen />, {
    ...(storage ? { services: testServices({ storage }) } : {}),
    route: ROUTE,
  });
  await screen.findByRole('heading', { name: /^numbers$/i, level: 2 });
  return view;
}

describe('the numbers section', () => {
  /**
   * Sized by whether the *language* has a numeral module, exactly as the
   * alphabet's tab is — not by how many numeral rows a pack happens to carry.
   */
  it('is offered for a language whose numerals the app can generate', async () => {
    renderWithServices(<StudyScreen />, { route: '/es/all/study' });

    const tabs = within(await screen.findByRole('navigation', { name: 'Study sections' }));
    expect(tabs.getByRole('link', { name: /numbers/i })).toBeInTheDocument();
  });

  /**
   * The rest of Study promises nothing is recorded, so a section that feeds the
   * scheduler has to qualify that rather than quietly break it — the same thing
   * the Sets note already does.
   */
  it('says that this one is recorded', async () => {
    await openDrill();

    const heading = await screen.findByRole('heading', { name: /^numbers$/i, level: 2 });
    expect(heading.closest('section')?.textContent).toMatch(/recorded/i);
  });

  it('asks about a number as soon as it opens', async () => {
    await openDrill();

    expect(
      screen.getByRole('textbox', { name: /The number, in (words|digits)/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
  });
});

describe('answering', () => {
  /**
   * **The claim the feature rests on.** 1042 has no id and must not be given
   * one; what it exercises does. So an attempt has to land against the pattern
   * ids, and against every pattern the number actually puts to work.
   */
  it('records against the patterns the number exercises, not the number', async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    await openDrill(storage);

    const { value, spoken } = await asked();
    const box = screen.getByRole('textbox', { name: /The number, in (words|digits)/ });
    // Answer whatever was asked, whichever direction it was asked in. The point
    // is where the evidence lands, not whether this test can spell.
    await user.type(box, spoken ? '0' : spellCardinal(value));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await screen.findByText(/Yes\.|Not quite\./);

    const attempts = await storage.attempts.all();
    expect(attempts.length).toBeGreaterThan(0);
    for (const attempt of attempts) {
      expect(attempt.subject).toMatch(/^[a-z-]+:skill:numerals-/);
    }
    // And a progress row per pattern, keyed the same way.
    const rows = await storage.progress.all();
    expect(rows.map((row) => row.subject).sort()).toEqual(
      attempts.map((attempt) => attempt.subject).sort(),
    );
  });

  it('marks a correct answer correct, and says the number back', async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    await openDrill(storage);

    const { value, spoken } = await asked();
    const box = screen.getByRole('textbox', { name: /The number, in (words|digits)/ });
    await user.type(box, spoken ? '0' : spellCardinal(value));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    const verdict = await screen.findByText(/Yes\.|Not quite\./);
    if (!spoken) {
      expect(verdict).toHaveTextContent('Yes.');
      // The spelling is shown either way: getting it right is also when a
      // learner checks they got it right for the right reason.
      expect(verdict).toHaveTextContent(spellCardinal(value));
      expect((await storage.attempts.all()).every((a) => a.grade === 'good')).toBe(true);
    }
  });

  it('marks nonsense wrong, and still records it', async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    await openDrill(storage);

    const box = screen.getByRole('textbox', { name: /The number, in (words|digits)/ });
    await user.type(box, 'zzzz');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText(/Not quite\./)).toBeInTheDocument();
    const attempts = await storage.attempts.all();
    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts.every((attempt) => attempt.grade === 'again')).toBe(true);
  });

  /**
   * A learner who gets `ciento treinta y uno` wrong is owed the rules it was
   * testing — that is the thing to go and learn. The number itself is a sample.
   */
  it('names the patterns the number was testing', async () => {
    const user = userEvent.setup();
    await openDrill();

    await user.type(screen.getByRole('textbox', { name: /The number, in (words|digits)/ }), 'zzzz');
    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText(/This one tests:/)).toBeInTheDocument();
  });

  it('moves on to another number', async () => {
    const user = userEvent.setup();
    await openDrill();

    await user.type(screen.getByRole('textbox', { name: /The number, in (words|digits)/ }), 'zzzz');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(await screen.findByRole('button', { name: 'Next number' }));

    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /The number, in (words|digits)/ })).toHaveValue('');
  });
});
