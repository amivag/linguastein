import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import type { Exercise } from '../../domain/exercises';
import { isSelfRated } from '../../domain/exercises';
import { REVIEW_GRADES, type ReviewGrade } from '../../domain/progress';
import { AudioControls } from './AudioControls';
import { ItemDetails } from './ItemDetails';
import styles from './Practice.module.css';
import type { SessionRunner } from './useSessionRunner';

interface ExerciseViewProps {
  readonly exercise: Exercise;
  readonly runner: SessionRunner;
}

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
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setRevealed(false);
    setBuilt([]);
    startedAt.current = Date.now();
  }, [exercise.id]);

  const elapsed = () => Date.now() - startedAt.current;

  const answered = runner.lastResult !== null;
  const item = exercise.item;

  return (
    <section className={styles.card} aria-live="polite">
      {exercise.kind === 'listen-repeat' && (
        <>
          <p className={styles.prompt} lang="es">
            {item.text}
          </p>
          <AudioControls item={item} autoPlay />
          <p className={styles.hint}>Listen, then say it aloud.</p>
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
          <p className={styles.prompt} lang="es">
            {item.text}
          </p>
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
              <p className={styles.prompt} lang="es">
                {exercise.answer}
              </p>
              <AudioControls item={item} autoPlay />
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
          <p className={styles.prompt} lang="es">
            {exercise.prompt}
          </p>
          <div className={styles.choices}>
            {exercise.choices.map((choice) => (
              <Button
                key={choice.id}
                block
                large
                disabled={answered}
                variant={choiceVariant(answered, choice.correct)}
                onClick={() => runner.submitAnswer({ value: choice.id, latencyMs: elapsed() })}
              >
                {choice.text}
              </Button>
            ))}
          </div>
          {answered && (
            <p className={runner.lastResult?.correct ? styles.reveal : styles.hint}>
              {runner.lastResult?.correct ? '¡Correcto!' : `Answer: ${runner.lastResult?.expected}`}
            </p>
          )}
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
          {answered && (
            <p className={runner.lastResult?.correct ? styles.reveal : styles.hint}>
              {runner.lastResult?.correct ? '¡Correcto!' : `Answer: ${runner.lastResult?.expected}`}
            </p>
          )}
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

      <ItemDetails item={item} />
    </section>
  );
}

function choiceVariant(answered: boolean, correct: boolean) {
  if (!answered) return 'default' as const;
  return correct ? ('correct' as const) : ('incorrect' as const);
}
