import { useCallback, useEffect, useRef, useState } from 'react';
import { usePronunciationLocale } from '../../app/course';
import { useServices } from '../../app/services-context';
import {
  describeSpeechFailure,
  readSpeechEnvironment,
  SPEECH_ABORTED,
  type SpeechEnvironment,
  type SpeechFailure,
} from '../../audio';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { MicLevel } from '../../components/MicLevel';
import styles from './Settings.module.css';

/** How loud counts as "the microphone is reaching this page". */
const AUDIBLE = 0.06;

type State =
  | { readonly phase: 'idle' }
  | { readonly phase: 'listening' }
  | { readonly phase: 'heard'; readonly text: string }
  | { readonly phase: 'failed'; readonly failure: SpeechFailure };

type CheckState = 'ok' | 'warn' | 'missing' | 'unknown';

interface Check {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly state: CheckState;
}

/**
 * Whether speech input can work here, and what to change when it cannot.
 *
 * Speech input is the one feature in the app whose failures are almost entirely
 * *outside* it: an insecure page, a permission, a browser with no recogniser, or
 * — the case this was written for — an Android device whose separate speech
 * service has no Spanish downloaded. Every one of those reaches a learner as the
 * same nothing, mid-exercise, where there is room for one sentence and no room
 * to explain that Chrome on a phone does not recognise anything itself.
 *
 * So the explaining happens here instead, on a page that can afford it: what the
 * device supports, a listen the learner can run on purpose rather than during
 * practice, and the steps for whatever it reports. A failing exercise links here
 * rather than trying to teach Android's settings from inside a flashcard.
 *
 * Nothing is recorded. The test uses the same seam an exercise does, which is
 * also the point: a check that passed against a mock would prove nothing.
 */
