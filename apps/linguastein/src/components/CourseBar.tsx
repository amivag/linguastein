import { useLocation, useNavigate } from 'react-router';
import { useCourse } from '../app/course';
import { useServices } from '../app/services-context';
import { coursePath, type LevelScope } from '../domain/content';
import styles from './CourseBar.module.css';

interface CourseBarProps {
  /** Laid out for a filter toolbar rather than as a block of its own. */
  readonly compact?: boolean;
}

/**
 * What is being studied, and the control for changing it: the language, and how
 * far up the levels the learner is working.
 *
 * It appears on every browsing screen rather than only in Settings, because the
 * scope changes what those screens *show* — a count of 412 items means nothing
 * without the level it counts. Switching keeps you on the same screen and only
 * swaps the course out of the path, so changing level while browsing does not
 * throw away the search you had typed into the URL.
 *
 * The language `<select>` is hidden while only one language is loaded. A picker
 * with one option is not a choice, and offering it would imply content that is
 * not there — the level chips carry the same message honestly, since a
 * single-language pack still has levels.
 */
export function CourseBar({ compact = false }: CourseBarProps) {
  const { course, options, option } = useCourse();
  const { updatePreferences, updateCourse } = useServices();
  const navigate = useNavigate();
  const location = useLocation();

  if (!option) return null;

  // Everything after `/<language>/<level>`, so a level switch stays put.
  const screen = location.pathname.split('/').slice(3).join('/');

  const go = (language: string, level: LevelScope) => {
    /*
     * Two records, one gesture: which course `/` reopens is a device preference,
     * and the level it opens at belongs to the course. They are written on the
     * same queue in `App.tsx`, so a reload cannot find the language changed and
     * the level not yet.
     *
     * The accent no longer has to travel with the language, which is the part
     * that got simpler. It used to: one global `pronunciationLocale` meant
     * switching to a German course kept `es-ES`, and every play button asked the
     * device for a Spanish voice to read German — silence at best, a Spanish
     * reading of German at worst. Correcting it here was a patch over a value
     * that could not be right for two courses at once. Each course now holds its
     * own accent and its own voice, so switching away and back finds them as they
     * were rather than as the last course left them.
     */
    updatePreferences({ targetLanguage: language });
    updateCourse(language, { level });
    void navigate(`${coursePath({ language, level }, screen)}${location.search}`);
  };

  const inScope = option.levels.find((entry) => entry.level === course.level)?.count ?? 0;

  return (
    <div
      className={`${styles.bar} ${compact ? styles.compact : ''}`}
      role="group"
      aria-label="Course"
    >
      {options.length > 1 && (
        <label className={styles.language}>
          <span className="visually-hidden">Language</span>
          <select
            value={course.language}
            onChange={(event) => go(event.target.value, course.level)}
          >
            {options.map((entry) => (
              <option key={entry.language} value={entry.language}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {/*
        A `<select>` rather than a row of chips, and the ladder is why.

        Chips were one tap and showed every count at once, which was the right
        trade for the four CEFR rungs this app shipped with. A pack declares its
        own ladder now (`docs/tasks/language-matrix.md` §7), so "how many rungs"
        is a property of the content: HSK is six plus `All levels`, and at 375px
        four chips already wrap onto a second row and take the top of the screen
        away from the search and the mission.

        The count comes along rather than being traded away. It is what makes the
        control legible — `docs/design-language.md`'s "a count is what makes a
        filter honest" — and in compact mode it is the *only* place the in-scope
        figure appears, which is why the note below is suppressed there.
      */}
      <label className={styles.level}>
        <span className="visually-hidden">Level</span>
        <select
          value={course.level}
          onChange={(event) => go(course.language, event.target.value as LevelScope)}
        >
          {option.levels.map((entry) => (
            <option key={entry.level} value={entry.level}>
              {entry.label} · {entry.count} {entry.count === 1 ? 'item' : 'items'}
            </option>
          ))}
        </select>
      </label>

      {!compact && (
        <p className={styles.note}>
          {option.label} · {inScope} {inScope === 1 ? 'item' : 'items'} in scope
          {course.level === 'all' ? '' : ', including everything below'}
        </p>
      )}
    </div>
  );
}
