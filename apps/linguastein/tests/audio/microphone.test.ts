/**
 * The microphone behind the level meter.
 *
 * What is worth testing here is not the arithmetic — it is the handling of the
 * device. An open stream keeps the browser's recording indicator on and, on a
 * phone, keeps the microphone away from the next listen, so `close` giving
 * everything back is the contract. The rest is the two mistakes that make a
 * live microphone look dead: a context left suspended, whose analyser reads
 * pure silence, and a meter that tracks the gaps between syllables down to
 * nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebMicrophoneLevels, MICROPHONE_BUSY } from '../../src/audio';

/** Fills whatever buffer it is handed with one sample value. 128 is silence. */
class FakeAnalyser {
  fftSize = 0;
  sample = 128;

  getByteTimeDomainData(target: Uint8Array) {
    target.fill(this.sample);
  }
}

class FakeContext {
  static instances: FakeContext[] = [];

  state: 'suspended' | 'running' | 'closed' = 'suspended';
  resumes = 0;
  closes = 0;
  readonly analyser = new FakeAnalyser();
  /** Everything the microphone was wired into, so a route to the speakers shows up. */
  readonly connected: unknown[] = [];
  disconnects = 0;

  constructor() {
    FakeContext.instances.push(this);
  }

  /** The speakers. Connecting a live microphone to these is feedback. */
  readonly destination = { id: 'destination' };

  createMediaStreamSource() {
    return {
      connect: (target: unknown) => this.connected.push(target),
      disconnect: () => {
        this.disconnects += 1;
      },
    };
  }

  createAnalyser() {
    return this.analyser;
  }

  resume() {
    this.resumes += 1;
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    this.closes += 1;
    this.state = 'closed';
    return Promise.resolve();
  }
}

const track = () => ({ stopped: 0, stop() {} });
let tracks: { stopped: number; stop: () => void }[] = [];

/** A `getUserMedia` that grants, or refuses with a named DOMException-alike. */
function grantMicrophone(refusal?: string) {
  const getUserMedia = () => {
    if (refusal) {
      const error = new Error('refused');
      error.name = refusal;
      return Promise.reject(error);
    }
    const stopped = { stopped: 0, stop: () => {} };
    stopped.stop = () => {
      stopped.stopped += 1;
    };
    tracks = [stopped];
    return Promise.resolve({ getTracks: () => tracks } as unknown as MediaStream);
  };
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
}

const scope = globalThis as unknown as { AudioContext?: unknown };

beforeEach(() => {
  FakeContext.instances = [];
  tracks = [track()];
  scope.AudioContext = FakeContext;
  grantMicrophone();
});

afterEach(() => {
  delete scope.AudioContext;
  Reflect.deleteProperty(navigator, 'mediaDevices');
  vi.useRealTimers();
});

const context = () => FakeContext.instances[0]!;

describe('the microphone level provider', () => {
  it('reports itself unavailable where there is no microphone to open', () => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
    // Which is also what a page served over plain HTTP looks like: the whole
    // `mediaDevices` object is absent, not merely refused.
    expect(createWebMicrophoneLevels().isAvailable()).toBe(false);

    grantMicrophone();
    expect(createWebMicrophoneLevels().isAvailable()).toBe(true);
  });

  it('resumes a context that arrived suspended', async () => {
    const handle = await createWebMicrophoneLevels().open(() => {});

    // A suspended context reads pure silence, which is a live microphone that
    // looks broken — the exact failure the meter exists to rule out.
    expect(context().resumes).toBe(1);
    expect(context().state).toBe('running');
    handle.close();
  });

  it('reads the microphone without routing it to the speakers', async () => {
    const handle = await createWebMicrophoneLevels().open(() => {});

    expect(context().connected).toEqual([context().analyser]);
    expect(context().connected).not.toContain(context().destination);
    handle.close();
  });

  it('follows a voice up and falls back on a curve', async () => {
    vi.useFakeTimers();
    const levels: number[] = [];
    const handle = await createWebMicrophoneLevels().open((level) => levels.push(level));

    // A steady sample 12/128 from centre: loud enough to move the meter well
    // clear of its floor without pinning it.
    context().analyser.sample = 140;
    vi.advanceTimersByTime(50);
    expect(levels.at(-1)).toBeCloseTo(0.3, 2);

    // Silence now. The reading decays rather than dropping, because the gaps
    // between syllables are silent and a meter that tracked them would flicker.
    context().analyser.sample = 128;
    vi.advanceTimersByTime(50);
    expect(levels.at(-1)).toBeCloseTo(0.246, 2);

    handle.close();
  });

  it('gives the device back on close, and says the level is zero', async () => {
    vi.useFakeTimers();
    const levels: number[] = [];
    const handle = await createWebMicrophoneLevels().open((level) => levels.push(level));

    context().analyser.sample = 200;
    vi.advanceTimersByTime(50);
    handle.close();

    expect(tracks[0]!.stopped).toBe(1);
    expect(context().closes).toBe(1);
    expect(context().disconnects).toBe(1);
    // A meter left at its last reading would go on showing a voice nothing is
    // listening to any more.
    expect(levels.at(-1)).toBe(0);

    // Nothing keeps reporting, and a second close is not a second release.
    const reported = levels.length;
    vi.advanceTimersByTime(500);
    handle.close();
    expect(levels).toHaveLength(reported);
    expect(tracks[0]!.stopped).toBe(1);
  });

  it('translates the device failures into the reasons the UI explains', async () => {
    grantMicrophone('NotAllowedError');
    await expect(createWebMicrophoneLevels().open(() => {})).rejects.toThrow('not-allowed');

    // A microphone held by a call or another tab, which on a phone is ordinary
    // enough to be worth its own message rather than a generic capture failure.
    grantMicrophone('NotReadableError');
    await expect(createWebMicrophoneLevels().open(() => {})).rejects.toThrow(MICROPHONE_BUSY);

    grantMicrophone('NotFoundError');
    await expect(createWebMicrophoneLevels().open(() => {})).rejects.toThrow('audio-capture');
  });
});
