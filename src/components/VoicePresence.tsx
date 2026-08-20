import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCourse } from '../app/course';
import { useServices } from '../app/services-context';
import type { TtsVoice } from '../audio';
import { Button } from './Button';
import { useFocusTrap } from './useFocusTrap';
import { VoiceSettings } from './VoiceSettings';
import styles from './VoicePresence.module.css';

/**
 * The voice, always within reach.
 *
 * Pronunciation is not a one-time setup step: the accent you want changes with
 * what you are reading, a device voice can be wrong in a way you only hear on
 * the third sentence, and "why is this silent?" is a question worth answering
 * where it is asked rather than three taps away in Settings. So the header
 * carries a permanent control that both *reports* the state — which voice is
 * speaking, or that none is — and opens the full set of audio controls in
 * place, on every screen.
 */
export function VoicePresence() {
  const { services, preferences } = useServices();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<TtsVoice | undefined>(undefined);
  const [available, setAvailable] = useState(true);

  const locale = preferences.pronunciationLocale;

  // Voice discovery is asynchronous, so the chip reports "unknown yet" as
  // available and corrects itself rather than flashing a false "silent".
  useEffect(() => {
    let cancelled = false;
    void services.audio.ready().then(() => {
      if (cancelled) return;
      setActive(services.audio.voiceFor(locale, preferences.voiceName || undefined));
      setAvailable(services.audio.canSpeak(locale));
    });
    return () => {
      cancelled = true;
    };
  }, [services.audio, locale, preferences.voiceName]);

  const close = useCallback(() => setOpen(false), []);

  const label = available
    ? `Voice: ${active?.name ?? 'automatic'} (${locale}). Open voice settings`
    : `Voice: none installed for ${locale}. Open voice settings`;

  return (
    <>
      <button
        type="button"
        className={styles.chip}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
      >
        <span aria-hidden="true">{available ? '🔊' : '🔇'}</span>
        <span className={styles.tag} aria-hidden="true">
          {locale}
        </span>
      </button>
      {open && <VoiceMenu onClose={close} />}
    </>
  );
}

/**
 * A popover under the header on a pointer device, a bottom sheet on a phone —
 * the same dialog, put where the hand is.
 */
function VoiceMenu({ onClose }: { readonly onClose: () => void }) {
  const menuRef = useFocusTrap<HTMLDivElement>(onClose);
  const { path } = useCourse();

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={menuRef}
        className={styles.menu}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label="Voice"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Voice</h2>
          <Button variant="ghost" icon onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </header>

        <VoiceSettings variant="panel" />

        <Link className={styles.link} to={path('settings')} onClick={onClose}>
          All settings
        </Link>
      </div>
    </div>
  );
}
