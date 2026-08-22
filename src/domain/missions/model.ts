/**
 * A mission is curriculum sequencing, not an exercise or a copy of content.
 *
 * It points at one connected passage and says what communicative outcome that
 * material serves. The passage keeps owning every sentence; the exercise engine
 * keeps deriving practice from those sentences; learner progress keeps pointing
 * only at item ids. A mission merely turns those existing systems into a journey.
 */

import { CEFR_LEVELS, LEVEL_SCOPE_ALL, type CefrLevel, type Course } from '../content';

export const MISSION_STAGES = ['understand', 'practise', 'use'] as const;
export type MissionStage = (typeof MISSION_STAGES)[number];

export interface MissionDefinition {
  /** Stable, shareable curriculum id — deliberately independent of a pack id. */
  readonly id: string;
  readonly language: string;
  readonly level: CefrLevel;
  readonly order: number;
  readonly title: string;
  /** The real-world thing the learner should be able to do afterwards. */
  readonly goal: string;
  /** Local passage id, resolved against whichever compatible pack is loaded. */
  readonly passage: string;
  /** Which line gives Home a useful preview. */
  readonly spotlight: number;
  readonly estimatedMinutes: number;
  /** In a dialogue, the part the learner performs during the Use stage. */
  readonly learnerSpeaker?: string;
  /** What to call the other side when the source is a monologue or narrative. */
  readonly scenarioPartner: string;
}

/** Missions that belong in a course, in their authored dependency order. */
export function missionsForCourse(
  catalog: readonly MissionDefinition[],
  course: Course,
): readonly MissionDefinition[] {
  const ceiling = course.level === LEVEL_SCOPE_ALL ? Number.POSITIVE_INFINITY : CEFR_LEVELS.indexOf(course.level);

  return catalog
    .filter(
      (mission) =>
        mission.language === course.language && CEFR_LEVELS.indexOf(mission.level) <= ceiling,
    )
    .sort((a, b) => a.order - b.order);
}

export function missionById(
  catalog: readonly MissionDefinition[],
  course: Course,
  id: string,
): MissionDefinition | undefined {
  return missionsForCourse(catalog, course).find((mission) => mission.id === id);
}

/** Completion stays derived: every sentence in the mission has retrieval evidence. */
export function missionIsComplete(
  itemIds: readonly string[],
  practisedItemIds: ReadonlySet<string>,
): boolean {
  return itemIds.length > 0 && itemIds.every((id) => practisedItemIds.has(id));
}
