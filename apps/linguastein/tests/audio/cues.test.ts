/**
 * Verdict cues: synthesised on demand, quiet, and never a failure.
 */

import { describe, expect, it, vi } from 'vitest';
import { createAudioService, createWebAudioCues, NO_CUES, type CueContext } from '../../src/audio';
import { testRepository } from '../fixtures/pack';

interface Played {
  readonly hz: number[];
  start: number;
  stop: number;
}

function fakeContext(state = 'running') {
  const oscillators: Played[] = [];
  const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const resume = vi.fn(() => Promise.resolve());
  const context: CueContext = {
    currentTime: 10,
    state,
    destination: {},
    resume,
    createGain: () => ({ gain: param(), connect: vi.fn() }),
    createOscillator: () => {
      const record: Played = { hz: [], start: 0, stop: 0 };
      oscillators.push(record);
      return {
        type: '',
        frequency: {
          setValueAtTime: (value: number) => record.hz.push(value),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: (when: number) => {
          record.start = when;
        },
        stop: (when: number) => {
          record.stop = when;
        },
      };
    },
  };
  return { context, oscillators, resume };
}

describe('createWebAudioCues', () => {
  it('creates its context on the first cue, not before, and reuses it', () => {
    const { context } = fakeContext();
    const factory = vi.fn(() => context);
    const cues = createWebAudioCues(factory);

    expect(cues.isAvailable()).toBe(true);
    expect(factory).not.toHaveBeenCalled();
    cues.play('correct');
    cues.play('incorrect');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('rises for a match and stays low for a miss, all of it brief', () => {
    const correct = fakeContext();
    createWebAudioCues(() => correct.context).play('correct');
    const pitches = correct.oscillators.map((o) => o.hz[0] ?? 0);
    expect(pitches.length).toBeGreaterThan(1);
    expect(pitches[1]).toBeGreaterThan(pitches[0] ?? 0);

    const miss = fakeContext();
    createWebAudioCues(() => miss.context).play('incorrect');
    expect(miss.oscillators[0]?.hz[0]).toBeLessThan(pitches[0] ?? 0);

    for (const o of [...correct.oscillators, ...miss.oscillators]) {
      expect(o.start).toBeGreaterThanOrEqual(10);
      expect(o.stop - 10).toBeLessThan(0.5);
    }
  });

  it('wakes a context the browser started suspended', () => {
    const { context, resume } = fakeContext('suspended');
    createWebAudioCues(() => context).play('correct');
    expect(resume).toHaveBeenCalled();
  });

  it('swallows a device that will not make the sound', () => {
    const cues = createWebAudioCues(() => {
      throw new Error('no audio');
    });
    expect(() => cues.play('incorrect')).not.toThrow();
  });

  it('is unavailable where there is no Web Audio', () => {
    expect(createWebAudioCues(undefined)).toBe(NO_CUES);
    expect(NO_CUES.isAvailable()).toBe(false);
    expect(() => NO_CUES.play('correct')).not.toThrow();
  });
});

describe('the audio service', () => {
  it('lays a cue over playback without touching the playing state', () => {
    const play = vi.fn();
    const audio = createAudioService({
      repository: testRepository(),
      assetBaseUrl: 'https://example.test/',
      cues: { isAvailable: () => true, play },
    });

    expect(audio.canCue()).toBe(true);
    audio.cue('correct');
    expect(play).toHaveBeenCalledWith('correct');
    expect(audio.playing()).toBeNull();
  });

  it('makes no cue without a player', () => {
    const audio = createAudioService({
      repository: testRepository(),
      assetBaseUrl: 'https://example.test/',
    });
    expect(audio.canCue()).toBe(false);
    expect(() => audio.cue('incorrect')).not.toThrow();
  });
});
