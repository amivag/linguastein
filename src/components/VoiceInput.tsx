import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../app/services-context';
import { SPEECH_ABORTED } from '../audio';
import type { LanguageTag } from '../domain/content';
import styles from './VoiceInput.module.css';

interface VoiceInputProps {
  readonly label: string;
  readonly locale: LanguageTag;
  readonly onResult: (text: string) => void;
}

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
 */
export function VoiceInput({ label, locale, onResult }: VoiceInputProps) {
  const { services } = useServices();
  const { speech } = services;
  const [listening, setListening] = useState(false);
  const [failed, setFailed] = useState(false);

  // Leaving the screen mid-listen would otherwise hold the microphone open.
  useEffect(() => () => speech.stop(), [speech]);

  const listen = useCallback(async () => {
    setFailed(false);
    setListening(true);
    try {
      const result = await speech.listen(locale);
      onResult(result.transcript);
    } catch (error) {
      // Stopping on purpose is not a failure to report back.
      setFailed(!(error instanceof Error && error.message === SPEECH_ABORTED));
    } finally {
      setListening(false);
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
        <span aria-hidden="true">{listening ? '■' : '🎙'}</span>
      </button>
      {/* One live region, always mounted, so a change to it is announced.
          Listening is only announced: the mic itself shows that state, and
          spelling it out here as well would squeeze the search field it sits
          beside every time someone dictates. */}
      <span role="status" className={failed ? styles.status : 'visually-hidden'}>
        {listening ? 'Listening…' : failed ? 'Could not hear that.' : ''}
      </span>
    </>
  );
}
