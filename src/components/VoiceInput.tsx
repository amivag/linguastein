import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useServices } from '../app/services-context';
import {
  describeSpeechFailure,
  readSpeechEnvironment,
  SPEECH_ABORTED,
  type SpeechFailure,
} from '../audio';
import type { LanguageTag } from '../domain/content';
import { Icon } from '../components/Icon';
import { MicLevel } from '../components/MicLevel';
import styles from './VoiceInput.module.css';

interface VoiceInputProps {
  readonly label: string;
  readonly locale: LanguageTag;
  readonly onResult: (text: string) => void;
  /**
   * Where the steps for a failed listen live — the Audio settings check.
   *
   * A prop rather than a call to `settingsPath`, because a shared component may
   * not import a feature (`.oxlintrc.json` enforces it) and it has no course to
   * build the address from anyway. A caller that does not pass one gets the
   * summary without the link, which is still a reason where there was none.
   */
  readonly helpPath?: string | undefined;
}

/** Loudness above which the microphone is certainly picking up a voice. */
const AUDIBLE = 0.08;

type State =
  | { readonly phase: 'idle' }
  | { readonly phase: 'listening' }
  /** The recogniser answered, with an empty string in it. */
  | { readonly phase: 'empty' }
  | { readonly phase: 'failed'; readonly failure: SpeechFailure };

/**
 * Dictation for any text field, using the browser's own recogniser.
 *
 * Typing Spanish on a phone keyboard is exactly the friction the product tries
 * to avoid (spec §2.1), so wherever typing exists, speaking is offered next to
 * it. Renders nothing when the browser cannot listen.
 *
 * The mic is a toggle, not a fire-and-forget. A recogniser ends a listen when
 * it judges the speaker to have finished, and a noisy room can keep it from
 * ever judging that — so pressing again has to be able to end it.
 *
 * ## Why this reports as much as a speaking exercise does
 *
 * It used to report almost nothing: no level, no provisional text, and one
 * message — "Could not hear that." — for every one of the eight reasons a listen
 * can fail. On a phone that is the common outcome rather than the rare one, and
 * on Android the usual cause is a *separate* speech service with the language
 * missing, which nothing about "could not hear that" points at. Worse, an empty
 * transcript counted as success and was handed to the field, so a learner who
 * had typed something watched the box clear itself for no stated reason.
 *
 * So it now asks for the same two channels {@link SpeakCheck} does — the level
 * and the interim transcript — and names the cause through the one
 * {@link describeSpeechFailure} every speech surface shares.
 */
export function VoiceInput({ label, locale, onResult, helpPath }: VoiceInputProps) {
  const { services } = useServices();
  const { speech } = services;
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [level, setLevel] = useState(0);
  const [partial, setPartial] = useState('');
  /** The loudest reading of this listen, which is what a failure is judged against. */
  const peak = useRef(0);
  const mounted = useRef(true);

  // Leaving the screen mid-listen would otherwise hold the microphone open.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      speech.stop();
    };
  }, [speech]);

  const listening = state.phase === 'listening';

  const listen = useCallback(async () => {
    peak.current = 0;
    setLevel(0);
    setPartial('');
    setState({ phase: 'listening' });

    try {
      const result = await speech.listen(locale, {
        onLevel: (value) => {
          peak.current = Math.max(peak.current, value);
          if (mounted.current) setLevel(value);
        },
        // What the recogniser has so far, before it commits to it. On a device
        // that will not let this page meter the microphone it is the only proof
        // a learner gets that anything is being heard at all.
        onPartial: (text) => {
          if (mounted.current) setPartial(text);
        },
      });
      const transcript = result.transcript.trim();
      if (!mounted.current) return;
      // An empty transcript is not a result to hand over: `onResult` writes into
      // the field, so passing '' clears whatever the learner had typed and calls
      // that a success.
      if (!transcript) {
        setState({ phase: 'empty' });
        return;
      }
      setState({ phase: 'idle' });
      onResult(transcript);
    } catch (error) {
      if (!mounted.current) return;
      const reason = error instanceof Error ? error.message : 'unknown';
      // Stopping on purpose is not a failure to report back.
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
  }, [speech, locale, onResult]);

  if (!speech.isAvailable() || !speech.supportsLanguage(locale)) return null;

  return (
    <>
      <button
        type="button"
        className={styles.mic}
        onClick={() => (listening ? speech.stop() : void listen())}
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : label}
      >
        <Icon name={listening ? 'stop' : 'record'} size="lg" />
      </button>
      {/* One live region, always mounted, so a change to it is announced, and
          named because both screens that render this box have a `role="status"`
          of their own — two unnamed statuses on one screen is one a screen
          reader, or an agent, cannot tell from the other.

          It sits on its own line rather than in the row: the field beside it is
          `flex: 1`, so anything that shares the row shortens the box you are
          dictating into, which is why this used to be allowed to say nothing. */}
      <span role="status" aria-label="Dictation" className={styles.status}>
        {listening && (
          <>
            <MicLevel level={level} />
            {partial ? (
              <span className={styles.partial} lang={locale}>
                {partial}
              </span>
            ) : (
              <span>Listening…</span>
            )}
          </>
        )}
        {state.phase === 'empty' && (
          <span>
            The recogniser answered, but with nothing in it. Try again and speak a phrase.
          </span>
        )}
        {state.phase === 'failed' && (
          <>
            <span>{state.failure.summary}</span>
            {/* The box says what happened; the Audio settings say what to change.
                A search field is the wrong place to teach somebody their phone's
                speech settings, and the wrong place to find them again after. */}
            {helpPath && state.failure.steps.length > 0 && (
              <Link className={styles.fix} to={helpPath}>
                How to fix speech input
              </Link>
            )}
          </>
        )}
      </span>
    </>
  );
}
