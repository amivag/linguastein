/**
 * Optional sound and haptics on checked answers (`docs/tasks/game-feel.md` §4.6).
 *
 * What has to hold: both are off until asked for; a checked answer makes the
 * sound and the buzz that match its verdict; a self-rated card makes neither,
 * because it proves nothing; and a setting is offered only where the device can
 * act on it.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Haptics } from '@platform/web';
import { SessionScreen } from '../../src/features/practice/SessionScreen';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { DEFAULT_PREFERENCES, type Preferences } from '../../src/storage';
import { renderWithServices, stubAudio, testServices } from '../fixtures/services';

const CHOICE = /beer|water|bread|coffee/;

function devices() {
  const cue = vi.fn();
  const pulse = vi.fn();
  const haptics: Haptics = { isAvailable: () => true, pulse };
  return { cue, pulse, audio: stubAudio({ cue, canCue: () => true }), haptics };
}

describe('on a checked answer', () => {
  const answer = async (preferences: Partial<Preferences>) => {
    const { cue, pulse, audio, haptics } = devices();
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      services: testServices({
        audio,
        haptics,
        preferences: { ...DEFAULT_PREFERENCES, ...preferences },
      }),
      route: '/session?preset=vocabulary&size=items:1',
    });
    const choices = await screen.findAllByRole('button', { name: CHOICE });
    await user.click(choices[0]!);
    const verdict = await screen.findByRole('status');
    const correct = verdict.textContent?.includes('¡Correcto!') ?? false;
    return { cue, pulse, correct, choices, user };
  };

  it('is silent and still by default', async () => {
    const { cue, pulse } = await answer({});
    expect(cue).not.toHaveBeenCalled();
    expect(pulse).not.toHaveBeenCalled();
  });

  it('plays the cue and buzz that match the verdict, once', async () => {
    const { cue, pulse, correct, choices, user } = await answer({
      feedbackSound: true,
      feedbackHaptics: true,
    });

    expect(cue).toHaveBeenCalledExactlyOnceWith(correct ? 'correct' : 'incorrect');
    expect(pulse).toHaveBeenCalledExactlyOnceWith(correct ? 'confirm' : 'miss');

    // A second tap on an answered card is not a second answer.
    await user.click(choices[1] ?? choices[0]!);
    expect(cue).toHaveBeenCalledTimes(1);
  });

  it('honours each setting on its own', async () => {
    const { cue, pulse } = await answer({ feedbackSound: false, feedbackHaptics: true });
    expect(cue).not.toHaveBeenCalled();
    expect(pulse).toHaveBeenCalledTimes(1);
  });
});

describe('on a self-rated card', () => {
  it('makes no sound and no buzz, whatever the settings', async () => {
    const { cue, pulse, audio, haptics } = devices();
    const user = userEvent.setup();
    renderWithServices(<SessionScreen />, {
      services: testServices({
        audio,
        haptics,
        preferences: { ...DEFAULT_PREFERENCES, feedbackSound: true, feedbackHaptics: true },
      }),
      route: '/session?preset=flashcards&size=items:1&order=sequential',
    });

    await user.click(await screen.findByRole('button', { name: 'Reveal' }));
    await user.click(screen.getByRole('button', { name: 'Good' }));

    expect(cue).not.toHaveBeenCalled();
    expect(pulse).not.toHaveBeenCalled();
  });
});

describe('the settings', () => {
  it('are offered off where the device can act on them, and write their own field', async () => {
    const { audio, haptics } = devices();
    const user = userEvent.setup();
    const written: Partial<Preferences>[] = [];
    renderWithServices(<SettingsScreen />, {
      services: testServices({ audio, haptics }),
      route: '/settings',
      updatePreferences: (patch) => written.push(patch),
    });

    const sound = await screen.findByRole('checkbox', { name: 'Sound on checked answers' });
    const vibrate = screen.getByRole('checkbox', { name: 'Vibrate on checked answers' });
    expect(sound).not.toBeChecked();
    expect(vibrate).not.toBeChecked();

    await user.click(sound);
    await user.click(vibrate);
    expect(written).toEqual([{ feedbackSound: true }, { feedbackHaptics: true }]);
  });

  it('are absent where the device cannot make a sound or a buzz', async () => {
    renderWithServices(<SettingsScreen />, { route: '/settings' });

    await screen.findByRole('checkbox', { name: 'Show elapsed time' });
    expect(screen.queryByRole('checkbox', { name: /on checked answers/ })).not.toBeInTheDocument();
  });
});
