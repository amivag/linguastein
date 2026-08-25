import { isSpeaking } from '../audio';
import type { ItemId, LearningItem, TokenId } from '../domain/content';
import { kindHue } from '../styles/kinds';
import { Icon } from './Icon';
import { SpeakingBars } from './SpeakingBars';
import { TokenizedText } from './TokenizedText';
import { usePlayback } from './usePlayback';
import styles from './Transcript.module.css';

export interface TranscriptLine {
  readonly item: LearningItem;
  /** Absent in a text, and in a dialogue's narration. */
  readonly speaker?: string | undefined;
  /** The reference-language reading, when the learner has asked for it. */
  readonly meaning?: string | undefined;
}

interface TranscriptProps {
  /** Names the list, e.g. `Un día de trabajo, 4 sentences`. */
  readonly label: string;
  readonly lines: readonly TranscriptLine[];
  /**
   * The speaker the learner performs, put on their own side of the conversation.
   *
   * Absent for a passage nobody is cast in, where the sides fall to the order the
   * voices first speak instead. Naming it is what turns "two colours of bubble"
   * into "these ones are mine".
   */
  readonly self?: string | undefined;
  readonly onSelectWord: (itemId: ItemId, tokenId: TokenId) => void;
  readonly selectedTokens: (itemId: ItemId) => readonly TokenId[];
  readonly onListen: (item: LearningItem) => void;
}

/**
 * A passage's lines — as a conversation where it is one, and as prose where it
 * is not.
 *
 * Both screens that show a passage had grown their own copy of this: the same
 * `ol`, the same speaker label, the same tokenised line, the same per-line play
 * button, in two stylesheets that had already drifted on the play button's hover
 * state. It is extracted here for the reason `SectionTabs` gives — the second
 * screen to want a pattern is when it either gets extracted or gets copied, and a
 * copied one drifts on accessibility rather than on colour.
 *
 * ## Why a dialogue is not a list
 *
 * It was drawn as one: every turn a full-width slab, evenly spaced, with the
 * speaker's name printed above each. That is a transcript in the stenographic
 * sense and it reads as a table of sentences — a learner has to *read* the names
 * to follow who is talking, which is the one thing a conversation should not cost
 * anything to see.
 *
 * Four changes, and none of them is colour:
 *
 * - **Bubbles hug their words.** `Sí.` is short and looks short. A column of
 *   equal-width slabs hides the shape of an exchange, which is most of what makes
 *   an exchange legible.
 * - **Each voice keeps a side.** The learner's own, when there is one; otherwise
 *   the order the voices first speak. This is the signal that survives being
 *   glanced at, and unlike hue it survives being glanced at in greyscale.
 * - **Runs are grouped.** Consecutive turns by one speaker sit tight together
 *   with air between runs, and the name is printed where a run begins rather than
 *   on all four of its lines.
 * - **The corner facing the speaker is tightened where a run begins** — a tail,
 *   without a shape the design language has nowhere else.
 *
 * The name stays in the DOM on *every* turn, visually hidden on continuations. A
 * screen reader reads turns one at a time and has no column to see the grouping
 * in, so a name printed once is a name it hears once — and the rest of the
 * exchange becomes unattributed Spanish. This is the same trade as the sighted
 * layout, made the other way round for a reader who cannot use the layout.
 */
