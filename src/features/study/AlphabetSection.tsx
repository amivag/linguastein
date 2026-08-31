import { useEffect, useId, useMemo, useState } from 'react';
import {
  useCourse,
  usePronunciationLocale,
  useTargetLanguage,
  useVoiceName,
} from '../../app/course';
import { useServices } from '../../app/services-context';
import { Annotation } from '../../components/Annotation';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { regionLabel } from '../../domain/content';
import { alphabetGuide, type AlphabetEntry, type AlphabetGuide } from '../../languages/runtime';
import { kindHue } from '../../styles/kinds';
import styles from './AlphabetSection.module.css';

/**
 * The alphabet, as a chart rather than as a filter.
 *
 * Browse already had a row of letters and Study already had a category called
 * "The alphabet", and between them they answered every question about the
 * alphabet except the two a learner actually arrives with: what are the letters,
 * and how do I say them. The letter index narrows a list; the category opens
 * thirty-seven sentences *about* spelling — `¿Se escribe con be o con uve?` —
 * which are the right sentences and are useless to somebody who does not yet
 * know that `uve` is a v.
 *
 * So this is the chart: every letter with its name, that name respelled for
 * reading, what the letter sounds like inside a word, words to hear it in, and
 * the cases where it does something else. The three lists stay three — letters,
 * pairs that spell one sound, written marks — because merging them would make
 * the alphabet's own length a lie, and "how many letters are there" is the
 * question the 2010 reform makes worth answering precisely.
 *
 * Nothing here is practised and nothing is recorded, which is what makes it a
 * section of Study rather than content: the moment a letter is something a
 * learner is tested on, it needs an id in `content/es` that progress can
 * reference. The eighteen letter *names* that are already word cards have those
 * ids today.
 */
