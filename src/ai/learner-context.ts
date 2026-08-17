/**
 * Builds the structured learner summary that any AI — a future in-app tutor, or
 * whatever the learner pastes into an external chat — should be given instead
 * of "teach me Spanish" (spec §18).
 *
 * Pure, offline and vendor-free: it reads the repository and local progress and
 * produces data. Nothing here talks to a network.
 */

import type { CefrLevel, ContentRepository, ItemId } from '../domain/content';
import type { ItemProgress } from '../domain/progress';
import { isDue } from '../domain/progress';
import type { LearnerContext, WeakPoint } from './types';

export interface BuildContextOptions {
  readonly repository: ContentRepository;
  readonly progress: readonly ItemProgress[];
  readonly referenceLanguage: string;
  readonly targetLanguage?: string;
  readonly now?: number;
  readonly maxKnown?: number;
  readonly maxWeak?: number;
  readonly maxNewWords?: number;
  /** Restrict the summary to a topic the learner is about to practise. */
  readonly topic?: string;
}

const KNOWN_DIFFICULTY = 0.35;
const WEAK_DIFFICULTY = 0.5;

export function buildLearnerContext(options: BuildContextOptions): LearnerContext {
  const {
    repository,
    progress,
    referenceLanguage,
    targetLanguage = 'es',
    now = Date.now(),
    maxKnown = 20,
    maxWeak = 8,
    maxNewWords = 3,
  } = options;

  const known = new Set<string>();
  const weak: WeakPoint[] = [];
  const topics = new Set<string>();
  let mastered = 0;
  let due = 0;

  for (const record of [...progress].sort((a, b) => b.difficulty - a.difficulty)) {
    const item = repository.getItem(record.itemId);
    if (!item) continue;
    if (options.topic && !(item.topics ?? []).includes(options.topic)) continue;

    if (record.status === 'mastered') mastered++;
    if (isDue(record, now)) due++;
    for (const topic of item.topics ?? []) topics.add(topic);

    const lemmas = (item.lexemes ?? [])
      .map((id) => repository.getLexeme(id)?.lemma)
      .filter((lemma) => lemma !== undefined);

    if (record.difficulty >= WEAK_DIFFICULTY || record.status === 'learning') {
      weak.push(...weakPoints(repository, record, item.id, lemmas));
    } else if (record.difficulty <= KNOWN_DIFFICULTY && record.attempts > 0) {
      for (const lemma of lemmas) known.add(lemma);
    }
  }

  return {
    targetLanguage,
    referenceLanguage,
    level: dominantLevel(repository, progress),
    known: [...known].slice(0, maxKnown),
    weak: dedupe(weak).slice(0, maxWeak),
    topics: [...topics].sort(),
    maxNewWords,
    totals: { seen: progress.length, mastered, due },
  };
}

function weakPoints(
  repository: ContentRepository,
  record: ItemProgress,
  itemId: ItemId,
  lemmas: readonly string[],
): WeakPoint[] {
  const item = repository.getItem(itemId);
  const skills = (item?.skills ?? [])
    .map((id) => ({ id, skill: repository.getSkill(id) }))
    .filter((entry) => entry.skill !== undefined);

  // A weak sentence usually means a weak pattern, so patterns are named first.
  if (skills.length > 0) {
    return skills.map((entry) => ({
      label: entry.skill!.label,
      kind: 'skill' as const,
      ref: entry.id,
      difficulty: record.difficulty,
    }));
  }
  if (lemmas.length > 0 && item?.lexemes?.[0]) {
    return [
      {
        label: lemmas[0]!,
        kind: 'lexeme' as const,
        ref: item.lexemes[0],
        difficulty: record.difficulty,
      },
    ];
  }
  return [
    { label: item?.text ?? itemId, kind: 'item', ref: itemId, difficulty: record.difficulty },
  ];
}

function dedupe(points: readonly WeakPoint[]): WeakPoint[] {
  const seen = new Map<string, WeakPoint>();
  for (const point of points) {
    const existing = seen.get(point.label);
    if (!existing || existing.difficulty < point.difficulty) seen.set(point.label, point);
  }
  return [...seen.values()].sort((a, b) => b.difficulty - a.difficulty);
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
