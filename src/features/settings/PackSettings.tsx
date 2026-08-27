import { useMemo } from 'react';
import { useServices } from '../../app/services-context';
import { Icon } from '../../components/Icon';
import {
  installedPacks,
  issueBelongsTo,
  languageOption,
  levelLabel,
  type PackContents,
} from '../../domain/content';
import styles from './Settings.module.css';

/**
 * Content packs, as the add-ons they actually are.
 *
 * A pack is not part of the app: it ships separately, versions separately, is
 * licensed separately and could come from someone else entirely. Settings used
 * to report all of that as one line — "1234 items in 1 pack(s)" — which is the
 * summary you write when packs are an implementation detail. They are not: which
 * pack a sentence came from decides whether it has been reviewed, what licence
 * it carries, which accents it can be spoken in, and which of them to blame when
 * a record is skipped.
 *
 * Everything below is counted from the repository rather than read out of the
 * manifest's prose, so a pack that claims more than it holds says so — see
 * `domain/content/packs.ts`.
 */
export function PackSettings() {
  const { services } = useServices();
  const packs = useMemo(() => installedPacks(services.repository), [services.repository]);

  return (
    <>
      {packs.map((pack) => (
        <Pack key={pack.manifest.id} pack={pack} />
      ))}

      {packs.length === 0 && (
        <p className={styles.hint}>No content packs are loaded. Nothing to study until one is.</p>
      )}

      <div className={styles.field}>
        <span className={styles.label}>
          <Icon name="update" size="sm" className={styles.labelIcon} />
          Updates
        </span>
        <p className={styles.hint}>
          A pack carries its own version and updates on its own schedule, so content can improve
          without a new build of the app — and the version above is what a report about a sentence
          should quote. This build ships the packs listed here; there is no pack store yet.
        </p>
      </div>
    </>
  );
}

