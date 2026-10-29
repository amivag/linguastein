/** Application operation: read fresh state and commit evidence/projections together. */
import type { EntityId } from '../domain/content';
import {
  applyAttempt,
  replaySubject,
  type Attempt,
  type SubjectProgress,
} from '../domain/progress';
import type { LearnerStorage } from './types';

const ATTEMPT_FIELDS = [
  'id',
  'subject',
  'exerciseKind',
  'grade',
  'correct',
  'latencyMs',
  'hintsUsed',
  'at',
  'sessionId',
] as const;
export function sameAttempt(a: Attempt, b: Attempt): boolean {
  return ATTEMPT_FIELDS.every((key) => a[key] === b[key]);
}
export async function saveAttempts(
  storage: LearnerStorage,
  attempts: readonly Attempt[],
): Promise<ReadonlyMap<EntityId, SubjectProgress>> {
  return storage.transaction(async (stores) => {
    const updated = new Map<EntityId, SubjectProgress>();
    for (const attempt of attempts) {
      const existing = await stores.attempts.get(attempt.id);
      if (existing && !sameAttempt(existing, attempt))
        throw new Error('Attempt id already belongs to different evidence');
      const previous = await stores.progress.get(attempt.subject);
      if (!existing) await stores.attempts.append(attempt);
      // Normal chronological practice stays incremental; duplicates, missing
      // projections and out-of-order arrivals use the canonical log fold.
      const row =
        !existing && previous?.lastReviewedAt !== undefined && previous.lastReviewedAt < attempt.at
          ? applyAttempt(previous, attempt)
          : replaySubject(
              attempt.subject,
              await stores.attempts.forSubject(attempt.subject, Number.MAX_SAFE_INTEGER),
            );
      if (row) {
        await stores.progress.put(row);
        updated.set(attempt.subject, row);
      }
    }
    return updated;
  });
}
