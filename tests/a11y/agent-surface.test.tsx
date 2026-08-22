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
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { PassageScreen } from '../../src/features/read/PassageScreen';
import { ReadScreen } from '../../src/features/read/ReadScreen';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { MissionScreen } from '../../src/features/missions/MissionScreen';
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

  it('names every control on the reading list', async () => {
    const { container } = renderWithServices(<ReadScreen />, { route: '/read' });
    await screen.findByRole('heading', { level: 1 });
    await expectEveryControlNamed(container);
  });

  it('names every control on the browse screen, including each result’s play button', async () => {
    const { container } = renderWithServices(<BrowseScreen />, { route: '/browse' });
    // The play buttons arrive with voice discovery, so the tree is only complete
    // once one of them is there — checking names before that would pass by
    // finding nothing.
    await screen.findAllByRole('button', { name: /^Listen to/ }, { timeout: 5_000 });
    await expectEveryControlNamed(container);

    // A letter chip named "C" says nothing about what pressing it does, and a
    // play button per row has to say which row — the same rule a passage's
    // lines are held to below.
    expect(screen.getByRole('button', { name: 'Starting with C, 2 items' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Listen to “cerveza”' })).toBeInTheDocument();
  });

  it('names every control in a passage, including each line’s play button', async () => {
    const { container } = renderWithServices(
      <Routes>
        <Route path="/read/:id" element={<PassageScreen />} />
      </Routes>,
      { route: '/read/700001' },
    );
    await screen.findByRole('heading', { level: 1 });
    await expectEveryControlNamed(container);

    // A play button per line has to say *which* line, or an agent cannot pick.
    expect(
      screen.getByRole('button', { name: 'Listen to “Tengo que trabajar.”' }),
    ).toBeInTheDocument();
  });

  it('names every control in a mission and exposes its stage', async () => {
    const { container } = renderWithServices(
      <Routes>
        <Route path="/:language/:level/mission/:missionId/:stage" element={<MissionScreen />} />
      </Routes>,
      { route: '/es/all/mission/morning-routine/understand' },
    );

    await screen.findByRole('button', { name: 'Start practice' });
    await expectEveryControlNamed(container);
    expect(screen.getByRole('list', { name: 'Mission journey' })).toBeInTheDocument();
    expect(screen.getByText('Understand').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('names every control in a practice session', async () => {
    const { container } = renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:2&order=sequential',
    });
    await screen.findByRole('button', { name: 'Reveal' });
    await expectEveryControlNamed(container);
  });

  it('exposes each practice card as a named region', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

    const card = await screen.findByRole('region', { name: 'Reveal the meaning' });
    expect(within(card).getByRole('button', { name: 'Reveal' })).toBeInTheDocument();
  });

  it('describes where you are through the document title', async () => {
    renderWithServices(<HomeScreen />);
    await screen.findByRole('heading', { level: 1 });
    // The course names the screen: the language being studied, with the level
    // beside it in the bar below.
    expect(document.title).toBe('Español · All levels · Linguastein');
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
