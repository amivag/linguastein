import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useCourse, usePronunciationLocale } from '../app/course';
import { useServices } from '../app/services-context';
import type { TtsVoice } from '../audio';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
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

  const locale = usePronunciationLocale();

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
        {/* Two glyphs from the set rather than two emoji: an emoji is a font the
            device chooses, so the same "muted" state was a flat outline on one
            platform and a full-colour cartoon on another. */}
        <Icon name={available ? 'speak' : 'unknown'} />
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
 *
 * The overlay, the backdrop, the arrival animation and the scroll containment
 * all come from `Sheet` now. This file used to carry its own copy, which is how
 * two sheets in the same app ended up with two different corner radii and only
 * one of them capped at the viewport height. `anchor="header"` is the one thing
 * that is genuinely local: the chip that opens it lives up there.
 */
function VoiceMenu({ onClose }: { readonly onClose: () => void }) {
  const { path } = useCourse();

  return (
    <Sheet title="Voice" onClose={onClose} anchor="header">
      <VoiceSettings variant="panel" />

      <Link className={styles.link} to={path('settings')} onClick={onClose}>
        All settings
      </Link>
    </Sheet>
  );
}
