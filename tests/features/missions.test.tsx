import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { SpeechRecognitionProvider } from '../../src/audio';
import { MissionScreen } from '../../src/features/missions/MissionScreen';
import { missionPracticePath } from '../../src/features/missions/mission-url';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { MISSIONS } from '../../src/app/missions';
import { renderWithServices, testServices } from '../fixtures/services';

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function missionRoutes() {
  return (
    <>
      <Routes>
        <Route path="/:language/:level/mission/:missionId/:stage" element={<MissionScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </>
  );
}

describe('MissionScreen', () => {
  it('puts communicative capabilities in the shareable practice URL', () => {
    const cafe = MISSIONS.find((mission) => mission.id === 'cafe-order')!;
    const path = missionPracticePath({ language: 'es', level: 'a1' }, cafe);

    expect(path).toBe(
      '/es/a1/session?preset=quick&size=all&passage=700009&mission=cafe-order&skill=order-food-drink%2Chandle-add-on%2Cask-understand-price%2Cclose-service-exchange&order=sequential',
    );
  });

  it('turns the source passage into an understandable first stage', async () => {
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/all/mission/morning-routine/understand',
    });

    expect(
      await screen.findByRole('heading', { name: 'Describe your morning' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Mission journey' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'About “Tengo” in “Tengo que trabajar.”' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start practice' }));
    expect(screen.getByTestId('where')).toHaveTextContent('passage=700001');
    expect(screen.getByTestId('where')).toHaveTextContent('mission=morning-routine');
    expect(screen.getByTestId('where')).toHaveTextContent('order=sequential');
  });

  it('runs the Use stage as recall before reveal and reaches completion', async () => {
    const user = userEvent.setup();
    const { services } = renderWithServices(missionRoutes(), {
      route: '/es/all/mission/morning-routine/use',
    });

    await screen.findByText('I have to work.');
    expect(screen.getByText('I have to work.')).toBeInTheDocument();
    expect(screen.queryByText('Tengo que trabajar.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal the line' }));
    expect(screen.getByText('Tengo que trabajar.')).toBeInTheDocument();
    expect(screen.queryByText('Transfer 1 of 1 complete')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));

    await user.click(screen.getByRole('button', { name: 'Reveal the line' }));
    await user.click(screen.getByRole('button', { name: 'Not yet' }));

    expect(await screen.findByText('Transfer 1 of 1 complete')).toBeInTheDocument();
    expect(
      screen.getByText('2 transfer attempts recorded: 1 solid, 0 partial, 1 not yet.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish mission' })).toBeInTheDocument();
    expect(await services.storage.attempts.recent(10)).toHaveLength(2);
    const progress = await services.storage.progress.all();
    expect(progress.find((entry) => entry.itemId.endsWith(':item:001'))?.attempts).toBe(1);
    expect(progress.find((entry) => entry.itemId.endsWith(':item:002'))?.incorrect).toBe(1);
  });

  it('turns a matching speech check into a recorded transfer grade', async () => {
    const speech: SpeechRecognitionProvider = {
      id: 'mission-test',
      isAvailable: () => true,
      supportsLanguage: () => true,
      stop: () => {},
      listen: () => Promise.resolve({ transcript: 'tengo que trabajar', confidence: 0.95 }),
    };
    const services = testServices({ speech });
    const user = userEvent.setup();
    renderWithServices(missionRoutes(), {
      route: '/es/all/mission/morning-routine/use',
      services,
    });

    await user.click(await screen.findByRole('button', { name: 'Check my pronunciation' }));
    expect(await screen.findByText(/That matched/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Record result and continue/ }));

    expect(await screen.findByText('I have to go.')).toBeInTheDocument();
    const [attempt] = await services.storage.attempts.recent(1);
    expect(attempt).toMatchObject({ grade: 'good', correct: true, exerciseKind: 'think-say' });
    expect(attempt?.sessionId).toMatch(/^mission:morning-routine:use:700001:/);
  });

  it('continues a finished tracked session into the Use stage', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <>
        <SessionScreen />
        <Where />
      </>,
      {
        route: '/session?preset=speaking&size=items:1&order=sequential&mission=morning-routine',
      },
    );

    await screen.findByText('1/1');
    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));
    await user.click(await screen.findByRole('button', { name: /Continue to Use/ }));

    expect(screen.getByTestId('where')).toHaveTextContent('/es/all/mission/morning-routine/use');
  });
});
