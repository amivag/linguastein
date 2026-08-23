/**
 * Study: the section that shows the material rather than grading it.
 *
 * The app had six ways to be tested and none to be taught, so these assert the
 * two things that make this screen worth having — that every tile leads to real
 * material, and that nothing on it records anything.
 */

import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StudyScreen } from '../../src/features/study/StudyScreen';
import { renderWithServices } from '../fixtures/services';

const section = async (name: RegExp) => {
  const heading = await screen.findByRole('heading', { name, level: 2 });
  const owner = heading.closest('section');
  if (!owner) throw new Error(`no section for ${String(name)}`);
  return within(owner);
};

const study = () => renderWithServices(<StudyScreen />, { route: '/es/all/study' });

describe('the study section', () => {
  beforeEach(() => {
    study();
  });

  it('says up front that nothing here is graded', async () => {
    expect(
      await screen.findByText(/nothing is graded and nothing is recorded/i),
    ).toBeInTheDocument();
  });

  /**
   * The bug this exists for: the word tiles were counted with `partsOfSpeech`,
   * which counts every item *exemplifying* a part of speech — sentences included
   * — while the tile links to a sheet of word cards. That reported 546 verbs in
   * the shipped pack, where the sheet behind it lists none at all.
   *
   * So a tile's number has to be counted with the filter the tile links to. The
   * fixture has four noun word cards and no verb ones, which is the same shape.
   */
  it('counts a tile with the filter that tile links to', async () => {
    const words = await section(/^words$/i);
    const nouns = words.getByRole('link', { name: /nouns/i });

    expect(nouns).toHaveAttribute('href', expect.stringContaining('type=word'));
    expect(nouns).toHaveAttribute('href', expect.stringContaining('pos=noun'));
    expect(nouns.textContent).toMatch(/4/);
  });

  it('offers no tile for a word kind with no cards', async () => {
    const words = await section(/^words$/i);

    // The fixture's verbs live in sentences and have no word cards, exactly as
    // the shipped pack's do. A tile promising them would open an empty sheet.
    expect(words.queryByRole('link', { name: /verbs/i })).not.toBeInTheDocument();
  });

  it('leads to texts, phrases and sentences separately', async () => {
    const block = await section(/phrases and sentences/i);

    expect(block.getByRole('link', { name: /set phrases/i })).toHaveAttribute(
      'href',
      expect.stringContaining('type=phrase'),
    );
    // Anchored: the passages tile's own note says "several sentences", so an
    // unanchored match finds two links.
    expect(block.getByRole('link', { name: /^Sentences/ })).toHaveAttribute(
      'href',
      expect.stringContaining('type=sentence'),
    );
    expect(block.getByRole('link', { name: /texts and dialogues/i })).toHaveAttribute(
      'href',
      '/es/all/read',
    );
  });

  /**
   * A grammar tile is the one place `?skill=` is reachable without typing a URL,
   * and it has to open something that records nothing — `flashcards` is
   * `mode: 'study'`, so a self-rated reveal never reaches the scheduler.
   */
  it('opens a grammar pattern as a study session, not a graded one', async () => {
    const grammar = await section(/grammar and patterns/i);
    const link = grammar.getByRole('link', { name: /tener que/i });
    const href = link.getAttribute('href') ?? '';

    expect(href).toContain('skill=tener-que');
    expect(href).toContain('preset=flashcards');
  });

  it('marks target-language text as such, so it is not read with an English voice', async () => {
    const grammar = await section(/grammar and patterns/i);

    expect(grammar.getByText('tener que + infinitivo')).toHaveAttribute('lang', 'es');
  });

  it('offers a category only where there is something in it', async () => {
    const categories = await section(/by category/i);

    // `colours` is declared by the fixture manifest and used by nothing.
    expect(categories.queryByRole('link', { name: /colours/i })).not.toBeInTheDocument();
    expect(categories.getByRole('link', { name: /food and drink/i })).toHaveAttribute(
      'href',
      expect.stringContaining('topic=food-drink'),
    );
  });
});

/**
 * Missions belong to Study rather than to Test.
 *
 * The section split is "material" against "find out whether you know it", and a
 * mission is mostly material: an exchange to understand, then the same language
 * used somewhere new. Only its last stage records anything — which is the one
 * thing this screen has to say out loud, because everything else on it promises
 * the opposite.
 */
describe('the missions on Study', () => {
  beforeEach(() => {
    study();
  });

  it('lists the course’s missions as a route rather than a sheet', async () => {
    const missions = await section(/^missions$/i);
    const mission = missions.getByRole('link', { name: /Describe your morning/ });

    // The state is inside the link's own text: a list of rows all called
    // "Continue" gives a screen reader and an agent nothing to choose between.
    expect(mission).toHaveAttribute('href', '/es/all/mission/morning-routine/understand');
    expect(mission.textContent).toMatch(/2 lines/);
  });

  it('says that the last stage of a mission is recorded', async () => {
    // The rest of the screen promises that nothing is recorded. A control that
    // records, sitting under that promise unqualified, would make the promise a
    // lie rather than a scope.
    const missions = await section(/^missions$/i);

    expect(missions.getByText(/The last stage is recorded/i)).toBeInTheDocument();
  });
});
