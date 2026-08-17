/**
 * The accessibility tree is the agent interface.
 *
 * A screen reader and an automated agent need the same things: every control
 * has a stable, meaningful name; state is exposed as ARIA rather than colour;
 * and where you are is discoverable. These tests hold that contract so a
 * refactor cannot quietly break either audience.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { renderWithServices } from '../fixtures/services';

/** Accessible name as an agent would resolve it. */
function accessibleName(element: HTMLElement): string {
  return (
    element.getAttribute('aria-label') ?? element.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  );
}

async function expectEveryControlNamed(container: HTMLElement) {
  const controls = [
    ...container.querySelectorAll<HTMLElement>('button, a[href], select, input, [role="button"]'),
  ];
  expect(controls.length).toBeGreaterThan(0);

  const unnamed = controls.filter((control) => {
    if (control.getAttribute('aria-hidden') === 'true') return false;
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      // Labelled by a wrapping or associated <label>.
      return control.labels?.length === 0 && !control.getAttribute('aria-label');
    }
    return accessibleName(control).length === 0;
  });

  expect(unnamed.map((control) => control.outerHTML.slice(0, 120))).toEqual([]);
}

describe('agent surface', () => {
  it('names every control on the home screen', async () => {
    const { container } = renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });
    await expectEveryControlNamed(container);
  });

  it('names every control on the settings screen', async () => {
    const { container } = renderWithServices(<SettingsScreen />, { route: '/settings' });
    await screen.findByRole('heading', { level: 1 });
    await expectEveryControlNamed(container);
  });

  it('names every control in a practice session', async () => {
    const { container } = renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:2',
    });
    await screen.findByRole('button', { name: 'Reveal' });
    await expectEveryControlNamed(container);
  });

  it('exposes each practice card as a named region', async () => {
    renderWithServices(<SessionScreen />, { route: '/session?preset=flashcards&size=items:1' });

    const card = await screen.findByRole('region', { name: 'Reveal the meaning' });
    expect(within(card).getByRole('button', { name: 'Reveal' })).toBeInTheDocument();
  });

  it('describes where you are through the document title', async () => {
    renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });
    expect(document.title).toBe('Test Spanish · Lingo');
  });

  it('keeps session state in the URL so an agent can resume or share it', async () => {
    renderWithServices(<SessionScreen />, { route: '/session?preset=verbs&size=items:5' });
    // The screen is driven entirely by the query string.
    expect(await screen.findByRole('heading', { level: 1, name: 'Verbs' })).toBeInTheDocument();
  });

  it('reports answer state through ARIA, not only colour', async () => {
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, { route: '/session?preset=vocabulary&size=items:1' });

    const choices = await screen.findAllByRole('button', { name: /beer|water|bread|coffee/ });
    await user.click(choices[0]!);

    // Disabled choices plus a status message, both machine-readable.
    expect(choices[0]).toBeDisabled();
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});
