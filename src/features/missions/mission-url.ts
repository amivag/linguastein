import { coursePath, type Course } from '../../domain/content';
import type { MissionStage } from '../../domain/missions';

/** A mission stage is addressable so the journey survives reloads and sharing. */
export function missionPath(
  course: Course,
  missionId: string,
  stage: MissionStage = 'understand',
): string {
  return coursePath(course, `mission/${encodeURIComponent(missionId)}/${stage}`);
}
