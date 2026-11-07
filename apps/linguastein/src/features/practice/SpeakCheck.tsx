import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useCourse, usePronunciationLocale, useTargetLanguage } from '../../app/course';
import { useServices } from '../../app/services-context';
import {
  describeSpeechFailure,
  readSpeechEnvironment,
  SPEECH_ABORTED,
  type SpeechFailure,
} from '../../audio';
import { Button } from '../../components/Button';
import { settingsPath } from '../settings/settings-url';
import {
  bestExpectedAlternative,
  type ExpectedSpeechMatch,
  type SpeechComparison,
} from '../../domain/exercises';
import { Icon } from '../../components/Icon';
import { MicLevel } from '../../components/MicLevel';
import styles from './SpeakCheck.module.css';

interface SpeakCheckProps {
  /** The target-language text the learner is trying to say. */
  readonly expected: string | readonly string[];
  /** Reports the recogniser's best comparison without deciding how a caller records it. */
  readonly onComparison?: (match: ExpectedSpeechMatch) => void;
}

type State =
  | { readonly phase: 'idle' }
  | { readonly phase: 'listening' }
  | {
      readonly phase: 'heard';
      readonly text: string;
      readonly expected: string;
      readonly comparison: SpeechComparison;
    }
  | { readonly phase: 'failed'; readonly failure: SpeechFailure };

const MESSAGES: Record<SpeechComparison['verdict'], string> = {
  match: '¡Muy bien! That matched.',
  close: 'Close — check the highlighted words.',
  different: 'That did not match. Listen again and retry.',
};

/** Loudness above which the microphone is certainly picking up a voice. */
const AUDIBLE = 0.08;

/**
 * How long a silent microphone is left unremarked. Long enough for a learner to
 * gather themselves after pressing the button, short enough that a dead
 * microphone is named rather than waited out to the twenty-second timeout.
 */
const SILENCE_HINT_MS = 2500;

/**
 * Optional speech check on speaking exercises (spec §4.3, §6.2).
 *
 * The browser's own recogniser does the work, so this costs nothing to run and
 * needs no key. It never gates progress: the rating buttons remain the way to
 * record how it went, and the control is hidden where the browser cannot
 * listen.
 *
 * The control is a toggle: a recogniser only ends a listen once it judges the
 * speaker to have finished, and background noise can stop it ever judging
 * that, so pressing again has to be able to end it.
 *
 * Three things here exist because a listen that fails tells the learner
 * nothing, which on Android is the common case rather than the rare one: the
 * level meter, the provisional transcript, and failure messages that name a
 * cause the learner can act on rather than "unavailable".
 */
export function SpeakCheck({ expected, onComparison }: SpeakCheckProps) {
  const lang = useTargetLanguage();
  const { course } = useCourse();
  const { services } = useServices();
  const locale = usePronunciationLocale();
  const { speech, audio } = services;
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [level, setLevel] = useState(0);
  const [partial, setPartial] = useState('');
  const [silent, setSilent] = useState(false);
  /** The loudest reading of this listen, which is what a failure is judged against. */
  const peak = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      speech.stop();
    };
  }, [speech]);

  const listening = state.phase === 'listening';

  // A microphone that has been open for a while and heard nothing is worth
  // saying out loud: it is the difference between "speak up" and "your browser
  // is not giving this page the microphone", and the learner cannot tell those
  // apart from a control that simply sits there.
  useEffect(() => {
    if (!listening) return;
    const timer = setTimeout(() => {
      if (mounted.current && peak.current < AUDIBLE) setSilent(true);
    }, SILENCE_HINT_MS);
    return () => clearTimeout(timer);
  }, [listening]);

  const listen = useCallback(async () => {
    // Anything still playing is stopped first. On a phone the recogniser and
    // the speaker compete for one audio path: a voice still speaking is either
    // heard as the learner's or holds the focus the recogniser needs, and
    // "press Play, then Say it" is the ordinary way to use this screen.
    audio.stop();
    peak.current = 0;
    setLevel(0);
    setPartial('');
    setSilent(false);
    setState({ phase: 'listening' });

    try {
      const result = await speech.listen(locale, {
        onLevel: (value) => {
          peak.current = Math.max(peak.current, value);
          if (mounted.current) setLevel(value);
        },
        onPartial: (text) => {
          if (mounted.current) setPartial(text);
        },
      });
      const targets = typeof expected === 'string' ? [expected] : expected;
      const best = bestExpectedAlternative(targets, result.transcript, result.alternatives);
      if (mounted.current) {
        setState({
          phase: 'heard',
          text: best.text,
          expected: best.expected,
          comparison: best.comparison,
        });
        onComparison?.(best);
      }
    } catch (error) {
      if (!mounted.current) return;
      const reason = error instanceof Error ? error.message : 'unknown';
      // Stopping on purpose is not a failed attempt to report on.
      setState(
        reason === SPEECH_ABORTED
          ? { phase: 'idle' }
          : {
              phase: 'failed',
              // Read here rather than in render: the platform decides which
              // settings screen the advice names, and the environment is the
              // browser's state rather than this component's.
              failure: describeSpeechFailure(reason, {
                audible: peak.current >= AUDIBLE,
                locale,
                platform: readSpeechEnvironment().platform,
              }),
            },
      );
    } finally {
      if (mounted.current) setLevel(0);
    }
  }, [speech, audio, locale, expected, onComparison]);

  if (!speech.isAvailable() || !speech.supportsLanguage(locale)) {
    return null;
  }

  return (
    <div className={styles.speak}>
      <div className={styles.controls}>
        <Button
          onClick={() => (listening ? speech.stop() : void listen())}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Check my pronunciation'}
        >
          <Icon name={listening ? 'stop' : 'record'} /> {listening ? 'Stop' : 'Say it'}
        </Button>
        {listening && <MicLevel level={level} />}
      </div>

      <p role="status" className={styles.result}>
        {listening && (
          <>
            <span className={styles.hint}>
              {silent
                ? 'Nothing is reaching the microphone yet — check that this page is allowed to use it.'
                : 'Listening…'}
            </span>
            {/* What the recogniser has so far, before it commits to it. Shown
                because a transcript forming is the clearest possible proof that
                the thing is working, and it is free — the recogniser was
                sending these all along. */}
            {partial && (
              <span className={styles.partial} lang={lang}>
                {partial}
              </span>
            )}
          </>
        )}
        {state.phase === 'heard' && (
          <>
            <span className={verdictClass(state.comparison.verdict)}>
              {MESSAGES[state.comparison.verdict]}
            </span>
            <span className={styles.heard} lang={lang}>
              Heard: “{state.text}”
            </span>
            {typeof expected !== 'string' && expected.length > 1 && (
              <span className={styles.heard} lang={lang}>
                Matched response: “{state.expected}”
              </span>
            )}
          </>
        )}
        {state.phase === 'failed' && (
          <>
            <span className={styles.hint}>{state.failure.summary}</span>
            {/* The exercise says what happened; the Audio settings say what to
                change. A flashcard is the wrong place to teach somebody their
                phone's speech settings, and the wrong place to find them again
                afterwards. */}
            {state.failure.steps.length > 0 && (
              <Link className={styles.fix} to={settingsPath(course, 'audio')}>
                How to fix speech input
              </Link>
            )}
          </>
        )}
      </p>
    </div>
  );

  function verdictClass(verdict: SpeechComparison['verdict']) {
    if (verdict === 'match') return styles.match;
    return verdict === 'close' ? styles.close : styles.different;
  }
}
