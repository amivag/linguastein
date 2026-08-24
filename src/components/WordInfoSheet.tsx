import { useTargetLanguage } from '../app/course';
import { useServices } from '../app/services-context';
import {
  expandSpan,
  inspectSpan,
  inspectToken,
  nextInSpan,
  WHOLE_ITEM_TOKEN,
  type LearningItem,
  type PhraseInfo,
  type TokenId,
  type WordInfo,
} from '../domain/content';
import { Annotation } from './Annotation';
import { Button } from './Button';
import { GrammarTags } from './GrammarTags';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { UsageBadges } from './UsageBadges';
import styles from './WordInfoSheet.module.css';

interface WordInfoSheetProps {
  readonly item: LearningItem;
  /** The selected run. One token asks about a word, several about a phrase. */
  readonly tokenIds: readonly TokenId[];
  /** Grow or shrink the selection without closing the sheet. */
  readonly onChange: (tokenIds: readonly TokenId[]) => void;
  readonly onClose: () => void;
  /**
   * False while a card is grading what this text *means*, which is the one
   * thing the sheet then withholds. Everything else it knows — which word this
   * is, what form it is in, the pattern it belongs to, its other forms — is not
   * an answer to anything, and is most of the reason to tap a word mid-question.
   *
   * Said out loud rather than left as a gap: a noun whose entry is a gloss and
   * nothing else would otherwise read "no extra information for this word yet",
   * which is a different claim and a false one.
   */
  readonly meanings?: boolean;
}

/**
 * "What is this?" — for a word: meaning, grammar, the construction it belongs
 * to, its other forms and other phrases that use it. For a run of words: the
 * pattern they form, what each of them is, and other phrases built the same
 * way. All derived from the dataset at render time (spec §4.1 "More info",
 * §13.2 reusable examples, §15 annotations).
 *
 * A phrase is not a longer word. `tener que` means "to have to" while `tener`
 * alone means "to have", and the dataset already records the difference as a
 * multi-token annotation — so the selection is a span, and growing it is a
 * control in the sheet rather than a gesture nobody would discover.
 *
 * The word and the way out are pinned: only the detail below them scrolls, so
 * a verb with nine forms and four examples cannot push either off the screen.
 */
export function WordInfoSheet({
  item,
  tokenIds,
  onChange,
  onClose,
  meanings = true,
}: WordInfoSheetProps) {
  const { services, preferences } = useServices();
  const language = preferences.referenceLanguage;
  const lang = useTargetLanguage();

  const word =
    tokenIds.length === 1 && tokenIds[0] !== undefined
      ? inspectToken(services.repository, item, tokenIds[0], language, { meanings })
      : null;
  const phrase =
    tokenIds.length > 1
      ? inspectSpan(services.repository, item, tokenIds, language, { meanings })
      : null;

  if (!word && !phrase) return null;

  const text = word ? word.token.text : (phrase?.text ?? '');
  const speak = () =>
    void services.audio.speak({
      text,
      locale: preferences.pronunciationLocale,
      ...(preferences.voiceName ? { voice: preferences.voiceName } : {}),
    });

  return (
    <Sheet
      title={`About ${text}`}
      width="wide"
      onClose={onClose}
      heading={
        <div className={styles.heading}>
          <h2 className={styles.word} lang={lang}>
            {text}
          </h2>
          {word && <Lemma info={word} />}
          {phrase && <p className={styles.lemma}>{phrase.words.length} words</p>}
        </div>
      }
      actions={
        <Button variant="ghost" icon onClick={speak} aria-label="Pronounce">
          <Icon name="speak" />
        </Button>
      }
      pinned={<SpanControls item={item} tokenIds={tokenIds} onChange={onChange} />}
    >
      {!meanings && <p className={styles.withheld}>Meanings unlock once you answer.</p>}
      {word && <WordBody info={word} meanings={meanings} />}
      {phrase && <PhraseBody info={phrase} meanings={meanings} />}
    </Sheet>
  );
}

