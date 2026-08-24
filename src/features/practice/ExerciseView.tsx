import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useServices } from '../../app/services-context';
import { Button, type ButtonVariant } from '../../components/Button';
import type { Exercise, GradeResult } from '../../domain/exercises';
import { isSelfRated } from '../../domain/exercises';

import type { TokenId } from '../../domain/content';
import { REVIEW_GRADES, type ReviewGrade } from '../../domain/progress';
import { AudioControls } from './AudioControls';
import { Annotation } from '../../components/Annotation';
import { UsageBadges } from '../../components/UsageBadges';
import { ItemDetails } from './ItemDetails';
import { SpeakCheck } from './SpeakCheck';
import { Icon } from '../../components/Icon';
import styles from './Practice.module.css';
import { TokenizedText } from '../../components/TokenizedText';
import { useWordSelection } from '../../components/useWordSelection';
import { WordInfoSheet } from '../../components/WordInfoSheet';
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
  const { services } = useServices();
  const [revealed, setRevealed] = useState(false);
  // Tiles are held by position, never by text. `Veo la televisión por la noche.`
  // deals two `la` tiles, and tracking them by word disabled both the moment one
  // was used — leaving the sentence impossible to finish and marked wrong.
  const [built, setBuilt] = useState<readonly number[]>([]);
  const words = useWordSelection();
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
  const parts = exercise.kind === 'tap-to-build' ? exercise.parts : [];
  const builtWords = built.map((position) => parts[position] ?? '');

  // A card the engine grades must not display the answer it is about to grade.
  // The details below — notes, skills, example sentences with their translations
  // — spell it out, so they stay shut until the answer is in. Self-rated cards
  // reveal on the learner's own terms.
  const answerLocked = !isSelfRated(exercise.kind) && !answered;
  const selectWord = (tokenId: TokenId) => words.open(item.id, tokenId);

  /**
   * Whether the word sheet may show meanings.
   *
   * Every word of every phrase is tappable on every screen, and a graded card is
   * not the exception it used to be: being unable to ask what `va` is while
   * reading the sentence it sits in made the one screen you are actually
   * studying on the worst place to look something up.
   *
   * What the card is grading is still withheld, and only that. Multiple choice
   * asks what the phrase *means*, so meaning is the one thing the sheet holds
   * back until the answer is in — the form, the lemma, the pattern and the other
   * forms are not the answer to it, and are most of the reason to tap a word
   * mid-question. A cloze grades a *form*, and that form is already rendered as
   * the blank rather than as a button, so its sheet has nothing left to hide.
   */
  const meanings = !answerLocked || exercise.kind !== 'multiple-choice';

  // Playback speaks the item's own text, so it hands over any card whose answer
  // is that text or a word missing from it. Multiple choice is the exception:
  // it shows the Spanish and asks what it means, so hearing it reveals nothing
  // the card is not already showing — and an audio-first app should let you
  // hear the phrase before you commit to a meaning, not only afterwards.
  const audioLocked = answerLocked && exercise.kind !== 'multiple-choice';

  const openItem = words.item ? services.repository.getItem(words.item) : undefined;

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
            selected={words.tokensFor(item.id)}
          />
          <AudioControls item={item} autoPlay />
          <p className={styles.hint}>Listen, then say it aloud.</p>
          <SpeakCheck expected={item.text} />
          {revealed && exercise.translation ? (
            <Annotation facet="meaning" lead>
              {exercise.translation.text}
            </Annotation>
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
            selected={words.tokensFor(item.id)}
          />
          <AudioControls item={item} />
          {revealed && exercise.translation ? (
            <Annotation facet="meaning" lead>
              {exercise.translation.text}
            </Annotation>
          ) : (
            <Button block large onClick={() => setRevealed(true)}>
              Reveal
            </Button>
          )}
        </>
      )}

      {exercise.kind === 'think-say' && (
        <>
          {/* The English is the *cue* here rather than the answer, and it wears
              the same shape it wears when a card reveals it — one fact, one
              look, wherever on the card it happens to fall. */}
          <Annotation facet="meaning" lead>
            {exercise.prompt}
          </Annotation>
          <p className={styles.hint}>Say it in Spanish, then reveal.</p>
          {revealed ? (
            <>
              <TokenizedText
                item={item}
                className={styles.prompt}
                onSelect={selectWord}
                selected={words.tokensFor(item.id)}
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
          {/* The words are tappable throughout, on both kinds of card. The only
              difference the answer makes is what the sheet will say: a cloze
              blanks the form it grades out of the text, and multiple choice
              holds back meanings until the choice is in. */}
          <TokenizedText
            item={item}
            className={styles.prompt}
            onSelect={selectWord}
            selected={words.tokensFor(item.id)}
            {...(!answered && exercise.kind === 'cloze-choice'
              ? { blankTokenId: exercise.blankTokenId }
              : {})}
          />
          {!audioLocked && <AudioControls item={item} />}
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
        </>
      )}

      {exercise.kind === 'tap-to-build' && (
        <>
          <Annotation facet="meaning" lead>
            {exercise.prompt}
          </Annotation>
          <p className={styles.built} lang="es">
            {builtWords.join(' ') || ' '}
          </p>
          {/*
            Raised, not `option`.

            `option` means "an answer recessed into the card", which is right for
            a row of multiple-choice answers and wrong here: the slot above is
            the recessed thing, and painting the words the same colour made the
            two indistinguishable — a well you fill and the tiles you fill it
            with, in one flat grey. A word here is an object you pick up, so it
            sits on the surface.
          */}
          <div className={styles.parts}>
            {exercise.parts.map((part, position) => (
              <Button
                key={position}
                lang="es"
                disabled={answered || built.includes(position)}
                onClick={() => setBuilt((current) => [...current, position])}
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
              onClick={() => runner.submitAnswer({ value: builtWords, latencyMs: elapsed() })}
            >
              Check
            </Button>
          </div>
          {/* The sentence itself, once it can no longer give the answer away:
              the parts above are the learner's attempt, not a phrase to hear
              or to take words out of. */}
          {answered && (
            <>
              <TokenizedText
                item={item}
                className={styles.prompt}
                onSelect={selectWord}
                selected={words.tokensFor(item.id)}
              />
              <AudioControls item={item} />
            </>
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
          /*
            What happened, and what to do about it — one region rather than two
            more rows in the stack.

            The screen had become six full-width rounded rectangles in a column:
            four options, the verdict, the button. The verdict wore the same tint
            and the same radius as the graded option above it, so it read as a
            fifth answer, and the button read as a sixth. Neither was separable
            from the question by looking.

            This bleeds to the card's edges, which nothing else on the card does,
            so it is a different *kind* of thing before it is a different colour.
          */
          <div className={styles.outcomeBar}>
            <Verdict result={runner.lastResult} />
            <Button variant="primary" block large onClick={runner.next}>
              Continue
              <Icon name="forward" />
            </Button>
          </div>
        )
      )}

      {/* Who you may say this to, and where — learned with the phrase, not
          looked up afterwards. */}
      <UsageBadges register={item.register} address={item.address} regions={item.regions} />

      {!answerLocked && (
        <ItemDetails item={item} onSelectWord={words.open} selectedTokens={words.tokensFor} />
      )}

      {/* Resolved from the repository rather than assumed to be this card's
          item: the example sentences below open their own words too. */}
      {openItem && (
        <WordInfoSheet
          item={openItem}
          tokenIds={words.tokens}
          onChange={words.set}
          onClose={words.close}
          meanings={meanings}
        />
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

  // No panel of its own any more: the band around it carries the region, so this
  // is a line of coloured type with an icon. A full-width tinted rectangle at the
  // same radius as the options above it read as a fifth answer — which is exactly
  // what the original left-bar silhouette had been shaped to avoid.
  return (
    <p
      role="status"
      className={`${styles.verdict} ${correct ? styles.verdictCorrect : styles.verdictIncorrect}`}
    >
      <span className={styles.verdictIcon}>
        <Icon name={correct ? 'correct' : 'incorrect'} size="lg" />
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
      {variant === 'correct' ? (
        <Icon name="check" size="sm" />
      ) : variant === 'incorrect' ? (
        <Icon name="close" size="sm" />
      ) : (
        position + 1
      )}
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
