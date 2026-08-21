/**
 * Content preferences, as a learner meets them.
 *
 * Two things are worth holding. The choice is *standing* — it survives between
 * sessions, which is the whole reason it is a preference and not a per-session
 * dialog. And it is nevertheless written into the session link, because a
 * session that is not fully described by its URL cannot be reloaded, shared or
 * scripted, and a shared link must not practise the sharer's categories on
 * someone else's device.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { DEFAULT_PREFERENCES, type Preferences } from '../../src/storage';
import { renderWithServices, testServices } from '../fixtures/services';

/** Surfaces the router's current URL, since MemoryRouter never touches window. */
function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function homeWith(preferences: Partial<Preferences>) {
  const written: Partial<Preferences>[] = [];
  const result = renderWithServices(
    <>
      <HomeScreen />
      <Where />
    </>,
    {
      services: testServices({ preferences: { ...DEFAULT_PREFERENCES, ...preferences } }),
      updatePreferences: (patch) => written.push(patch),
    },
  );
  return { ...result, written };
}

/** The disclosure that summarises the choice and opens the panel. */
const panel = () => screen.getByRole('button', { name: /Change what to practise/ });

describe('the practising summary', () => {
  it('says "everything" until a choice is made', async () => {
    homeWith({});
    await screen.findByRole('heading', { level: 1 });

    expect(panel()).toHaveAccessibleName(/Everything · balanced/);
  });

  it('names the chosen categories and focus while collapsed', async () => {
    homeWith({ focusTopics: ['food-drink'], focus: 'struggling' });
    await screen.findByRole('heading', { level: 1 });

    expect(panel()).toHaveAccessibleName(/Food and drink · shaky items/);
  });

  it('counts them once there are too many to name', async () => {
    homeWith({ focusTopics: ['food-drink', 'work', 'everyday'] });
    await screen.findByRole('heading', { level: 1 });

    expect(panel()).toHaveAccessibleName(/3 categories/);
  });

  /**
   * `colours` is declared by the fixture manifest and used by nothing. The
   * picker already refuses to offer an empty category; the summary must not
   * claim one either, or the two would disagree about what is selected.
   */
  it('does not claim a category with nothing in scope', async () => {
    homeWith({ focusTopics: ['work', 'colours'] });
    await screen.findByRole('heading', { level: 1 });

    expect(panel()).toHaveAccessibleName(/Work · balanced/);
  });

  /**
   * A hidden panel whose controls stay in the accessibility tree is a screen
   * reader walking through a dozen category buttons that are not on screen.
   */
  it('keeps the panel out of the tree until it is opened', async () => {
    const user = userEvent.setup();
    homeWith({});
    await screen.findByRole('heading', { level: 1 });

    expect(screen.queryByRole('group', { name: 'Lead with' })).not.toBeInTheDocument();
    expect(panel()).toHaveAttribute('aria-expanded', 'false');

    await user.click(panel());
    expect(panel()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Lead with' })).toBeInTheDocument();
  });
});

/**
 * Where the panel is *drawn*, which is a design-language rule rather than a
 * detail: a control that expands must open over the page, never grow inside it.
 *
 * Both assertions come from real regressions. The picker was an inline panel,
 * and opening it pushed the quick-session buttons, all six presets and the rest
 * of Home down by around four hundred pixels — so narrowing what you practise
 * moved the button you were reaching for off the screen. Moving it into a sheet
 * fixed that, and then a `<div id={panelId}>` wrapper around the sheet brought a
 * smaller version of it back: the section is a grid, so a flow child collects a
 * `gap` even when its only content is fixed, and the page grew by 12px on open.
 *
 * jsdom computes no layout, so neither can be measured here. What can be
 * asserted is the structure that caused them: the panel is a modal dialog, and
 * `aria-controls` resolves to that dialog rather than to a wrapper around it.
 */
describe('where the panel opens', () => {
  it('opens a modal dialog rather than expanding the page', async () => {
    const user = userEvent.setup();
    homeWith({});
    await screen.findByRole('heading', { level: 1 });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(panel());

    const dialog = screen.getByRole('dialog', { name: 'What to practise' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('points aria-controls at the dialog itself, with nothing in between', async () => {
    const user = userEvent.setup();
    homeWith({});
    await screen.findByRole('heading', { level: 1 });

    const toggle = panel();
    await user.click(toggle);

    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    // The element the control names *is* the dialog. A wrapper here would be a
    // flow element inside a grid, which is what reintroduced the 12px shift.
    expect(document.getElementById(controls!)).toBe(screen.getByRole('dialog'));
  });

  it('closes without leaving the dialog in the accessibility tree', async () => {
    const user = userEvent.setup();
    homeWith({});
    await screen.findByRole('heading', { level: 1 });

    await user.click(panel());
    await user.click(screen.getByRole('button', { name: 'Close' }));

    // Rendered only while open: a hidden panel whose twelve category buttons
    // stay in the tree is twelve stops a screen reader walks through for nothing.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('choosing what to practise', () => {
  it('stores the focus, so it holds for the next session too', async () => {
    const user = userEvent.setup();
    const { written } = homeWith({});
    await screen.findByRole('heading', { level: 1 });

    await user.click(panel());
    await user.click(screen.getByRole('button', { name: /Shaky items/ }));

    expect(written).toEqual([{ focus: 'struggling' }]);
  });

  it('accepts several categories at once', async () => {
    const user = userEvent.setup();
    const { written } = homeWith({ focusTopics: ['work'] });
    await screen.findByRole('heading', { level: 1 });

    await user.click(panel());
    const categories = within(screen.getByRole('region', { name: 'Categories' }));
    await user.click(categories.getByRole('button', { name: /Food and drink/ }));

    // Added to the existing choice rather than replacing it: "food and travel"
    // is a normal thing to be working on.
    expect(written).toEqual([{ focusTopics: ['work', 'food-drink'] }]);
  });

  it('unpicks a category that is already chosen', async () => {
    const user = userEvent.setup();
    const { written } = homeWith({ focusTopics: ['work', 'food-drink'] });
    await screen.findByRole('heading', { level: 1 });

    await user.click(panel());
    const categories = within(screen.getByRole('region', { name: 'Categories' }));
    await user.click(categories.getByRole('button', { name: /^Work/ }));

    expect(written).toEqual([{ focusTopics: ['food-drink'] }]);
  });

  it('offers a way back to everything', async () => {
    const user = userEvent.setup();
    const { written } = homeWith({ focusTopics: ['work'] });
    await screen.findByRole('heading', { level: 1 });

    await user.click(panel());
    await user.click(screen.getByRole('button', { name: 'Practise everything' }));

    expect(written).toEqual([{ focusTopics: [] }]);
  });
});

describe('the session the choice starts', () => {
  it('carries the categories and the focus in the link', async () => {
    const user = userEvent.setup();
    homeWith({ focusTopics: ['food-drink'], focus: 'struggling' });
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: /Flashcards/ }));

    const where = screen.getByTestId('where').textContent ?? '';
    expect(where).toContain('topic=food-drink');
    expect(where).toContain('focus=struggling');
  });

  it('writes nothing for the defaults, so a plain link stays plain', async () => {
    const user = userEvent.setup();
    homeWith({});
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: '5 min' }));

    const where = screen.getByTestId('where').textContent ?? '';
    expect(where).not.toContain('topic=');
    expect(where).not.toContain('focus=');
  });

  /**
   * The due button names a number. Narrowing it by category would review fewer
   * items than the label promised, which is worse than ignoring the preference.
   */
  it('leaves "review what is due" unnarrowed', async () => {
    const user = userEvent.setup();
    const services = testServices({
      preferences: { ...DEFAULT_PREFERENCES, focusTopics: ['work'] },
    });
    const itemId = (await services.repository.allItems())[0]!.id;
    await services.storage.progress.put({
      itemId,
      status: 'review',
      attempts: 1,
      correct: 1,
      incorrect: 0,
      difficulty: 0.5,
      hintsUsed: 0,
      streak: 1,
      updatedAt: 0,
      dueAt: 0,
    });

    renderWithServices(
      <>
        <HomeScreen />
        <Where />
      </>,
      { services },
    );

    await user.click(await screen.findByRole('button', { name: /Review 1 due/ }));

    const where = screen.getByTestId('where').textContent ?? '';
    expect(where).toContain('due=1');
    expect(where).not.toContain('topic=');
  });
});
