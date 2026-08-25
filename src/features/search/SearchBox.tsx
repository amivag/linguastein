import { useId } from 'react';
import { languageOption, type LanguageTag } from '../../domain/content';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { VoiceInput } from '../../components/VoiceInput';
import styles from './SearchBox.module.css';

interface SearchBoxProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** The language being studied, named in the label. */
  readonly targetLanguage: LanguageTag;
  /** The language the learner's own half of the search is in, also named. */
  readonly referenceLanguage: LanguageTag;
  /** The accent to listen in, for the voice control. */
  readonly locale: LanguageTag;
  readonly placeholder?: string;
}

/**
 * One box, both languages, wherever a lookup belongs.
 *
 * A component rather than markup on Home, because the box is going to appear on
 * more than one screen and its label is the part that is easy to get wrong twice.
 * Both languages are named and both are *derived*: the pair changes with the
 * course and with the reference language, so a literal is wrong twice over. This
 * is the same reasoning Browse's own label carries — and unlike Browse's, this
 * one is true, because {@link searchContent} really does read both sides.
 *
 * The clear button is a real control rather than the one the browser draws.
 * `type="search"` gets a native ✕ in some engines and nothing in others, and it
 * reaches no accessible name in either, so on the screens where clearing the box
 * is how a learner gets back to the page underneath it cannot be left to chance.
 */
export function SearchBox({
  value,
  onChange,
  targetLanguage,
  referenceLanguage,
  locale,
  placeholder = 'Search a word or phrase…',
}: SearchBoxProps) {
  const inputId = useId();
  const target = languageOption(targetLanguage).englishName;
  const reference = languageOption(referenceLanguage).englishName;

  return (
    <div className={styles.box}>
      <label className="visually-hidden" htmlFor={inputId}>
        Search {target} or {reference}
      </label>
      <div className={styles.field}>
        <input
          id={inputId}
          type="search"
          className={styles.input}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          // Off, both of them: a learner typing Spanish into a device set to
          // English gets `esta` corrected to `east` and a lookup for a word they
          // did not type. The box accepts two languages and can assume neither.
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
        {value !== '' && (
          <Button
            variant="ghost"
            icon
            className={styles.clear}
            aria-label="Clear search"
            onClick={() => onChange('')}
          >
            <Icon name="close" size="sm" />
          </Button>
        )}
      </div>
      <VoiceInput label="Search by voice" locale={locale} onResult={onChange} />
    </div>
  );
}
