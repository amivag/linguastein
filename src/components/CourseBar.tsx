import { useLocation, useNavigate } from 'react-router';
import { useCourse } from '../app/course';
import { useServices } from '../app/services-context';
import { coursePath, type LevelScope } from '../domain/content';
import { Chip } from './Chip';
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
  const { updatePreferences } = useServices();
  const navigate = useNavigate();
  const location = useLocation();

  if (!option) return null;

  // Everything after `/<language>/<level>`, so a level switch stays put.
  const screen = location.pathname.split('/').slice(3).join('/');

  const go = (language: string, level: LevelScope) => {
    // Remembered so `/` reopens this course next time; the path stays the
    // source of truth for the screen that is open now.
    updatePreferences({ targetLanguage: language, level });
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

      <ul className={styles.levels}>
        {option.levels.map((entry) => {
          const pressed = entry.level === course.level;
          return (
            <li key={entry.level}>
              <Chip
                // A level is a ceiling, so the count is what it *includes* —
                // spelled out because the label and count are adjacent spans
                // and the computed name would otherwise read "A2168".
                aria-label={`${entry.label}, ${entry.count} ${entry.count === 1 ? 'item' : 'items'}`}
                pressed={pressed}
                count={entry.count}
                onClick={() => go(course.language, entry.level)}
              >
                {entry.label}
              </Chip>
            </li>
          );
        })}
      </ul>

      {!compact && (
        <p className={styles.note}>
          {option.label} · {inScope} {inScope === 1 ? 'item' : 'items'} in scope
          {course.level === 'all' ? '' : ', including everything below'}
        </p>
      )}
    </div>
  );
}
