/**
 * The short sounds that can accompany a verdict, synthesised rather than shipped.
 *
 * Two tones built from oscillators on the spot: no files to fetch, cache or
 * license, nothing to go missing offline. They reach feature code only through
 * {@link AudioService.cue}, so there is still one way for this app to make a
 * noise (`docs/tasks/game-feel.md` §4.6).
 *
 * Deliberately not part of the playing state. A cue is a few hundred
 * milliseconds laid over whatever is happening; it neither stops the voice that
 * is speaking nor lights a transport control, and a learner's speech is never
 * interrupted to make room for one.
 *
 * Neither tone scolds. The miss is a single low, soft note — information that
 * the answer was not it, said as quietly as the correct one is said — because a
 * buzzer for a wrong answer is the punishment mechanic §3 rules out.
 */

/** What a cue is about. Named for meaning, never for its sound. */
export type FeedbackCue = 'correct' | 'incorrect';

/** One note: a pitch, when it starts after the cue does, and how long it lasts. */
interface Note {
  readonly hz: number;
  readonly at: number;
  readonly seconds: number;
}

/*
 * A rising fifth for a match, one low note for a miss. Quiet on purpose: this
 * is under the learner's own voice and the app's speech, never over them.
 */
const NOTES: Readonly<Record<FeedbackCue, readonly Note[]>> = {
  correct: [
    { hz: 660, at: 0, seconds: 0.09 },
    { hz: 990, at: 0.07, seconds: 0.14 },
  ],
  incorrect: [{ hz: 247, at: 0, seconds: 0.18 }],
};
const PEAK_GAIN = 0.07;
/** Ramp in and out, because a tone that starts or stops at full level clicks. */
const ATTACK = 0.01;

/* The slice of the Web Audio API used here, so tests can stand in for it. */
interface CueParam {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
}
interface CueNode {
  connect(destination: CueNode | CueDestination): unknown;
}
type CueDestination = object;
interface CueOscillator extends CueNode {
  type: string;
  readonly frequency: CueParam;
  start(when: number): void;
  stop(when: number): void;
}
interface CueGain extends CueNode {
  readonly gain: CueParam;
}
export interface CueContext {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: CueDestination;
  createOscillator(): CueOscillator;
  createGain(): CueGain;
  resume(): Promise<void>;
}

export interface CuePlayer {
  isAvailable(): boolean;
  /** Plays the cue now. Never throws and never rejects: a silent cue is no fault. */
  play(cue: FeedbackCue): void;
}

export const NO_CUES: CuePlayer = { isAvailable: () => false, play: () => {} };

/**
 * Cues over Web Audio, or {@link NO_CUES} where there is none.
 *
 * The context is created on the first cue rather than at boot: browsers start an
 * `AudioContext` suspended until a user gesture, and the first cue always
 * follows one — the answer that caused it.
 */
export function createWebAudioCues(
  createContext: (() => CueContext) | undefined = defaultContextFactory(),
): CuePlayer {
  if (!createContext) return NO_CUES;
  let context: CueContext | undefined;

  return {
    isAvailable: () => true,
    play(cue) {
      try {
        context ??= createContext();
        if (context.state === 'suspended') void context.resume().catch(() => undefined);
        const start = context.currentTime;
        for (const note of NOTES[cue]) schedule(context, note, start);
      } catch {
        // A device that will not make the sound leaves the verdict on screen.
      }
    },
  };
}

function schedule(context: CueContext, note: Note, start: number): void {
  const begin = start + note.at;
  const end = begin + note.seconds;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(note.hz, begin);
  gain.gain.setValueAtTime(0, begin);
  gain.gain.linearRampToValueAtTime(PEAK_GAIN, begin + ATTACK);
  gain.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(begin);
  oscillator.stop(end);
}

function defaultContextFactory(): (() => CueContext) | undefined {
  const Context = globalThis.AudioContext as (new () => CueContext) | undefined;
  return Context ? () => new Context() : undefined;
}
