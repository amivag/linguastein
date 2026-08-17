/**
 * Exercise generation: item + context → interaction.
 *
 * Every generator is pure and declares whether it can handle an item, so new
 * exercise types plug in without touching the session planner or the UI.
 */

import type { ContentRepository, LanguageTag, LearningItem } from '../content';
import { normalise } from '../content';
import { type Rng, sample, shuffle } from '../../utils/random';
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
 * Distractors come from other items of the same type and level so they stay
 * plausible (spec §4.4).
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

function distractors(
  item: LearningItem,
  context: GenerationContext,
  count: number,
): readonly Distractor[] {
  const pool = context.distractorPool ?? context.repository.query();
  const sameShape = pool.filter(
    (candidate) =>
      candidate.id !== item.id && candidate.type === item.type && candidate.level === item.level,
  );
  const fallback = pool.filter((candidate) => candidate.id !== item.id);
  const ordered = sameShape.length >= count ? sameShape : fallback;

  const seen = new Set([normalise(translationOf(item, context)?.text ?? item.text)]);
  const found: Distractor[] = [];
  for (const candidate of sample(ordered, Math.max(count * 4, count), context.rng)) {
    const translation = context.repository.translationOf(candidate.id, context.referenceLanguage);
    if (!translation) continue;
    const key = normalise(translation.text);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ item: candidate, text: translation.text });
    if (found.length === count) break;
  }
  return found;
}

interface BlankCandidate {
  readonly token: NonNullable<LearningItem['tokens']>[number];
  readonly alternatives: readonly string[];
}

/** Picks a verb token whose lexeme has other known forms to use as choices. */
function blankCandidate(item: LearningItem, context: GenerationContext): BlankCandidate | null {
  const tokens = item.tokens ?? [];
  for (const token of tokens) {
    if (token.pos !== 'VERB' && token.pos !== 'AUX') continue;
    if (!token.lexeme) continue;
    const alternatives = context.repository
      .verbFormsOf(token.lexeme)
      .map((form) => form.form)
      .filter((form) => normalise(form) !== normalise(token.text));
    const unique = [...new Set(alternatives)];
    if (unique.length >= 2) {
      return { token, alternatives: sample(unique, 3, context.rng) };
    }
  }
  return null;
}

function words(item: LearningItem): readonly string[] {
  const tokens = item.tokens;
  if (tokens?.length) return tokens.map((token) => token.text);
  return item.text
    .replace(/[.,!?;:¡¿]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}
