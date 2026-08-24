/**
 * Exercise generation: item + context → interaction.
 *
 * Every generator is pure and declares whether it can handle an item, so new
 * exercise types plug in without touching the session planner or the UI.
 */

import type { ContentRepository, LanguageTag, LearningItem, Morphology } from '../content';
import { isPunctuation, normalise, splitWords } from '../content';
import { type Rng, shuffle } from '../../utils/random';
import type {
  ClozeChoiceExercise,
  Choice,
  Exercise,
  ExerciseKind,
  ListenRepeatExercise,
  MultipleChoiceExercise,
  RevealExercise,
  TapToBuildExercise,
  ThinkSayExercise,
} from './types';

export interface GenerationContext {
  readonly repository: ContentRepository;
  readonly referenceLanguage: LanguageTag;
  readonly rng: Rng;
  /** Pool the generator may draw distractors from; defaults to the whole repository. */
  readonly distractorPool?: readonly LearningItem[];
  readonly choiceCount?: number;
}

export interface ExerciseGenerator<K extends ExerciseKind = ExerciseKind> {
  readonly kind: K;
  supports(item: LearningItem, context: GenerationContext): boolean;
  generate(item: LearningItem, context: GenerationContext): Exercise | null;
}

const DEFAULT_CHOICE_COUNT = 4;

/** True when the two share at least one entry; empty on either side is no match. */
function overlaps(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (!a?.length || !b?.length) return false;
  return a.some((value) => b.includes(value));
}

function exerciseId(item: LearningItem, kind: ExerciseKind): string {
  return `${item.id}#${kind}`;
}

function translationOf(item: LearningItem, context: GenerationContext) {
  return context.repository.translationOf(item.id, context.referenceLanguage);
}

export const listenRepeatGenerator: ExerciseGenerator<'listen-repeat'> = {
  kind: 'listen-repeat',
  supports: () => true,
  generate(item, context): ListenRepeatExercise {
    const translation = translationOf(item, context);
    return {
      id: exerciseId(item, 'listen-repeat'),
      kind: 'listen-repeat',
      item,
      ...(translation ? { translation } : {}),
    };
  },
};

export const revealGenerator: ExerciseGenerator<'reveal'> = {
  kind: 'reveal',
  supports: () => true,
  generate(item, context): RevealExercise {
    const translation = translationOf(item, context);
    return {
      id: exerciseId(item, 'reveal'),
      kind: 'reveal',
      item,
      ...(translation ? { translation } : {}),
    };
  },
};

/** Needs a reference-language prompt to think from. */
export const thinkSayGenerator: ExerciseGenerator<'think-say'> = {
  kind: 'think-say',
  supports: (item, context) => translationOf(item, context) !== undefined,
  generate(item, context): ThinkSayExercise | null {
    const translation = translationOf(item, context);
    if (!translation) return null;
    return {
      id: exerciseId(item, 'think-say'),
      kind: 'think-say',
      item,
      translation,
      prompt: translation.text,
      answer: item.text,
    };
  },
};

/**
 * Meaning recognition: show the Spanish, choose the reference-language meaning.
 * Distractors are ranked to look like the answer — same surface form, same kind
 * of item, same theme — so the only thing separating them is what they mean
 * (spec §4.4).
 */
export const multipleChoiceGenerator: ExerciseGenerator<'multiple-choice'> = {
  kind: 'multiple-choice',
  supports(item, context) {
    return translationOf(item, context) !== undefined && distractors(item, context, 1).length > 0;
  },
  generate(item, context): MultipleChoiceExercise | null {
    const translation = translationOf(item, context);
    if (!translation) return null;

    const wanted = (context.choiceCount ?? DEFAULT_CHOICE_COUNT) - 1;
    const others = distractors(item, context, wanted);
    if (others.length === 0) return null;

    const choices: Choice[] = shuffle(
      [
        { id: item.id, text: translation.text, correct: true },
        ...others.map((other) => ({
          id: other.item.id,
          text: other.text,
          correct: false,
          sourceItem: other.item.id,
        })),
      ],
      context.rng,
    );

    return {
      id: exerciseId(item, 'multiple-choice'),
      kind: 'multiple-choice',
      item,
      translation,
      prompt: item.text,
      promptLanguage: 'es',
      choices,
    };
  },
};

/**
 * Blank out one meaningful token and offer forms of the same kind as choices —
 * typically alternative conjugations of the same verb (spec §4.5).
 */
