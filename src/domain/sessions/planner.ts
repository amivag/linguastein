/**
 * Session planning: repository + learner state + config → an ordered item list.
 *
 * Pure and deterministic given a seed, so ordering behaviour is testable and a
 * session can be reproduced exactly.
 */

import type { ContentRepository, ItemId, LearningItem } from '../content';
import { isDue, type ItemProgress, type Timestamp } from '../progress/types';
import { seededRng, shuffle, systemRng, type Rng } from '../../utils/random';
import {
  ESTIMATED_MS_PER_ITEM,
  type SessionConfig,
  type SessionPlan,
  type SessionSize,
} from './types';

export interface PlanInput {
  readonly repository: ContentRepository;
  readonly config: SessionConfig;
  readonly progress: ReadonlyMap<ItemId, ItemProgress>;
  readonly now: Timestamp;
  /** Overrides the seeded/system RNG; mainly for tests. */
  readonly rng?: Rng;
}

export function planSession(input: PlanInput): SessionPlan {
  const { repository, config, progress, now } = input;
  const rng = input.rng ?? (config.seed !== undefined ? seededRng(config.seed) : systemRng);

  const candidates = repository.query(config.filter).filter((item) => {
    if (!config.dueOnly) return true;
    const state = progress.get(item.id);
    return state !== undefined && isDue(state, now);
  });

  const ordered = order(candidates, config, progress, now, rng);
  const limited = ordered.slice(0, capacity(config.size, ordered.length));

  return {
    id: `session-${now.toString(36)}`,
    config,
    itemIds: limited.map((item) => item.id),
    createdAt: now,
    ...(config.size.kind === 'time' ? { targetDurationMs: config.size.minutes * 60_000 } : {}),
  };
}

function capacity(size: SessionSize, available: number): number {
  switch (size.kind) {
    case 'items':
      return Math.min(size.count, available);
    case 'time':
      return Math.min(Math.ceil((size.minutes * 60_000) / ESTIMATED_MS_PER_ITEM), available);
    case 'all':
      return available;
  }
}

function order(
  items: readonly LearningItem[],
  config: SessionConfig,
  progress: ReadonlyMap<ItemId, ItemProgress>,
  now: Timestamp,
  rng: Rng,
): readonly LearningItem[] {
  switch (config.ordering) {
    case 'sequential':
      return items;
    case 'random':
      return shuffle(items, rng);
    case 'smart':
      return smartOrder(items, progress, now, rng, config.maxNewItems);
  }
}

/**
 * Weak and due items first, a controlled number of new items mixed in, then
 * everything else — the shape spec §5.2 describes, kept simple on purpose.
 */
function smartOrder(
  items: readonly LearningItem[],
  progress: ReadonlyMap<ItemId, ItemProgress>,
  now: Timestamp,
  rng: Rng,
  maxNewItems = Number.POSITIVE_INFINITY,
): readonly LearningItem[] {
  const due: LearningItem[] = [];
  const weak: LearningItem[] = [];
  const fresh: LearningItem[] = [];
  const rest: LearningItem[] = [];

  for (const item of items) {
    const state = progress.get(item.id);
    if (!state || state.status === 'new') fresh.push(item);
    else if (isDue(state, now)) due.push(item);
    else if (state.difficulty >= 0.5) weak.push(item);
    else rest.push(item);
  }

  return [
    ...shuffle(due, rng),
    ...shuffle(weak, rng),
    ...shuffle(fresh, rng).slice(0, maxNewItems),
    ...shuffle(rest, rng),
  ];
}