export function SpeechInputCheck() {
  const { services } = useServices();
  const { speech, audio } = services;
  const locale = usePronunciationLocale();
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [level, setLevel] = useState(0);
  const [partial, setPartial] = useState('');
  const [environment, setEnvironment] = useState<SpeechEnvironment | undefined>(undefined);
  const peak = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      speech.stop();
    };
  }, [speech]);

  /*
   * Read in an effect rather than during render: `onLine` and the user agent are
   * the browser's state, not this component's, and the connection is the one
   * check that changes while the page is open — a learner who reconnects should
   * see this row correct itself rather than wonder if it is stale.
   */
  useEffect(() => {
    const read = () => setEnvironment(readSpeechEnvironment());
    read();
    globalThis.addEventListener('online', read);
    globalThis.addEventListener('offline', read);
    return () => {
      globalThis.removeEventListener('online', read);
      globalThis.removeEventListener('offline', read);
    };
  }, []);

  const listening = state.phase === 'listening';

  const test = useCallback(async () => {
    audio.stop();
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
        onPartial: (text) => {
          if (mounted.current) setPartial(text);
        },
      });
      if (mounted.current) setState({ phase: 'heard', text: result.transcript });
    } catch (error) {
      if (!mounted.current) return;
      const reason = error instanceof Error ? error.message : 'unknown';
      if (reason === SPEECH_ABORTED) {
        setState({ phase: 'idle' });
        return;
      }
      setState({
        phase: 'failed',
        failure: describeSpeechFailure(reason, {
          audible: peak.current >= AUDIBLE,
          locale,
          ...(environment ? { platform: environment.platform } : {}),
        }),
      });
    } finally {
      if (mounted.current) setLevel(0);
    }
  }, [speech, audio, locale, environment]);

  const checks = buildChecks({
    environment,
    locale,
    recogniser: speech.isAvailable(),
    voices: audio.voicesFor(locale).length,
  });

  return (
    <div className={styles.group}>
      <ul className={styles.checks}>
        {checks.map((check) => (
          <li key={check.id} className={styles.check}>
            <Icon name={CHECK_ICONS[check.state]} size="sm" className={styles[check.state]} />
            <span className={styles.checkText}>
              {/* The state is in the words as well as in the glyph: a row that
                  says what it found reads the same to a screen reader, in a
                  colour-blind palette, and in a screenshot pasted into a bug. */}
              <strong className={styles.checkLabel}>{check.label}</strong>
              <span className={styles.hint}>{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.testRow}>
        <Button
          variant={listening ? 'tonal' : 'default'}
          aria-pressed={listening}
          onClick={() => (listening ? speech.stop() : void test())}
        >
          <Icon name={listening ? 'stop' : 'record'} size="sm" />
          {listening ? 'Stop' : 'Test speech input'}
        </Button>
        {listening && <MicLevel level={level} />}
      </div>

      {/* Named, because the voice picker above owns a live region too: two
          unnamed statuses on one screen is one status a screen reader — or an
          agent — cannot tell from the other. */}
      <p className={styles.hint} role="status" aria-label="Speech input check">
        {state.phase === 'listening' && (
          <>
            Listening — say anything in {locale}.{' '}
            {partial && <span className={styles.heard}>{partial}</span>}
          </>
        )}
        {state.phase === 'heard' &&
          (state.text ? (
            <>
              Speech input works. It heard <strong className={styles.heard}>{state.text}</strong>
            </>
          ) : (
            <>The recogniser answered, but with nothing in it. Try again and speak a full phrase.</>
          ))}
        {state.phase === 'failed' && state.failure.summary}
        {state.phase === 'idle' &&
          'Runs one real listen, the same way a speaking exercise does. Nothing is recorded.'}
      </p>

      {state.phase === 'failed' && (
        <div className={styles.group}>
          {state.failure.steps.length > 0 && (
            <ol className={styles.steps}>
              {state.failure.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {/* The raw reason, because "it did not work" is not a bug report and
              this is the only screen that can hand somebody the word to quote. */}
          <p className={styles.hint}>
            Reported by the browser as <code>{state.failure.reason}</code>.
          </p>
        </div>
      )}
    </div>
  );
}

const CHECK_ICONS: Record<CheckState, IconName> = {
  ok: 'correct',
  warn: 'hint',
  missing: 'incorrect',
  unknown: 'unknown',
};

/**
 * The facts, in the order a listen depends on them.
 *
 * Secure page first because nothing else can be true without it, then the two
 * halves that are genuinely separate — the microphone the browser opens, and the
 * recogniser that transcribes what it hears. Conflating those two is the mistake
 * this whole panel exists to undo.
 */
function buildChecks(input: {
  readonly environment: SpeechEnvironment | undefined;
  readonly locale: string;
  readonly recogniser: boolean;
  readonly voices: number;
}): readonly Check[] {
  const { environment, locale, recogniser, voices } = input;

  return [
    {
      id: 'secure',
      label: 'Secure page',
      state: environment ? (environment.secureContext ? 'ok' : 'missing') : 'unknown',
      detail: environment?.secureContext
        ? 'This page is allowed to open a microphone — https, localhost or the installed app.'
        : 'This page is served over plain http, so the browser will not open a microphone for it at all.',
    },
    {
      id: 'microphone',
      label: 'Microphone',
      state: environment ? (environment.microphone ? 'ok' : 'missing') : 'unknown',
      detail: environment?.microphone
        ? 'The browser can open one. Whether it is allowed to is a permission you will be asked for on the first test.'
        : 'This browser exposes no microphone to the page.',
    },
    {
      id: 'recogniser',
      label: 'Speech recogniser',
      state: recogniser ? 'ok' : 'missing',
      detail: recogniser
        ? recogniserNote(environment)
        : 'This browser has none — Firefox is the common case. Speaking exercises stay usable by self-rating.',
    },
    {
      id: 'language',
      label: `Recognition language (${locale})`,
      // Deliberately never "ok": the Web Speech API exposes no capability list,
      // so nothing here can honestly claim the language is installed. The test
      // below is the only thing that answers it.
      state: 'unknown',
      detail:
        'No browser will say in advance whether it has this language — the test below is what finds out.',
    },
    {
      id: 'connection',
      label: 'Connection',
      state: environment ? (environment.online ? 'ok' : 'warn') : 'unknown',
      detail: environment?.online
        ? 'Online. Most desktop browsers transcribe through a service rather than on the device.'
        : 'Offline. Recognition works only if this device has the language downloaded for offline use.',
    },
    {
      id: 'playback',
      label: 'Playback voice',
      state: voices > 0 ? 'ok' : 'warn',
      detail:
        voices > 0
          ? `${voices} voice(s) installed for ${locale}, from your device.`
          : `No ${locale} voice on this device, so the app stays silent rather than read it with the wrong accent. Playback and input are separate — this does not stop the microphone.`,
    },
  ];
}

/** Where the recognising actually happens, which is not always the browser. */
function recogniserNote(environment: SpeechEnvironment | undefined): string {
  switch (environment?.platform) {
    case 'android':
      return 'Present. On Android the browser does not transcribe: it hands the audio to a separate system app, which needs the language installed.';
    case 'ios':
      return 'Present. On iOS this runs through Dictation, which has to be enabled in system settings.';
    default:
      return 'Present in this browser. Desktop browsers usually transcribe through an online service.';
  }
}
