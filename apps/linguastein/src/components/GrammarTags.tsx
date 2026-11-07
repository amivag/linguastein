import type { Gender, Mood, PartOfSpeech, Tense } from '../domain/content';
import { genderHue, genderLabel, posHue, tenseHue } from '../styles/semantics';
import styles from './GrammarTags.module.css';

interface GrammarTagsProps {
  readonly pos?: PartOfSpeech | undefined;
  /** Already-humanised, e.g. `noun` — the domain owns the wording. */
  readonly posLabel?: string | undefined;
  readonly gender?: Gender | undefined;
  readonly tense?: Tense | undefined;
  readonly mood?: Mood | undefined;
  /** Humanised tense or mood, e.g. `preterite`. */
  readonly tenseLabel?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * What a word *is*, as coloured pills: part of speech, gender, tense.
 *
 * One component rather than three call sites, because these three facts always
 * appear together and the rule binding them is easy to break one screen at a
 * time: **the colour never travels without its label**. Every pill here contains
 * the word it means, and the hue is only ever a background and a foreground —
 * CSS, which no screen reader reports. So a learner who cannot distinguish two
 * hues reads exactly what a learner who can reads, and loses only the mnemonic.
 * The pills are deliberately *not* `aria-hidden`, unlike the categorical badges:
 * those carry no text, and these are the text. Spelling that out in Browse, in
 * the word sheet and in Study separately is how one of them ends up shipping a
 * bare coloured dot.
 *
 * It renders nothing when there is nothing to say. Most tokens in a sentence are
 * function words with no gender and no tense, and a row of empty pills on every
 * one of them would be noise where the design language asks for quiet.
 *
 * The hues come from `src/styles/semantics.ts`, which is also where the reasoning
 * for each assignment lives — including why gender is blue-and-orange rather than
 * the blue-and-pink every Spanish textbook uses.
 */
export function GrammarTags({
  pos,
  posLabel,
  gender,
  tense,
  mood,
  tenseLabel,
  className,
}: GrammarTagsProps) {
  const partOfSpeech = pos === undefined ? undefined : posHue(pos);
  const grammaticalGender = genderHue(gender);
  const article = genderLabel(gender);
  const tenseTone = tenseHue(tense, mood);

  const tags = [
    // A part of speech with no hue is a function word, and still worth naming —
    // it just does not earn a colour. `data-kind` is withheld rather than set to
    // a fallback, which is the same mechanism a finished mission uses to let its
    // verdict colour win.
    ...(posLabel ? [{ key: 'pos', label: posLabel, hue: partOfSpeech }] : []),
    ...(article ? [{ key: 'gender', label: article, hue: grammaticalGender }] : []),
    ...(tenseLabel ? [{ key: 'tense', label: tenseLabel, hue: tenseTone }] : []),
  ];

  if (tags.length === 0) return null;

  return (
    <p className={`${styles.tags} ${className ?? ''}`}>
      {tags.map((tag) => (
        <span
          key={tag.key}
          className={styles.tag}
          {...(tag.hue === undefined ? {} : { 'data-kind': tag.hue })}
        >
          {tag.label}
        </span>
      ))}
    </p>
  );
}
