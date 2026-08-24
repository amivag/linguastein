/**
 * How far a learner has got with each mission — derived, never stored.
 *
 * The rule missions inherit from everything else in this codebase is that
 * progress records point at item ids and nothing else, so "is this mission
 * finished?" has to be *computed* from the attempt log rather than written down
 * when it happens. That is what makes a mission catalogue safe to reorder and a
 * pack safe to grow.
 *
 * It lives here rather than in a screen because two screens now ask the same
 * question and must not answer it differently: Study lists every mission with
 * its standing, and the course home leads with the first unfinished one. The
 * home screen used to compute it inline, which meant the list could not exist
 * without the calculation being copied.
 */

import type { LearningItem, Passage } from '../content';
import type { Course } from '../content';
import type { ContentRepository } from '../content';
import {
  missionIsComplete,
  missionsForCourse,
  missionTransfers,
  type MissionDefinition,
  type MissionStage,
} from './model';

/**
 * The session id a Use-stage attempt is recorded under.
 *
 * A convention, and therefore something exactly one module should know: it was
 * built in the mission screen, read back in the mission screen and parsed again
 * on the home screen, which is three chances for the shape to drift apart. Only
 * Use writes one — Understand records nothing at all, being study.
 */
export function missionUseSessionId(missionId: string, context: string, stamp: string): string {
  return `mission:${missionId}:use:${context}:${stamp}`;
}

/** The mission a session id belongs to, or `undefined` for an ordinary session. */
export function missionOfUseSession(sessionId: string | undefined): string | undefined {
  return /^mission:([^:]+):use:/.exec(sessionId ?? '')?.[1];
}

/** Whether a session id is the Use stage of one particular mission. */
export function isMissionUseSession(sessionId: string | undefined, missionId: string): boolean {
  return missionOfUseSession(sessionId) === missionId;
}

/** What has been practised, in the two shapes a mission's completion needs. */
export interface MissionEvidence {
  /**
   * Items with any recorded practice at all. Enough for a mission that names no
   * capabilities: its taught exchange is the whole of it.
   */
  readonly practised: ReadonlySet<string>;
  /**
   * Items retrieved during a mission's own Use stage, per mission.
   *
   * A capability has to be evidenced *in transfer* — having met a sentence while
   * reading it is not evidence of being able to use it in a new situation, which
   * is the whole point of the stage.
   */
  readonly used: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Indexes an attempt log into the Use-stage evidence, mission by mission. */
export function missionUseEvidence(
  attempts: readonly { readonly itemId: string; readonly sessionId?: string }[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const result = new Map<string, Set<string>>();
  for (const attempt of attempts) {
    const mission = missionOfUseSession(attempt.sessionId);
    if (!mission) continue;
    const items = result.get(mission) ?? new Set<string>();
    items.add(attempt.itemId);
    result.set(mission, items);
  }
  return result;
}

/** One mission, and where the learner stands in it. */
export interface MissionStanding {
  readonly mission: MissionDefinition;
  /** The taught exchange. Use runs on the transfer passages instead. */
  readonly passage: Passage;
  /** 1-based place in the course's authored order, for "Mission 2 of 7". */
  readonly position: number;
  readonly total: number;
  /** Lines in the taught exchange. */
  readonly lineCount: number;
  /** Where a learner returning to this mission should land. */
  readonly stage: MissionStage;
  readonly complete: boolean;
  /** Rungs of the transfer ladder finished, and how many there are. */
  readonly transfersDone: number;
  readonly transferTotal: number;
  /** The rung to show as current, which is the last one once they are all done. */
  readonly transferPosition: number;
}

/**
 * Every mission the course offers, in authored order, with its standing.
 *
 * A mission whose passage is not in the current course is left out rather than
 * shown as unavailable: a course is a scope, so a mission outside it is not a
 * locked feature, it is simply not part of what is being studied.
 */
export function missionStandings(
  catalog: readonly MissionDefinition[],
  course: Course,
  repository: ContentRepository,
  courseItemIds: ReadonlySet<string>,
  evidence: MissionEvidence,
): readonly MissionStanding[] {
  const inCourse = (passage: Passage) =>
    repository.itemsOfPassage(passage.id).some((item) => courseItemIds.has(item.id));

  const authored = missionsForCourse(catalog, course).flatMap((mission) => {
    const passage = repository.passageByRef(mission.passage);
    return passage && inCourse(passage) ? [{ mission, passage }] : [];
  });

  return authored.map(({ mission, passage }, index) => {
    const used = evidence.used.get(mission.id) ?? new Set<string>();

    // A curriculum may run against a compatible pack that predates one of its
    // transfer passages, so the ladder is what actually resolves rather than
    // what was authored.
    const transfers = missionTransfers(mission).flatMap((transfer) => {
      const candidate = repository.passageByRef(transfer.passage);
      return candidate ? [candidate] : [];
    });

    const learnerItems = (candidate: Passage): readonly string[] =>
      repository
        .itemsOfPassage(candidate.id)
        .filter(
          (_: LearningItem, position: number) =>
            mission.learnerSpeaker === undefined ||
            candidate.speakers?.[position] === mission.learnerSpeaker,
        )
        .map((item) => item.id);

    const usePassages = transfers.length ? transfers : [passage];
    const complete = mission.capabilities?.length
      ? usePassages.every((candidate) => missionIsComplete(learnerItems(candidate), used))
      : missionIsComplete(passage.items, evidence.practised);

    const transfersDone = transfers.filter((candidate) =>
      missionIsComplete(learnerItems(candidate), used),
    ).length;
    const transferTotal = Math.max(transfers.length, 1);

    return {
      mission,
      passage,
      position: index + 1,
      total: authored.length,
      lineCount: repository.itemsOfPassage(passage.id).length,
      // Any Use-stage evidence at all means the learner has left Understand
      // behind; sending them back to read it again is not where they were.
      stage: transfersDone > 0 || used.size > 0 ? 'use' : 'understand',
      complete,
      transfersDone,
      transferTotal,
      transferPosition: Math.min(transfersDone + 1, transferTotal),
    };
  });
}

/**
 * The mission to lead with: the first unfinished one, or the last if the course
 * is finished.
 *
 * The last rather than nothing, because a finished course still has to offer
 * something to open — and revisiting the final transfer is a better answer than
 * an empty screen.
 */
export function nextMissionStanding(
  standings: readonly MissionStanding[],
): MissionStanding | undefined {
  return standings.find((standing) => !standing.complete) ?? standings[standings.length - 1];
}
