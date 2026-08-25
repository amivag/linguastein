import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useCourse } from '../../app/course';
import { useServices } from '../../app/services-context';
import type { AppServices } from '../../app/services';
import { AppShell } from '../../components/AppShell';
import { Icon } from '../../components/Icon';
import { SPEAKER_GENDERS, type SpeakerGender } from '../../domain/content';
import { settingsPath } from '../settings/settings-url';
import styles from './User.module.css';

/** What the gender control offers, unsaid first because it is the default. */
const GENDER_OPTIONS: readonly { readonly id: SpeakerGender | ''; readonly label: string }[] = [
  { id: '', label: 'Not specified' },
  { id: 'masculine', label: 'Masculine' },
  { id: 'feminine', label: 'Feminine' },
];

/** What the storage counts are called, and in what order they are read. */
interface DataCounts {
  readonly items: number;
  readonly attempts: number;
  readonly sessions: number;
  readonly batches: number;
  /** Bytes the browser says this origin is using, where it will say. */
  readonly bytes: number | undefined;
}

/**
 * You: who the app thinks you are, and what it is holding about you.
 *
 * Its own address rather than a sixth Settings section, because none of this is
 * a setting about the app. Two of the three things here are about the person —
 * what to call them, and which grammatical gender they speak about themselves in
 * — and the third is an account of what is stored on this device, which is the
 * question a profile page exists to answer honestly before there is an account
 * to attach it to (`docs/tasks/accounts-and-sync.md`).
 *
 * Outside the course routes for the same reason `/design` is: a name is not a
 * property of what you are studying, and it must not appear to change when the
 * language does.
 *
 * The gender control is the one that touches content, and it says so with the
 * pair it reorders rather than with a paragraph about agreement. It is a bias
 * and the copy has to keep saying so: the other form stays in the course,
 * because other people describe themselves too and a learner who has only ever
 * been shown their own half cannot understand the half said to them.
 */
