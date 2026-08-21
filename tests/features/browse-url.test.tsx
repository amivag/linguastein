/**
 * Browse is a study sheet, and a study sheet is a thing you link to.
 *
 * Its filters were `useState`, which made a filtered sheet the one view in the
 * app with no address: "the nouns" could not be bookmarked, shared, restored
 * after a reload, offered from Home as a destination, or driven by an agent. The
 * session URL has been treated as load-bearing since it existed; this is the
 * same rule applied to the other half of the app.
 *
 * Both directions, in one file, for the reason `session-url.ts` gives about
 * itself: a screen that reads a parameter nothing writes, or writes one nothing
 * reads, is the bug this shape prevents.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { renderWithServices } from '../fixtures/services';

/** Surfaces the router's current URL so a rewrite can be asserted on. */
function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

const query = () =>
  new URLSearchParams((screen.getByTestId('where').textContent ?? '').split('?')[1] ?? '');

const rows = () => screen.getAllByRole('listitem').map((li) => li.textContent ?? '');

function browse(route: string) {
  return renderWithServices(
    <>
      <BrowseScreen />
      <Where />
    </>,
    { route },
  );
}

describe('a sheet the URL describes', () => {
  it('shows what the link asked for, not the whole pack', async () => {
    browse('/browse?type=word&pos=noun');

    // The four noun word cards, and neither of the verb sentences.
    const listed = await screen.findByRole('list', { name: 'Results' });
    expect(listed.children).toHaveLength(4);
  });

  it('narrows on several facets at once', async () => {
    browse('/browse?type=word&topic=food-drink');

    expect((await screen.findByRole('list', { name: 'Results' })).children).toHaveLength(4);
  });

  it('restores the controls from the link, so a reload looks the same', async () => {
    browse('/browse?type=word&pos=noun&topic=food-drink&sort=az');

    expect(await screen.findByRole('combobox', { name: /type/i })).toHaveValue('word');
    expect(screen.getByRole('combobox', { name: /word kind/i })).toHaveValue('NOUN');
    expect(screen.getByRole('combobox', { name: /topic/i })).toHaveValue('food-drink');
    expect(screen.getByRole('combobox', { name: /sort/i })).toHaveValue('az');
  });

  /**
   * A hand-written or scripted link may carry a batch the selects cannot show.
   * Listing all of it and showing the first in the control is the honest
   * outcome; dropping what the UI cannot display would quietly practise
   * something else.
   */
  it('lists a batch of word kinds the single select cannot express', async () => {
    browse('/browse?pos=verb,noun');

    const listed = await screen.findByRole('list', { name: 'Results' });
    expect(listed.children.length).toBeGreaterThan(4);
    expect(screen.getByRole('combobox', { name: /word kind/i })).toHaveValue('VERB');
  });

  it('falls back to the whole pack when the link narrows to nothing it knows', async () => {
    browse('/browse?type=bogus&sort=sideways');

    expect((await screen.findByRole('list', { name: 'Results' })).children).toHaveLength(7);
    expect(screen.getByRole('combobox', { name: /sort/i })).toHaveValue('pack');
  });
});

describe('changing a control rewrites the link', () => {
  it('writes the facet a learner picked', async () => {
    const user = userEvent.setup();
    browse('/browse');
    await screen.findByRole('list', { name: 'Results' });

    await user.selectOptions(screen.getByRole('combobox', { name: /type/i }), 'word');

    expect(query().get('type')).toBe('word');
  });

  it('writes the search text, so a found word can be linked to', async () => {
    const user = userEvent.setup();
    browse('/browse');
    await screen.findByRole('list', { name: 'Results' });

    await user.type(screen.getByRole('searchbox'), 'café');

    expect(query().get('q')).toBe('café');
  });

  it('writes the sort, which is the list’s own business and not a filter', async () => {
    const user = userEvent.setup();
    browse('/browse');
    await screen.findByRole('list', { name: 'Results' });

    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'az');

    expect(query().get('sort')).toBe('az');
    // Pack order is the default, so it is absent rather than spelled out — a
    // plain link stays readable, exactly as `sessionPath` keeps it.
    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'pack');
    expect(query().has('sort')).toBe(false);
  });

  it('drops a facet when it goes back to "any"', async () => {
    const user = userEvent.setup();
    browse('/browse?type=word&topic=food-drink');
    await screen.findByRole('list', { name: 'Results' });

    await user.selectOptions(screen.getByRole('combobox', { name: /topic/i }), 'all');

    expect(query().has('topic')).toBe(false);
    // The facet the learner did not touch has to survive the rewrite.
    expect(query().get('type')).toBe('word');
  });

  it('keeps the sheet and the session link agreeing about what "these" are', async () => {
    const user = userEvent.setup();
    browse('/browse');
    await screen.findByRole('list', { name: 'Results' });

    await user.selectOptions(screen.getByRole('combobox', { name: /word kind/i }), 'NOUN');
    const sheet = query();

    await user.click(screen.getByRole('button', { name: /practise these/i }));
    const session = query();

    expect(sheet.get('pos')).toBe('noun');
    expect(session.get('pos')).toBe('noun');
  });
});

/**
 * Style is the one facet a learner wants two of at once — "formal or casual,
 * just not slang" — so it is chips rather than a select. `ItemFilter.registers`
 * was always plural and the link always carried `?register=a,b`; only the
 * control could not say it.
 */
describe('style, which can be more than one', () => {
  const styleChips = () =>
    screen
      .getAllByRole('button', { pressed: false })
      .concat(screen.getAllByRole('button', { pressed: true }));

  it('reads several styles out of one link', async () => {
    browse('/browse?register=colloquial,formal');
    await screen.findByRole('list', { name: 'Results' });

    expect(screen.getByRole('button', { name: /casual/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /formal/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /neutral/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('adds a style without dropping the one already on', async () => {
    const user = userEvent.setup();
    browse('/browse?register=colloquial');
    await screen.findByRole('list', { name: 'Results' });

    await user.click(screen.getByRole('button', { name: /formal/ }));

    expect(query().get('register')?.split(',').sort()).toEqual(['colloquial', 'formal']);
  });

  it('turns one off by pressing it again', async () => {
    const user = userEvent.setup();
    browse('/browse?register=colloquial,formal');
    await screen.findByRole('list', { name: 'Results' });

    await user.click(screen.getByRole('button', { name: /casual/ }));

    expect(query().get('register')).toBe('formal');
    // The last one off means no constraint, not an empty result.
    await user.click(screen.getByRole('button', { name: /formal/ }));
    expect(query().has('register')).toBe(false);
  });

  it('says how many each style has, so a dead end is visible before it is pressed', async () => {
    browse('/browse');
    await screen.findByRole('list', { name: 'Results' });

    // Nothing in the fixture is slang, and a chip reading 0 is the honest way to
    // say so — the same reason a category carries its count.
    expect(styleChips().some((chip) => /slang/.test(chip.textContent ?? ''))).toBe(true);
    expect(screen.getByRole('button', { name: /slang/ }).textContent).toMatch(/0/);
  });
});

/**
 * The sheet lists the target language with its meaning beside it, which is what
 * makes it study material rather than a search box. Asserted because it is the
 * whole point of the screen and nothing else covers it.
 */
describe('what a row shows', () => {
  it('puts the meaning next to the Spanish', async () => {
    browse('/browse?type=word&topic=food-drink');
    await screen.findByRole('list', { name: 'Results' });

    expect(rows().some((row) => row.includes('cerveza') && row.includes('beer'))).toBe(true);
  });
});
