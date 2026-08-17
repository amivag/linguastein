import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button, type ButtonVariant } from '../../components/Button';
import type { Exercise, GradeResult } from '../../domain/exercises';
import { isSelfRated } from '../../domain/exercises';
import type { TokenId } from '../../domain/content';
import { REVIEW_GRADES, type ReviewGrade } from '../../domain/progress';
import { AudioControls } from './AudioControls';
import { UsageBadges } from '../../components/UsageBadges';
import { ItemDetails } from './ItemDetails';
import { SpeakCheck } from './SpeakCheck';
import styles from './Practice.module.css';
import { TokenizedText } from './TokenizedText';
import { WordInfoSheet } from './WordInfoSheet';
import type { SessionRunner } from './useSessionRunner';

interface ExerciseViewProps {
  readonly exercise: Exercise;
  readonly runner: SessionRunner;
}

/** Names each card so the practice surface is self-describing. */
const CARD_HEADINGS: Record<Exercise['kind'], string> = {
  'listen-repeat': 'Listen and repeat',
  reveal: 'Reveal the meaning',
  'think-say': 'Say it in Spanish',
  'multiple-choice': 'Choose the meaning',
  'cloze-choice': 'Choose the missing word',
  'tap-to-build': 'Build the sentence',
};

const GRADE_LABELS: Record<ReviewGrade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

/**
 * One card per exercise kind. Each kind is a *view* of the same item — the
 * content model never changes shape to accommodate an interaction (Rule 2).
 */
