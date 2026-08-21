/**
 * Courses, as a learner meets them: the level in the path, the level in the UI,
 * and a second language that needs no new code to appear.
 *
 * The screens are mounted under the real `/:language/:level` routes rather than
 * bare, because the whole point is that the path is what decides the scope.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BrowseScreen } from '../../src/features/browse/BrowseScreen';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { ReadScreen } from '../../src/features/read/ReadScreen';
import type { Preferences } from '../../src/storage';
import { multilingualRepository } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

/** The app's own route table, narrowed to the screens a case needs. */
function courseRoutes(screens: Record<string, React.ReactNode>) {
  return (
    <Routes>
      {Object.entries(screens).map(([path, element]) => (
        <Route key={path} path={`/:language/:level${path}`} element={element} />
      ))}
    </Routes>
  );
}

describe('the level in the path', () => {
  it('narrows what a course contains', async () => {
    const services = testServices({ repository: multilingualRepository() });

    renderWithServices(courseRoutes({ '/browse': <BrowseScreen /> }), {
      services,
      route: '/fr/a1/browse',
    });

    // The French fixture has one A1 item and one B1 item.
    expect(await screen.findByText('1 item')).toBeInTheDocument();
    expect(screen.getByText('Je dois travailler.')).toBeInTheDocument();
    expect(screen.queryByText('bonjour')).not.toBeInTheDocument();
  });

  it('includes everything below it, because a level is a ceiling', async () => {
    const services = testServices({ repository: multilingualRepository() });

    renderWithServices(courseRoutes({ '/browse': <BrowseScreen /> }), {
      services,
      route: '/fr/b1/browse',
    });

    expect(await screen.findByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('Je dois travailler.')).toBeInTheDocument();
    expect(screen.getByText('bonjour')).toBeInTheDocument();
  });

  it('keeps one language out of another’s course', async () => {
    const services = testServices({ repository: multilingualRepository() });

    renderWithServices(courseRoutes({ '/browse': <BrowseScreen /> }), {
      services,
      route: '/es/all/browse',
    });

    await screen.findByText('7 items');
    expect(screen.queryByText('Je dois travailler.')).not.toBeInTheDocument();
  });

  /** A stale link must degrade to a wider course, never to a blank screen. */
  it('widens a level the course does not offer', async () => {
    const services = testServices({ repository: multilingualRepository() });

    renderWithServices(courseRoutes({ '/browse': <BrowseScreen /> }), {
      services,
      route: '/fr/a2/browse',
    });

    expect(await screen.findByText('2 items')).toBeInTheDocument();
  });
});

describe('the course bar', () => {
  it('offers the levels with content, each with what it puts in scope', async () => {
    const services = testServices({ repository: multilingualRepository() });

    renderWithServices(courseRoutes({ '': <HomeScreen /> }), { services, route: '/fr/a1' });

    const group = await screen.findByRole('group', { name: 'Course' });
    expect(within(group).getByRole('button', { name: 'A1, 1 item' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'B1, 2 items' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // A2 has no French content, so it is not offered rather than offered empty.
    expect(within(group).queryByRole('button', { name: /^A2/ })).not.toBeInTheDocument();
  });

  it('switches level without leaving the screen, and remembers the choice', async () => {
    const user = userEvent.setup();
    const services = testServices({ repository: multilingualRepository() });
    const written: Partial<Preferences>[] = [];

    renderWithServices(courseRoutes({ '/browse': <BrowseScreen /> }), {
      services,
      route: '/fr/a1/browse',
      updatePreferences: (patch) => written.push(patch),
    });

    await screen.findByText('1 item');
    await user.click(screen.getByRole('button', { name: 'B1, 2 items' }));

    // Still Browse, now wider — and the course is stored so `/` reopens it.
    expect(await screen.findByText('2 items')).toBeInTheDocument();
    expect(written).toEqual([{ targetLanguage: 'fr', level: 'b1' }]);
  });

  it('offers the languages the loaded packs provide', async () => {
    const user = userEvent.setup();
    const services = testServices({ repository: multilingualRepository() });

    renderWithServices(courseRoutes({ '/browse': <BrowseScreen /> }), {
      services,
      route: '/es/all/browse',
    });

    await screen.findByText('7 items');
    const picker = screen.getByRole('combobox', { name: 'Language' });
    expect(within(picker).getByRole('option', { name: 'Español' })).toBeInTheDocument();
    expect(within(picker).getByRole('option', { name: 'Français' })).toBeInTheDocument();

    await user.selectOptions(picker, 'fr');
    expect(await screen.findByText('2 items')).toBeInTheDocument();
  });

  /**
   * A picker with one option is not a choice, and offering it would imply
   * content that is not loaded. The level chips still appear.
   */
  it('hides the language picker when only one language is loaded', async () => {
    renderWithServices(courseRoutes({ '': <HomeScreen /> }), { route: '/es/all' });

    await screen.findByRole('group', { name: 'Course' });
    expect(screen.queryByRole('combobox', { name: 'Language' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^A1/ })).toBeInTheDocument();
  });
});

describe('course-scoped navigation', () => {
  it('keeps every link inside the current course', async () => {
    renderWithServices(courseRoutes({ '': <HomeScreen /> }), { route: '/es/a1' });

    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Study' })).toHaveAttribute(
      'href',
      '/es/a1/study',
    );
    expect(within(nav).getByRole('link', { name: 'Test' })).toHaveAttribute('href', '/es/a1');
  });

  it('points a passage link at the course it was found in', async () => {
    renderWithServices(courseRoutes({ '/read': <ReadScreen /> }), { route: '/es/a1/read' });

    const link = await screen.findByRole('link', { name: /Un día de trabajo/ });
    expect(link).toHaveAttribute('href', '/es/a1/read/700001');
  });

  it('scopes the reading list to the course as well as the pack', async () => {
    const services = testServices({ repository: multilingualRepository() });

    renderWithServices(courseRoutes({ '/read': <ReadScreen /> }), {
      services,
      route: '/fr/all/read',
    });

    // The French fixture ships no passages; the Spanish ones must not leak in.
    expect(await screen.findByText(/No texts in this pack yet/)).toBeInTheDocument();
  });
});
