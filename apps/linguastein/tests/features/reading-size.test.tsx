import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadingSizeControl } from '../../src/components/ReadingSizeControl';
import { applyReadingSize, READING_SIZE_STORAGE_KEY } from '../../src/styles/reading-size';
import { renderWithServices, testServices } from '../fixtures/services';
import { DEFAULT_PREFERENCES } from '../../src/storage';

afterEach(() => {
  document.documentElement.removeAttribute('data-reading-size');
  localStorage.removeItem(READING_SIZE_STORAGE_KEY);
});

describe('reading size', () => {
  it('offers three named sizes and exposes the current choice', () => {
    renderWithServices(<ReadingSizeControl />, {
      services: testServices({
        preferences: { ...DEFAULT_PREFERENCES, readingSize: 'medium' },
      }),
    });

    expect(screen.getByRole('radiogroup', { name: 'Text size' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Small' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Large' })).not.toBeChecked();
  });

  it('writes the selected size through the shared preference seam', async () => {
    const user = userEvent.setup();
    const updatePreferences = vi.fn();
    renderWithServices(<ReadingSizeControl />, { updatePreferences });

    await user.click(screen.getByRole('radio', { name: 'Large' }));

    expect(updatePreferences).toHaveBeenCalledWith({ readingSize: 'large' });
  });

  it('applies and caches the root attribute used before first paint', () => {
    applyReadingSize('large');

    expect(document.documentElement).toHaveAttribute('data-reading-size', 'large');
    expect(localStorage.getItem(READING_SIZE_STORAGE_KEY)).toBe('large');
  });
});
