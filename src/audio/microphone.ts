/**
 * Microphone loudness through the Web Audio API (spec §6.2).
 *
 * The seam and the reasons it exists are in `types.ts`. This is the browser
 * half: `getUserMedia` for the stream, an analyser for the level, and a handle
 * that gives the device straight back.
 *
 * Two details are load-bearing rather than incidental:
 *
 * - The analyser is **not** connected to the context destination. Routing a
 *   microphone to the speakers is feedback, and an analyser reads its input
 *   whether or not anything downstream is listening.
 * - Every track is stopped on close, not just the context. A stream left
 *   running keeps the browser's recording indicator on and, on a phone, keeps
 *   the microphone away from the next listen.
 */

import { MICROPHONE_BUSY, type MicrophoneHandle, type MicrophoneLevels } from './types';

/**
 * Samples per frame. 1024 is about 21 ms at 48 kHz — long enough for a steady
 * reading, short enough to follow a syllable rather than average it away.
 */
const FFT_SIZE = 1024;

/**
 * How often a level is reported. Twenty a second looks continuous and costs a
 * twentieth of the renders a per-frame report would: this drives React state,
 * and a meter is not worth a frame budget on a mid-range phone.
 *
 * A timer rather than `requestAnimationFrame` for one more reason: the loop
 * keeps reporting while the tab is in the background, so a listen that ends
 * there still settles.
 */
const REPORT_INTERVAL_MS = 50;

/**
 * Speech sits well below full scale — a normal voice at arm's length reads
 * around 0.05–0.2 RMS — so the reading is scaled before it is clamped. A meter
 * that never leaves its first third reads as broken.
 */
const GAIN = 3.2;

/**
 * How fast the meter falls. It follows the voice up instantly and decays on a
 * curve, because the gaps between syllables are silent and a meter that tracked
 * them down would flicker rather than move.
 */
const DECAY = 0.82;

type AudioContextConstructor = new () => AudioContext;

function audioContextConstructor(): AudioContextConstructor | undefined {
  const scope = globalThis as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/** Root mean square of one frame of 8-bit samples centred on 128. */
function loudness(samples: Uint8Array): number {
  let total = 0;
  for (const sample of samples) {
    const centred = (sample - 128) / 128;
    total += centred * centred;
  }
  return Math.sqrt(total / samples.length);
}

/**
 * `getUserMedia`'s failures in the recogniser's vocabulary, so the UI has one
 * set of reasons to explain rather than two.
 */
function asSpeechReason(error: unknown): Error {
  const name = error instanceof Error ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new Error('not-allowed');
    case 'NotReadableError':
    case 'AbortError':
      return new Error(MICROPHONE_BUSY);
    default:
      // `NotFoundError`, `OverconstrainedError`, and anything a browser invents:
      // the device could not be opened, which is what `audio-capture` means.
      return new Error('audio-capture');
  }
}

export function createWebMicrophoneLevels(): MicrophoneLevels {
  return {
    id: 'web-audio-microphone',

    isAvailable() {
      // `mediaDevices` is absent outside a secure context, which is the case
      // this has to report as "no microphone here" rather than crash on.
      return (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices?.getUserMedia !== undefined &&
        audioContextConstructor() !== undefined
      );
    },

    async open(onLevel: (level: number) => void): Promise<MicrophoneHandle> {
      const Context = audioContextConstructor();
      if (!Context || navigator.mediaDevices?.getUserMedia === undefined) {
        throw new Error('audio-capture');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // The same processing the recogniser wants: a phone held at chest
          // height in a room with a fan is the ordinary case, not the hard one.
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (error) {
        throw asSpeechReason(error);
      }

      const context = new Context();
      // A context can arrive suspended, and a suspended context's analyser
      // reads pure silence — a meter that never moves, from a live microphone.
      if (context.state === 'suspended') await context.resume().catch(() => undefined);

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      source.connect(analyser);

      const samples = new Uint8Array(analyser.fftSize);
      let reported = 0;
      const timer = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        const level = Math.min(1, loudness(samples) * GAIN);
        reported = level > reported ? level : reported * DECAY;
        onLevel(reported);
      }, REPORT_INTERVAL_MS);

      let closed = false;
      return {
        close() {
          if (closed) return;
          closed = true;
          clearInterval(timer);
          source.disconnect();
          for (const track of stream.getTracks()) track.stop();
          void context.close().catch(() => undefined);
          // A meter left at its last reading would keep showing a voice that
          // stopped being heard.
          onLevel(0);
        },
      };
    },
  };
}