export function Transcript({
  label,
  lines,
  self,
  onSelectWord,
  selectedTokens,
  onListen,
}: TranscriptProps) {
  const dialogue = lines.some((line) => line.speaker !== undefined);
  const playback = usePlayback();
  // A queue is running, so a line's play button means "carry on from here"
  // rather than "read this one". `Sequence.listen` decides it the same way; this
  // is the half of the decision that has to be said out loud, in the name.
  const queued = playback !== null && playback.total > 1;

  if (!dialogue) {
    return (
      <ol className={styles.prose} aria-label={label}>
        {lines.map((line) => (
          <li
            key={line.item.id}
            className={styles.paragraph}
            // The line being read, as a fact about the list rather than as a
            // tint. It changes once a sentence, which is a rate a screen reader
            // can follow — unlike the word inside it, which is decoration only.
            {...(isSpeaking(playback, line.item) ? { 'aria-current': true } : {})}
          >
            <TokenizedText
              item={line.item}
              className={styles.lineText}
              onSelect={(token) => onSelectWord(line.item.id, token)}
              selected={selectedTokens(line.item.id)}
              contextLabel={line.item.text}
            />
            <PlayLine
              item={line.item}
              onListen={onListen}
              speaking={isSpeaking(playback, line.item)}
              queued={queued}
            />
            {line.meaning !== undefined && <p className={styles.meaning}>{line.meaning}</p>}
          </li>
        ))}
      </ol>
    );
  }

  const sideOf = speakerSides(lines, self);

  return (
    <ol className={styles.dialogue} aria-label={label}>
      {lines.map((line, index) => {
        const { speaker } = line;
        // A run is consecutive turns by one speaker. `undefined` compares equal
        // to `undefined`, so unattributed narration between two of a speaker's
        // lines correctly breaks the run rather than joining it.
        const startsRun = speaker !== lines[index - 1]?.speaker;
        return (
          <li
            key={line.item.id}
            className={styles.turn}
            {...(isSpeaking(playback, line.item) ? { 'aria-current': true } : {})}
            /*
              Who is speaking, as data on the turn rather than only as text
              inside it. The name is drawn once per run and the line's own text is
              a `p` too, so "the first paragraph in this turn" means the speaker
              on one turn and the Spanish on the next — which is a thing a test,
              an agent or a later stylesheet will read wrongly rather than fail
              on. Absent for narration, because nobody is speaking it.
            */
            {...(speaker === undefined ? {} : { 'data-speaker': speaker })}
            data-side={sideOf(speaker)}
            data-run={startsRun ? 'start' : 'continued'}
          >
            {speaker !== undefined && (
              <p
                className={startsRun ? styles.speaker : 'visually-hidden'}
                {...(startsRun ? { 'data-kind': kindHue(speaker) } : {})}
              >
                {speaker}
              </p>
            )}
            <div className={styles.row}>
              <div
                className={styles.bubble}
                {...(speaker === undefined ? {} : { 'data-kind': kindHue(speaker) })}
              >
                <TokenizedText
                  item={line.item}
                  className={styles.lineText}
                  onSelect={(token) => onSelectWord(line.item.id, token)}
                  selected={selectedTokens(line.item.id)}
                  contextLabel={line.item.text}
                />
                {line.meaning !== undefined && <p className={styles.meaning}>{line.meaning}</p>}
              </div>
              <PlayLine
                item={line.item}
                onListen={onListen}
                speaking={isSpeaking(playback, line.item)}
                queued={queued}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Which side each voice sits on.
 *
 * Two rules, and the first wins where it applies: a named `self` takes the end
 * side and *everyone else* takes the start, which is how a chat with three people
 * in it works and is the only arrangement that stays true as a cast grows. With
 * nobody cast, the voices alternate in the order they first speak — so a
 * two-person dialogue reads as one, and a third voice shares the start side with
 * the first, told apart by its own hue and its name.
 *
 * Order of first appearance rather than of the speaker list, because the list is
 * positional data about the passage and this is a fact about the conversation:
 * whoever opens it is on the left, in every passage, whatever the pack's array
 * happens to hold.
 */
function speakerSides(
  lines: readonly TranscriptLine[],
  self: string | undefined,
): (speaker: string | undefined) => 'start' | 'end' {
  if (self !== undefined) {
    return (speaker) => (speaker === self ? 'end' : 'start');
  }

  const order: string[] = [];
  for (const line of lines) {
    if (line.speaker !== undefined && !order.includes(line.speaker)) order.push(line.speaker);
  }
  return (speaker) => (speaker !== undefined && order.indexOf(speaker) % 2 === 1 ? 'end' : 'start');
}

/**
 * Named by its line rather than by what it does.
 *
 * A passage shows up to twenty of these, and `Listen` said twenty times is a
 * control neither a screen reader nor an agent can pick — the same rule
 * `TokenizedText`'s `contextLabel` follows for the words inside the line.
 *
 * It has two jobs, because a line in a passage being read is two different
 * offers: hear this sentence, when nothing is playing, and pick up the reading
 * here, when something is. One control rather than two on every line, and the
 * name is what carries the difference — a screen reader user gets told which
 * offer is live rather than being left to infer it from the state of the page.
 */
function PlayLine({
  item,
  onListen,
  speaking,
  queued,
}: {
  readonly item: LearningItem;
  readonly onListen: (item: LearningItem) => void;
  /** This line is the one being read. */
  readonly speaking: boolean;
  /** A whole passage is being read, so this button restarts it here. */
  readonly queued: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.play}
      onClick={() => onListen(item)}
      aria-label={queued ? `Play from “${item.text}”` : `Listen to “${item.text}”`}
      {...(speaking ? { 'data-speaking': 'true' } : {})}
    >
      {speaking ? <SpeakingBars /> : <Icon name="speak" size="lg" />}
    </button>
  );
}
