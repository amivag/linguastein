import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  useCourse,
  usePronunciationLocale,
  useTargetLanguage,
  useVoiceName,
} from '../../app/course';
import { useServices } from '../../app/services-context';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import type { EntityId, SkillId } from '../../domain/content';
import { nextSubject } from '../../domain/drills';
import { recordAttempt, type SubjectProgress } from '../../domain/progress';
import { numeralGuide, type NumeralGuide } from '../../languages/runtime';
import { systemRng } from '../../utils/random';
import styles from './NumbersSection.module.css';

/** Which way round the question is asked. */
type Direction = 'say' | 'hear';

/** Everything the drill needs before it can ask anything, read in one pass. */
interface Loaded {
  readonly guide: NumeralGuide;
  readonly patterns: readonly Pattern[];
  readonly progress: ReadonlyMap<EntityId, SubjectProgress>;
}

interface Question {
  /** The pattern the drill set out to practise; the number may exercise more. */
  readonly rule: string;
  readonly value: number;
  readonly direction: Direction;
}

interface Verdict {
  readonly correct: boolean;
  readonly value: number;
  readonly spelled: string;
  /** Every pattern this answer was evidence about. */
  readonly rules: readonly string[];
}

/** A rule the loaded packs actually declare a skill for, with that skill's id. */
interface Pattern {
  readonly rule: string;
  readonly id: SkillId;
  readonly label: string;
}

/**
 * Numbers, drilled rather than listed.
 *
 * A learner's actual question is "how do I say 1042?", and no number of authored
 * rows answers it: the value is in the joining rules, the solid teens, the
 * apocopation and the hundreds agreement. `docs/tasks/numerals.md` §2 argues
 * that at length, and §4.1 already shipped the half that fits in a dataset — 38
 * generated numeral lemmas, practised through the ordinary exercise kinds.
 *
 * This is the other half: **generated targets**, so 1042 is askable without
 * existing anywhere. What blocked it was never the generator. It was that an
 * attempt has to be recorded against something, a session deals item ids, and
 * 1042 has no id and must not be given one — §6.1 refused a synthetic item for
 * the right reason.
 *
 * It is recorded against the **patterns the number puts to work**. `rulesFor`
 * already computed those, the seven `core-es:skill:numerals-*` records already
 * shipped, and a progress row can be about a skill now — so the set of things
 * the scheduler sees is closed, stable and small, while the set of numbers a
 * learner can be asked is not.
 *
 * **One answer, one attempt per rule.** Producing `mil cuarenta y dos` genuinely
 * requires both `y-joining` and `mil-millon`, so a correct answer is evidence
 * for both and a wrong one is evidence that something in that combination is not
 * solid. That over-attributes a failure to the rule that was not at fault, and
 * it is the same trade `mastery.ts` already makes when an item's success credits
 * every skill it carries: across enough attempts the rule actually failing shows
 * up in more of them, and the alternative is guessing which one to blame.
 *
 * A section of Study rather than a route of its own, which is where the brief
 * expected a screen. The address exists either way — `/es/a1/study?tab=numbers`
 * — and everything a separate route would have bought is already here: the tab
 * is derived from whether the language *has* a numeral module, exactly as the
 * alphabet's is, so a pack with no numerals grows no tab and no dead link.
 *
 * Unlike the rest of Study, this **records**, and the section note says so — the
 * same qualification the Sets section makes for the same reason.
 */
/**
 * The next question: which pattern to practise, and a number that puts it to
 * work.
 *
 * Pure but for the injected randomness, and outside the component for that
 * reason — the React Compiler rules forbid an impure call during render, and a
 * function that reaches for `Math.random` is much easier to keep out of one when
 * it is not sitting inside it.
 */
