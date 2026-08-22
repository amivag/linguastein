import { useServices } from '../app/services-context';
import { READING_SIZE_OPTIONS, type ReadingSize } from '../styles/reading-size';
import styles from './ReadingSizeControl.module.css';

/** Small / medium / large type, independent of the selected colour theme. */
export function ReadingSizeControl() {
  const { preferences, updatePreferences } = useServices();

  const choose = (readingSize: ReadingSize) => updatePreferences({ readingSize });

  return (
    <div className={styles.group} role="radiogroup" aria-label="Text size">
      {READING_SIZE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={preferences.readingSize === option.id}
          aria-label={option.label}
          className={`${styles.option} ${
            preferences.readingSize === option.id ? styles.active : ''
          }`}
          onClick={() => choose(option.id)}
        >
          <span aria-hidden="true">{option.shortLabel}</span>
          <span className={styles.name} aria-hidden="true">
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}
