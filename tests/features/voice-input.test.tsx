/**
 * Dictation into a text field, and the way out of it.
 *
 * The recogniser decides when a listen is over, and a noisy room can stop it
 * ever deciding, so the mic has to be a toggle and leaving the screen has to
 * release the microphone. Without both, a learner who taps the mic once is left
 * with a control that says "listening" and no way to end it.
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SPEECH_ABORTED, type SpeechRecognitionProvider, type SpeechResult } from '../../src/audio';
import { VoiceInput } from '../../src/components/VoiceInput';
import { renderWithServices, testServices } from '../fixtures/services';

/** A recogniser that listens until something stops it, as a real one may. */
function openMic() {
  let end: ((reason: Error) => void) | undefined;
  let heard: ((result: SpeechResult) => void) | undefined;
  const provider: SpeechRecognitionProvider = {
    id: 'open-mic',
    isAvailable: () => true,
    supportsLanguage: () => true,
    listen: () =>
      new Promise<SpeechResult>((resolve, reject) => {
        heard = resolve;
        end = reject;
      }),
    stop: () => {
      stops.count += 1;
      end?.(new Error(SPEECH_ABORTED));
    },
  };
  const stops = { count: 0 };
  return { provider, stops, say: (text: string) => heard?.({ transcript: text, confidence: 0.9 }) };
}

function render(speech: SpeechRecognitionProvider, onResult: (text: string) => void = () => {}) {
  return renderWithServices(
    <VoiceInput label="Search by voice" locale="es-ES" onResult={onResult} />,
    { services: testServices({ speech }) },
  );
}

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
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('exposes listening as ARIA state, not colour alone', async () => {
    const user = userEvent.setup();
    render(openMic().provider);

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Listening…');
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

  it('reports a listen that failed for a reason of its own', async () => {
    const user = userEvent.setup();
    const failing: SpeechRecognitionProvider = {
      id: 'failing',
      isAvailable: () => true,
      supportsLanguage: () => true,
      listen: () => Promise.reject(new Error('no-speech')),
      stop: () => {},
    };
    render(failing);

    await user.click(screen.getByRole('button', { name: 'Search by voice' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not hear that.');
  });

  it('is absent where the browser cannot listen', () => {
    renderWithServices(<VoiceInput label="Search by voice" locale="es-ES" onResult={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
