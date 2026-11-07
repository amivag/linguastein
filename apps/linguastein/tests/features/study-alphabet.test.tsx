/**
 * The alphabet as something a learner can read, rather than only filter by.
 *
 * Browse's letter index and the `alphabet` category both existed before this and
 * neither answers the first question: what are the letters and how do I say
 * them. These hold the three halves of the answer — the letter, its name, and
 * what it does inside a word — plus the two rules that make the section legal:
 * every control names itself precisely enough to pick, and the count of the
 * alphabet stays honest at twenty-seven with `ch` and `ll` taught beside it.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StudyScreen } from '../../src/features/study/StudyScreen';
import { NOOP_PLAYBACK } from '../../src/audio';
import { renderWithServices, testServices } from '../fixtures/services';

const study = (route = '/es/all/study?tab=alphabet') =>
  renderWithServices(<StudyScreen />, { route });

/** The card for one letter, found by the heading that shows both its cases. */
const card = async (both: string) => {
  const heading = await screen.findByRole('heading', { name: both, level: 4 });
  const owner = heading.closest('li');
  if (!owner) throw new Error(`no card for ${both}`);
  return within(owner);
};

describe('the alphabet section', () => {
  it('is offered as a section of Study', async () => {
    study('/es/all/study');

    const tabs = await screen.findByRole('navigation', { name: 'Study sections' });
    expect(within(tabs).getByRole('link', { name: /alphabet/i })).toBeInTheDocument();
  });

  it('shows a letter in both cases, what it is called, and how that name sounds', async () => {
    study();

    // `eñe` is the letter to assert on: it is the one a learner cannot guess
    // from English, and the one whose name is not spelled like its glyph.
    const enye = await card('Ñ ñ');
    expect(enye.getByText('eñe')).toBeInTheDocument();
    expect(enye.getByText('EN-yeh')).toBeInTheDocument();
  });

  it('says what the letter does inside a word, which is not what it is called', async () => {
    study();

    // The whole reason the section exists: the module could say that `h` is
    // called `hache` long before it could say that it is silent.
    const hache = await card('H h');
    expect(hache.getByText(/no sound of its own/i)).toBeInTheDocument();
    expect(hache.getByText('hola')).toBeInTheDocument();
    expect(hache.getByText('hello')).toBeInTheDocument();
  });

  it('carries the special cases, including the regional ones', async () => {
    study();

    const uve = await card('V v');
    expect(uve.getByText(/identical to b/i)).toBeInTheDocument();
    // Knowing only `uve` is not enough to take a booking code from a Mexican
    // speaker, which is the situation the alphabet is learned for.
    expect(uve.getByText('ve corta')).toBeInTheDocument();
    expect(uve.getAllByText(/Latin America/).length).toBeGreaterThan(0);
  });

  it('teaches ch and ll without counting them as letters', async () => {
    study();

    const letters = await screen.findByRole('region', { name: /the letters/i });
    expect(within(letters).getByText('27')).toBeInTheDocument();

    const pairs = screen.getByRole('region', { name: /pairs that spell one sound/i });
    expect(within(pairs).getByRole('heading', { name: 'Ch ch', level: 4 })).toBeInTheDocument();
    expect(within(pairs).getByRole('heading', { name: 'Ll ll', level: 4 })).toBeInTheDocument();
    expect(
      within(letters).queryByRole('heading', { name: 'Ch ch', level: 4 }),
    ).not.toBeInTheDocument();
  });

  it('teaches the accent, because a name spelled without one is a different name', async () => {
    study();

    const marks = await screen.findByRole('region', { name: /written marks/i });
    expect(within(marks).getAllByText(/o con acento/).length).toBeGreaterThan(0);
  });

  it('speaks the name of a letter, and any word listed under it', async () => {
    const speak = vi.fn(() => Promise.resolve(NOOP_PLAYBACK));
    const services = testServices();
    const user = userEvent.setup();
    renderWithServices(<StudyScreen />, {
      route: '/es/all/study?tab=alphabet',
      services: { ...services, audio: { ...services.audio, speak } },
    });

    const jota = await card('J j');
    await user.click(jota.getByRole('button', { name: /Pronounce the letter J, called jota/ }));
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'jota' }));

    await user.click(jota.getByRole('button', { name: /Pronounce jamón, ham/ }));
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'jamón' }));
  });

  it('names an example control by the letter it belongs to', async () => {
    study();

    // `casa` is an example of A, of C and of S. Three controls all called
    // "Pronounce casa" is the mistake `contextLabel` exists to stop on every
    // other screen, so each one has to say which card it sits on.
    const names = (await screen.findAllByRole('button', { name: /Pronounce casa/ })).map(
      (control) => control.getAttribute('aria-label'),
    );
    expect(names.length).toBeGreaterThan(1);
    expect(new Set(names).size).toBe(names.length);
  });
});
