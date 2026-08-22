import type { MissionStage } from '../../domain/missions';
import styles from './Mission.module.css';

const STAGES: readonly { readonly id: MissionStage; readonly label: string }[] = [
  { id: 'understand', label: 'Understand' },
  { id: 'practise', label: 'Practise' },
  { id: 'use', label: 'Use' },
];

export function MissionJourney({ current }: { readonly current: MissionStage }) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === current);

  return (
    <ol className={styles.journey} aria-label="Mission journey">
      {STAGES.map((stage, index) => (
        <li
          key={stage.id}
          data-state={index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'next'}
          {...(index === currentIndex ? { 'aria-current': 'step' as const } : {})}
        >
          <span>{index < currentIndex ? '✓' : index + 1}</span>
          <strong>{stage.label}</strong>
        </li>
      ))}
    </ol>
  );
}
