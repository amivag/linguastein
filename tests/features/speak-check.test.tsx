import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPEECH_ABORTED, type SpeechRecognitionProvider, type SpeechResult } from '../../src/audio';
import { SpeakCheck } from '../../src/features/practice/SpeakCheck';
import { renderWithServices, testServices } from '../fixtures/services';

function fakeSpeech(result: SpeechResult | Error): SpeechRecognitionProvider {
  return {
    id: 'fake',
    isAvailable: () => true,
    supportsLanguage: () => true,
    stop: () => {},
    listen: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
  };
}

/** A recogniser that listens until something stops it, as a real one may. */
function openMic(): SpeechRecognitionProvider {
  let end: ((reason: Error) => void) | undefined;
  return {
    id: 'open-mic',
    isAvailable: () => true,
    supportsLanguage: () => true,
    listen: () => new Promise<SpeechResult>((_, reject) => (end = reject)),
    stop: () => end?.(new Error(SPEECH_ABORTED)),
  };
}

/**
 * A recogniser the test drives from outside: the level, the provisional text
 * and the outcome, each at the moment the test chooses. What the UI does
 * *during* a listen is the whole point of the meter, and a promise that has
 * already settled cannot show any of it.
 */
function meteredMic() {
  const control = {
    level: undefined as ((level: number) => void) | undefined,
    partial: undefined as ((text: string) => void) | undefined,
    finish: (_outcome: SpeechResult | Error) => {},
  };

  const provider: SpeechRecognitionProvider = {
    id: 'metered',
    isAvailable: () => true,
    supportsLanguage: () => true,
    stop: () => control.finish(new Error(SPEECH_ABORTED)),
    listen: (_locale, options) =>
      new Promise<SpeechResult>((resolve, reject) => {
        control.level = options?.onLevel;
        control.partial = options?.onPartial;
        control.finish = (outcome) =>
          outcome instanceof Error ? reject(outcome) : resolve(outcome);
      }),
  };

  return { provider, control };
}

const press = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Check my pronunciation' }));

const render = (result: SpeechResult | Error) =>
  renderWithServices(<SpeakCheck expected="Tengo que trabajar." />, {
    services: testServices({ speech: fakeSpeech(result) }),
  });

