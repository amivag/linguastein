/**
 * The voice control is on every screen, and it is the same control Settings
 * shows. These tests hold both halves of that: presence, and one source of
 * truth for what it changes.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NOOP_PLAYBACK, type AudioService, type TtsVoice } from '../../src/audio';
import { HomeScreen } from '../../src/features/home/HomeScreen';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import type { Preferences } from '../../src/storage';
import { expectNoViolations } from '../a11y/axe';
import { renderWithServices, testServices } from '../fixtures/services';

const MONICA: TtsVoice = { name: 'Mónica', locale: 'es-ES', isDefault: true };
const PAULINA: TtsVoice = { name: 'Paulina', locale: 'es-MX', isDefault: false };

/** A device with Spanish voices installed, unlike the silent default. */
function speakingAudio(voices: readonly TtsVoice[] = [MONICA, PAULINA]): AudioService {
  return {
    play: () => Promise.resolve(NOOP_PLAYBACK),
    speak: vi.fn(() => Promise.resolve(NOOP_PLAYBACK)),
    stop: vi.fn(),
    canPlay: () => voices.length > 0,
    canSpeak: () => voices.length > 0,
    voicesFor: () => voices,
    voiceFor: (_locale, preferred) => voices.find((v) => v.name === preferred) ?? voices[0],
    ready: () => Promise.resolve(),
  };
}

const openMenu = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^Voice:/ }));
  return { user, menu: await screen.findByRole('dialog', { name: 'Voice' }) };
};

describe('the voice control in the header', () => {
  it('is present on an ordinary screen and names the voice that will speak', async () => {
    renderWithServices(<HomeScreen />, {
      services: testServices({ audio: speakingAudio() }),
    });

    expect(
      await screen.findByRole('button', { name: 'Voice: Mónica (es-ES). Open voice settings' }),
    ).toBeInTheDocument();
  });

  it('says so when the device has no voice for the language, rather than staying blank', async () => {
    renderWithServices(<HomeScreen />, {
      services: testServices({ audio: speakingAudio([]) }),
    });

    expect(
      await screen.findByRole('button', {
        name: 'Voice: none installed for es-ES. Open voice settings',
      }),
    ).toBeInTheDocument();
  });

  it('opens a dialog with the accent, voice and playback controls', async () => {
    renderWithServices(<HomeScreen />, {
      services: testServices({ audio: speakingAudio() }),
    });

    const { menu } = await openMenu();

    expect(within(menu).getByLabelText('Accent')).toHaveValue('es-ES');
    expect(within(menu).getByLabelText('Voice')).toBeInTheDocument();
    expect(within(menu).getByLabelText('Play audio automatically')).toBeInTheDocument();
    expect(within(menu).getByLabelText('Prefer slow playback')).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Test voice' })).toBeInTheDocument();
  });

  it('escapes the sticky header stacking context', async () => {
    renderWithServices(<HomeScreen />, {
      services: testServices({ audio: speakingAudio() }),
    });

    const { menu } = await openMenu();

    // `backdrop-filter` makes the sticky header a containing block for fixed
    // descendants on Chrome. The overlay must be portalled directly to body or
    // the dialog is visually clipped to the header even though its DOM exists.
    expect(menu.parentElement?.parentElement).toBe(document.body);
  });

  it('writes a voice change to the same preference Settings writes', async () => {
    const changes: Partial<Preferences>[] = [];
    renderWithServices(<HomeScreen />, {
      services: testServices({ audio: speakingAudio() }),
      updatePreferences: (patch) => changes.push(patch),
    });

    const { user, menu } = await openMenu();
    await user.selectOptions(within(menu).getByLabelText('Voice'), 'Paulina');

    expect(changes).toEqual([{ voiceName: 'Paulina' }]);
  });

  it('drops a voice picked for one accent when the accent changes', async () => {
    const changes: Partial<Preferences>[] = [];
    renderWithServices(<HomeScreen />, {
      services: testServices({ audio: speakingAudio() }),
      updatePreferences: (patch) => changes.push(patch),
    });

    const { user, menu } = await openMenu();
    await user.selectOptions(within(menu).getByLabelText('Accent'), 'es-MX');

    expect(changes).toEqual([{ pronunciationLocale: 'es-MX', voiceName: '' }]);
  });

  it('speaks a sample on request and can be stopped again', async () => {
    const audio = speakingAudio();
    renderWithServices(<HomeScreen />, { services: testServices({ audio }) });

    const { user, menu } = await openMenu();
    await user.click(within(menu).getByRole('button', { name: 'Test voice' }));
    expect(audio.speak).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'es-ES', text: expect.any(String) }),
    );

    await user.click(within(menu).getByRole('button', { name: 'Stop' }));
    expect(audio.stop).toHaveBeenCalled();
  });

  it('closes on Escape and gives focus back to the chip that opened it', async () => {
    renderWithServices(<HomeScreen />, { services: testServices({ audio: speakingAudio() }) });

    const { user } = await openMenu();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Voice' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^Voice:/ })).toHaveFocus();
  });

  it('has no WCAG violations while open', async () => {
    const { container } = renderWithServices(<HomeScreen />, {
      services: testServices({ audio: speakingAudio() }),
    });

    await openMenu();
    await expectNoViolations(container);
  });
});

describe('the Settings audio section', () => {
  it('offers the same controls, so neither surface is the poorer one', async () => {
    renderWithServices(<SettingsScreen />, {
      services: testServices({ audio: speakingAudio() }),
      route: '/settings',
    });

    const audio = (await screen.findByRole('region', { name: 'Audio' })) as HTMLElement;
    expect(within(audio).getByLabelText('Accent')).toBeInTheDocument();
    expect(within(audio).getByLabelText('Voice')).toBeInTheDocument();
    expect(within(audio).getByRole('button', { name: 'Test voice' })).toBeInTheDocument();
  });
});