export function UserScreen() {
  const { services, preferences, updatePreferences } = useServices();
  const { course, filter } = useCourse();
  const ids = useId();
  const [counts, setCounts] = useState<DataCounts | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void readCounts(services).then((read) => {
      if (!cancelled) setCounts(read);
    });
    return () => {
      cancelled = true;
    };
  }, [services]);

  /*
   * Uncontrolled, and committed on the way out rather than on every keystroke:
   * a controlled field here would write to IndexedDB per character, and a name
   * is typed once. `key` is what keeps it honest — a reset elsewhere changes the
   * stored name, and remounting the field is how the new value reaches a box
   * React would otherwise leave alone.
   */
  const commitName = (value: string) => {
    const trimmed = value.trim();
    if (trimmed !== preferences.displayName) updatePreferences({ displayName: trimmed });
  };

  const example = useGenderedExample();
  const chosen = preferences.speakerGender;

  return (
    <AppShell title="You">
      <section className={styles.group} aria-labelledby={`${ids}-about`}>
        <h2 className={styles.sectionTitle} id={`${ids}-about`}>
          About you
        </h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${ids}-name`}>
            <Icon name="user" size="sm" className={styles.labelIcon} />
            Name
          </label>
          <input
            id={`${ids}-name`}
            key={preferences.displayName}
            type="text"
            defaultValue={preferences.displayName}
            autoComplete="given-name"
            placeholder="Not set"
            onBlur={(event) => commitName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <span className={styles.hint}>
            Optional, and only used to address you in this app. It stays on this device.
          </span>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            <Icon name="grammar" size="sm" className={styles.labelIcon} />
            How you speak about yourself
          </span>
          <div className={styles.group} role="radiogroup" aria-label="How you speak about yourself">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.id || 'unset'}
                type="button"
                role="radio"
                aria-checked={chosen === option.id}
                className={`${styles.option} ${chosen === option.id ? styles.active : ''}`}
                onClick={() => updatePreferences({ speakerGender: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className={styles.hint}>
            Grammar, not a profile. Spanish makes you choose before you can say anything about
            yourself, so sessions lead with the form that is true of you. Both forms are still
            taught — other people describe themselves too, and you have to understand them.
          </span>
          {example && (
            <p className={styles.example}>
              {chosen === '' ? (
                <>
                  {/* Quoted rather than run into the sentence: the pack's text
                      carries its own full stop, and "Estoy cansada.." is what
                      running it in produced. */}
                  You will meet <span lang="es">“{example.masculine}”</span> and{' '}
                  <span lang="es">“{example.feminine}”</span> in whichever order they come up.
                </>
              ) : (
                <>
                  <span lang="es">“{example[chosen]}”</span> comes first;{' '}
                  <span lang="es">
                    “{example[chosen === 'masculine' ? 'feminine' : 'masculine']}”
                  </span>{' '}
                  is still taught, because other people will say it to you.
                </>
              )}
            </p>
          )}
        </div>
      </section>

      <section className={styles.group} aria-labelledby={`${ids}-data`}>
        <h2 className={styles.sectionTitle} id={`${ids}-data`}>
          Your data
        </h2>

        {/* The honest statement of where this lives, before the numbers rather
            than under them: "on this device" is the part that decides whether
            somebody should worry about the rest. */}
        <p className={styles.notice}>
          <Icon name="explain" size="sm" className={styles.labelIcon} />
          Everything below is stored on this device only. There is no account, nothing is uploaded,
          and no other device can see it. Clearing this browser’s data for the site deletes it.
        </p>

        <ul className={styles.stats}>
          <Stat label="Items practised" value={counts?.items} />
          <Stat label="Answers recorded" value={counts?.attempts} />
          <Stat label="Sessions" value={counts?.sessions} />
          <Stat label="Saved batches" value={counts?.batches} />
          <Stat label="Storage used" value={counts?.bytes} format={bytes} />
          <Stat label="Items in this course" value={services.repository.query(filter).length} />
        </ul>

        <Link className={styles.link} to={settingsPath(course, 'about')}>
          <Icon name="settings" size="sm" />
          Reset or delete it in Settings → About
        </Link>
      </section>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  format = (input: number) => input.toLocaleString(),
}: {
  readonly label: string;
  readonly value: number | undefined;
  readonly format?: (value: number) => string;
}) {
  return (
    <li className={styles.stat}>
      {/* An em dash while it loads, rather than a zero: "nothing yet" and "not
          read yet" are different answers and a learner cannot tell them apart. */}
      <span className={styles.statValue}>{value === undefined ? '—' : format(value)}</span>
      <span className={styles.statLabel}>{label}</span>
    </li>
  );
}

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const mb = value / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(value / 1024)} KB`;
}

async function readCounts(services: AppServices): Promise<DataCounts> {
  const { storage } = services;
  const [items, attempts, sessions, batches, estimate] = await Promise.all([
    storage.progress.count(),
    storage.attempts.count(),
    storage.sessions.count(),
    storage.batches.all(),
    // Not every browser implements it, and the ones that do report the whole
    // origin rather than this app's share. Absent is better than invented.
    navigator.storage?.estimate?.().catch(() => undefined) ?? Promise.resolve(undefined),
  ]);

  return {
    items,
    attempts,
    sessions,
    batches: batches.length,
    bytes: estimate?.usage,
  };
}

/**
 * A real pair from the pack, so the setting can show its own effect.
 *
 * Read from the repository rather than written here, because a hard-coded
 * `Estoy cansado` would be a second place the shipped content is spelled — and
 * it would keep claiming to be an example after the row it names was retired.
 */
function useGenderedExample(): Record<SpeakerGender, string> | undefined {
  const { services } = useServices();
  const { filter } = useCourse();

  return useMemo(() => {
    const items = services.repository.query(filter);
    // The shortest of each, which is what makes the two lines read as the pair
    // they are: the pack's marked sentences are pairs, and the shortest pair is
    // the one whose halves differ in a single letter.
    const [masculine, feminine] = SPEAKER_GENDERS.map((gender) =>
      items
        .filter((item) => item.speakerGender === gender)
        .reduce<string | undefined>(
          (best, item) => (best === undefined || item.text.length < best.length ? item.text : best),
          undefined,
        ),
    );

    return masculine && feminine ? { masculine, feminine } : undefined;
  }, [services.repository, filter]);
}
