/**
 * Text-response extension of subject-neutral DrillMaterial. Numerals use a
 * number target and render/parse its spelling; rhythm can use DrillMaterial
 * directly with timed responses. Generated targets have no progress identity:
 * evidence belongs to the durable rules they exercise. Subject-specific bounds
 * such as NumeralGuide.maxValue stay on the subject's own interface.
 * See docs/framework.md for the current reuse boundary.
 */

import type { DrillMaterial } from '../../engine/drill';

export interface DrillGuide<Target> extends DrillMaterial<Target> {
  /** The target as the learner should produce it: `1042` → `mil cuarenta y dos`. */
  render(target: Target): string;
  /** The inverse, for grading what a learner answered. `null` when it is not one. */
  parse(text: string): Target | null;
}

/**
 * A guide that arrives in its own chunk.
 *
 * A loader rather than a promise, for the reason `languages/runtime.ts` already
 * gives its own capabilities: "does this subject have a drill?" is answered
 * synchronously off the same switch that knows how to load one, so a screen can
 * decide whether the section exists while it decides every other section — with
 * no second list to fall out of step and no tab that appears a frame late. The
 * data itself still only reaches the learner who opens it.
 */
export type DrillGuideLoader<Target> = () => Promise<DrillGuide<Target>>;
