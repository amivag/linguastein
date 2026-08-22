import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MissionScreen } from '../../src/features/missions/MissionScreen';
import { missionPracticePath } from '../../src/features/missions/mission-url';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { MISSIONS } from '../../src/app/missions';
import { renderWithServices } from '../fixtures/services';

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
    renderWithServices(missionRoutes(), {
      route: '/es/all/mission/morning-routine/use',
    });

    expect(await screen.findByText('I have to work.')).toBeInTheDocument();
    expect(screen.queryByText('Tengo que trabajar.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal the line' }));
    expect(screen.getByText('Tengo que trabajar.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    await user.click(screen.getByRole('button', { name: 'Reveal the line' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    expect(await screen.findByText('Mission complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish mission' })).toBeInTheDocument();
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
    await user.click(await screen.findByRole('button', { name: /Continue to role-play/ }));

    expect(screen.getByTestId('where')).toHaveTextContent('/es/all/mission/morning-routine/use');
  });
});
