import { coursePath, type Course } from '../../domain/content';
import type { MissionDefinition, MissionStage } from '../../domain/missions';
import { sessionPath } from '../practice/session-url';

/**
 * The Understand stage's sections, and their addresses.
 *
 * Understand was one column of everything it had: the goal, the exchange, up to
 * nine response palettes and a variation lab, which on the shipped A1 greeting
 * mission is several phone screens of scrolling to reach material the screen
 * never says is there. They are sections you switch between now.
 *
 * `dialogue` is a genuine constant default rather than a data-dependent one —
 * a mission always has its exchange, while palettes and a lab are optional — so
 * it is omitted from the URL the way Settings omits `learning`, and every link
 * written before sections existed still means what it meant.
 *
 * Both directions live here so a section cannot be written that the screen does
 * not read, which is the rule `study-url.ts` and `settings-url.ts` follow.
 */
export const MISSION_SECTIONS = ['dialogue', 'responses', 'variations'] as const;
export type MissionSection = (typeof MISSION_SECTIONS)[number];

/** The section a bare mission link opens: the exchange the mission is about. */
export const DEFAULT_MISSION_SECTION: MissionSection = 'dialogue';

export function isMissionSection(value: string | null | undefined): value is MissionSection {
  return (
    value !== null && value !== undefined && (MISSION_SECTIONS as readonly string[]).includes(value)
  );
}

/**
 * The section a URL asks for, or `undefined` for "wherever this mission starts".
 *
 * Unresolved on purpose, as Study's is: which sections exist is a property of
 * the mission — one with no authored palettes has no Responses section — so the
 * screen picks the first section it actually has, which is also what an
 * unrecognised name degrades to.
 */
export function parseMissionSection(params: URLSearchParams): MissionSection | undefined {
  const section = params.get('section');
  return isMissionSection(section) ? section : undefined;
}

/** A mission stage is addressable so the journey survives reloads and sharing. */
export function missionPath(
  course: Course,
  missionId: string,
  stage: MissionStage = 'understand',
  section: MissionSection = DEFAULT_MISSION_SECTION,
): string {
  const base = coursePath(course, `mission/${encodeURIComponent(missionId)}/${stage}`);
  return section === DEFAULT_MISSION_SECTION ? base : `${base}?section=${section}`;
}

/**
 * Where each rung of the journey goes.
 *
 * Here rather than in a screen because two screens draw the journey and must not
 * disagree about it: the mission screen draws Understand and Use, and a session
 * started from a mission draws Practise — which is the rung that is not a stage
 * of the mission screen at all, and so the one a second copy would get wrong.
 */
export function missionJourneyHrefs(
  course: Course,
  mission: MissionDefinition,
): Readonly<Record<MissionStage, string>> {
  return {
    understand: missionPath(course, mission.id, 'understand'),
    practise: missionPracticePath(course, mission),
    use: missionPath(course, mission.id, 'use'),
  };
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
