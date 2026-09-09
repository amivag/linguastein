/**
 * What a drill needs from a subject: a closed set of rules, and targets for them.
 *
 * The companion to [`select.ts`](./select.ts). That file decides *which* durable
 * subject to ask about next; this one is how a subject answers "so ask me
 * something", and the two together are the whole of a drill. Nothing here knows
 * what is being learned.
 *
 * It exists because a drill's material cannot be authored. `docs/tasks/numerals.md`
 * §2 makes the argument for one subject — "how do I say 1042?" is not a question
 * any number of authored rows answers, because the value is in the joining rules
 * rather than in a list of numbers — and the argument is not about language.
 * There are more intervals than anyone will author, more products than anyone
 * will type out, and in each case the *rules* are few, closed and stable while
 * the *targets* are effectively infinite. That asymmetry is what this interface
 * is shaped around, and it is why a progress row can reference a rule without
 * anything minting an id for a target (architecture rule 4).
 *
 * **`Target` is deliberately unconstrained.** It is a number for numerals, and
 * `docs/framework.md` §1 records it fitting an interval class unchanged; an
 * expression tree would work the same way. A `string` bound would have been
 * tempting and wrong, because `render` already exists for the case where a
 * target has to become text and `parse` for the case where text has to become a
 * target — a target that *was* a string would make both of those identity
 * functions and hide the step where a subject decides how it is written.
 *
 * The one member this interface refuses is a *bound* on the target space.
 * `NumeralGuide` carries `maxValue` because a speller has a largest number it
 * will produce; an interval drill has twelve classes and no such quantity, and
 * lifting it here would have forced every subject to invent one. A subject with
 * a bound declares it on its own guide, which is where the spike found it
 * belonged.
 */

import type { Rng } from '../../utils/random';

export interface DrillGuide<Target> {
  /**
   * The rules this subject puts to work, **in teaching order**.
   *
   * The order is load-bearing rather than cosmetic: `nextSubject` returns unmet
   * subjects in the order it is given them, so this list is a curriculum. Sorted
   * by id, it would teach alphabetically.
   */
  readonly rules: readonly string[];
  /** A target that puts one rule to work, for the drill to ask. */
  sampleFor(rule: string, rng: Rng): Target;
  /**
   * Which rules a target exercises — what an attempt on it is evidence about.
   *
   * The heart of it, and the reason a drill can ask about something the dataset
   * has never heard of. An answer is recorded against these, never against the
   * target, so the set the scheduler sees stays closed and small while the set
   * the learner meets does not.
   */
  rulesFor(target: Target): readonly string[];
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