function Pack({ pack }: { readonly pack: PackContents }) {
  const { services } = useServices();
  const { manifest } = pack;
  const language = languageOption(manifest.targetLanguage);

  // Attributed to the pack rather than counted globally: a skipped record is
  // only actionable if you know which add-on dropped it.
  const skipped = services.datasetIssues.filter(
    (issue) => issue.severity === 'error' && issueBelongsTo(manifest, issue.source),
  ).length;

  return (
    <article className={styles.pack} aria-labelledby={`pack-${manifest.id}`}>
      <div className={styles.packHead}>
        <div>
          <h3 className={styles.packName} id={`pack-${manifest.id}`}>
            {manifest.name}
            <span className={styles.packVersion}>{manifest.version}</span>
          </h3>
          {manifest.description && <p className={styles.hint}>{manifest.description}</p>}
        </div>
        <span className={styles.packIcon} aria-hidden="true">
          <Icon name="pack" size="lg" />
        </span>
      </div>

      <ul className={styles.chips}>
        <li className={styles.chip}>
          <Icon name="language" size="sm" />
          {language.englishName}
        </li>
        {pack.levels.length > 0 && (
          <li className={styles.chip}>
            <Icon name="level" size="sm" />
            {levelRange(pack)}
          </li>
        )}
        {pack.pronunciationLocales.length > 0 && (
          <li className={styles.chip}>
            <Icon name="speak" size="sm" />
            {pack.pronunciationLocales.join(' · ')}
          </li>
        )}
        {/* Whether audio is recorded or spoken by the device is the difference
            between a fixed accent and whatever voice the phone happens to have. */}
        <li className={styles.chip}>
          <Icon name={pack.hasAudio ? 'listen' : 'silent'} size="sm" />
          {pack.hasAudio
            ? `${pack.voices || 'No'} recorded ${pack.voices === 1 ? 'voice' : 'voices'}`
            : 'Device voice only'}
        </li>
        {manifest.license && (
          <li className={styles.chip}>
            <Icon name="explain" size="sm" />
            {manifest.license}
          </li>
        )}
        {/* How old the thing you installed is. A version alone does not say
            whether `0.7.0` was cut last week or two years ago, which is the
            question a learner actually has about an add-on. */}
        {manifest.updated && (
          <li className={styles.chip}>
            <Icon name="history" size="sm" />
            Updated {manifest.updated}
          </li>
        )}
        {/*
          Provenance, stated rather than implied. Generated material that has not
          been read by an editor must stay distinguishable from material that
          has: a pack presented without this is a pack presented as curriculum.
        */}
        <li
          className={pack.review === 'reviewed' ? styles.chip : `${styles.chip} ${styles.chipWarm}`}
        >
          <Icon name={pack.review === 'reviewed' ? 'check' : 'hint'} size="sm" />
          {describeProvenance(pack)}
        </li>
      </ul>

      <ul className={styles.packStats}>
        <Stat value={pack.words} label="word cards" />
        <Stat value={pack.phrases} label="set phrases" />
        <Stat value={pack.sentences} label="sentences" />
        <Stat value={pack.passages} label="texts" />
        <Stat value={pack.skills} label="patterns" />
        <Stat value={pack.topics} label="categories" />
      </ul>

      {pack.referenceLanguages.length > 0 && (
        <p className={styles.hint}>
          Meanings in{' '}
          {pack.referenceLanguages.map((tag) => languageOption(tag).englishName).join(', ')}.
        </p>
      )}

      {/*
        Credits, because a pack is an add-on. Once one can come from somewhere
        other than this build, "who made the thing I installed" is a question the
        app has to be able to answer — and the role matters as much as the name:
        `generation` beside a name is the difference between a pack somebody wrote
        and a pack a model produced.

        Linked where a url is given, plain text where it is not. An invented link
        would be worse than none, which is why the field is optional in the data.
      */}
      {manifest.authors && manifest.authors.length > 0 && (
        <p className={styles.hint}>
          By{' '}
          {manifest.authors.map((author, index) => (
            <span key={author.name}>
              {index > 0 && ', '}
              {author.url ? (
                <a href={author.url} rel="noreferrer noopener" target="_blank">
                  {author.name}
                </a>
              ) : (
                author.name
              )}
              {author.role ? ` (${author.role})` : ''}
            </span>
          ))}
          .
        </p>
      )}

      {skipped > 0 && (
        <p className={styles.packIssues}>
          {skipped} {skipped === 1 ? 'record was' : 'records were'} skipped as invalid when this
          pack loaded.
        </p>
      )}
    </article>
  );
}

/**
 * The counts, with the noun inside the item's own text.
 *
 * Six list items each reading "357" with the word beside them gives a screen
 * reader six unlabelled numbers — the same mistake the Study tiles avoided by
 * putting the count inside the link.
 */
function Stat({ value, label }: { readonly value: number; readonly label: string }) {
  return (
    <li className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </li>
  );
}

/**
 * `A1` on its own, `A1–A2` for a span: a level is a ceiling, not a chapter.
 *
 * The ends of the pack's **declared** ladder rather than a sorted pair, which is
 * the same reason the ladder is ordered data: `hsk10` sorts before `hsk2`, so a
 * span read off a sort would advertise an HSK pack as `HSK1–HSK9`.
 */
function levelRange(pack: PackContents): string {
  const first = pack.levels[0];
  const last = pack.levels[pack.levels.length - 1];
  if (!first) return '';
  const labels = pack.levelLabels;
  return first === last
    ? levelLabel(first, labels)
    : `${levelLabel(first, labels)}–${levelLabel(last!, labels)}`;
}

function describeProvenance(pack: PackContents): string {
  if (pack.review === 'reviewed') return 'Editorially reviewed';
  if (pack.source === 'generated') return 'Generated, not yet reviewed';
  if (pack.source) return `${pack.source}, not yet reviewed`;
  return 'Review state not declared';
}
