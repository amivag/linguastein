/**
 * What a learner sees for an address the app does not have.
 *
 * Every unrecognised path used to redirect to the course home, silently — so a
 * stale bookmark, a link to a screen that moved and a typo all produced a working
 * page that was not the one asked for, with nothing to say so.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router';
import { NotFoundScreen } from '../../src/features/not-found/NotFoundScreen';
import { PassageScreen } from '../../src/features/read/PassageScreen';
import { renderWithServices } from '../fixtures/services';

describe('an address the app does not have', () => {
  it('says so, rather than redirecting somewhere that works', async () => {
    renderWithServices(<NotFoundScreen />, { route: '/es/a1/nonsense?x=1' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('There is no page at this address');
  });

  /**
   * The one fact the learner does not already have. It is what separates "the app
   * is broken" from "that link is wrong" without opening the address bar.
   */
  it('quotes the address back, query string included', async () => {
    renderWithServices(<NotFoundScreen />, { route: '/es/a1/nonsense?x=1' });

    expect(await screen.findByText('/es/a1/nonsense?x=1')).toBeInTheDocument();
  });

  it('offers a way on rather than only a way back', async () => {
    renderWithServices(<NotFoundScreen />, { route: '/es/a1/nonsense' });

    // Named after the course, not after a language tag.
    expect(await screen.findByRole('button', { name: /^Go to/ })).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Browse what this course has' }),
    ).toBeInTheDocument();
  });

  /**
   * A learner on A1 who follows a stale link should be offered A1, not whichever
   * scope their stored preference happens to hold. The course-scoped route is
   * matched before the global catch-all for exactly this.
   */
  it('keeps the course the bad link was inside', async () => {
    renderWithServices(
      <Routes>
        <Route path="/:language/:level/*" element={<NotFoundScreen />} />
      </Routes>,
      { route: '/es/a1/nonsense' },
    );

    expect(await screen.findByRole('button', { name: 'Go to Spanish · A1' })).toBeInTheDocument();
  });

  it('lets a caller say what was missing', async () => {
    renderWithServices(<NotFoundScreen reason="That mission moved." />, { route: '/es/a1/x' });

    expect(await screen.findByRole('status')).toHaveTextContent('That mission moved.');
  });
});

describe('content that is not in the installed packs', () => {
  /**
   * "Not found" alone leaves a learner unable to tell a broken link from a pack
   * they have not installed, and those have different fixes. So the message names
   * the text and points at the pack list.
   */
  it('names what was asked for and offers the pack list', async () => {
    // PassageScreen reads its id from the route, so it needs a real match.
    renderWithServices(
      <Routes>
        <Route path="/read/:id" element={<PassageScreen />} />
      </Routes>,
      { route: '/read/999999' },
    );

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('999999');
    expect(status).toHaveTextContent(/not installed/);
    expect(await screen.findByRole('button', { name: 'See installed packs' })).toBeInTheDocument();
  });
});
