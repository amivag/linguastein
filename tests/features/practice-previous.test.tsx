/** Going back to look at a card must not grade it a second time. */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { createMemoryStorage } from '../../src/storage';
import { renderWithServices, testServices } from '../fixtures/services';

function start(preset: string) {
  const storage = createMemoryStorage();
  renderWithServices(<SessionScreen />, {
    services: testServices({ storage }),
    route: `/session?preset=${preset}&size=items:2&order=sequential`,
  });
  return { storage, user: userEvent.setup() };
}

const previous = () => screen.getByRole('button', { name: 'Previous' });

describe('going back during a tracked session', () => {
  it('shows a typed answer as it was given, and cannot take a new one', async () => {
    const { storage, user } = start('writing');

    await user.type(await screen.findByRole('textbox'), 'nada de nada');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    const verdict = (await screen.findByRole('status')).textContent;
    await waitFor(async () => expect(await storage.attempts.count()).toBe(1));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.click(previous());

    const input = await screen.findByRole('textbox');
    expect(input).toBeDisabled();
    expect(input).toHaveValue('nada de nada');
    expect(screen.getByRole('status')).toHaveTextContent(verdict ?? '');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByRole('textbox')).toBeEnabled();
    expect(await storage.attempts.count()).toBe(1);
  });

  it('shows a self-rating as it was given, and cannot change it', async () => {
    const { storage, user } = start('speaking');

    await user.click(await screen.findByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Hard' }));
    await waitFor(async () => expect(await storage.attempts.count()).toBe(1));
    await user.click(await screen.findByRole('button', { name: 'Reveal' }));
    await user.click(previous());

    expect(await screen.findByText('You rated this Hard.')).toBeInTheDocument();
    for (const name of ['Again', 'Hard', 'Good', 'Easy']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(await storage.attempts.count()).toBe(1);
  });

  it('still lets a skipped card be answered, once', async () => {
    const { storage, user } = start('speaking');

    await screen.findByRole('button', { name: 'Reveal' });
    await user.click(screen.getByRole('button', { name: /Skip/ }));
    await user.click(previous());
    await user.click(await screen.findByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    await waitFor(async () => expect(await storage.attempts.count()).toBe(1));
  });

  it('keeps the summary to one answer per card', async () => {
    const { user } = start('speaking');

    await user.click(await screen.findByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));
    await user.click(await screen.findByRole('button', { name: 'Reveal' }));
    await user.click(previous());
    await user.click(await screen.findByRole('button', { name: /Skip/ }));
    await user.click(await screen.findByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    expect(await screen.findByText('2/2')).toBeInTheDocument();
  });
});