export function ExerciseView({ exercise, runner }: ExerciseViewProps) {
  const [revealed, setRevealed] = useState(false);
  const [built, setBuilt] = useState<readonly string[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenId | null>(null);
  // Which choice was tapped, so the feedback can mark that one rather than
  // painting every distractor red.
  const [chosen, setChosen] = useState<string | null>(null);

  // Per-card state resets by remounting on a new exercise (SessionScreen keys
  // this component by exercise id), so no reset effect is needed. The clock is
  // read after mount rather than during render, which keeps rendering pure.
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const elapsed = useCallback(() => Date.now() - startedAt.current, []);

  const cardRef = useRef<HTMLElement>(null);
  const headingId = useId();
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  const answered = runner.lastResult !== null;
  const item = exercise.item;

  // A card the engine grades must not display the answer it is about to grade.
  // Word meanings and the details below — notes, skills, example sentences with
  // their translations — each spell it out, so both stay shut until the answer
  // is in. Self-rated cards reveal on the learner's own terms.
  const answerLocked = !isSelfRated(exercise.kind) && !answered;
  const selectWord = answerLocked ? undefined : setSelectedToken;

  return (
    <section ref={cardRef} className={styles.card} tabIndex={-1} aria-labelledby={headingId}>
      <h2 id={headingId} className="visually-hidden">
        {CARD_HEADINGS[exercise.kind]}
      </h2>
      {exercise.kind === 'listen-repeat' && (
        <>
          <TokenizedText
            item={item}
            className={styles.prompt}
            onSelect={selectWord}
            selected={selectedToken}
          />
          <AudioControls item={item} autoPlay />
          <p className={styles.hint}>Listen, then say it aloud.</p>
          <SpeakCheck expected={item.text} />
          {revealed && exercise.translation ? (
            <p className={styles.reveal}>{exercise.translation.text}</p>
          ) : (
            <Button block onClick={() => setRevealed(true)}>
              Meaning
            </Button>
          )}
        </>
      )}

      {exercise.kind === 'reveal' && (
        <>
          <TokenizedText
            item={item}
            className={styles.prompt}
            onSelect={selectWord}
            selected={selectedToken}
          />
          <AudioControls item={item} />
          {revealed && exercise.translation ? (
            <p className={styles.reveal}>{exercise.translation.text}</p>
          ) : (
            <Button block large onClick={() => setRevealed(true)}>
              Reveal
            </Button>
          )}
        </>
      )}

      {exercise.kind === 'think-say' && (
        <>
          <p className={styles.promptSecondary}>{exercise.prompt}</p>
          <p className={styles.hint}>Say it in Spanish, then reveal.</p>
          {revealed ? (
            <>
              <TokenizedText
                item={item}
                className={styles.prompt}
                onSelect={selectWord}
                selected={selectedToken}
              />
              <AudioControls item={item} autoPlay />
              <SpeakCheck expected={exercise.answer} />
            </>
          ) : (
            <Button block large onClick={() => setRevealed(true)}>
              Reveal
            </Button>
          )}
        </>
      )}

      {(exercise.kind === 'multiple-choice' || exercise.kind === 'cloze-choice') && (
        <>
          {/* Once answered, the full sentence is shown and its words open up. */}
          {answered ? (
            <TokenizedText
              item={item}
              className={styles.prompt}
              onSelect={selectWord}
              selected={selectedToken}
            />
          ) : (
            <p className={styles.prompt} lang="es">
              {exercise.prompt}
            </p>
          )}
          <div className={styles.choices}>
            {exercise.choices.map((choice, position) => {
              const variant = choiceVariant(answered, choice.correct, chosen === choice.id);
              return (
                <Button
                  key={choice.id}
                  block
                  large
                  align="start"
                  disabled={answered}
                  variant={variant}
                  lang={exercise.kind === 'cloze-choice' ? 'es' : undefined}
                  onClick={() => {
                    setChosen(choice.id);
                    runner.submitAnswer({ value: choice.id, latencyMs: elapsed() });
                  }}
                >
                  <ChoiceMarker variant={variant} position={position} />
                  {choice.text}
                </Button>
              );
            })}
          </div>
          {answered && <Verdict result={runner.lastResult} />}
        </>
      )}

      {exercise.kind === 'tap-to-build' && (
        <>
          <p className={styles.promptSecondary}>{exercise.prompt}</p>
          <p className={styles.built} lang="es">
            {built.join(' ') || ' '}
          </p>
          <div className={styles.parts}>
            {exercise.parts.map((part, position) => (
              <Button
                key={`${part}-${position}`}
                lang="es"
                variant="option"
                disabled={answered || built.includes(part)}
                onClick={() => setBuilt((current) => [...current, part])}
              >
                {part}
              </Button>
            ))}
          </div>
          <div className={styles.footer}>
            <Button onClick={() => setBuilt([])} disabled={answered}>
              Clear
            </Button>
            <Button
              variant="primary"
              disabled={answered || built.length === 0}
              onClick={() => runner.submitAnswer({ value: built, latencyMs: elapsed() })}
            >
              Check
            </Button>
          </div>
          {answered && <Verdict result={runner.lastResult} />}
        </>
      )}

      {isSelfRated(exercise.kind) ? (
        <div className={styles.ratings}>
          {REVIEW_GRADES.map((grade) => (
            <Button
              key={grade}
              onClick={() => runner.submitGrade(grade, elapsed())}
              variant={grade === 'good' ? 'primary' : 'default'}
            >
              {GRADE_LABELS[grade]}
            </Button>
          ))}
        </div>
      ) : (
        answered && (
          <Button variant="primary" block large onClick={runner.next}>
            Continue
          </Button>
        )
      )}

      {/* Who you may say this to, and where — learned with the phrase, not
          looked up afterwards. */}
      <UsageBadges register={item.register} address={item.address} regions={item.regions} />

      {!answerLocked && <ItemDetails item={item} />}

      {selectedToken && (
        <WordInfoSheet item={item} tokenId={selectedToken} onClose={() => setSelectedToken(null)} />
      )}
    </section>
  );
}

/**
 * The result, stated loudly enough to catch someone already reaching for the
 * next card: an icon, the word, and — when it was wrong — the answer itself,
 * announced through `role="status"` for anyone not looking at the screen.
 */
function Verdict({ result }: { readonly result: GradeResult | null }) {
  if (result === null) return null;
  const correct = result.correct;

  return (
    <p
      role="status"
      className={`${styles.verdict} ${correct ? styles.verdictCorrect : styles.verdictIncorrect}`}
    >
      <span className={styles.verdictIcon} aria-hidden="true">
        {correct ? '✓' : '✗'}
      </span>
      {correct ? (
        <span lang="es">¡Correcto!</span>
      ) : (
        <span>
          Answer: <span className={styles.verdictAnswer}>{result.expected}</span>
        </span>
      )}
    </p>
  );
}

/**
 * The numbered disc that makes a choice read as one option among several. Once
 * graded it shows the outcome, so the marking is not carried by fill alone —
 * decorative to a screen reader, which hears the verdict instead.
 */
function ChoiceMarker({
  variant,
  position,
}: {
  readonly variant: ButtonVariant;
  readonly position: number;
}) {
  const state =
    variant === 'correct'
      ? styles.choiceMarkerCorrect
      : variant === 'incorrect'
        ? styles.choiceMarkerIncorrect
        : '';

  return (
    <span className={`${styles.choiceMarker} ${state}`} aria-hidden="true">
      {variant === 'correct' ? '✓' : variant === 'incorrect' ? '✗' : position + 1}
    </span>
  );
}

/**
 * Marks the right answer, and the wrong one only if that is what was tapped —
 * the choices nobody picked keep their unanswered look and simply fade.
 */
function choiceVariant(answered: boolean, correct: boolean, wasChosen: boolean): ButtonVariant {
  if (!answered) return 'option';
  if (correct) return 'correct';
  return wasChosen ? 'incorrect' : 'option';
}
