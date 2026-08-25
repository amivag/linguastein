import { useMemo } from 'react';
import { useServices } from '../../app/services-context';
import { useTargetLanguage } from '../../app/course';
import { CourseBar } from '../../components/CourseBar';
import { Icon } from '../../components/Icon';
import { referenceLanguages } from '../../domain/content';
import styles from './Settings.module.css';

/**
 * The learner's own settings: what is being learned, in which reference
 * language, and how a session should behave.
 *
 * These are the four that belong to the person rather than to the app, which is
 * why they are one section now instead of being spread across a Language group
 * and a Practice group with Appearance in between.
 */
export function LearningSettings() {
  const { services, preferences, updatePreferences } = useServices();
  const targetLanguage = useTargetLanguage();
  // What the loaded packs can actually explain in, rather than a list of what
  // the app hopes to support one day, and never the language being learned.
  // See `referenceLanguages`.
  const languages = useMemo(
    () => referenceLanguages(services.repository, targetLanguage),
    [services.repository, targetLanguage],
  );

  return (
    <>
      {/* The same control the course bar offers everywhere else, so there is one
          way to change course rather than two that can disagree. */}
      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="language" size="sm" className={styles.labelIcon} />
          Learning
        </span>
        <CourseBar />
        <span className={styles.hint}>
          A level is a ceiling, not a chapter: choosing A2 keeps A1 material in rotation as review.
        </span>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>
          <Icon name="explain" size="sm" className={styles.labelIcon} />
          Reference language
        </span>
        <select
          value={preferences.referenceLanguage}
          onChange={(event) => updatePreferences({ referenceLanguage: event.target.value })}
        >
          {languages.map((language) => (
            <option key={language.tag} value={language.tag}>
              {language.nativeName}
            </option>
          ))}
        </select>
        <span className={styles.hint}>
          {languages.length > 1
            ? 'The language meanings are shown in.'
            : 'The language meanings are shown in. A pack that ships another one adds it here.'}
        </span>
      </label>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={preferences.showTimer}
          onChange={(event) => updatePreferences({ showTimer: event.target.checked })}
        />
        <span>Show elapsed time</span>
      </label>
      <span className={styles.hint}>
        How long the session has been running. There is no limit and no penalty — switch it off if a
        clock is a distraction.
      </span>
    </>
  );
}
