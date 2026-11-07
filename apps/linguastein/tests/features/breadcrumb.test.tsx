/**
 * Where you are, said in the header.
 *
 * The screens that hide the tab bar — a mission and a running session — used to
 * say only what they were *called*. "Order at a café" drawn large is the name of
 * the thing and not a word about what kind of thing it is, and with `AppNav`
 * gone there was no visible route back to the list it came from either: the one
 * Back button walked history, which is however many taps the learner happened to
 * make.
 *
 * These hold the two halves of the fix together, because either alone is a
 * regression waiting to happen. A trail that names the section but does not link
 * to it is decoration; a trail on a screen the tab bar already places is a line
 * of sticky header spent restating what is lit up on screen.
 */

import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { MissionScreen } from '../../src/features/missions/MissionScreen';
import { PassageScreen } from '../../src/features/read/PassageScreen';
import { ProgressScreen } from '../../src/features/progress/ProgressScreen';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { StudyScreen } from '../../src/features/study/StudyScreen';
import { renderWithServices } from '../fixtures/services';

/** The trail's crumbs, in order, as `label → href`. */
function trail(): string[] {
  const nav = screen.queryByRole('navigation', { name: 'Breadcrumb' });
  if (!nav) return [];
  return within(nav)
    .getAllByRole('link')
    .map((link) => `${link.textContent} → ${link.getAttribute('href')}`);
}

const missionRoute = (
  <Routes>
    <Route path="/:language/:level/mission/:missionId/:stage" element={<MissionScreen />} />
  </Routes>
);

describe('the breadcrumb in the header', () => {
  it('places a mission inside Study’s mission list, and links to both', async () => {
    renderWithServices(missionRoute, { route: '/es/all/mission/morning-routine/understand' });
    await screen.findByRole('button', { name: 'Start practice' });

    expect(trail()).toEqual(['Study → /es/all/study', 'Missions → /es/all/study?tab=missions']);
  });

  it('names the stage beside the mission, so the header still says it once scrolled', async () => {
    renderWithServices(missionRoute, { route: '/es/all/mission/morning-routine/understand' });
    await screen.findByRole('button', { name: 'Start practice' });

    // The mission is the subject and the stage is the mode, so only the first is
    // the heading — but both reach the tab title, which said neither before.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Describe your morning');
    expect(document.title).toContain('Understand');
  });

  it('does not repeat the current screen as a crumb', async () => {
    renderWithServices(missionRoute, { route: '/es/all/mission/morning-routine/understand' });
    const heading = await screen.findByRole('heading', { level: 1 });

    // The `h1` is the current page and already carries its name; a final
    // `aria-current` crumb would announce the same words twice in a row.
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).queryByText(heading.textContent ?? '')).toBeNull();
  });

  it('puts a mission session under the missions rather than under the mission', async () => {
    renderWithServices(<SessionScreen />, {
      route: '/es/all/session?preset=quick&size=all&mission=morning-routine&order=sequential',
    });
    await screen.findByRole('heading', { level: 1 });

    // One crumb shorter than Back deliberately: the session is *titled* with the
    // mission, so a crumb for it would repeat the heading below.
    expect(trail()).toEqual(['Study → /es/all/study', 'Missions → /es/all/study?tab=missions']);
  });

  it('leaves a session over nothing in particular without a trail', async () => {
    renderWithServices(<SessionScreen />, { route: '/es/all/session?preset=verbs&size=items:5' });
    await screen.findByRole('heading', { level: 1, name: 'Verbs' });

    // Its preset is the whole of what the screen is. A guessed parent would be
    // worse than none.
    expect(trail()).toEqual([]);
  });

  it('sends a sheet back to the section that opened it', async () => {
    renderWithServices(<BrowseScreen />, { route: '/es/all/browse?from=categories' });
    await screen.findByRole('searchbox');

    expect(trail()).toEqual(['Study → /es/all/study', 'Categories → /es/all/study?tab=categories']);
  });

  it('stops at Study when the sheet was not told which section sent it', async () => {
    renderWithServices(<BrowseScreen />, { route: '/es/all/browse' });
    await screen.findByRole('searchbox');

    // Never guessed: a trail pointing at a section the learner was not in is
    // worse than a short one.
    expect(trail()).toEqual(['Study → /es/all/study']);
  });

  it('places a text under the reading list it belongs to', async () => {
    renderWithServices(
      <Routes>
        <Route path="/:language/:level/read/:id" element={<PassageScreen />} />
      </Routes>,
      { route: '/es/all/read/700002' },
    );
    await screen.findByRole('heading', { level: 1 });

    expect(trail()).toEqual(['Study → /es/all/study', 'Read → /es/all/read']);
  });

  it.each([
    ['home', <HomeScreen key="home" />, '/es/all'],
    ['study', <StudyScreen key="study" />, '/es/all/study'],
    ['progress', <ProgressScreen key="progress" />, '/es/all/progress'],
    ['settings', <SettingsScreen key="settings" />, '/es/all/settings'],
  ])('spends no header on %s, which the tab bar already places', async (_name, ui, route) => {
    renderWithServices(ui, { route });
    await screen.findByRole('heading', { level: 1 });

    expect(trail()).toEqual([]);
  });

  it.each([
    ['Study', <StudyScreen key="study" />, '/es/all/study?tab=grammar', 'Grammar'],
    ['Settings', <SettingsScreen key="settings" />, '/es/all/settings?tab=audio', 'Audio'],
  ])(
    'names the open section of %s in the sticky header and in the tab title',
    async (name, ui, route, section) => {
      renderWithServices(ui, { route });
      await screen.findByRole('heading', { level: 1, name });

      // The section strip scrolls away and the header does not — and the tab
      // title said only "Study" for all nine of Study's sections.
      expect(screen.getByRole('banner')).toHaveTextContent(section);
      expect(document.title).toContain(section);
    },
  );
});
