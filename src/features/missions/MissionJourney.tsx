import { Link } from 'react-router';
import { MISSION_STAGES, type MissionStage } from '../../domain/missions';
import styles from './Mission.module.css';

const LABELS: Readonly<Record<MissionStage, string>> = {
  understand: 'Understand',
  practise: 'Practise',
  use: 'Use',
};

/**
 * Understand → Practise → Use, as three links.
 *
 * They were three `li`s and nothing else: pill-shaped, numbered, tinted for the
 * one you were on — everything a control looks like, and a tap did nothing. That
 * is the worse half of the affordance mistake, because the promise is made by
 * the thing that cannot keep it.
 *
 * Nothing in the domain gates the order, so nothing here needs to. `Practise`
 * leaves for a session over this mission's passage, which is the same
 * destination its button at the foot of Understand has always had, and the
 * missions list already deep-links to `use` for anyone with transfer evidence.
 * Sending a learner back to a stage is a navigation, so these are links with
 * `aria-current`, for the reason `SectionTabs` gives at greater length.
 */
export function MissionJourney({
  current,
  hrefs,
}: {
  readonly current: MissionStage;
  /** Where each rung goes. Held by the screen, which knows the course. */
  readonly hrefs: Readonly<Record<MissionStage, string>>;
}) {
  const currentIndex = MISSION_STAGES.indexOf(current);

  return (
    <ol className={styles.journey} aria-label="Mission journey">
      {MISSION_STAGES.map((stage, index) => {
        const done = index < currentIndex;
        return (
          <li
            key={stage}
            data-state={done ? 'complete' : index === currentIndex ? 'current' : 'next'}
          >
            <Link
              className={styles.journeyStep}
              to={hrefs[stage]}
              // The marker is a glyph or a numeral either way, so it is named
              // rather than read: `aria-current` already says which rung you are
              // on, and "check mark Understand" says the rest badly.
              aria-label={done ? `${LABELS[stage]}, done` : LABELS[stage]}
              {...(index === currentIndex ? { 'aria-current': 'step' as const } : {})}
            >
              <span aria-hidden="true">{done ? '✓' : index + 1}</span>
              <strong>{LABELS[stage]}</strong>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
