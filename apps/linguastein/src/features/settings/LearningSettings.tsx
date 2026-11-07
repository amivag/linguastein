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
  /*
   * What this installation can actually explain in, rather than a list of what
   * the app hopes to support one day, and never the language being learned.
   *
   * Two sources, because meanings are their own downloadable unit: what is in
   * the index, and what the catalog says could be fetched. Only the learner's
   * own language is downloaded, so the index alone would offer a picker holding
   * one option — the setting would look broken in exactly the situation it is
   * for. See `referenceLanguages`.
   */
  const languages = useMemo(
    () =>
      referenceLanguages(
        services.repository,
        targetLanguage,
        services.content.availableReferences(),
      ),
    [services.repository, services.content, targetLanguage],
  );

  /*
   * The meanings are fetched, then the preference is set.
   *
   * That order rather than the reverse, and it is not a detail: a preference
   * pointing at a language whose records have not arrived shows the fallback
   * chain's English, which reads as "the setting did nothing". Setting it after
   * means the moment the control changes is the moment the screen changes with
   * it. `ensureReference` resolves immediately for a language already held, so
   * switching back costs nothing.
   *
   * A failure leaves the preference alone rather than stranding it: offline, the
   * setting stays where it was and the learner keeps the meanings they had.
   */
  const chooseReference = (referenceLanguage: string) => {
    void services.content.ensureReference(referenceLanguage).then(
      () => updatePreferences({ referenceLanguage }),
      (error: unknown) => console.warn('Could not fetch meanings', error),
    );
  };

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
          onChange={(event) => chooseReference(event.target.value)}
        >
          {languages.map((language) => (
            <option key={language.tag} value={language.tag}>
              {language.nativeName}
            </option>
          ))}
        </select>
        <span className={styles.hint}>
          {languages.length > 1
            ? 'The language meanings are shown in. Choosing one that is not on the device yet fetches it.'
            : 'The language meanings are shown in. A translation set published for this pack adds it here.'}
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
