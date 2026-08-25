import { useCallback, useEffect, useState } from 'react';
import { usePronunciationLocale } from '../../app/course';
import { useServices } from '../../app/services-context';
import { SLOW_RATE } from '../../audio';
import { Button } from '../../components/Button';
import type { LearningItem } from '../../domain/content';
import { Icon } from '../../components/Icon';
import { useIsSpeaking } from '../../components/usePlayback';
import styles from './Practice.module.css';

interface AudioControlsProps {
  readonly item: LearningItem;
  /** Play once as soon as the item appears (spec §6.1). */
  readonly autoPlay?: boolean;
}

/** Normal, slow and loop ×3 playback (spec §6.1). */
export function AudioControls({ item, autoPlay = false }: AudioControlsProps) {
  const { services, preferences } = useServices();
  const { audio } = services;
  const locale = usePronunciationLocale();
  const [playable, setPlayable] = useState(true);
  const speaking = useIsSpeaking(item);

  const play = useCallback(
    (rate: number, repeat = 1) => {
      void audio.play(item, { locale, rate, repeat, voice: preferences.voiceName || undefined });
    },
    [audio, item, locale, preferences.voiceName],
  );

  // Voice discovery is asynchronous, so availability is re-checked once the
  // provider is ready rather than assumed on first render.
  useEffect(() => {
    let cancelled = false;
    void audio.ready().then(() => {
      if (!cancelled) setPlayable(audio.canPlay(item, locale));
    });
    return () => {
      cancelled = true;
    };
  }, [audio, item, locale]);

  useEffect(() => {
    if (autoPlay && preferences.autoPlayAudio) play(preferences.slowAudio ? SLOW_RATE : 1);
    return () => audio.stop();
  }, [autoPlay, play, preferences.autoPlayAudio, preferences.slowAudio, audio]);

  if (!playable) {
    return (
      <p className={styles.hint}>
        No {locale} voice on this device — check Settings, or add one in your system’s speech
        settings.
      </p>
    );
  }

  return (
    <div className={styles.audio}>
      {/* One button that plays and stops, rather than a Play that does nothing
          the second time it is pressed. A card is one short phrase, so there is
          nothing here worth holding: stop is the whole of the other half. */}
      {speaking ? (
        <Button variant="primary" onClick={() => audio.stop()} aria-label="Stop audio">
          <Icon name="stop" /> Stop
        </Button>
      ) : (
        <Button variant="primary" onClick={() => play(1)} aria-label="Play audio">
          <Icon name="speak" /> Play
        </Button>
      )}
      <Button onClick={() => play(SLOW_RATE)} aria-label="Play slowly">
        <Icon name="slow" /> Slow
      </Button>
      <Button onClick={() => play(1, 3)} aria-label="Play three times">
        <Icon name="again" /> ×3
      </Button>
    </div>
  );
}
