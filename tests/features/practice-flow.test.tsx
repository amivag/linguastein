/** End-to-end wiring check: content → planner → engine → UI → stored progress. */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import type { ItemId } from '../../src/domain/content';
import { id } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

describe('HomeScreen', () => {
  it('offers quick sessions and practice presets', async () => {
    const user = userEvent.setup();
    renderWithServices(<HomeScreen />);

    expect(
      await screen.findByRole('heading', { name: 'Español · All levels' }),
    ).toBeInTheDocument();
    // Two authored missions are built on passages the fixture holds, so the
    // count is what the ladder actually has rather than a fixed 1.
    expect(screen.getByText('Mission 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Begin mission/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Free practice/ }));
    expect(screen.getByRole('button', { name: '5 min' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Flashcards/ })).toBeInTheDocument();
    // The scope the mission and free-practice choices will draw from.
    expect(screen.getByText(/7 items in your course/)).toBeInTheDocument();
  });

  it('starts the recommended mission journey in the current course', async () => {
    const user = userEvent.setup();
    function Where() {
      return <output data-testid="where">{useLocation().pathname}</output>;
    }

    renderWithServices(
      <>
        <HomeScreen />
        <Where />
      </>,
      { route: '/es/a1' },
    );

    await user.click(await screen.findByRole('button', { name: /Begin mission/ }));
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/es/all/mission/morning-routine/understand',
    );
  });

  it('returns a learner with transfer evidence directly to Use', async () => {
    const services = testServices();
    await services.storage.attempts.append({
      id: 'mission-transfer-attempt',
      itemId: id<ItemId>('test-es:item:001'),
      exerciseKind: 'think-say',
      grade: 'good',
      correct: true,
      at: 1_700_000_000_000,
      sessionId: 'mission:morning-routine:use:700001:test',
    });
    const user = userEvent.setup();
    function Where() {
      return <output data-testid="where">{useLocation().pathname}</output>;
    }

    renderWithServices(
      <>
        <HomeScreen />
        <Where />
      </>,
      { route: '/es/all', services },
    );

    await user.click(await screen.findByRole('button', { name: /Continue transfer/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/es/all/mission/morning-routine/use');
  });

  it('keeps the mission visible after due reviews and orders it as the next step', async () => {
    const services = testServices();
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

    renderWithServices(<HomeScreen />, { services });

    expect(await screen.findByRole('button', { name: /Review 1 due/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next steps' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Continue Describe your morning/ }),
    ).toBeInTheDocument();
  });

  it('starts a bounded new-material session from the daily path', async () => {
    const user = userEvent.setup();
    function Where() {
      const location = useLocation();
      return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
    }

    renderWithServices(
      <>
        <HomeScreen />
        <Where />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: /Meet something new/ }));

    expect(screen.getByTestId('where')).toHaveTextContent('preset=quick');
    expect(screen.getByTestId('where')).toHaveTextContent('size=items%3A5');
    expect(screen.getByTestId('where')).toHaveTextContent('focus=fresh');
  });

  it('starts a bounded weak-material session after the learner has history', async () => {
    const services = testServices();
    const itemId = (await services.repository.allItems())[0]!.id;
    await services.storage.progress.put({
      itemId,
      status: 'learning',
      attempts: 1,
      correct: 0,
      incorrect: 1,
      difficulty: 0.8,
      hintsUsed: 0,
      streak: 0,
      updatedAt: 0,
      dueAt: Number.MAX_SAFE_INTEGER,
    });
    const user = userEvent.setup();
    function Where() {
      const location = useLocation();
      return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
    }

    renderWithServices(
      <>
        <HomeScreen />
        <Where />
      </>,
      { services },
    );

    await user.click(await screen.findByRole('button', { name: /Strengthen recall/ }));

    expect(screen.getByTestId('where')).toHaveTextContent('size=items%3A5');
    expect(screen.getByTestId('where')).toHaveTextContent('focus=struggling');
  });

  it('shows when the learner last practised this course', async () => {
    const services = testServices();
    const itemId = (await services.repository.allItems())[0]!.id;
    await services.storage.attempts.append({
      id: 'recent-attempt',
      itemId,
      exerciseKind: 'think-say',
      grade: 'good',
      correct: true,
      at: Date.now(),
    });

    renderWithServices(<HomeScreen />, { services });

    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(screen.getByText('last practised')).toBeInTheDocument();
  });
});

describe('SessionScreen', () => {
  /**
   * Flashcards are a study session: browsing, not testing. A self-rated reveal
   * is not evidence of retrieval, and Browse routes into this preset — so
   * flipping through cards must not move an item's schedule.
   */
  it('runs a flashcard session without recording anything', async () => {
    const user = userEvent.setup();
    const services = testServices();

    renderWithServices(<SessionScreen />, {
      services,
      route: '/session?preset=flashcards&size=items:2&order=sequential',
    });

    expect(await screen.findByText('1/2')).toBeInTheDocument();
    // The phrase renders as individually tappable words (see word-info tests).
    expect(screen.getByRole('button', { name: 'About “Tengo”' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.getByText('I have to work.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Good' }));
    expect(await screen.findByText('2/2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    // Studying is reported as a count, and says plainly that it did not count.
    expect(await screen.findByText(/not scored/)).toBeInTheDocument();
    expect(await services.storage.progress.all()).toHaveLength(0);
    expect(await services.storage.attempts.recent(5)).toHaveLength(0);
    expect(await services.storage.sessions.recent(5)).toHaveLength(0);
  });

  it('records a self-rated answer in a tracked session', async () => {
    const user = userEvent.setup();
    const services = testServices();

    renderWithServices(<SessionScreen />, {
      services,
      route: '/session?preset=listen&size=items:1',
    });

    // Listen & repeat is self-rated too — the audio-first loop of spec §4.2.
    await user.click(await screen.findByRole('button', { name: 'Meaning' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    await waitFor(async () => {
      expect(await services.storage.progress.all()).toHaveLength(1);
    });

    const [progress] = await services.storage.progress.all();
    expect(progress?.status).toBe('learning');
    expect(progress?.dueAt).toBeGreaterThan(Date.now());
    expect(await services.storage.attempts.recent(5)).toHaveLength(1);
  });

  it('grades a multiple-choice answer and moves on', async () => {
    const user = userEvent.setup();
    const services = testServices();

    renderWithServices(<SessionScreen />, {
      services,
      route: '/session?preset=vocabulary&size=items:1',
    });

    // A vocabulary item is shown in Spanish with four reference-language choices.
    expect(await screen.findByText('1/1')).toBeInTheDocument();
    const choices = await screen.findAllByRole('button', { name: /beer|water|bread|coffee/ });
    expect(choices).toHaveLength(4);

    await user.click(choices[0]!);

    expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
    await waitFor(async () => {
      expect(await services.storage.progress.all()).toHaveLength(1);
    });
  });
});
