import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PackOffline } from '../../app/offline';
import { useServices } from '../../app/services-context';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import {
  installedPacks,
  issueBelongsTo,
  languageOption,
  levelLabel,
  type PackContents,
  type PackManifest,
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
  // only actionable if you know which add-on dropped it. Both lists, because
  // most of a pack now arrives after boot — counting only what boot validated
  // would report a clean pack whose late shards were full of problems.
  const skipped = [...services.datasetIssues, ...services.content.issues()].filter(
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

      <OfflineState manifest={manifest} />

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
 * Whether this pack is on the device, and the offer to change that.
 *
 * The packs used to be precached, so "available offline" was a property of
 * having opened the app at all and there was nothing to say. They are
 * runtime-cached now — the app fetches the shards its course reads and nothing
 * else — which makes this a real state with a real answer, and makes the rest of
 * the pack a download a learner should be asked about rather than given.
 *
 * The size is stated before the download rather than after, which is the whole
 * reason `PackFile.bytes` is in the manifest: an offer that cannot say what it
 * costs is not a fair one. What is already here is subtracted, because a learner
 * who has been studying A1 has most of the A1 half already.
 */
function OfflineState({ manifest }: { readonly manifest: PackManifest }) {
  const { services } = useServices();
  const [held, setHeld] = useState<PackOffline | undefined>(undefined);
  const [downloading, setDownloading] = useState<{ done: number; total: number } | undefined>(
    undefined,
  );
  const [failure, setFailure] = useState('');

  const refresh = useCallback(
    () =>
      services.offline
        .status()
        .then((packs) => setHeld(packs.find((pack) => pack.pack === manifest.id))),
    [services.offline, manifest.id],
  );

  useEffect(() => {
    void refresh().catch(() => {
      // A cache that cannot be read is reported as "not kept" rather than as an
      // error: the app works either way, and the only thing lost is the offer.
    });
  }, [refresh]);

  if (!services.offline.supported) {
    return (
      <p className={styles.hint}>
        This browser cannot keep packs on the device, so the app needs a connection to load one.
      </p>
    );
  }
  if (!held) return null;

  const kept = held.cached === held.files;
  const remaining = held.bytes - held.cachedBytes;
  // A pack that declares no sizes can still be kept; the offer just cannot say
  // what it costs, and saying nothing beats saying a number that is not one.
  const priced = held.bytes > 0;

  const install = () => {
    setDownloading({ done: 0, total: held.files - held.cached });
    services.offline
      .install(manifest.id, (done, total) => setDownloading({ done, total }))
      .then(refresh, (error: unknown) => {
        setFailure(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setDownloading(undefined));
  };

  const remove = () => {
    services.offline.remove(manifest.id).then(refresh, (error: unknown) => {
      setFailure(error instanceof Error ? error.message : String(error));
    });
  };

  return (
    <div className={styles.offline}>
      <p className={styles.offlineState} role="status">
        <Icon name={kept ? 'check' : 'download'} size="sm" />
        {downloading
          ? `Downloading… ${downloading.done} of ${downloading.total} files`
          : describeHeld(held)}
      </p>

      {kept ? (
        <Button
          variant="ghost"
          aria-label={`Remove ${manifest.name} from this device`}
          onClick={remove}
        >
          Remove
        </Button>
      ) : (
        <Button
          variant="tonal"
          disabled={downloading !== undefined}
          aria-label={`Keep ${manifest.name} offline${priced ? `, ${size(remaining)} to download` : ''}`}
          onClick={install}
        >
          {priced ? `Keep offline (${size(remaining)})` : 'Keep offline'}
        </Button>
      )}

      {failure && <p className={styles.packIssues}>Could not finish: {failure}</p>}
    </div>
  );
}

/**
 * The state as a sentence, in the units the question is asked in.
 *
 * Three states rather than a percentage: nothing here, some of it here, all of
 * it here. "Some" is the one worth spelling out in megabytes, because it is the
 * one where a learner is deciding whether to finish the download — and it falls
 * back to a file count for a pack that does not say what it weighs, which is a
 * real answer rather than a blank.
 */
function describeHeld(held: PackOffline): string {
  if (held.cached === held.files) {
    return held.bytes > 0 ? `Available offline · ${size(held.bytes)}` : 'Available offline';
  }
  if (held.cached === 0) return 'Not kept on this device';
  return held.bytes > 0
    ? `Partly on this device · ${size(held.cachedBytes)} of ${size(held.bytes)}`
    : `Partly on this device · ${held.cached} of ${held.files} files`;
}

/**
 * `6.4 MB`.
 *
 * Decimal megabytes rather than mebibytes, because this number is read against a
 * data plan rather than against a disk — and one decimal place, because the
 * third significant figure of a download is not a fact anybody acts on.
 */
function size(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
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
