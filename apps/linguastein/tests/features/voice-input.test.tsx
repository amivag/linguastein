/**
 * Dictation into a text field, and the way out of it.
 *
 * The recogniser decides when a listen is over, and a noisy room can stop it
 * ever deciding, so the mic has to be a toggle and leaving the screen has to
 * release the microphone. Without both, a learner who taps the mic once is left
 * with a control that says "listening" and no way to end it.
 *
 * The rest of this file is about what a listen *says*, which is the half that
 * was missing. A search box that reports nothing is indistinguishable from a
 * broken one, and on a phone reporting nothing is the common case: no level, no
 * provisional text, one message for eight causes, and an empty transcript
 * quietly clearing the field it was supposed to fill.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  SPEECH_ABORTED,
  type ListenOptions,
  type SpeechRecognitionProvider,
  type SpeechResult,
} from '../../src/audio';
import { VoiceInput } from '../../src/components/VoiceInput';
import { renderWithServices, testServices } from '../fixtures/services';

/** A recogniser that listens until something stops it, as a real one may. */
function openMic() {
  let end: ((reason: Error) => void) | undefined;
  let heard: ((result: SpeechResult) => void) | undefined;
  let options: ListenOptions = {};
  const provider: SpeechRecognitionProvider = {
    id: 'open-mic',
    isAvailable: () => true,
    supportsLanguage: () => true,
    listen: (_locale, listenOptions = {}) =>
      new Promise<SpeechResult>((resolve, reject) => {
        options = listenOptions;
        heard = resolve;
        end = reject;
      }),
    stop: () => {
      stops.count += 1;
      end?.(new Error(SPEECH_ABORTED));
    },
  };
  const stops = { count: 0 };
  return {
    provider,
    stops,
    say: (text: string) => heard?.({ transcript: text, confidence: 0.9 }),
    /** What the recogniser reports on the way, rather than at the end. */
    level: (value: number) => options.onLevel?.(value),
    partial: (text: string) => options.onPartial?.(text),
    fail: (reason: string) => end?.(new Error(reason)),
  };
}

/** A recogniser that rejects every listen with one reason. */
function failing(reason: string): SpeechRecognitionProvider {
  return {
    id: 'failing',
    isAvailable: () => true,
    supportsLanguage: () => true,
    listen: () => Promise.reject(new Error(reason)),
    stop: () => {},
  };
}

function render(
  speech: SpeechRecognitionProvider,
  onResult: (text: string) => void = () => {},
  helpPath?: string,
) {
  return renderWithServices(
    <VoiceInput
      label="Search by voice"
      locale="es-ES"
      onResult={onResult}
      {...(helpPath ? { helpPath } : {})}
    />,
    { services: testServices({ speech }) },
  );
}

const status = () => screen.getByRole('status', { name: 'Dictation' });

describe('VoiceInput', () => {
  it('hands the transcript to the field it sits beside', async () => {
    const user = userEvent.setup();
    const mic = openMic();
    const dictated: string[] = [];
    render(mic.provider, (text) => dictated.push(text));

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    mic.say('camarero');

    expect(await screen.findByRole('button', { name: 'Search by voice' })).toBeInTheDocument();
    expect(dictated).toEqual(['camarero']);
  });

  it('can be stopped by pressing again, since a recogniser may not end itself', async () => {
    const user = userEvent.setup();
    const mic = openMic();
    render(mic.provider);

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    const stop = await screen.findByRole('button', { name: 'Stop listening' });
    expect(stop).toHaveAttribute('aria-pressed', 'true');

    await user.click(stop);

    expect(await screen.findByRole('button', { name: 'Search by voice' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Choosing to stop is not the microphone having failed to hear anything.
    expect(status()).toHaveTextContent('');
  });

  it('exposes listening as ARIA state, not colour alone', async () => {
    const user = userEvent.setup();
    render(openMic().provider);

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    expect(await screen.findByRole('status', { name: 'Dictation' })).toHaveTextContent(
      'Listening…',
    );
  });

  it('releases the microphone when the screen goes away mid-listen', async () => {
    const user = userEvent.setup();
    const mic = openMic();
    const { unmount } = render(mic.provider);

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    await screen.findByRole('button', { name: 'Stop listening' });
    unmount();

    expect(mic.stops.count).toBe(1);
  });

  /*
   * The two channels a listen has while it is running. Both were available all
   * along and neither was asked for, which left the mic in a search box as the
   * one speech control in the app that could not say whether it was working.
   */
  it('asks for the level, so a voice reaching the microphone is visible', async () => {
    const user = userEvent.setup();
    const mic = openMic();
    render(mic.provider);

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    await screen.findByRole('button', { name: 'Stop listening' });

    expect(status().querySelector('[data-level]')).toHaveAttribute('data-level', '0.00');
    mic.level(0.4);
    await waitFor(() =>
      expect(status().querySelector('[data-level]')).toHaveAttribute('data-level', '0.40'),
    );
  });

  it('shows what the recogniser has heard before it commits to it', async () => {
    const user = userEvent.setup();
    const mic = openMic();
    render(mic.provider);

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    await screen.findByRole('button', { name: 'Stop listening' });
    mic.partial('cama');

    expect(await screen.findByText('cama')).toBeInTheDocument();
    // The provisional text replaces the placeholder rather than joining it.
    expect(status()).not.toHaveTextContent('Listening…');
  });

  /*
   * The reason, in the learner's terms rather than the browser's. One message
   * for every cause sent an Android learner to check a permission that was never
   * blocked, when the cause was a speech service with no Spanish in it.
   */
  it('names the cause of a failure rather than reporting one message for all of them', async () => {
    const user = userEvent.setup();
    render(failing('not-allowed'));

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    expect(await screen.findByRole('status', { name: 'Dictation' })).toHaveTextContent(
      /Microphone access was blocked/,
    );
  });

  it('distinguishes the recogniser refusing from the microphone being blocked', async () => {
    const user = userEvent.setup();
    render(failing('service-not-allowed'));

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    expect(await screen.findByRole('status', { name: 'Dictation' })).toHaveTextContent(
      /The microphone is not the problem/,
    );
  });

  it('sends a learner to the settings that hold the steps, where it is given one', async () => {
    const user = userEvent.setup();
    render(failing('network'), () => {}, '/es/a1/settings?tab=audio');

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    expect(await screen.findByRole('link', { name: 'How to fix speech input' })).toHaveAttribute(
      'href',
      '/es/a1/settings?tab=audio',
    );
  });

  it('reports a listen that heard nothing, rather than clearing the field with it', async () => {
    const user = userEvent.setup();
    const mic = openMic();
    const dictated: string[] = [];
    render(mic.provider, (text) => dictated.push(text));

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    mic.say('   ');

    expect(await screen.findByRole('status', { name: 'Dictation' })).toHaveTextContent(
      /answered, but with nothing in it/,
    );
    // The transcript is empty, and `onResult` writes into the field: handing it
    // over would wipe whatever the learner had typed and call that a success.
    expect(dictated).toEqual([]);
  });

  it('is absent where the browser cannot listen', () => {
    renderWithServices(<VoiceInput label="Search by voice" locale="es-ES" onResult={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
