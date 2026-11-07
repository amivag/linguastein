/**
 * The style guide has to stay a *view* of the design system.
 *
 * The whole value of the page is that nobody has to remember to update it, so
 * these tests are about the mechanism rather than the content: a token added to
 * a stylesheet appears, a colour role appears under Colour rather than in the
 * leftovers, every icon in the set is listed, and the page keeps the same
 * heading and landmark contract every other screen has.
 */

import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { StyleGuideScreen } from '../../src/features/design/StyleGuideScreen';
import { ICON_NAMES } from '../../src/components/icons';
import { renderWithServices } from '../fixtures/services';

const sheets: HTMLStyleElement[] = [];

function withCss(css: string): void {
  const element = document.createElement('style');
  element.textContent = css;
  document.head.append(element);
  sheets.push(element);
}

afterEach(() => {
  for (const sheet of sheets.splice(0)) sheet.remove();
});

/** The `<section>` whose heading starts with `title`. */
function section(title: string): HTMLElement {
  const heading = screen
    .getAllByRole('heading', { level: 2 })
    .find((element) => element.textContent?.startsWith(title));
  if (!heading) throw new Error(`no section titled ${title}`);
  const owner = heading.closest('section');
  if (!owner) throw new Error(`section ${title} has no container`);
  return owner;
}

describe('the design system page', () => {
  it('keeps the screen contract every other screen keeps', () => {
    renderWithServices(<StyleGuideScreen />, { route: '/design' });

    expect(screen.getByRole('heading', { level: 1, name: 'Design system' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(document.title).toBe('Design system · Linguastein');
  });

  it('lists a token the stylesheets declare, without being told about it', () => {
    // The point of the whole page: this token exists nowhere in its source.
    withCss(':root { --space-999: 1234px; }');
    renderWithServices(<StyleGuideScreen />, { route: '/design' });

    expect(within(section('Spacing')).getByText('--space-999')).toBeInTheDocument();
    expect(within(section('Spacing')).getByText('1234px')).toBeInTheDocument();
  });

  it('files a new colour role under Colour rather than in the leftovers', () => {
    // Group membership is by name prefix, so a role named for its role lands in
    // the right place with no edit to the page.
    withCss(':root { --color-invented: #123456; }');
    renderWithServices(<StyleGuideScreen />, { route: '/design' });

    expect(within(section('Colour roles')).getByText('--color-invented')).toBeInTheDocument();
  });

  it('shows an unrecognised token rather than dropping it', () => {
    // A token that matches no group must still appear: a page that looks
    // complete is the one nobody checks.
    withCss(':root { --totally-unclaimed: 7px; }');
    renderWithServices(<StyleGuideScreen />, { route: '/design' });

    expect(within(section('Everything else')).getByText('--totally-unclaimed')).toBeInTheDocument();
  });

  it('lists every icon in the set', () => {
    renderWithServices(<StyleGuideScreen />, { route: '/design' });
    // The catalogue itself, not the whole section: the prose above it names
    // `listen` as an example of a semantic name, so a section-wide text query
    // matches twice.
    const catalogue = within(section('Icons')).getByRole('list');

    // Every name, not a sample: an icon added to the seam has to show up here or
    // the page is no longer the catalogue it claims to be.
    for (const name of ICON_NAMES) {
      expect(within(catalogue).getByText(name), name).toBeInTheDocument();
    }
  });

  it('re-reads every value when the theme changes', async () => {
    const user = userEvent.setup();
    withCss(":root { --space-998: 1px; } [data-theme='light'] { --space-998: 42px; }");
    renderWithServices(<StyleGuideScreen />, { route: '/design' });

    const spacing = () => section('Spacing');
    expect(within(spacing()).getByText('1px')).toBeInTheDocument();

    /*
     * Applied to the document directly rather than through the theme control.
     *
     * `renderWithServices` stubs `updatePreferences`, so pressing Light would
     * change nothing — and the thing under test is not the toggle, it is that
     * the page follows `data-theme` rather than the preference. Keying it on the
     * preference was the original bug: `applyTheme` runs in an effect in `App`,
     * a child's effects run first, and the page rendered a whole theme behind.
     */
    await user.click(screen.getByRole('radio', { name: /Light/ }));
    document.documentElement.dataset['theme'] = 'light';

    expect(await within(spacing()).findByText('42px')).toBeInTheDocument();
  });
});
