/**
 * Whether a sentence asks, tells or exclaims.
 *
 * **Derived, never stored** (Rule 3), and here the rule is not a preference:
 * Spanish orthography *requires* the opening `¿` and `¡`, so the text already
 * carries the fact with no ambiguity. A stored `mood` column could only ever
 * disagree with the punctuation beside it, and a learner reading `¿…?` would be
 * the one who found out.
 *
 * This exists because the pack could not answer "show me the questions". The
 * `questions` topic looks like the answer and is not: it is a *theme* — what a
 * sentence is about — and it covers 172 sentences where 376 are actually
 * questions. Asking is a form, so it belongs beside `address` and `register` as
 * a facet, not beside `travel` and `food-drink` as a subject.
 */

import type { LearningItem } from './model';

export const SENTENCE_MOODS = ['statement', 'question', 'exclamation'] as const;
export type SentenceMood = (typeof SENTENCE_MOODS)[number];

/**
 * What a learner sees for each mood.
 *
 * A table beside the values, for the reason `REGISTER_LABELS` records: a second
 * screen listing moods would otherwise disagree with the first about what they
 * are called.
 */
export const MOOD_LABELS: Record<SentenceMood, string> = {
  statement: 'statement',
  question: 'question',
  exclamation: 'exclamation',
};

/**
 * The mood a sentence's punctuation declares.
 *
 * Checked on the *opening* mark rather than the closing one, because that is the
 * one Spanish puts where English has nothing, and because a question ending in
 * an exclamation (`¿Pero qué haces!`) is still a question. A sentence carrying
 * both opens with the one that governs it.
 */
export function sentenceMood(text: string): SentenceMood {
  const question = text.indexOf('¿');
  const exclamation = text.indexOf('¡');
  if (question === -1 && exclamation === -1) return 'statement';
  if (question === -1) return 'exclamation';
  if (exclamation === -1) return 'question';
  return question < exclamation ? 'question' : 'exclamation';
}

/**
 * The mood of an item, or `undefined` for a word card, which has none.
 *
 * A card reading `abrigo` is not a statement, and letting it count as one would
 * put 627 word cards into "statements" and make the facet meaningless. So the
 * type gate lives here rather than at each call site.
 */
export function moodOf(item: LearningItem): SentenceMood | undefined {
  return item.type === 'word' ? undefined : sentenceMood(item.text);
}