export const clozeChoiceGenerator: ExerciseGenerator<'cloze-choice'> = {
  kind: 'cloze-choice',
  supports(item, context) {
    return blankCandidate(item, context) !== null;
  },
  generate(item, context): ClozeChoiceExercise | null {
    const candidate = blankCandidate(item, context);
    if (!candidate) return null;
    const { token, alternatives } = candidate;

    const prompt = (item.tokens ?? [])
      .map((entry) => (entry.id === token.id ? '___' : entry.text))
      .join(' ')
      .replace(/\s+([.,!?;:])/g, '$1');

    const choices: Choice[] = shuffle(
      [
        { id: token.id, text: token.text, correct: true },
        ...alternatives.map((text, index) => ({ id: `d${index}`, text, correct: false })),
      ],
      context.rng,
    );

    const translation = translationOf(item, context);
    return {
      id: exerciseId(item, 'cloze-choice'),
      kind: 'cloze-choice',
      item,
      prompt,
      blankTokenId: token.id,
      choices,
      ...(translation ? { translation } : {}),
    };
  },
};

/** Rebuild the sentence from shuffled words (spec §4.6). */
export const tapToBuildGenerator: ExerciseGenerator<'tap-to-build'> = {
  kind: 'tap-to-build',
  supports(item, context) {
    return translationOf(item, context) !== undefined && words(item).length >= 2;
  },
  generate(item, context): TapToBuildExercise | null {
    const translation = translationOf(item, context);
    const solution = words(item);
    if (!translation || solution.length < 2) return null;
    return {
      id: exerciseId(item, 'tap-to-build'),
      kind: 'tap-to-build',
      item,
      translation,
      prompt: translation.text,
      parts: shuffle(solution, context.rng),
      solution,
    };
  },
};

export const DEFAULT_GENERATORS: readonly ExerciseGenerator[] = [
  listenRepeatGenerator,
  revealGenerator,
  thinkSayGenerator,
  multipleChoiceGenerator,
  clozeChoiceGenerator,
  tapToBuildGenerator,
];

export class ExerciseEngine {
  private readonly byKind: ReadonlyMap<ExerciseKind, ExerciseGenerator>;

  constructor(generators: readonly ExerciseGenerator[] = DEFAULT_GENERATORS) {
    this.byKind = new Map(generators.map((generator) => [generator.kind, generator]));
  }

  supportedKinds(item: LearningItem, context: GenerationContext): readonly ExerciseKind[] {
    return [...this.byKind.values()]
      .filter((generator) => generator.supports(item, context))
      .map((generator) => generator.kind);
  }

  generate(item: LearningItem, kind: ExerciseKind, context: GenerationContext): Exercise | null {
    const generator = this.byKind.get(kind);
    if (!generator || !generator.supports(item, context)) return null;
    return generator.generate(item, context);
  }

  /**
   * Generates the first supported kind from `preferred`, so a session can ask
   * for variety and degrade gracefully when data is thin.
   */
  generateFirst(
    item: LearningItem,
    preferred: readonly ExerciseKind[],
    context: GenerationContext,
  ): Exercise | null {
    for (const kind of preferred) {
      const exercise = this.generate(item, kind, context);
      if (exercise) return exercise;
    }
    return null;
  }
}

interface Distractor {
  readonly item: LearningItem;
  readonly text: string;
}

/**
 * How a choice looks before it is read: is it a question, and how long is it.
 *
 * These are what a learner answers by when they answer without knowing any
 * Spanish. `¿Tiene fiebre?` offered against three statements is not a question
 * about meaning — the only option ending in `?` wins — and the one long answer
 * among three short ones is found the same way. So the choices are matched on
 * surface before they are matched on anything else.
 */
interface Surface {
  /** The sentence's final mark: `?`, `!` or `.` for everything else. */
  readonly force: string;
  readonly words: number;
}

function surfaceOf(text: string): Surface {
  const last = text.trim().slice(-1);
  return {
    force: last === '?' || last === '!' ? last : '.',
    words: splitWords(text).length,
  };
}

/** Close enough in length that neither stands out in a list of four. */
function comparableLength(a: number, b: number): boolean {
  return Math.abs(a - b) <= 2;
}

/**
 * Ranks a candidate against the item being asked about, most misleading feature
 * first: surface form, then item type, then level, then theme, then length.
 *
 * The weights are powers of two, so each feature outranks every feature below it
 * combined: a strict priority order, written as a score rather than as nested
 * filters so that it degrades instead of starving. Questions are a small
 * fraction of any pack and thinner still inside one topic, so "a question from
 * this topic" often cannot fill four choices — and falling to "a question from
 * anywhere" keeps the card honest, where falling to "anything from this topic"
 * hands the answer over.
 */
function comparability(
  item: LearningItem,
  target: Surface,
  candidate: LearningItem,
  text: string,
): number {
  const surface = surfaceOf(text);
  let score = 0;
  if (surface.force === target.force) score += 16;
  if (candidate.type === item.type) score += 8;
  if (candidate.level === item.level) score += 4;
  if (overlaps(item.topics, candidate.topics)) score += 2;
  if (comparableLength(surface.words, target.words)) score += 1;
  return score;
}

