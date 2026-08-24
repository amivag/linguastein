/**
 * Session planning: repository + learner state + config → an ordered item list.
 *
 * Pure and deterministic given a seed, so ordering behaviour is testable and a
 * session can be reproduced exactly.
 */

import type { ContentRepository, ItemId, LearningItem } from '../content';
import { isDue, type ItemProgress, type Timestamp } from '../progress/types';
import { seededRng, shuffle, systemRng, token, type Rng } from '../../utils/random';
import {
  DEFAULT_SESSION_FOCUS,
  ESTIMATED_MS_PER_ITEM,
  type SessionConfig,
  type SessionFocus,
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
    // Drawn from the rng *after* the ordering, so adding a unique suffix cannot
    // change which items a given seed deals — and a seeded plan still gets the
    // same id twice. The clock alone is not an identity: two devices starting a
    // session in the same millisecond would collide, and every session record
    // is keyed by it.
    id: `session-${now.toString(36)}-${token(rng)}`,
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
      return smartOrder(
        items,
        progress,
        now,
        rng,
        config.focus ?? DEFAULT_SESSION_FOCUS,
        config.maxNewItems,
      );
  }
}

type Bucket = 'due' | 'weak' | 'fresh' | 'rest';

/**
 * Which bucket each focus leads with.
 *
 * Every focus is a permutation of the same four groups rather than its own
 * algorithm, which is what keeps a focus from being able to empty a session: the
 * groups it deprioritises are still there, just later. `balanced` is spec §5.2
 * unchanged.
 *
 * `struggling` puts new material dead last on purpose — meeting new words is the
 * opposite of consolidating the ones already going wrong.
 */
const BUCKET_ORDER: Record<SessionFocus, readonly Bucket[]> = {
  balanced: ['due', 'weak', 'fresh', 'rest'],
  struggling: ['weak', 'due', 'rest', 'fresh'],
  due: ['due', 'weak', 'rest', 'fresh'],
  fresh: ['fresh', 'due', 'weak', 'rest'],
  /*
   * `recent` is the one focus that is not really a permutation, and the entry
   * here is what it falls back to.
   *
   * "The material I was just working on" cuts *across* these groups rather than
   * selecting one of them: a sentence practised twenty minutes ago is in `rest`
   * if it went well, in `weak` if it did not, and in `due` if the scheduler has
   * already brought it round again. Ordering by bucket would scatter exactly the
   * handful of items the learner is asking for. So `smartOrder` special-cases it
   * below, and this row is only what remains true either way: new material comes
   * last, because meeting new words is not what "again" means.
   */
  recent: ['due', 'weak', 'rest', 'fresh'],
};

/**
 * Weak and due items first, a controlled number of new items mixed in, then
 * everything else — the shape spec §5.2 describes, reordered by the focus the
 * learner picked.
 */
function smartOrder(
  items: readonly LearningItem[],
  progress: ReadonlyMap<ItemId, ItemProgress>,
  now: Timestamp,
  rng: Rng,
  focus: SessionFocus,
  maxNewItems = Number.POSITIVE_INFINITY,
): readonly LearningItem[] {
  const buckets: Record<Bucket, LearningItem[]> = { due: [], weak: [], fresh: [], rest: [] };

  for (const item of items) {
    const state = progress.get(item.id);
    if (!state || state.status === 'new') buckets.fresh.push(item);
    else if (isDue(state, now)) buckets.due.push(item);
    else if (state.difficulty >= 0.5) buckets.weak.push(item);
    else buckets.rest.push(item);
  }

  // Asked for the hardest, get the hardest: within the weak group, difficulty
  // decides the order rather than the shuffle. Deterministic either way.
  if (focus === 'struggling') {
    buckets.weak.sort(
      (a, b) => (progress.get(b.id)?.difficulty ?? 0) - (progress.get(a.id)?.difficulty ?? 0),
    );
  }

  /*
   * Everything already met, most recently practised first — then new material.
   *
   * The three seen buckets are merged rather than ordered, for the reason
   * `BUCKET_ORDER` records: recency is orthogonal to how an item is doing, so
   * keeping the buckets apart would bury the four sentences from this morning
   * under everything else that happens to be due. Sorted rather than shuffled,
   * so "again" means what it says; ties keep their scan order, which makes the
   * result deterministic without a seed.
   *
   * It still cannot hand back an empty session: unseen items are appended under
   * the same cap every other focus applies, so a learner with no history at all
   * gets an ordinary first session instead of nothing.
   */
  if (focus === 'recent') {
    const seen = [...buckets.due, ...buckets.weak, ...buckets.rest].sort(
      (a, b) =>
        (progress.get(b.id)?.lastReviewedAt ?? 0) - (progress.get(a.id)?.lastReviewedAt ?? 0),
    );
    return [...seen, ...shuffle(buckets.fresh, rng).slice(0, maxNewItems)];
  }

  // The cap exists so "10 minutes of practice" cannot become ten first
  // encounters. Under `fresh` that is exactly what was asked for, so it lifts.
  const newCap = focus === 'fresh' ? Number.POSITIVE_INFINITY : maxNewItems;

  return BUCKET_ORDER[focus].flatMap((bucket) => {
    if (bucket === 'fresh') return shuffle(buckets.fresh, rng).slice(0, newCap);
    if (bucket === 'weak' && focus === 'struggling') return buckets.weak;
    return shuffle(buckets[bucket], rng);
  });
}