describe('SpeakCheck', () => {
  it('confirms a correct attempt', async () => {
    const user = userEvent.setup();
    render({ transcript: 'tengo que trabajar', confidence: 0.9 });

    await user.click(screen.getByRole('button', { name: 'Check my pronunciation' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('That matched');
    expect(status).toHaveTextContent('tengo que trabajar');
  });

  it('flags a partial attempt as close rather than wrong', async () => {
    const user = userEvent.setup();
    render({ transcript: 'tengo que', confidence: 0.8 });

    await user.click(screen.getByRole('button', { name: 'Check my pronunciation' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Close');
  });

  it('picks the alternative that matches the target', async () => {
    const user = userEvent.setup();
    render({
      transcript: 'ten go kay tra bahar',
      confidence: 0.4,
      alternatives: ['ten go kay tra bahar', 'tengo que trabajar'],
    });

    await user.click(screen.getByRole('button', { name: 'Check my pronunciation' }));
    expect(await screen.findByRole('status')).toHaveTextContent('That matched');
  });

  it('accepts any response in a semantic palette', async () => {
    const user = userEvent.setup();
    renderWithServices(
      <SpeakCheck expected={['Muy bien, gracias.', 'Más o menos.', 'Estoy cansado.']} />,
      {
        services: testServices({
          speech: fakeSpeech({ transcript: 'mas o menos', confidence: 0.9 }),
        }),
      },
    );

    await user.click(screen.getByRole('button', { name: 'Check my pronunciation' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('That matched');
    expect(status).toHaveTextContent('Matched response: “Más o menos.”');
  });

  it('explains a blocked microphone instead of failing silently', async () => {
    const user = userEvent.setup();
    render(new Error('not-allowed'));

    await user.click(screen.getByRole('button', { name: 'Check my pronunciation' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Microphone access was blocked');
  });

  it('can be stopped by pressing again, since a recogniser may not end itself', async () => {
    const user = userEvent.setup();
    renderWithServices(<SpeakCheck expected="Tengo que trabajar." />, {
      services: testServices({ speech: openMic() }),
    });

    await user.click(screen.getByRole('button', { name: 'Check my pronunciation' }));
    const stop = await screen.findByRole('button', { name: 'Stop listening' });
    expect(stop).toHaveAttribute('aria-pressed', 'true');

    await user.click(stop);

    // Back to the resting control, and no failure reported: the learner chose
    // to stop, which is not the recogniser having heard nothing.
    expect(await screen.findByRole('button', { name: 'Check my pronunciation' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('says nothing at all where the browser cannot listen', () => {
    renderWithServices(<SpeakCheck expected="Tengo que trabajar." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

/**
 * Feedback while it listens.
 *
 * Without it, a listen that fails is indistinguishable from a listen that never
 * started — which is how this presented on Android, and why the first thing
 * anyone tries is saying it louder.
 */
describe('SpeakCheck while listening', () => {
  it('shows the level the microphone is reporting', async () => {
    const user = userEvent.setup();
    const { provider, control } = meteredMic();
    const { container } = renderWithServices(<SpeakCheck expected="Tengo que trabajar." />, {
      services: testServices({ speech: provider }),
    });

    // Nothing at rest: a meter on an idle control claims a microphone is open
    // when none is.
    expect(container.querySelector('[data-level]')).toBeNull();

    await press(user);
    expect(container.querySelector('[data-level]')).toHaveAttribute('data-level', '0.00');

    act(() => control.level?.(0.42));
    const meter = container.querySelector('[data-level]');
    expect(meter).toHaveAttribute('data-level', '0.42');
    // The words beside it carry the state. A number that changes twenty times a
    // second is not something to announce.
    expect(meter).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows what the recogniser has heard before it commits to it', async () => {
    const user = userEvent.setup();
    const { provider, control } = meteredMic();
    renderWithServices(<SpeakCheck expected="Tengo que trabajar." />, {
      services: testServices({ speech: provider }),
    });

    await press(user);
    act(() => control.partial?.('tengo que'));

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Listening');
    expect(status).toHaveTextContent('tengo que');
  });

  it('silences whatever is playing before it starts', async () => {
    const user = userEvent.setup();
    const { provider } = meteredMic();
    const stop = vi.fn();
    const audio = { ...testServices().audio, stop };
    renderWithServices(<SpeakCheck expected="Tengo que trabajar." />, {
      services: testServices({ speech: provider, audio }),
    });

    await press(user);

    // Play, then Say it, is the ordinary way to use this screen — and on a
    // phone the recogniser and the speaker compete for one audio path, so a
    // voice still speaking is either heard as the learner or holds the focus
    // the recogniser needs.
    expect(stop).toHaveBeenCalled();
  });

  it('separates a microphone that heard nothing from a recogniser that returned nothing', async () => {
    const user = userEvent.setup();
    const { provider, control } = meteredMic();
    renderWithServices(<SpeakCheck expected="Tengo que trabajar." />, {
      services: testServices({ speech: provider }),
    });

    await press(user);
    act(() => control.level?.(0.5));
    await act(async () => {
      control.finish(new Error('no-speech'));
    });

    // Telling someone who plainly spoke to speak up sends them to fix the one
    // thing that is not broken.
    expect(screen.getByRole('status')).toHaveTextContent('Your microphone is working');
  });

  it('still tells a silent attempt to try louder', async () => {
    const user = userEvent.setup();
    const { provider, control } = meteredMic();
    renderWithServices(<SpeakCheck expected="Tengo que trabajar." />, {
      services: testServices({ speech: provider }),
    });

    await press(user);
    await act(async () => {
      control.finish(new Error('no-speech'));
    });

    expect(screen.getByRole('status')).toHaveTextContent('did not hear anything');
  });

  it('names a plain-HTTP page rather than reporting a mystery', async () => {
    const user = userEvent.setup();
    render(new Error('insecure-context'));

    await press(user);

    // The one failure a learner cannot diagnose from inside the app, and the
    // one most likely to be met while testing on a phone against a dev server.
    expect(await screen.findByRole('status')).toHaveTextContent('needs a secure page');
  });
});

describe('SpeakCheck on a microphone that stays silent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('says so, rather than sitting there listening', async () => {
    const user = userEvent.setup();
    const { provider } = meteredMic();
    renderWithServices(<SpeakCheck expected="Tengo que trabajar." />, {
      services: testServices({ speech: provider }),
    });

    await press(user);
    expect(screen.getByRole('status')).toHaveTextContent('Listening');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    // A blocked permission and a learner gathering their thoughts look
    // identical from the outside, for twenty seconds, otherwise.
    expect(screen.getByRole('status')).toHaveTextContent('Nothing is reaching the microphone');
  });
});
