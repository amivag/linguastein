import { resolveMissions } from '../../domain/missions';
import { MISSION_SPINES } from './spines';
import { SPANISH_MISSIONS } from './es';

export { MISSION_SPINES } from './spines';
export { SPANISH_MISSIONS } from './es';

/**
 * The authored curriculum, joined.
 *
 * Every screen reads this and none of them knows the data arrives in two halves —
 * `resolveMissions` returns the same `MissionDefinition` shape the single file
 * used to export, which is why splitting it touched no consumer. A future
 * pack-supplied curriculum can supply either half.
 */
export const MISSIONS = resolveMissions(MISSION_SPINES, SPANISH_MISSIONS);
