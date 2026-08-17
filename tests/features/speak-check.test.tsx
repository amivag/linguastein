import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SpeechRecognitionProvider, SpeechResult } from '../../src/audio';
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

  it('explains a blocked microphone instead of failing silently', async () => {
    const user = userEvent.setup();
    render(new Error('not-allowed'));

    await user.click(screen.getByRole('button', { name: 'Check my pronunciation' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Microphone access was blocked');
  });

  it('says nothing at all where the browser cannot listen', () => {
    renderWithServices(<SpeakCheck expected="Tengo que trabajar." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
