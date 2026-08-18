import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { TokenizedText } from '../../components/TokenizedText';
import { UsageBadges } from '../../components/UsageBadges';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import type { ItemId, TokenId } from '../../domain/content';
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
  const { services, preferences } = useServices();

  const [showTranslations, setShowTranslations] = useState(false);
  const [selected, setSelected] = useState<{ item: ItemId; token: TokenId } | null>(null);

  const passage = services.repository.passageByLocalId(id);
  const sentences = useMemo(
    () => (passage ? services.repository.itemsOfPassage(passage.id) : []),
    [services.repository, passage],
  );

  if (!passage) {
    return (
      <AppShell title="Read" onBack="history">
        <p className={styles.empty}>That text is not in this pack.</p>
        <Button block onClick={() => void navigate('/read')}>
          Back to reading
        </Button>
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

  const selectedItem = selected ? sentences.find((item) => item.id === selected.item) : undefined;

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
          🔊 Listen
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
                onSelect={(token) => setSelected({ item: item.id, token })}
                selected={selected?.item === item.id ? selected.token : null}
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
                🔊
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
          void navigate(sessionPath({ preset: 'quick', size: { kind: 'all' }, passage: id }))
        }
      >
        Practise these sentences
      </Button>

      {selectedItem && selected && (
        <WordInfoSheet
          item={selectedItem}
          tokenId={selected.token}
          onClose={() => setSelected(null)}
        />
      )}
    </AppShell>
  );
}