/**
 * Growing and shrinking the selection.
 *
 * Buttons rather than a drag: a drag across two words is imprecise on a phone,
 * invisible to a keyboard and unnameable to a screen reader, and each button can
 * say exactly which word it would add. Only offered where there is a word to
 * add, so the control never lies about what it will do.
 */
function SpanControls({
  item,
  tokenIds,
  onChange,
}: {
  readonly item: LearningItem;
  readonly tokenIds: readonly TokenId[];
  readonly onChange: (tokenIds: readonly TokenId[]) => void;
}) {
  // A word card is one word and has no tokens to grow into.
  if (tokenIds.includes(WHOLE_ITEM_TOKEN)) return null;

  const before = nextInSpan(item, tokenIds, 'before');
  const after = nextInSpan(item, tokenIds, 'after');
  const shrinkable = tokenIds.length > 1;
  if (!before && !after && !shrinkable) return null;

  const first = tokenIds[0];

  return (
    <div className={styles.span}>
      <span className={styles.spanLabel}>Phrase</span>
      {/*
        The name says what the button *does*, not only which word it names.
        These used to be labelled by their contents — "＋ que" and "que ＋" —
        which meant the accessible name depended on a fullwidth plus sign being
        read out, and left two controls whose names differed only by the side the
        glyph fell on. With the glyph now `aria-hidden`, the label has to carry
        it: "Add “que” before" is what a screen reader and an agent both need,
        and it is the same string whichever way the phrase grows.
      */}
      {before && (
        <Button
          aria-label={`Add “${before.text}” before`}
          onClick={() => onChange(expandSpan(item, tokenIds, 'before'))}
        >
          <Icon name="add" size="sm" /> {before.text}
        </Button>
      )}
      {after && (
        <Button
          aria-label={`Add “${after.text}” after`}
          onClick={() => onChange(expandSpan(item, tokenIds, 'after'))}
        >
          {after.text} <Icon name="add" size="sm" />
        </Button>
      )}
      {shrinkable && first !== undefined && (
        <Button variant="ghost" onClick={() => onChange([first])}>
          One word
        </Button>
      )}
    </div>
  );
}

/**
 * Where the word came from, and what it is.
 *
 * The part of speech used to be appended to the lemma line as ` · noun`, which
 * made it a footnote to a footnote. It is now a coloured pill beside the gender,
 * because those two together are the answer to "what kind of word is this" — and
 * gender in particular is the fact a learner comes back for, since nothing in
 * `mano` says feminine. The colour is a second channel on that; the label is
 * still the signal.
 */
function Lemma({ info }: { readonly info: WordInfo }) {
  const lang = useTargetLanguage();
  const derived = info.lemma && info.lemma !== info.token.text.toLowerCase();

  return (
    <>
      {derived && (
        <p className={styles.lemma} lang={lang}>
          from <strong>{info.lemma}</strong>
        </p>
      )}
      <GrammarTags
        pos={info.pos}
        posLabel={info.posLabel}
        gender={info.gender}
        className={styles.tags}
      />
    </>
  );
}

