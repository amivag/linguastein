/**
 * Study: the section that shows the material rather than grading it.
 *
 * The app had six ways to be tested and none to be taught, so these assert the
 * two things that make this screen worth having — that every tile leads to real
 * material, and that nothing on it records anything.
 *
 * The sections are addresses now (`?tab=grammar`), so each case opens the one it
 * is about. That is the point of the change rather than an inconvenience of
 * testing it: seventy rows on one page is a page nobody reads to the bottom of.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { StudyScreen } from '../../src/features/study/StudyScreen';
import { STUDY_TABS } from '../../src/features/study/study-url';
import { renderWithServices } from '../fixtures/services';

const section = async (name: RegExp) => {
  const heading = await screen.findByRole('heading', { name, level: 2 });
  const owner = heading.closest('section');
  if (!owner) throw new Error(`no section for ${String(name)}`);
  return within(owner);
};

const study = (tab?: string) =>
  renderWithServices(<StudyScreen />, {
    route: tab ? `/es/all/study?tab=${tab}` : '/es/all/study',
  });

const tabs = () => screen.getByRole('navigation', { name: 'Study sections' });

describe('the study section', () => {
  /**
   * Up front, and true — which is the part that took a correction. The line used
   * to promise that nothing here is recorded except the last stage of a mission,
   * while a saved set already fed the scheduler and the numbers drill made a
   * third exception. A blanket promise that sections quietly break is worse than
   * none, since the reason for saying it is that a learner can browse without
   * wondering whether they are being marked.
   */
  it('says up front that nothing here is graded', async () => {
    study();
    expect(await screen.findByText(/Nothing here is graded/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing is recorded here/i)).not.toBeInTheDocument();
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
    study('words');
    const words = await section(/^words$/i);
    const nouns = words.getByRole('link', { name: /nouns/i });

    expect(nouns).toHaveAttribute('href', expect.stringContaining('type=word'));
    expect(nouns).toHaveAttribute('href', expect.stringContaining('pos=noun'));
    expect(nouns.textContent).toMatch(/4/);
  });

  it('offers no tile for a word kind with no cards', async () => {
    study('words');
    const words = await section(/^words$/i);

    // The fixture's verbs live in sentences and have no word cards, exactly as
    // the shipped pack's do. A tile promising them would open an empty sheet.
    expect(words.queryByRole('link', { name: /verbs/i })).not.toBeInTheDocument();
  });

  it('leads to texts, phrases and sentences separately', async () => {
    study('phrases');
    const phrases = await section(/^phrases$/i);

    expect(phrases.getByRole('link', { name: /set phrases/i })).toHaveAttribute(
      'href',
      expect.stringContaining('type=phrase'),
    );
    expect(phrases.getByRole('link', { name: /^sentences/i })).toHaveAttribute(
      'href',
      expect.stringContaining('type=sentence'),
    );
    // The reading list, and the section to come back to — `back-navigation`
    // holds the second half.
    expect(phrases.getByRole('link', { name: /texts and dialogues/i })).toHaveAttribute(
      'href',
      '/es/all/read?from=phrases',
    );
  });

  it('opens a grammar pattern as a study session, not a graded one', async () => {
    study('grammar');
    const grammar = await section(/^grammar$/i);
    const link = grammar.getByRole('link', { name: /tener que/i });
    const href = link.getAttribute('href') ?? '';

    expect(href).toContain('skill=tener-que');
    expect(href).toContain('preset=flashcards');
  });

  it('marks target-language text as such, so it is not read with an English voice', async () => {
    study('grammar');
    const grammar = await section(/^grammar$/i);

    expect(grammar.getByText('tener que + infinitivo')).toHaveAttribute('lang', 'es');
  });

  it('offers a category only where there is something in it', async () => {
    study('categories');
    const categories = await section(/^categories$/i);

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
    study('missions');
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

describe('the study sections', () => {
  it('shows one section at a time, and links to the others', async () => {
    study('grammar');

    expect(
      await screen.findByRole('heading', { name: /^grammar$/i, level: 2 }),
    ).toBeInTheDocument();
    // The other sections are one tap away rather than another screen of scrolling.
    expect(
      screen.queryByRole('heading', { name: /^categories$/i, level: 2 }),
    ).not.toBeInTheDocument();
    expect(within(tabs()).getByRole('link', { name: 'Categories' })).toHaveAttribute(
      'href',
      '/es/all/study?tab=categories',
    );
  });

  it('marks the open section, and announces it rather than only colouring it', async () => {
    study('categories');

    expect(within(tabs()).getByRole('link', { name: 'Categories' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs()).getByRole('link', { name: 'Words' })).not.toHaveAttribute('aria-current');
  });

  it('opens the first section it has when the URL names none', async () => {
    // The fixture has one authored mission in scope, so Missions leads.
    study();

    expect(
      await screen.findByRole('heading', { name: /^missions$/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it('degrades an unrecognised section instead of showing an empty page', async () => {
    // A link that has outlived a section should still open Study, the way a
    // stale course resolves to the widest real one.
    study('conjugations');

    expect(
      await screen.findByRole('heading', { name: /^missions$/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it('offers no section that would open an empty page', async () => {
    study();

    const offered = within(tabs())
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(offered.length).toBeGreaterThan(1);
    expect(offered.length).toBeLessThanOrEqual(STUDY_TABS.length);
  });
});

describe('the course scope on Study', () => {
  it('states the scope in one line and opens the control over the page', async () => {
    /*
     * It used to be a block of chips plus a sentence at the top of the screen —
     * four lines spent on something a learner changes once a week, above the
     * material they came for. The summary still has to say what the scope is,
     * because every count below it is relative to that.
     */
    const user = userEvent.setup();
    study();

    const scope = await screen.findByRole('button', { name: /Course: .*items in scope/ });
    expect(scope).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Course' })).not.toBeInTheDocument();

    await user.click(scope);

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('group', { name: 'Course' })).toBeInTheDocument();
    expect(scope).toHaveAttribute('aria-expanded', 'true');
  });
});
