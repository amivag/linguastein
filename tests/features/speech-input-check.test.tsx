/**
 * The Audio settings answer "why does the microphone not work?"
 *
 * A speaking exercise has room for one sentence, and the causes it is reporting
 * live outside the app — a permission, an insecure page, or an Android speech
 * service with no Spanish downloaded. This panel is where that gets explained,
 * so what it has to keep doing is: separate the microphone from the recogniser,
 * run a *real* listen rather than a simulated one, and hand back the raw reason
 * a learner can quote.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { type SpeechRecognitionProvider, type SpeechResult } from '../../src/audio';
import { AudioSettings } from '../../src/features/settings/AudioSettings';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { renderWithServices, testServices } from '../fixtures/services';

/** A recogniser the test settles by hand, so a listen can be observed mid-flight. */
function fakeSpeech(outcome: SpeechResult | Error, available = true): SpeechRecognitionProvider {
  return {
    id: 'fake',
    isAvailable: () => available,
    supportsLanguage: () => available,
    stop: () => {},
    listen: () => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome)),
  };
}

const heard = (transcript: string): SpeechResult => ({ transcript, confidence: 0.9 });

const audioSettings = (speech: SpeechRecognitionProvider) =>
  renderWithServices(<AudioSettings />, {
    services: testServices({ speech }),
    route: '/es/a1/settings?tab=audio',
  });

const test = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /Test speech input/ }));

describe('the speech input check', () => {
  it('reports the microphone and the recogniser as the separate things they are', async () => {
    audioSettings(fakeSpeech(heard('hola')));

    // Conflating these two is the bug the whole panel exists to undo: on a
    // phone the browser opens the microphone and something else transcribes.
    expect(screen.getByText('Microphone')).toBeInTheDocument();
    expect(screen.getByText('Speech recogniser')).toBeInTheDocument();
    expect(screen.getByText('Secure page')).toBeInTheDocument();
    expect(screen.getByText(/Recognition language/)).toBeInTheDocument();
  });

  it('never claims the language is installed, because no browser will say', async () => {
    audioSettings(fakeSpeech(heard('hola')));

    const row = screen.getByText(/Recognition language/).closest('li');
    expect(within(row as HTMLElement).getByText(/the test below is what finds out/)).toBeVisible();
  });

  it('says so when the browser has no recogniser at all', async () => {
    audioSettings(fakeSpeech(new Error('speech recognition unavailable'), false));

    expect(screen.getByText(/This browser has none/)).toBeInTheDocument();
    // Still offered, deliberately: this is the screen where pressing it is how
    // you find out, and the failure it produces carries the explanation.
    expect(screen.getByRole('button', { name: /Test speech input/ })).toBeEnabled();
  });

  it('quotes back what a working listen heard', async () => {
    const user = userEvent.setup();
    audioSettings(fakeSpeech(heard('me llamo Ana')));

    await test(user);

    const status = await screen.findByRole('status', { name: 'Speech input check' });
    expect(status).toHaveTextContent('Speech input works');
    expect(status).toHaveTextContent('me llamo Ana');
  });

  it('turns a refused speech service into steps and a reason to quote', async () => {
    const user = userEvent.setup();
    audioSettings(fakeSpeech(new Error('service-not-allowed')));

    await test(user);

    expect(await screen.findByRole('status', { name: 'Speech input check' })).toHaveTextContent(
      'The microphone is not the problem',
    );
    // The steps are the point: a summary alone is the state the app was already
    // in, and it is what left an Android learner with nothing to do.
    expect(screen.getByText(/Chrome and Edge transcribe/)).toBeVisible();
    // jsdom reports no user agent worth reading, so the advice lands on the
    // desktop branch here. Which branch is chosen is `speech-failure.test.ts`'s
    // to assert; what matters on this screen is that steps arrive at all.
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(6);
    expect(screen.getByText('service-not-allowed')).toBeInTheDocument();
  });

  it('does not report a listen the learner stopped as a failure', async () => {
    const user = userEvent.setup();
    audioSettings(fakeSpeech(new Error('aborted')));

    await test(user);

    const status = await screen.findByRole('status', { name: 'Speech input check' });
    expect(status).toHaveTextContent('Runs one real listen');
    expect(status).not.toHaveTextContent('unavailable');
  });
});

describe('the audio section', () => {
  it('holds both directions: what the app says and what it hears', async () => {
    renderWithServices(<SettingsScreen />, {
      services: testServices({ speech: fakeSpeech(heard('hola')) }),
      route: '/es/a1/settings?tab=audio',
    });

    expect(await screen.findByRole('heading', { name: 'Playback', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Speech input', level: 3 })).toBeInTheDocument();
    // The voice picker did not move out of Settings when input arrived beside it.
    expect(screen.getByLabelText('Accent')).toBeInTheDocument();
  });
});
