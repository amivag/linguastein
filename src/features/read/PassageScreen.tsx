import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { TokenizedText } from '../../components/TokenizedText';
import { UsageBadges } from '../../components/UsageBadges';
import { useWordSelection } from '../../components/useWordSelection';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import { sessionPath } from '../practice/session-url';
import styles from './Read.module.css';

/**
 * One passage, read end to end.
 *
 * The sentences are ordinary items, so every word stays tappable and the whole
 * text can be handed to a practice session — a passage adds an order and a
 * reason to read, not a second copy of the content.
 */
export function PassageScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { course, path } = useCourse();
  const { services, preferences } = useServices();

  const [showTranslations, setShowTranslations] = useState(false);
  const words = useWordSelection();

  const passage = services.repository.passageByLocalId(id);
  const sentences = useMemo(
    () => (passage ? services.repository.itemsOfPassage(passage.id) : []),
    [services.repository, passage],
  );

  if (!passage) {
    return (
      <AppShell title="Read" onBack="history">
        {/* Says which text and where it would come from, because "not found" on
            its own leaves a learner unable to tell a broken link from a pack
            they have not installed — and those have different fixes. */}
        <p className={styles.empty} role="status">
          There is no text <strong>{id}</strong> in the packs you have. It may belong to a pack that
          is not installed.
        </p>
        <div className={styles.emptyActions}>
          <Button variant="primary" block onClick={() => void navigate(path('read'))}>
            Back to reading
          </Button>
          <Button block onClick={() => void navigate(`${path('settings')}?tab=packs`)}>
            See installed packs
          </Button>
        </div>
      </AppShell>
    );
  }

  const titleTranslation = services.repository.translationOf(
    passage.id,
    preferences.referenceLanguage,
  );

  const speak = (text: string) =>
    void services.audio.speak({
      text,
      locale: preferences.pronunciationLocale,
      ...(preferences.voiceName ? { voice: preferences.voiceName } : {}),
    });

  const openItem = words.item ? sentences.find((item) => item.id === words.item) : undefined;

  return (
    <AppShell title={passage.title} onBack="history">
      <header className={styles.passageHeader}>
        {titleTranslation && <p className={styles.cardMeaning}>{titleTranslation.text}</p>}
        <p className={styles.cardMeta}>
          {passage.kind === 'dialogue' ? 'Dialogue' : 'Text'} · {sentences.length} sentences
          {passage.level ? ` · ${passage.level.toUpperCase()}` : ''}
        </p>
        <UsageBadges compact regions={passage.regions} />
      </header>

      <div className={styles.passageActions}>
        <Button onClick={() => speak(sentences.map((item) => item.text).join(' '))}>
          <Icon name="speak" /> Listen
        </Button>
        <Button
          onClick={() => setShowTranslations((shown) => !shown)}
          aria-pressed={showTranslations}
        >
          {showTranslations ? 'Hide meaning' : 'Show meaning'}
        </Button>
      </div>

      <ol className={styles.lines} aria-label={`${passage.title}, ${sentences.length} sentences`}>
        {sentences.map((item, index) => {
          const speaker = passage.speakers?.[index];
          const translation = services.repository.translationOf(
            item.id,
            preferences.referenceLanguage,
          );
          return (
            <li key={item.id} className={styles.line}>
              {speaker && <p className={styles.speaker}>{speaker}</p>}
              <TokenizedText
                item={item}
                className={styles.lineText}
                onSelect={(token) => words.open(item.id, token)}
                selected={words.tokensFor(item.id)}
                contextLabel={item.text}
              />
              {showTranslations && translation && (
                <p className={styles.lineMeaning}>{translation.text}</p>
              )}
              <button
                type="button"
                className={styles.linePlay}
                onClick={() => speak(item.text)}
                aria-label={`Listen to “${item.text}”`}
              >
                <Icon name="speak" size="lg" />
              </button>
            </li>
          );
        })}
      </ol>

      <Button
        variant="primary"
        block
        large
        onClick={() =>
          void navigate(
            sessionPath(course, { preset: 'quick', size: { kind: 'all' }, passage: id }),
          )
        }
      >
        Practise these sentences
      </Button>

      {openItem && (
        <WordInfoSheet
          item={openItem}
          tokenIds={words.tokens}
          onChange={words.set}
          onClose={words.close}
        />
      )}
    </AppShell>
  );
}
