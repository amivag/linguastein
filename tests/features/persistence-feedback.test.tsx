/** A verdict must not masquerade as a durable save, and retry must retain evidence ids. */
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { StudyScreen } from '../../src/features/study/StudyScreen';
import { createMemoryStorage, type LearnerStorage } from '../../src/storage';
import { renderWithServices, testServices } from '../fixtures/services';

function unreliable() {
  const base = createMemoryStorage();
  let fails = true;
  const storage: LearnerStorage = {
    ...base,
    transaction: (operation) =>
      base.transaction((tx) =>
        operation({
          ...tx,
          progress: {
            ...tx.progress,
            put: async (row) => {
              if (fails) throw new Error('Quota');
              await tx.progress.put(row);
            },
          },
        }),
      ),
  };
  return {
    base,
    storage,
    recover: () => {
      fails = false;
    },
  };
}
async function finishSpeaking(storage: LearnerStorage) {
  const user = userEvent.setup();
  renderWithServices(<SessionScreen />, {
    services: testServices({ storage }),
    route: '/session?preset=speaking&size=items:1&order=sequential',
  });
  await user.click(await screen.findByRole('button', { name: 'Reveal' }));
  await user.click(screen.getByRole('button', { name: 'Good' }));
  return user;
}

describe('persistence feedback', () => {
  it('reports an atomic save failure, retries it and does not count the answer twice', async () => {
    const { base, storage, recover } = unreliable();
    const user = await finishSpeaking(storage);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
    expect(screen.queryByText(/Progress saved on this device/)).not.toBeInTheDocument();
    expect(await base.attempts.count()).toBe(0);
    expect(await base.progress.count()).toBe(0);
    recover();
    await user.click(screen.getByRole('button', { name: 'Retry saving' }));
    expect(await screen.findByText(/Progress saved on this device/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await base.attempts.count()).toBe(1);
    expect((await base.progress.all())[0]?.attempts).toBe(1);
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('does not report saved while a practice write is pending', async () => {
    const base = createMemoryStorage();
    let finish: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const storage: LearnerStorage = {
      ...base,
      transaction: async (operation) => {
        await held;
        return base.transaction(operation);
      },
    };
    await finishSpeaking(storage);
    expect(await screen.findByText(/Session complete. Saving progress/)).toBeInTheDocument();
    expect(screen.queryByText(/Progress saved on this device/)).not.toBeInTheDocument();
    await act(async () => finish!());
    expect(await screen.findByText(/Progress saved on this device/)).toBeInTheDocument();
  });

  it('also reports a failed session summary write and retries only that record', async () => {
    const base = createMemoryStorage();
    let fails = true;
    const storage: LearnerStorage = {
      ...base,
      sessions: {
        ...base.sessions,
        put: async (row) => {
          if (fails) throw new Error('Quota');
          await base.sessions.put(row);
        },
      },
    };
    const user = await finishSpeaking(storage);
    await screen.findByRole('alert');
    expect(await base.attempts.count()).toBe(1);
    expect(await base.sessions.count()).toBe(0);
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Retry saving' }));
    await screen.findByText(/Progress saved on this device/);
    expect(await base.attempts.count()).toBe(1);
    expect(await base.sessions.count()).toBe(1);
  });

  it('retries all number-pattern evidence as one assessment without regrading', async () => {
    const { base, storage, recover } = unreliable();
    const user = userEvent.setup();
    renderWithServices(<StudyScreen />, {
      services: testServices({ storage }),
      route: '/es/all/study?tab=numbers',
    });
    const answer = await screen.findByRole('textbox', { name: /The number, in (words|digits)/ });
    await user.type(answer, 'zzzz');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await screen.findByRole('alert');
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(await base.attempts.count()).toBe(0);
    recover();
    await user.click(screen.getByRole('button', { name: 'Retry saving' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    const attempts = await base.attempts.all();
    expect(attempts.length).toBeGreaterThan(0);
    expect((await base.progress.all()).every((row) => row.attempts === 1)).toBe(true);
    expect(attempts.every((row) => row.grade === 'again')).toBe(true);
  });
});

it('retries the original evidence after a committed write loses its acknowledgement', async () => {
  const base = createMemoryStorage();
  let lost = true;
  const storage: LearnerStorage = {
    ...base,
    transaction: async (operation) => {
      const result = await base.transaction(operation);
      if (lost) {
        lost = false;
        throw new Error('Lost acknowledgement');
      }
      return result;
    },
  };
  const user = await finishSpeaking(storage);
  await screen.findByRole('alert');
  expect(await base.attempts.count()).toBe(1);
  await user.click(screen.getByRole('button', { name: 'Retry saving' }));
  await screen.findByText(/Progress saved on this device/);
  expect(await base.attempts.count()).toBe(1);
  expect((await base.progress.all())[0]?.attempts).toBe(1);
});
