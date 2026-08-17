import { useCallback, useState } from 'react';
import { useServices } from '../app/services-context';
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
 */
export function VoiceInput({ label, locale, onResult }: VoiceInputProps) {
  const { services } = useServices();
  const { speech } = services;
  const [listening, setListening] = useState(false);
  const [failed, setFailed] = useState(false);

  const listen = useCallback(async () => {
    setFailed(false);
    setListening(true);
    try {
      const result = await speech.listen(locale);
      onResult(result.transcript);
    } catch {
      setFailed(true);
    } finally {
      setListening(false);
    }
  }, [speech, locale, onResult]);

  if (!speech.isAvailable() || !speech.supportsLanguage(locale)) return null;

  return (
    <>
      <button
        type="button"
        className={`${styles.mic} ${listening ? styles.listening : ''}`}
        onClick={() => void listen()}
        disabled={listening}
        aria-label={listening ? 'Listening' : label}
      >
        <span aria-hidden="true">🎙</span>
      </button>
      {failed && (
        <span role="status" className={styles.error}>
          Could not hear that.
        </span>
      )}
    </>
  );
}