function compose(
  guide: NumeralGuide,
  patterns: readonly Pattern[],
  progress: ReadonlyMap<EntityId, SubjectProgress>,
): Question {
  const chosen = nextSubject(
    patterns.map((pattern) => pattern.id),
    progress,
    Date.now(),
    systemRng,
  );
  const pattern = patterns.find((entry) => entry.id === chosen) ?? patterns[0]!;
  return {
    rule: pattern.rule,
    value: guide.sampleFor(pattern.rule, systemRng),
    /*
     * Both directions from the first question, alternating by chance rather than
     * by a ladder. Hearing a number and writing digits is the failure that
     * actually happens — at a ticket desk, a market stall, a platform
     * announcement — so holding it back behind a threshold would be holding back
     * the useful half.
     */
    direction: systemRng.next() < 0.5 ? 'say' : 'hear',
  };
}

export function NumbersSection() {
  const { services } = useServices();
  const { course, filter } = useCourse();
  /*
   * The course's language rather than `useTargetLanguage()`, which answers
   * `undefined` where the packs cannot say — an honest answer for a `lang`
   * attribute and no use for deciding whether this language has numerals at all.
   */
  const lang = course.language;
  const spoken = useTargetLanguage();
  const locale = usePronunciationLocale();
  const voice = useVoiceName();
  const ids = useId();
  const field = useRef<HTMLInputElement>(null);

  /**
   * The speller, the patterns it can be recorded against, and what is already
   * known about them — read once, together.
   *
   * One state rather than three, and one effect rather than three, because the
   * first question needs all of it: which pattern to lead with is a question
   * about progress, which pattern *exists* is a question about the packs, and
   * what number to ask is a question for the speller. Setting them separately
   * meant a fourth effect waiting for the other three, which is both the thing
   * the React Compiler rules forbid and a worse way to say it.
   */
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [question, setQuestion] = useState<Question | undefined>(undefined);
  const [answer, setAnswer] = useState('');
  const [verdict, setVerdict] = useState<Verdict | undefined>(undefined);

  /*
   * Memoised, because `numeralGuide` hands back a *new closure* each call and
   * that closure is the load effect's dependency. Without this the effect re-ran
   * on every render — so every keystroke in the answer box quietly composed a
   * new question, and the drill graded an answer against a number the learner
   * had never been shown. `AlphabetSection` memoises its loader for the same
   * reason; the difference is that a chart does not re-render while you type
   * into it, so there the mistake would have been invisible.
   */
  const loader = useMemo(() => numeralGuide(lang), [lang]);
  const { repository, storage } = services;
  const packs = filter.packs;

  useEffect(() => {
    if (!loader) return;
    let cancelled = false;
    void (async () => {
      const [guide, rows] = await Promise.all([loader(), storage.progress.all()]);
      if (cancelled) return;

      /*
       * A rule whose skill the loaded packs do not declare is **not offered** —
       * there would be nowhere to put the evidence, and a question that records
       * nothing while sitting in a section that says it records is the worse of
       * the two failures. Same rule the tiles, the categories and the letters
       * already follow: a count of zero is not offered.
       */
      const patterns = guide.rules.flatMap<Pattern>((rule) => {
        const skill = repository.skillByRef(`numerals-${rule}`, packs);
        return skill ? [{ rule, id: skill.id, label: skill.label }] : [];
      });
      const progress = new Map(rows.map((row) => [row.subject, row] as const));

      setLoaded({ guide, patterns, progress });
      setQuestion(patterns.length > 0 ? compose(guide, patterns, progress) : undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [loader, packs, repository, storage]);

  const guide = loaded?.guide;
  const patterns = loaded?.patterns ?? [];

  const ask = (held: ReadonlyMap<EntityId, SubjectProgress>) => {
    if (!guide || patterns.length === 0) return;
    setQuestion(compose(guide, patterns, held));
    setAnswer('');
    setVerdict(undefined);
  };

  const speakQuestion = useCallback(
    (value: number) => {
      if (!guide) return;
      // §7: expand to words before the seam, never hand digits to a voice. What
      // an engine does with "1042" varies by engine and locale, and the whole
      // point of the module is that the app decides how a number is said.
      void services.audio.speak({ text: guide.spell(value), locale, ...(voice ? { voice } : {}) });
    },
    [guide, locale, services.audio, voice],
  );

  useEffect(() => {
    if (question?.direction === 'hear' && verdict === undefined) speakQuestion(question.value);
  }, [question, speakQuestion, verdict]);

  const submit = () => {
    if (!loaded || !guide || !question || verdict) return;
    const given = answer.trim();
    if (given === '') return;

    const correct =
      question.direction === 'say'
        ? guide.parse(given) === question.value
        : Number(given.replaceAll(/[\s.,]/gu, '')) === question.value;

    const rules = guide.rulesFor(question.value);
    const now = Date.now();
    const updated = new Map(loaded.progress);

    for (const rule of rules) {
      const pattern = patterns.find((entry) => entry.rule === rule);
      if (!pattern) continue;
      const recorded = recordAttempt(
        updated.get(pattern.id),
        {
          subject: pattern.id,
          // The closest existing kind, and an honest one: the learner produces
          // the whole answer from a cue with nothing to choose between. It is
          // what `domain/batches/progress.ts` counts as production evidence.
          exerciseKind: 'think-say',
          grade: correct ? 'good' : 'again',
          correct,
        },
        now,
      );
      updated.set(pattern.id, recorded.progress);
      void storage.progress.put(recorded.progress);
      void storage.attempts.append(recorded.attempt);
    }

    setLoaded({ ...loaded, progress: updated });
    setVerdict({ correct, value: question.value, spelled: guide.spell(question.value), rules });
  };

  if (!loader) return null;

  if (patterns.length === 0) {
    return (
      <p className={styles.empty}>
        {guide
          ? 'The loaded packs describe no number patterns, so there is nothing to record practice against yet.'
          : 'Loading…'}
      </p>
    );
  }

  return (
    <div className={styles.drill}>
      <p className={styles.lead}>
        {question?.direction === 'hear'
          ? 'Listen, and write the number in digits.'
          : 'Write this number the way you would say it.'}
      </p>

      {question && (
        <div className={styles.prompt}>
          {question.direction === 'say' ? (
            <output className={styles.digits}>{question.value.toLocaleString()}</output>
          ) : (
            <Button
              variant="tonal"
              large
              aria-label="Play the number again"
              onClick={() => speakQuestion(question.value)}
            >
              <Icon name="listen" size="md" />
              Play again
            </Button>
          )}
        </div>
      )}

      <form
        className={styles.answer}
        onSubmit={(event) => {
          event.preventDefault();
          if (verdict) ask(loaded?.progress ?? new Map());
          else submit();
        }}
      >
        <label className={styles.label} htmlFor={`${ids}-answer`}>
          {question?.direction === 'hear' ? 'The number, in digits' : 'The number, in words'}
        </label>
        <input
          id={`${ids}-answer`}
          ref={field}
          type="text"
          value={answer}
          readOnly={verdict !== undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode={question?.direction === 'hear' ? 'numeric' : 'text'}
          {...(question?.direction === 'say' && spoken ? { lang: spoken } : {})}
          onChange={(event) => setAnswer(event.target.value)}
        />
        <Button type="submit" variant="primary" block>
          {verdict ? 'Next number' : 'Check'}
        </Button>
      </form>

      {verdict && (
        <div className={styles.verdict} role="status">
          <p className={verdict.correct ? styles.right : styles.wrong}>
            <Icon name={verdict.correct ? 'check' : 'close'} size="sm" />
            {verdict.correct ? 'Yes.' : 'Not quite.'}{' '}
            <strong className={styles.spelled} {...(spoken ? { lang: spoken } : {})}>
              {verdict.spelled}
            </strong>{' '}
            <span className={styles.plain}>= {verdict.value.toLocaleString()}</span>
          </p>
          {/* Named rather than implied: a learner who gets `ciento treinta y uno`
              wrong is owed the two rules it was testing, because that is the
              thing to go and learn — the number itself is a sample. */}
          <p className={styles.rules}>
            {verdict.rules.length === 1 ? 'This one tests: ' : 'This one tests: '}
            {verdict.rules
              .map((rule) => patterns.find((entry) => entry.rule === rule)?.label ?? rule)
              .join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}
