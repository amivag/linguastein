/**
 * Reading along: a passage played line by line, with the transport that makes
 * that usable — where it has got to, holding it, dropping it, and picking a line
 * to carry on from.
 *
 * These render a real `AudioService` over a scripted voice rather than the
 * silent stub, because everything under test here *is* the playing state: the
 * position, the line marked `aria-current`, the word lit inside it, and what a
 * line's own button means while a queue is running.
 */

import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createAudioService, type SpeechSpan, type TtsProvider } from '../../src/audio';
import { PassageScreen } from '../../src/features/read/PassageScreen';
import { testRepository } from '../fixtures/pack';
import { renderWithServices, testServices } from '../fixtures/services';

/** A voice that speaks until the test says the sentence has finished. */
function scriptedTts() {
  const spoken: string[] = [];
  const progress: ((span: SpeechSpan) => void)[] = [];
  let end: (() => void) | undefined;

  const provider: TtsProvider = {
    id: 'scripted',
    isAvailable: () => true,
    hasVoiceFor: () => true,
    speak: (request) => {
      spoken.push(request.text);
      const done = new Promise<void>((resolve) => {
        end = resolve;
      });
      return Promise.resolve({
        stop: () => end?.(),
        pause: () => {},
        resume: () => {},
        onProgress: (listener: (span: SpeechSpan) => void) => {
          progress.push(listener);
          return () => {};
        },
        done,
      });
    },
  };

  return {
    provider,
    spoken,
    finish: () => act(async () => void end?.()),
    boundary: (span: SpeechSpan) =>
      act(async () => {
        for (const listener of progress) listener(span);
      }),
  };
}

/** The dialogue in the fixture pack: two lines, both spoken by the device. */
function readDialogue() {
  const voice = scriptedTts();
  const audio = createAudioService({
    repository: testRepository(),
    assetBaseUrl: 'https://example.test/packs/',
    tts: voice.provider,
  });

  renderWithServices(
    <Routes>
      <Route path="/read/:id" element={<PassageScreen />} />
    </Routes>,
    { route: '/read/700002', services: testServices({ audio }) },
  );

  return { voice, user: userEvent.setup() };
}

const lines = () => screen.getAllByRole('listitem');

describe('reading a passage aloud', () => {
  it('reads one line at a time and says which line it is on', async () => {
    const { voice, user } = readDialogue();
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Listen' }));

    expect(voice.spoken).toEqual(['¿Tienes tiempo?']);
    expect(screen.getByText('Sentence 1 of 2')).toBeInTheDocument();
    expect(lines()[0]).toHaveAttribute('aria-current', 'true');
    expect(lines()[1]).not.toHaveAttribute('aria-current');

    await voice.finish();

    expect(voice.spoken).toEqual(['¿Tienes tiempo?', 'Tengo que irme.']);
    expect(await screen.findByText('Sentence 2 of 2')).toBeInTheDocument();
    expect(lines()[1]).toHaveAttribute('aria-current', 'true');
  });

  it('holds where it is and picks up again', async () => {
    const { user } = readDialogue();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Listen' }));

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    // Still where it was: pausing is not stopping, and the line stays marked.
    expect(screen.getByText('Sentence 1 of 2')).toBeInTheDocument();
    expect(lines()[0]).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('drops the reading entirely on Stop', async () => {
    const { user } = readDialogue();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Listen' }));

    await user.click(screen.getByRole('button', { name: 'Stop' }));

    expect(screen.getByRole('button', { name: 'Listen' })).toBeInTheDocument();
    expect(screen.queryByText(/^Sentence /)).not.toBeInTheDocument();
    expect(lines()[0]).not.toHaveAttribute('aria-current');
  });

  it('keeps the same controls in every state, so none appears under a thumb', async () => {
    /*
     * The transport was one button while idle and three controls while playing,
     * so Pause and Stop appeared where the single button had been and everything
     * under them jumped — at the moment a thumb was on its way back to the
     * screen. The controls are all present now and Stop is merely disabled while
     * there is nothing to stop.
     */
    const { user } = readDialogue();
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
    // The readout holds the row's shape, and says how long the thing is before
    // it starts rather than filling space.
    expect(screen.getByText('2 sentences')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Listen' }));

    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('stops the reading from the line that is speaking, which is what its bars offer', async () => {
    // The line being read swaps its play icon for moving bars, and the control a
    // learner reaches for while a voice is talking is the one that started it.
    // Pressing it played the line again.
    const { voice, user } = readDialogue();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Listen' }));

    await user.click(screen.getByRole('button', { name: 'Stop reading “¿Tienes tiempo?”' }));

    expect(screen.getByRole('button', { name: 'Listen' })).toBeInTheDocument();
    expect(lines()[0]).not.toHaveAttribute('aria-current');
    // Stopped rather than restarted: the voice was asked for that line once.
    expect(voice.spoken).toEqual(['¿Tienes tiempo?']);
  });

  it('goes back to “carry on from here” while the reading is held', async () => {
    // Held, the bars are still and the line is a place to pick up from, so the
    // button keeps the meaning it has for every other line.
    const { user } = readDialogue();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Listen' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    expect(screen.getByRole('button', { name: 'Play from “¿Tienes tiempo?”' })).toBeInTheDocument();
  });

  it('offers one line on its own, and carries on from a line once it is reading', async () => {
    const { voice, user } = readDialogue();
    await screen.findByRole('heading', { level: 1 });

    // Nothing playing: a line's button is that line, and nothing after it.
    await user.click(screen.getByRole('button', { name: 'Listen to “Tengo que irme.”' }));
    expect(voice.spoken).toEqual(['Tengo que irme.']);
    expect(screen.queryByText(/^Sentence /)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await user.click(screen.getByRole('button', { name: 'Listen' }));

    // Reading: the same button means "carry on from here", and says so.
    expect(screen.queryByRole('button', { name: 'Listen to “Tengo que irme.”' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Play from “Tengo que irme.”' }));

    expect(voice.spoken.at(-1)).toBe('Tengo que irme.');
    expect(screen.getByText('Sentence 2 of 2')).toBeInTheDocument();
  });

  it('lights the word the voice is on, and moves it', async () => {
    const { voice, user } = readDialogue();
    await screen.findByRole('heading', { level: 1 });

    await user.click(screen.getByRole('button', { name: 'Listen to “Tengo que irme.”' }));
    const line = within(lines()[1]!);
    // The highlight is decoration and carries no ARIA — deliberately, since it
    // moves several times a second — so the class is what there is to assert.
    // CSS modules hash it, hence the match rather than an equality.
    const lit = (text: string) =>
      /speaking/.test(
        line.getByRole('button', { name: `About “${text}” in “Tengo que irme.”` }).className,
      );

    // `Tengo que irme.` — `que` starts at 6, `irme` at 10.
    await voice.boundary({ start: 6, end: 9 });
    expect(lit('que')).toBe(true);
    expect(lit('Tengo')).toBe(false);

    await voice.boundary({ start: 10, end: 14 });
    expect(lit('irme')).toBe(true);
    expect(lit('que')).toBe(false);
  });
});
