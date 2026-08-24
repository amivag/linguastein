import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useCourse, useTargetLanguage } from '../../app/course';
import { useServices } from '../../app/services-context';
import { AppShell } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { CourseBar } from '../../components/CourseBar';
import { UsageBadges } from '../../components/UsageBadges';
import { CEFR_LEVELS, type PassageKind } from '../../domain/content';
import { kindHue } from '../../styles/kinds';
import surfaces from '../../styles/surfaces.module.css';
import { studyPath } from '../study/study-url';
import { parseReadUrl } from './read-url';
import styles from './Read.module.css';

const KINDS: readonly { readonly id: PassageKind | 'all'; readonly label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'text', label: 'Texts' },
  { id: 'dialogue', label: 'Dialogues' },
];

/**
 * The reading list: connected texts and dialogues rather than single sentences
 * (spec §16). Extended input is the half of the app that practice cannot
 * provide — a paragraph teaches how sentences hang together.
 */
export function ReadScreen() {
  const lang = useTargetLanguage();
  const { services, preferences } = useServices();
  const { course, filter, path } = useCourse();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [kind, setKind] = useState<PassageKind | 'all'>('all');

  // Which Study section opened this list, so Back returns to it rather than to
  // whichever section the course happens to start with. The reasoning is
  // `browse-url.ts`'s, and so is the mechanism.
  const { from } = parseReadUrl(params);

  const passages = useMemo(() => {
    // A passage carries its own level, so the course narrows this list the same
    // way it narrows the pack: a B1 text has no business appearing in an A1
    // course just because its sentences are individually practisable.
    const ceiling = filter.levels?.length
      ? Math.max(...filter.levels.map((level) => CEFR_LEVELS.indexOf(level)))
      : undefined;
    return services.repository.allPassages().filter((passage) => {
      if (kind !== 'all' && passage.kind !== kind) return false;
      if (filter.packs?.length && !filter.packs.includes(passage.pack)) return false;
      if (ceiling === undefined) return true;
      return passage.level !== undefined && CEFR_LEVELS.indexOf(passage.level) <= ceiling;
    });
  }, [services.repository, kind, filter]);

  return (
    <AppShell title="Read" onBack={() => void navigate(studyPath(course, from))}>
      <CourseBar compact />
      <p className={styles.intro}>
        Short texts and conversations built from words you already practise. Tap any word for its
        meaning.
      </p>

      <div className={styles.filters}>
        <label className={styles.filter}>
          <span className="visually-hidden">Kind</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as PassageKind | 'all')}
          >
            {KINDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className={styles.count} role="status">
        {passages.length} {passages.length === 1 ? 'text' : 'texts'}
      </p>

      <ul className={styles.list}>
        {passages.map((passage) => {
          const translation = services.repository.translationOf(
            passage.id,
            preferences.referenceLanguage,
          );
          return (
            <li key={passage.id}>
              {/* The hue is declared on the card, not on the badge inside it, for the
                  reason the home screen's rows record: custom properties inherit, so
                  the ground, the spine, the disc and the kind's own name resolve from
                  one `data-kind` and cannot disagree. */}
              <Link
                className={styles.card}
                data-kind={kindHue(passage.id)}
                to={path(`read/${localId(passage.id)}`)}
              >
                {/* Decoration over a link that names itself: the glyph says text or
                    conversation, and the word beside it says the same in text. */}
                <span className={surfaces.kindBadge} aria-hidden="true">
                  <Icon name={passage.kind === 'dialogue' ? 'dialogue' : 'passage'} size="sm" />
                </span>
                <span className={styles.cardBody}>
                  <span className={styles.cardTitle} lang={lang}>
                    {passage.title}
                  </span>
                  {translation && <span className={styles.cardMeaning}>{translation.text}</span>}
                  <span className={styles.cardMeta}>
                    <span className={styles.cardKind}>
                      {passage.kind === 'dialogue' ? 'Dialogue' : 'Text'}
                    </span>
                    <span className={styles.cardFacts}>
                      {passage.items.length} sentences
                      {passage.level ? ` · ${passage.level.toUpperCase()}` : ''}
                    </span>
                    <UsageBadges compact regions={passage.regions} />
                  </span>
                </span>
                <Icon name="next" size="sm" className={styles.cardChevron} />
              </Link>
            </li>
          );
        })}
      </ul>

      {passages.length === 0 && (
        <p className={styles.empty}>
          <Icon name="read" size="xl" className={styles.emptyIcon} />
          No texts in this pack yet.
        </p>
      )}
    </AppShell>
  );
}

/** Routes carry only the local part, so the URL stays readable. */
function localId(passageId: string): string {
  return passageId.split(':').pop() ?? passageId;
}
