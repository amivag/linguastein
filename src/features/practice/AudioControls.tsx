import { useCallback, useEffect } from 'react';
import { useServices } from '../../app/services-context';
import { SLOW_RATE } from '../../audio';
import { Button } from '../../components/Button';
import type { LearningItem } from '../../domain/content';
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
  const locale = preferences.pronunciationLocale;

  const play = useCallback(
    (rate: number, repeat = 1) => {
      void audio.play(item, { locale, rate, repeat });
    },
    [audio, item, locale],
  );

  useEffect(() => {
    if (autoPlay && preferences.autoPlayAudio) play(preferences.slowAudio ? SLOW_RATE : 1);
    return () => audio.stop();
  }, [autoPlay, play, preferences.autoPlayAudio, preferences.slowAudio, audio]);

  return (
    <div className={styles.audio}>
      <Button variant="primary" onClick={() => play(1)} aria-label="Play audio">
        🔊 Play
      </Button>
      <Button onClick={() => play(SLOW_RATE)} aria-label="Play slowly">
        🐢 Slow
      </Button>
      <Button onClick={() => play(1, 3)} aria-label="Play three times">
        ↻ ×3
      </Button>
    </div>
  );
}
