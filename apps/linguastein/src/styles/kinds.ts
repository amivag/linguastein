/**
 * Which of the categorical hues a thing wears.
 *
 * The palette declares twelve `--color-kind-N` roles whose whole meaning is "which
 * kind of material this is" — see the note in `src/styles/themes/indigo-dark.css`
 * for why that is one meaning rather than twelve, and why the roles are numbered
 * rather than named. This module decides which of them a given thing gets.
 *
 * Two properties are the point, and both are why this is a hash rather than a
 * list or a position:
 *
 * - **A hue belongs to the thing, not to the row it sits in.** Colouring by
 *   index (`i % 12`) reads well on a static page and then changes every category's
 *   colour the day a row is inserted above it — which throws away the only thing
 *   the colour was buying, that Body is reliably the teal one. Derived from the
 *   stable id, a category keeps its hue as the dataset grows around it. This is
 *   the same rule as everywhere else here: store semantic data, derive
 *   presentation.
 * - **It needs no authoring.** Thirty-five categories, seven word kinds and every
 *   mission and set a learner makes are all derived from the packs, so a hand-kept
 *   map would be one more list to fall out of date — and a content pack in a
 *   second language would arrive with no colours at all.
 *
 * It is deliberately *not* `src/utils/random.ts`: this must be the same colour on
 * every device and every reload, so a seeded session and an unseeded one have to
 * agree. A hash is a pure function of the id; randomness would not be.
 */

/**
 * How many categorical hues the palettes declare.
 *
 * Twelve rather than the six it started with. Six was enough to stop a page of
 * grey cards being grey, and not enough to be *recognition*: thirty-five
 * categories over six hues is a collision every third row, so a learner never
 * got to learn that Body is the teal one. Twelve halves that, and twelve is
 * where it stops — a wheel divided finer than 30 degrees hands neighbouring
 * categories two colours a person cannot reliably tell apart, which is a
 * different way of failing at the same job.
 *
 * Widening it repainted every category once, which is a cost worth naming: the
 * rule below is that a hue belongs to the thing rather than to its row, and that
 * rule protects a learner from the dataset growing, not from the palette itself
 * being redesigned. This was the latter, and it happens once.
 */
export const KIND_HUE_COUNT = 12;

/** A hue's number, as `--color-kind-N` and `data-kind` both spell it. */
export type KindHue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * The hue for a stable id — an item id, a topic id, a skill id, a mission id.
 *
 * FNV-1a, which is the smallest thing that distributes short similar strings
 * well. That matters more than it sounds: the ids in this dataset differ in
 * their last few characters (`core-es:topic:food`, `core-es:topic:foot`), and a
 * weaker mix — summing char codes, say — hands neighbouring categories the same
 * colour often enough to look broken.
 *
 * `>>> 0` after each step keeps the arithmetic in 32 unsigned bits; without it
 * the multiply silently leaves the range where bitwise operators are exact and
 * the distribution degrades.
 */
export function kindHue(id: string): KindHue {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ((hash % KIND_HUE_COUNT) + 1) as KindHue;
}
