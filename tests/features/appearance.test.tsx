/**
 * The appearance axes, and the promise that they stay separate.
 *
 * Light/dark, palette, contrast and text size are four independent choices. The
 * bug this file exists to prevent is any of them being folded into another: the
 * moment "teal" means "teal at normal contrast", a learner who wants Soft has to
 * give up their colours, and every palette added afterwards doubles the number
 * of files. `docs/theming.md` states the rule; these assert it.
 *
 * The palettes themselves are checked in `tests/a11y/contrast.test.ts`, which
 * holds every palette to WCAG AA at every contrast level.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContrastControl } from '../../src/components/ContrastControl';
import { PaletteControl } from '../../src/components/PaletteControl';
import { applyContrast, CONTRAST_STORAGE_KEY } from '../../src/styles/contrast';
import { applyPalette, PALETTE_STORAGE_KEY, PALETTES } from '../../src/styles/themes';
import { DEFAULT_PREFERENCES } from '../../src/storage';
import { renderWithServices, testServices } from '../fixtures/services';

afterEach(() => {
  document.documentElement.removeAttribute('data-palette');
  document.documentElement.removeAttribute('data-contrast');
  localStorage.removeItem(PALETTE_STORAGE_KEY);
  localStorage.removeItem(CONTRAST_STORAGE_KEY);
});

describe('the palette', () => {
  it('offers every palette and exposes the current one', () => {
    renderWithServices(<PaletteControl />, {
      services: testServices({ preferences: { ...DEFAULT_PREFERENCES, palette: 'sand' } }),
    });

    expect(screen.getByRole('radiogroup', { name: 'Colour palette' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Indigo' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Sand' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Teal' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Plum' })).toBeInTheDocument();
  });

  it('writes the choice through the shared preference seam', async () => {
    const user = userEvent.setup();
    const updatePreferences = vi.fn();
    renderWithServices(<PaletteControl />, { updatePreferences });

    await user.click(screen.getByRole('radio', { name: 'Teal' }));

    expect(updatePreferences).toHaveBeenCalledWith({ palette: 'teal' });
  });

  it('previews each palette by declaring it, rather than by drawing it', () => {
    /*
     * The swatches are the actual palettes: each one carries `data-palette`, and
     * every palette file selects a descendant with that attribute as well as the
     * document, so the preview is painted by the stylesheet the page would use.
     * A swatch built from hard-coded colours would be a second copy of the
     * palette, invisible to the contrast test and free to go stale — and it is
     * the kind of copy nobody notices is wrong, because it still looks like a
     * colour.
     */
    const { container } = renderWithServices(<PaletteControl />, {
      services: testServices({
        preferences: { ...DEFAULT_PREFERENCES, palette: 'indigo', contrast: 'more' },
      }),
    });

    // Compared against the registry rather than a literal list: the picker's job
    // is to offer every palette that exists, so a palette added to `PALETTES`
    // and missing here should fail as "the picker dropped one" rather than as
    // "somebody forgot to update a test".
    const previews = [...container.querySelectorAll('[data-palette]')];
    expect(previews.map((element) => element.getAttribute('data-palette'))).toEqual([...PALETTES]);
    // And at the contrast the learner has chosen: a preview that ignored the
    // other axis would advertise a page they are not going to get.
    for (const preview of previews) {
      expect(preview).toHaveAttribute('data-contrast', 'more');
    }
  });

  it('applies and caches the root attribute used before first paint', () => {
    applyPalette('plum');

    expect(document.documentElement).toHaveAttribute('data-palette', 'plum');
    expect(localStorage.getItem(PALETTE_STORAGE_KEY)).toBe('plum');
  });
});

describe('contrast', () => {
  it('offers four named levels and exposes the current one', () => {
    renderWithServices(<ContrastControl />, {
      services: testServices({ preferences: { ...DEFAULT_PREFERENCES, contrast: 'max' } }),
    });

    expect(screen.getByRole('radiogroup', { name: 'Contrast' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Soft contrast' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Normal contrast' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'More contrast' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Maximum contrast' })).toBeChecked();
  });

  it('writes the choice through the shared preference seam', async () => {
    const user = userEvent.setup();
    const updatePreferences = vi.fn();
    renderWithServices(<ContrastControl />, { updatePreferences });

    await user.click(screen.getByRole('radio', { name: 'Soft contrast' }));

    expect(updatePreferences).toHaveBeenCalledWith({ contrast: 'soft' });
  });

  it('previews each level in the palette the learner is using', () => {
    const { container } = renderWithServices(<ContrastControl />, {
      services: testServices({
        preferences: { ...DEFAULT_PREFERENCES, palette: 'teal', contrast: 'normal' },
      }),
    });

    const samples = [...container.querySelectorAll('[data-contrast]')];
    expect(samples.map((element) => element.getAttribute('data-contrast'))).toEqual([
      'soft',
      'normal',
      'more',
      'max',
    ]);
    for (const sample of samples) {
      expect(sample).toHaveAttribute('data-palette', 'teal');
    }
  });

  it('writes the default level out too, so an unset axis cannot mean two things', () => {
    // `normal` has no stylesheet of its own, but the attribute is still set: it
    // lets a preview be handed a level without a special case for the default.
    applyContrast('normal');

    expect(document.documentElement).toHaveAttribute('data-contrast', 'normal');
    expect(localStorage.getItem(CONTRAST_STORAGE_KEY)).toBe('normal');
  });
});