function distractors(
  item: LearningItem,
  context: GenerationContext,
  count: number,
): readonly Distractor[] {
  const pool = context.distractorPool ?? context.repository.query();
  const answer = translationOf(item, context)?.text ?? item.text;
  const target = surfaceOf(answer);

  /**
   * Shuffled first, then sorted by rank. `Array.prototype.sort` is stable, so
   * equally comparable candidates keep the shuffled order and the same item
   * asks a different question next time.
   */
  const ranked = shuffle(pool, context.rng)
    .flatMap((candidate) => {
      if (candidate.id === item.id) return [];
      const translation = context.repository.translationOf(candidate.id, context.referenceLanguage);
      if (!translation) return [];
      return [
        {
          item: candidate,
          text: translation.text,
          score: comparability(item, target, candidate, translation.text),
        },
      ];
    })
    .sort((a, b) => b.score - a.score);

  const seen = new Set([normalise(answer)]);
  const found: Distractor[] = [];
  for (const candidate of ranked) {
    const key = normalise(candidate.text);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ item: candidate.item, text: candidate.text });
    if (found.length === count) break;
  }
  return found;
}

interface BlankCandidate {
  readonly token: NonNullable<LearningItem['tokens']>[number];
  readonly alternatives: readonly string[];
}

/**
 * How good a rival conjugation is as a choice, most misleading first — the same
 * shape of score as {@link comparability}, and for the same reason.
 *
 * A blank is only a question about grammar if every option could grammatically
 * stand in the gap. Offering `hablando` and `hablad` against `hablo` is not a
 * question about the present tense: two of the three are eliminable from their
 * shape alone, which is exactly the failure `distractors()` was rewritten to
 * avoid. So the finite/gerund/participle class matters most, then mood.
 *
 * The third term is what makes the card *teach* something. A distractor that
 * differs from the answer on one axis only asks about that axis: hold the person
 * and vary the tense and the learner is answering "when", hold the tense and
 * vary the person and they are answering "who". Vary both at once and the card
 * isolates nothing, which is what sampling at random produced.
 *
 * A score rather than a filter cascade, deliberately: a pack may hold few forms
 * for a verb, and a hard "same class and same mood" filter would starve the
 * choices — and too few choices hands the answer over just as surely.
 */
function formComparability(answer: Morphology, candidate: Morphology): number {
  let score = 0;
  if (answer.verbForm === candidate.verbForm) score += 16;
  if (answer.mood === candidate.mood) score += 8;

  const tenseDiffers = answer.tense !== candidate.tense;
  const agreementDiffers = answer.person !== candidate.person || answer.number !== candidate.number;
  if (Number(tenseDiffers) + Number(agreementDiffers) === 1) score += 4;

  return score;
}

/**
 * Picks a verb token whose lexeme has other known forms to use as choices, and
 * ranks those forms so the card grades grammar rather than shape.
 */
function blankCandidate(item: LearningItem, context: GenerationContext): BlankCandidate | null {
  const tokens = item.tokens ?? [];
  for (const token of tokens) {
    if (token.pos !== 'VERB' && token.pos !== 'AUX') continue;
    if (!token.lexeme) continue;

    const answer = token.morph ?? {};
    /**
     * Shuffled before it is sorted, like the distractor pool: `sort` is stable,
     * so equally plausible forms keep the shuffled order and the same sentence
     * asks a different question next time.
     */
    const ranked = shuffle(context.repository.formsOf(token.lexeme), context.rng)
      .filter((form) => normalise(form.form) !== normalise(token.text))
      .map((form) => ({ text: form.form, score: formComparability(answer, form.morph) }))
      .sort((a, b) => b.score - a.score);

    const unique: string[] = [];
    const seen = new Set([normalise(token.text)]);
    for (const form of ranked) {
      const key = normalise(form.text);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(form.text);
      if (unique.length === 3) break;
    }

    if (unique.length >= 2) return { token, alternatives: unique };
  }
  return null;
}

/**
 * The words a sentence is built from — punctuation is not one of them.
 *
 * A comma is a tile you have to remember to place and a full stop is a tile you
 * cannot get wrong, so dealing them graded punctuation rather than word order:
 * `Abre la boca por favor` was marked wrong for the `,` left in the tray. Word
 * order is the skill, so the tiles are words and the grading follows.
 */
function words(item: LearningItem): readonly string[] {
  const tokens = item.tokens;
  if (tokens?.length) {
    return tokens
      .filter((token) => token.pos !== 'PUNCT' && !isPunctuation(token.text))
      .map((token) => token.text);
  }
  return splitWords(item.text);
}