function WordBody({ info, meanings }: { readonly info: WordInfo; readonly meanings: boolean }) {
  const lang = useTargetLanguage();
  return (
    <>
      {info.gloss && (
        <Annotation facet="meaning" lead>
          {info.gloss}
        </Annotation>
      )}
      <UsageBadges register={info.register} regions={info.regions} />
      {/* Labelled `Grammar` rather than `Note`: it is the same *kind* of aside —
          same hue, same glyph — about something narrower. */}
      {info.grammar && (
        <Annotation facet="note" label="Grammar">
          {info.grammar}
        </Annotation>
      )}

      {info.constructions.length > 0 && (
        <div className={styles.block}>
          <BlockTitle icon="grammar">Pattern</BlockTitle>
          {info.constructions.map((construction) => (
            <p key={construction.label}>
              <strong lang={lang}>{construction.label}</strong>
              {construction.gloss ? ` — ${construction.gloss}` : ''}
            </p>
          ))}
        </div>
      )}

      {info.forms.length > 0 && (
        <div className={styles.block}>
          <BlockTitle icon="word">Other forms</BlockTitle>
          <ul className={styles.forms}>
            {info.forms.map((form) => (
              <li key={`${form.form}-${form.label}`} className={form.current ? styles.current : ''}>
                <span lang={lang}>{form.form}</span>
                <span className={styles.formLabel}>{form.label}</span>
                {/* The tint alone would carry this, and colour is never the
                    only signal the app uses to say something. */}
                {form.current && <span className="visually-hidden">the form in this phrase</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {info.examples.length > 0 && (
        <div className={styles.block}>
          <BlockTitle icon="passage">In other phrases</BlockTitle>
          <Examples examples={info.examples} />
        </div>
      )}

      {/* Only claimable when the meaning was looked for and not found: with
          meanings withheld, an empty entry means "not yet", not "nothing". */}
      {meanings && !info.gloss && !info.grammar && info.constructions.length === 0 && (
        <p className={styles.grammar}>No extra information for this word yet.</p>
      )}
    </>
  );
}

/**
 * A phrase leads with the pattern, because that is the thing the parts do not
 * add up to, and follows with the parts, because "you have to" does not tell
 * anyone which of these three words is `que`.
 */
function PhraseBody({ info, meanings }: { readonly info: PhraseInfo; readonly meanings: boolean }) {
  const lang = useTargetLanguage();
  const known = info.constructions.length > 0;

  return (
    <>
      {known && (
        <div className={styles.block}>
          <BlockTitle icon="grammar">Pattern</BlockTitle>
          {info.constructions.map((construction) => (
            <p key={construction.label}>
              <strong lang={lang}>{construction.label}</strong>
              {construction.gloss ? ` — ${construction.gloss}` : ''}
            </p>
          ))}
        </div>
      )}

      <div className={styles.block}>
        <BlockTitle icon="word">Word by word</BlockTitle>
        <ul className={styles.words}>
          {info.words.map((entry) => (
            <li key={entry.token.id}>
              <span className={styles.wordItem} lang={lang}>
                {entry.token.text}
              </span>
              <span className={styles.formLabel}>
                {[entry.gloss, entry.grammar ?? entry.posLabel].filter(Boolean).join(' · ') ||
                  (meanings ? 'not in the dictionary yet' : '')}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {info.context && (
        <div className={styles.block}>
          <BlockTitle icon="explain">In this sentence</BlockTitle>
          <p className={styles.grammar}>{info.context}</p>
        </div>
      )}

      {info.examples.length > 0 && (
        <div className={styles.block}>
          <BlockTitle icon="grammar">Same pattern elsewhere</BlockTitle>
          <Examples examples={info.examples} />
        </div>
      )}

      {!known && (
        <p className={styles.grammar}>
          {meanings
            ? 'These words are not recorded as a set phrase — what each one means is above.'
            : 'These words are not recorded as a set phrase.'}
        </p>
      )}
    </>
  );
}

/**
 * A block's heading, with the glyph for what the block is about.
 *
 * The sheet stacks up to five of these — Pattern, Other forms, In other phrases
 * — in one scrolling column of near-identical small headings, and a learner
 * scrolling back for "the one with the conjugations" was reading every one of
 * them. The glyph is a second channel on a heading that still says the words;
 * `aria-hidden`, because the heading is already the name.
 */
function BlockTitle({ icon, children }: { readonly icon: IconName; readonly children: string }) {
  return (
    <h3 className={styles.blockTitle}>
      <Icon name={icon} size="sm" />
      {children}
    </h3>
  );
}

function Examples({
  examples,
}: {
  readonly examples: readonly { id: string; text: string; translation?: string }[];
}) {
  const lang = useTargetLanguage();
  return (
    <ul className={styles.examples}>
      {examples.map((example) => (
        <li key={example.id}>
          <span lang={lang}>{example.text}</span>
          {example.translation && <span className={styles.formLabel}> {example.translation}</span>}
        </li>
      ))}
    </ul>
  );
}
