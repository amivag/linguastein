import { useCallback, useEffect, useRef, useState } from 'react';
import { useServices } from '../../app/services-context';
import { Button } from '../../components/Button';
import { bestAlternative, type SpeechComparison } from '../../domain/exercises';
import styles from './SpeakCheck.module.css';

interface SpeakCheckProps {
  /** The target-language text the learner is trying to say. */
  readonly expected: string;
}

type State =
  | { readonly phase: 'idle' }
  | { readonly phase: 'listening' }
  | { readonly phase: 'heard'; readonly text: string; readonly comparison: SpeechComparison }
  | { readonly phase: 'failed'; readonly reason: string };

const MESSAGES: Record<SpeechComparison['verdict'], string> = {
  match: '¡Muy bien! That matched.',
  close: 'Close — check the highlighted words.',
  different: 'That did not match. Listen again and retry.',
};

/**
 * Optional speech check on speaking exercises (spec §4.3, §6.2).
 *
 * The browser's own recogniser does the work, so this costs nothing to run and
 * needs no key. It never gates progress: the rating buttons remain the way to
 * record how it went, and the control is hidden where the browser cannot
 * listen.
 */
export function SpeakCheck({ expected }: SpeakCheckProps) {
  const { services, preferences } = useServices();
  const { speech } = services;
  const [state, setState] = useState<State>({ phase: 'idle' });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      speech.stop();
    };
  }, [speech]);

  const listen = useCallback(async () => {
    setState({ phase: 'listening' });
    try {
      const result = await speech.listen(preferences.pronunciationLocale);
      const best = bestAlternative(expected, result.transcript, result.alternatives);
      if (mounted.current) {
        setState({ phase: 'heard', text: best.text, comparison: best.comparison });
      }
    } catch (error) {
      if (!mounted.current) return;
      const reason = error instanceof Error ? error.message : 'unknown';
      setState({ phase: 'failed', reason });
    }
  }, [speech, preferences.pronunciationLocale, expected]);

  if (!speech.isAvailable() || !speech.supportsLanguage(preferences.pronunciationLocale)) {
    return null;
  }

  return (
    <div className={styles.speak}>
      <Button
        onClick={() => void listen()}
        disabled={state.phase === 'listening'}
        aria-label={state.phase === 'listening' ? 'Listening' : 'Check my pronunciation'}
      >
        <span aria-hidden="true">🎙</span> {state.phase === 'listening' ? 'Listening…' : 'Say it'}
      </Button>

      <p role="status" className={styles.result}>
        {state.phase === 'heard' && (
          <>
            <span className={verdictClass(state.comparison.verdict)}>
              {MESSAGES[state.comparison.verdict]}
            </span>
            <span className={styles.heard} lang="es">
              Heard: “{state.text}”
            </span>
          </>
        )}
        {state.phase === 'failed' && (
          <span className={styles.hint}>{failureMessage(state.reason)}</span>
        )}
      </p>
    </div>
  );

  function verdictClass(verdict: SpeechComparison['verdict']) {
    if (verdict === 'match') return styles.match;
    return verdict === 'close' ? styles.close : styles.different;
  }
}

function failureMessage(reason: string): string {
  switch (reason) {
    case 'no-speech':
      return 'I did not hear anything — try again a little louder.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow it in your browser to use this.';
    case 'network':
      return 'Speech recognition needs a connection on this browser.';
    default:
      return 'Speech check is unavailable right now. Rate yourself instead.';
  }
}
