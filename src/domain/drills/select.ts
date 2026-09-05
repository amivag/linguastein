/**
 * Which of a small, fixed set of subjects to practise next.
 *
 * A drill is not a session and this is not the planner. The planner deals a
 * *bounded set of items* chosen from thousands, weighing due dates against new
 * material against how much is left in the course; a drill returns to the same
 * handful of durable subjects — seven numeral patterns, a verb's twenty forms —
 * for as long as the learner keeps going. `SessionPlan` has nothing to say about
 * that: it is a list of item ids, and the whole reason this exists is that these
 * subjects are not items.
 *
 * So the rule here is deliberately simpler than `sessions/planner.ts`, and it is
 * the same three-part order the rest of the app already argues for:
 *
 * 1. **Due first**, because that is what the scheduler is for and a drill that
 *    ignored it would build the review debt that makes people stop. The most
 *    overdue leads.
 * 2. **Then anything unmet, in the order given** — which for a curriculum is
 *    teaching order, so a learner meets the solid teens before they meet
 *    `un millón de`.
 * 3. **Then the weakest**, so practice keeps going once everything is known and
 *    lands where it is worth landing.
 *
 * Randomness is injected (rule 7) and used only to break a tie, so a seeded
 * drill is reproducible while two equally shaky patterns do not always come up
 * in the same order.
 */

import type { EntityId } from '../content';
import { isDue, type SubjectProgress, type Timestamp } from '../progress';
import { randomInt, type Rng } from '../../utils/random';

/**
 * How well a subject is held, 0 (not at all) to 1.
 *
 * Accuracy weighted by whether the memory has survived a real gap, which is the
 * same pair `mastery.ts` reads — but computed here rather than imported, because
 * that module's `itemStrength` is about an *item* inside a course and folds in
 * how many distinct sentences used a word. A pattern has no sentences of its
 * own; it has a record and a stability, and nothing else is honest to use.
 */
function strength(record: SubjectProgress): number {
  if (record.attempts === 0) return 0;
  const accuracy = record.correct / record.attempts;
  // A week of stability is what `mastery.ts` and the batch bar both treat as one
  // spacing gap survived; below it, accuracy alone is flattering.
  const held = Math.min((record.stability ?? 0) / 7, 1);
  return accuracy * (0.5 + 0.5 * held);
}

/**
 * The subject to ask about next, or `undefined` when there are none to ask.
 *
 * `subjects` is taken in the order the caller means to teach them, and that
 * order is load-bearing for step 2 above — a caller that hands them over sorted
 * by id would be teaching alphabetically.
 */
export function nextSubject(
  subjects: readonly EntityId[],
  progress: ReadonlyMap<EntityId, SubjectProgress>,
  now: Timestamp,
  rng: Rng,
): EntityId | undefined {
  if (subjects.length === 0) return undefined;

  const due = subjects
    .map((subject) => ({ subject, record: progress.get(subject) }))
    .filter((entry) => entry.record !== undefined && isDue(entry.record, now));
  if (due.length > 0) {
    // Most overdue first. `dueAt` is set on every reviewed row, so the fallback
    // is unreachable rather than a default worth reasoning about.
    return due.sort((a, b) => (a.record?.dueAt ?? 0) - (b.record?.dueAt ?? 0))[0]?.subject;
  }

  const unmet = subjects.filter((subject) => (progress.get(subject)?.attempts ?? 0) === 0);
  if (unmet.length > 0) return unmet[0];

  const ranked = subjects
    .map((subject) => ({ subject, strength: strength(progress.get(subject)!) }))
    .sort((a, b) => a.strength - b.strength);
  const weakest = ranked[0]?.strength ?? 0;
  // Every subject as weak as the weakest, so a drill on an even set does not
  // ask the same one until its schedule happens to move.
  const tied = ranked.filter((entry) => entry.strength === weakest);
  return tied[randomInt(rng, tied.length)]?.subject;
}
