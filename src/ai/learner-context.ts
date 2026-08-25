/**
 * Builds the structured learner summary that any AI — a future in-app tutor, or
 * whatever the learner pastes into an external chat — should be given instead
 * of "teach me Spanish" (spec §18).
 *
 * What counts as "known" comes from word- and pattern-level mastery rather than
 * item history: a sentence answered correctly once does not mean its vocabulary
 * is learned, and a tutor told otherwise will pitch everything too high.
 *
 * Pure, offline and vendor-free: it reads the repository and local progress and
 * produces data. Nothing here talks to a network.
 */

import type { CefrLevel, ContentRepository } from '../domain/content';
import { inferMastery, isDue, type ItemProgress } from '../domain/progress';
import type { LearnerContext, WeakPoint } from './types';

export interface BuildContextOptions {
  readonly repository: ContentRepository;
  readonly progress: readonly ItemProgress[];
  readonly referenceLanguage: string;
  /**
   * Required, and deliberately not defaulted. It was `= 'es'` until 2026-08-25,
   * and the single caller never passed it — so a German course handed an AI a
   * summary saying the learner was studying Spanish, in the one artefact whose
   * whole purpose is to replace "teach me Spanish" with something true.
   */
  readonly targetLanguage: string;
  readonly now?: number;
  readonly maxKnown?: number;
  readonly maxWeak?: number;
  readonly maxNewWords?: number;
  /** Restrict the summary to a topic the learner is about to practise. */
  readonly topic?: string;
}

export function buildLearnerContext(options: BuildContextOptions): LearnerContext {
  const {
    repository,
    progress,
    referenceLanguage,
    targetLanguage,
    now = Date.now(),
    maxKnown = 20,
    maxWeak = 8,
    maxNewWords = 3,
  } = options;

  const relevant = options.topic
    ? progress.filter((record) =>
        (repository.getItem(record.itemId)?.topics ?? []).includes(options.topic!),
      )
    : progress;

  const mastery = inferMastery(repository, relevant, now);
  const entries = [...mastery.lexemes.values(), ...mastery.skills.values()];

  const topics = new Set<string>();
  let mastered = 0;
  let due = 0;

  for (const record of relevant) {
    const item = repository.getItem(record.itemId);
    if (!item) continue;
    if (record.status === 'mastered') mastered++;
    if (isDue(record, now)) due++;
    for (const topic of item.topics ?? []) topics.add(topic);
  }

  const known = entries
    .filter((entry) => entry.status === 'strong')
    .sort((a, b) => b.strength - a.strength)
    .map((entry) => entry.label);

  const weak: WeakPoint[] = entries
    .filter((entry) => entry.status === 'weak' || entry.status === 'developing')
    // Equally weak, a pattern is worth reporting before a single word: it tells
    // a tutor what to build a whole exercise around.
    .sort((a, b) => a.strength - b.strength || rank(a.kind) - rank(b.kind))
    .map((entry) => ({
      label: entry.label,
      kind: entry.kind,
      ref: entry.id,
      difficulty: round2(1 - entry.strength),
    }));

  return {
    targetLanguage,
    referenceLanguage,
    level: dominantLevel(repository, relevant),
    known: known.slice(0, maxKnown),
    weak: weak.slice(0, maxWeak),
    topics: [...topics].sort(),
    maxNewWords,
    totals: { seen: relevant.length, mastered, due },
  };
}

/** The level the learner is actually working at, not the level they claim. */
function dominantLevel(
  repository: ContentRepository,
  progress: readonly ItemProgress[],
): CefrLevel {
  const counts = new Map<CefrLevel, number>();
  for (const record of progress) {
    const level = repository.getItem(record.itemId)?.level;
    if (level) counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? 'a1';
}

/**
 * Renders the context as the prompt preamble described in spec §18 — the same
 * text the "copy as AI prompt" action puts on the clipboard.
 */
export function formatLearnerContext(context: LearnerContext): string {
  const lines = [
    `Learner level: ${context.level.toUpperCase()}`,
    `Target language: ${context.targetLanguage}`,
    `Explain in: ${context.referenceLanguage}`,
  ];

  if (context.known.length > 0) {
    lines.push('', 'Known:', ...context.known.map((lemma) => `- ${lemma}`));
  }
  if (context.weak.length > 0) {
    lines.push('', 'Weak:', ...context.weak.map((point) => `- ${point.label}`));
  }
  if (context.topics.length > 0) {
    lines.push('', `Topics: ${context.topics.join(', ')}`);
  }
  lines.push('', `Maximum new vocabulary: ${context.maxNewWords} words`);

  return lines.join('\n');
}

const rank = (kind: WeakPoint['kind']) => (kind === 'skill' ? 0 : 1);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
