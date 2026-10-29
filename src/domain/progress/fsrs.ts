/** Preserve app-owned fields while the engine updates only memory state. */
import { fsrsScheduler as memoryScheduler } from '../../engine/fsrs';
import type { Scheduler } from './scheduler';
export { intervalDays, retrievability } from '../../engine/fsrs';

export const fsrsScheduler: Scheduler = {
  id: memoryScheduler.id,
  review: (progress, grade, now) => ({
    ...progress,
    ...memoryScheduler.review(progress, grade, now),
  }),
};
