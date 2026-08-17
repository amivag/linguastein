import { useFocusTrap } from '../../components/useFocusTrap';
import { useServices } from '../../app/services-context';
import { Button } from '../../components/Button';
import { UsageBadges } from '../../components/UsageBadges';
import { inspectToken, type LearningItem, type TokenId } from '../../domain/content';
import styles from './WordInfoSheet.module.css';

interface WordInfoSheetProps {
  readonly item: LearningItem;
  readonly tokenId: TokenId;
  readonly onClose: () => void;
}

/**
 * "What is this word?" — meaning, grammar, the construction it belongs to,
 * its other forms and other phrases that use it. All derived from the dataset
 * at render time (spec §4.1 "More info", §13.2 reusable examples).
 */
export function WordInfoSheet({ item, tokenId, onClose }: WordInfoSheetProps) {
  const { services, preferences } = useServices();
  const info = inspectToken(services.repository, item, tokenId, preferences.referenceLanguage);

  const sheetRef = useFocusTrap<HTMLElement>(onClose);

  if (!info) return null;

  const speak = () =>
    void services.audio.speak({
      text: info.token.text,
      locale: preferences.pronunciationLocale,
      voice: preferences.voiceName || undefined,
    });

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <section
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={`About ${info.token.text}`}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.word} lang="es">
              {info.token.text}
            </p>
            {info.lemma && info.lemma !== info.token.text.toLowerCase() && (
              <p className={styles.lemma} lang="es">
                from <strong>{info.lemma}</strong>
                {info.posLabel ? ` · ${info.posLabel}` : ''}
              </p>
            )}
            {(!info.lemma || info.lemma === info.token.text.toLowerCase()) && info.posLabel && (
              <p className={styles.lemma}>{info.posLabel}</p>
            )}
          </div>
          <Button variant="ghost" onClick={speak} aria-label="Pronounce">
            🔊
          </Button>
        </header>

        {info.gloss && <p className={styles.gloss}>{info.gloss}</p>}
        <UsageBadges register={info.register} regions={info.regions} />
        {info.grammar && <p className={styles.grammar}>{info.grammar}</p>}

        {info.constructions.length > 0 && (
          <div className={styles.block}>
            <h3 className={styles.blockTitle}>Pattern</h3>
            {info.constructions.map((construction) => (
              <p key={construction.label}>
                <strong lang="es">{construction.label}</strong>
                {construction.gloss ? ` — ${construction.gloss}` : ''}
              </p>
            ))}
          </div>
        )}

        {info.forms.length > 0 && (
          <div className={styles.block}>
            <h3 className={styles.blockTitle}>Other forms</h3>
            <ul className={styles.forms}>
              {info.forms.map((form) => (
                <li
                  key={`${form.form}-${form.label}`}
                  className={form.current ? styles.current : ''}
                >
                  <span lang="es">{form.form}</span>
                  <span className={styles.formLabel}>{form.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {info.examples.length > 0 && (
          <div className={styles.block}>
            <h3 className={styles.blockTitle}>In other phrases</h3>
            <ul className={styles.examples}>
              {info.examples.map((example) => (
                <li key={example.id}>
                  <span lang="es">{example.text}</span>
                  {example.translation && (
                    <span className={styles.formLabel}> {example.translation}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!info.gloss && !info.grammar && info.constructions.length === 0 && (
          <p className={styles.grammar}>No extra information for this word yet.</p>
        )}

        <Button block onClick={onClose}>
          Close
        </Button>
      </section>
    </div>
  );
}
