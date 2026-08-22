import { coursePath, type Course } from '../../domain/content';
import type { MissionDefinition, MissionStage } from '../../domain/missions';
import { sessionPath } from '../practice/session-url';

/** A mission stage is addressable so the journey survives reloads and sharing. */
export function missionPath(
  course: Course,
  missionId: string,
  stage: MissionStage = 'understand',
): string {
  return coursePath(course, `mission/${encodeURIComponent(missionId)}/${stage}`);
}

/** A mission practice link carries the situation and the abilities it tests. */
export function missionPracticePath(course: Course, mission: MissionDefinition): string {
  return sessionPath(course, {
    preset: 'quick',
    size: { kind: 'all' },
    passage: mission.passage,
    mission: mission.id,
    ...(mission.capabilities?.length ? { skills: mission.capabilities } : {}),
    ordering: 'sequential',
  });
}
