/**
 * A mission is curriculum sequencing, not an exercise or a copy of content.
 *
 * It points at connected passages and says what communicative outcome that
 * material serves. Each passage keeps owning its sentences; the exercise engine
 * keeps deriving practice from them; learner progress keeps pointing only at
 * item ids. A mission merely turns those existing systems into a journey.
 */

import { CEFR_LEVELS, LEVEL_SCOPE_ALL, type CefrLevel, type Course } from '../content';

export const MISSION_STAGES = ['understand', 'practise', 'use'] as const;
export type MissionStage = (typeof MISSION_STAGES)[number];

export type MissionTransferSupport = 'guided' | 'independent';

export interface MissionTransfer {
  /** Local passage id for this distinct real-world context. */
  readonly passage: string;
  /** Guided gives line-level meaning cues; independent gives intention cues. */
  readonly support: MissionTransferSupport;
  /** Short learner-facing explanation of what changed in this context. */
  readonly brief: string;
}

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
  /**
   * A parallel situation used only for transfer after practice. It recombines
   * the same useful language so Use is not an exact replay of Understand.
   */
  readonly challengePassage?: string;
  /**
   * An ordered ladder of transfer contexts. Earlier rungs change details;
   * later rungs reduce scripting and ask the learner to recombine the skill.
   */
  readonly transfers?: readonly MissionTransfer[];
  /** Local ids of communicative-function skills this mission gathers evidence for. */
  readonly capabilities?: readonly string[];
  /** Which line gives Home a useful preview. */
  readonly spotlight: number;
  readonly estimatedMinutes: number;
  /** In a dialogue, the part the learner performs during the Use stage. */
  readonly learnerSpeaker?: string;
  /** What to call the other side when the source is a monologue or narrative. */
  readonly scenarioPartner: string;
}

export function missionPassageForStage(mission: MissionDefinition, stage: MissionStage): string {
  return stage === 'use'
    ? (missionTransfers(mission)[0]?.passage ?? mission.passage)
    : mission.passage;
}

/** The authored ladder, with the original single challenge kept as a fallback. */
export function missionTransfers(mission: MissionDefinition): readonly MissionTransfer[] {
  if (mission.transfers?.length) return mission.transfers;
  return mission.challengePassage
    ? [
        {
          passage: mission.challengePassage,
          support: 'guided',
          brief: 'The details have changed. Use what you learned in this new situation.',
        },
      ]
    : [];
}

/** First unfinished rung; after the ladder is complete, revisit its final challenge. */
export function nextMissionTransfer(
  mission: MissionDefinition,
  completedPassages: ReadonlySet<string>,
):
  | { readonly transfer: MissionTransfer; readonly index: number; readonly total: number }
  | undefined {
  const transfers = missionTransfers(mission);
  if (!transfers.length) return undefined;
  const unfinished = transfers.findIndex((transfer) => !completedPassages.has(transfer.passage));
  const index = unfinished >= 0 ? unfinished : transfers.length - 1;
  return { transfer: transfers[index]!, index, total: transfers.length };
}

/** A mission advances once each named real-world capability has retrieval evidence. */
export function missionCapabilitiesHaveEvidence(
  capabilities: readonly string[],
  evidencedCapabilities: ReadonlySet<string>,
): boolean {
  return (
    capabilities.length > 0 &&
    capabilities.every((capability) => evidencedCapabilities.has(capability))
  );
}

/** Missions that belong in a course, in their authored dependency order. */
export function missionsForCourse(
  catalog: readonly MissionDefinition[],
  course: Course,
): readonly MissionDefinition[] {
  const ceiling =
    course.level === LEVEL_SCOPE_ALL ? Number.POSITIVE_INFINITY : CEFR_LEVELS.indexOf(course.level);

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