export function AlphabetSection() {
  const { services } = useServices();
  const { course } = useCourse();
  const lang = useTargetLanguage();
  const locale = usePronunciationLocale();
  const voice = useVoiceName();
  const [guide, setGuide] = useState<AlphabetGuide | null>(null);

  /*
    Memoised because it is the effect's dependency: `alphabetGuide` returns a
    fresh closure per call, so reading it during render would re-run the load on
    every render the load itself caused.
  */
  const load = useMemo(() => alphabetGuide(course.language), [course.language]);

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    void load().then(
      (loaded) => {
        if (!cancelled) setGuide(loaded);
      },
      (error: unknown) => {
        // A chunk that will not load is not a reason to break the screen around
        // it; the section stays empty and says so.
        console.warn('Could not load the alphabet', error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Voice discovery is asynchronous, so what can be heard is re-read once the
  // provider is ready rather than assumed on the first render — Browse's rule.
  const [voicesReady, setVoicesReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void services.audio.ready().then(() => {
      if (!cancelled) setVoicesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [services.audio]);

  // Leaving the screen must not leave a letter still talking.
  useEffect(() => () => services.audio.stop(), [services.audio]);

  const speak = (text: string) =>
    void services.audio.speak({
      text,
      locale,
      ...(voice ? { voice } : {}),
    });

  if (!guide) {
    return (
      <p className={styles.pending} role="status">
        Loading the alphabet…
      </p>
    );
  }

  const speakable = voicesReady && services.audio.canSpeak(locale);

  return (
    <div className={styles.guide}>
      <Group
        title="The letters"
        note="What each one is called, what it sounds like inside a word, and words to hear it in."
        noun="letter"
        entries={guide.letters}
        lang={lang}
        speakable={speakable}
        onSpeak={speak}
      />
      <Group
        title="Pairs that spell one sound"
        note="Two letters acting as one. Not letters of the alphabet — and impossible to read without."
        noun="pair"
        entries={guide.digraphs}
        lang={lang}
        speakable={speakable}
        onSpeak={speak}
      />
      <Group
        title="Written marks"
        note="Not letters either, and both change what a word means."
        noun="mark"
        entries={guide.marks}
        lang={lang}
        speakable={speakable}
        onSpeak={speak}
      />
    </div>
  );
}

interface GroupProps {
  readonly title: string;
  readonly note: string;
  /** What one row of this group *is*, so a control can name itself precisely. */
  readonly noun: string;
  readonly entries: readonly AlphabetEntry[];
  readonly lang: string | undefined;
  readonly speakable: boolean;
  readonly onSpeak: (text: string) => void;
}

function Group({ title, note, noun, entries, lang, speakable, onSpeak }: GroupProps) {
  const headingId = useId();
  if (entries.length === 0) return null;

  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <h3 className={styles.groupHeading} id={headingId}>
        {title}
        <span className={styles.count}>{entries.length}</span>
      </h3>
      <p className={styles.groupNote}>{note}</p>

      <ul className={styles.cards}>
        {entries.map((entry) => (
          <Row
            key={entry.letter}
            entry={entry}
            noun={noun}
            lang={lang}
            speakable={speakable}
            onSpeak={onSpeak}
          />
        ))}
      </ul>
    </section>
  );
}

interface RowProps {
  readonly entry: AlphabetEntry;
  readonly noun: string;
  readonly lang: string | undefined;
  readonly speakable: boolean;
  readonly onSpeak: (text: string) => void;
}

/**
 * One letter, and everything a chart can say about it without being asked.
 *
 * Nothing is behind a disclosure. Design rule 3 says an expanding control opens
 * over the page rather than in flow, and twenty-seven sheets to open is not a
 * reference anyone would consult — so the card carries its whole content and the
 * page is long, which is what a chart is.
 */
function Row({ entry, noun, lang, speakable, onSpeak }: RowProps) {
  const capital = capitalise(entry.letter);
  const said = entry.name ?? entry.letter;

  return (
    <li className={styles.card} data-kind={kindHue(entry.letter)}>
      <div className={styles.head}>
        {/* Both cases, because a chart that shows one has answered half the
            question — and for a pair it is `Ch`, not `CH`. */}
        <h4 className={styles.glyph} lang={lang}>
          {capital} {entry.letter}
        </h4>

        <div className={styles.naming}>
          {entry.name && (
            <span className={styles.name} lang={lang}>
              {entry.name}
            </span>
          )}
          {entry.say && <span className={styles.say}>{entry.say}</span>}
        </div>

        {speakable && (
          <Button
            variant="ghost"
            icon
            className={styles.play}
            onClick={() => onSpeak(said)}
            aria-label={
              entry.name
                ? `Pronounce the ${noun} ${capital}, called ${entry.name}`
                : `Pronounce the ${noun} ${capital}`
            }
          >
            <Icon name="speak" />
          </Button>
        )}
      </div>

      <p className={styles.sound}>{entry.sound}</p>

      <ul className={styles.examples}>
        {entry.examples.map((example) => {
          const word = (
            <>
              <span className={styles.word} lang={lang}>
                {example.word}
              </span>
              <span className={styles.gloss}>{example.gloss}</span>
            </>
          );

          return (
            <li key={example.word}>
              {/*
                A control only where there is something to hear. Where the device
                has no voice for this language the word is still the teaching —
                it is read, not played — so it stays as text rather than as a
                hundred dead buttons, which is the same call Browse makes about
                its play controls.

                Where it *is* a control, the name has to place the word: `casa`
                is an example of A, of C and of S, and three controls called
                "Pronounce casa" is the mistake `contextLabel` exists to stop.
              */}
              {speakable ? (
                <button
                  type="button"
                  className={styles.exampleButton}
                  onClick={() => onSpeak(example.word)}
                  aria-label={`Pronounce ${example.word}, ${example.gloss}, an example of the ${noun} ${capital}`}
                >
                  {word}
                </button>
              ) : (
                <span className={styles.example}>{word}</span>
              )}
            </li>
          );
        })}
      </ul>

      {entry.also && entry.also.length > 0 && (
        <Annotation facet="note" label="Also called">
          {alternativeNames(entry.also).map((group, index) => (
            <span key={group.where}>
              {index > 0 && '; '}
              {group.names.map((name, position) => (
                <span key={name}>
                  {position > 0 && ', '}
                  <span lang={lang}>{name}</span>
                </span>
              ))}
              {group.where && ` in ${group.where}`}
            </span>
          ))}
        </Annotation>
      )}

      {entry.notes?.map((note) => (
        <Annotation facet="note" key={note}>
          {note}
        </Annotation>
      ))}
    </li>
  );
}

/**
 * The other names a letter answers to, with the place said once.
 *
 * `b` has two Latin American names and `v` has two more, so one region per name
 * reads "be larga in Latin America, be grande in Latin America" — the same fact
 * twice, in the line whose whole job is to be scanned. Grouped by where they are
 * used, it is "be larga, be grande in Latin America", and a name used somewhere
 * else still gets its own clause rather than being folded into that one.
 */
function alternativeNames(
  also: readonly { readonly name: string; readonly regions: readonly string[] }[],
): readonly { readonly where: string; readonly names: readonly string[] }[] {
  const groups = new Map<string, string[]>();
  for (const alternative of also) {
    const where = alternative.regions.map(regionLabel).join(' and ');
    const existing = groups.get(where);
    if (existing) existing.push(alternative.name);
    else groups.set(where, [alternative.name]);
  }
  return [...groups].map(([where, names]) => ({ where, names }));
}

/** `ch` → `Ch`, not `CH`: Spanish capitalises the pair on its first letter only. */
function capitalise(letter: string): string {
  return letter.charAt(0).toUpperCase() + letter.slice(1);
}
