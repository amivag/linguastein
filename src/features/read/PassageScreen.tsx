import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { PlaybackTransport } from '../../components/PlaybackTransport';
import { Transcript } from '../../components/Transcript';
import { UsageBadges } from '../../components/UsageBadges';
import { useSequence } from '../../components/usePlayback';
import { useWordSelection } from '../../components/useWordSelection';
import { WordInfoSheet } from '../../components/WordInfoSheet';
import type { LearningItem } from '../../domain/content';
import { sessionPath } from '../practice/session-url';
import styles from './Read.module.css';

/** Stable, so an unresolved passage does not hand back a new array each render. */
const EMPTY_ITEMS: readonly LearningItem[] = [];

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

  // Resolved once and memoised together with the sentences it decides, because
  // `resolvePassage` returns a fresh object each call: reading it inline made the
  // dependency below change on every render, which the React Compiler rejects
  // rather than silently re-running.
  const { resolved, sentences } = useMemo(() => {
    const found = services.repository.resolvePassage(id);
    return {
      resolved: found,
      sentences:
        found.kind === 'found' ? services.repository.itemsOfPassage(found.value.id) : EMPTY_ITEMS,
    };
  }, [services.repository, id]);
  const passage = resolved.kind === 'found' ? resolved.value : undefined;
  // Above the early return below, because a hook cannot be behind one. An
  // unresolved passage has no sentences, and a sequence over none of them is
  // simply idle and unavailable.
  const reading = useSequence(sentences);

  if (!passage) {
    return (
      <AppShell title="Read" onBack="history">
        {/* Three different things, said differently. "Not found" alone cannot
            distinguish a broken link from a pack a learner has not installed
            from a link that is merely under-specified — and only the last of
            those is fixed by the learner doing nothing at all. */}
        <p className={styles.empty} role="status">
          {resolved.kind === 'ambiguous' ? (
            <>
              More than one pack has a text called <strong>{id}</strong> —{' '}
              {resolved.packs.join(' and ')}. This link does not say which, so it cannot be opened
              safely.
            </>
          ) : (
            <>
              There is no text <strong>{id}</strong> in the packs you have. It may belong to a pack
              that is not installed.
            </>
          )}
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
        {/* One sentence at a time, with the transport that makes reading along
            possible: hold it where a word needs looking up, drop it, or tap a
            line to carry on from there. It was one utterance of the whole text
            joined by spaces, which could only start and be interrupted. */}
        <PlaybackTransport sequence={reading} unit="Sentence" />
        <Button
          onClick={() => setShowTranslations((shown) => !shown)}
          aria-pressed={showTranslations}
        >
          {showTranslations ? 'Hide meaning' : 'Show meaning'}
        </Button>
      </div>

      {/*
        No `self`: nobody is cast in a passage a learner is only reading, so the
        voices take sides in the order they first speak. A `kind: 'text'` passage
        has no speakers at all and `Transcript` draws it as prose — which is the
        one place left in the app that still rules a line between two paragraphs.
      */}
      <Transcript
        label={`${passage.title}, ${sentences.length} sentences`}
        lines={sentences.map((item, index) => {
          const translation = services.repository.translationOf(
            item.id,
            preferences.referenceLanguage,
          );
          return {
            item,
            ...(passage.speakers?.[index] ? { speaker: passage.speakers[index] } : {}),
            ...(showTranslations && translation ? { meaning: translation.text } : {}),
          };
        })}
        onSelectWord={words.open}
        selectedTokens={words.tokensFor}
        onListen={reading.listen}
      />

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
