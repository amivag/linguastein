import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/app/missions';
import {
  missionById,
  missionCapabilitiesHaveEvidence,
  missionIsComplete,
  missionPassageForStage,
  missionTransfers,
  missionsForCourse,
  nextMissionTransfer,
} from '../../src/domain/missions';

/**
 * The ladder these tests order against.
 *
 * `missionsForCourse` used to read `CEFR_LEVELS` from the model, so no caller had
 * to be handed anything — which is exactly why the assumption that every
 * curriculum climbs A1→C2 went unnoticed until a second one was briefed. The
 * ladder is a pack's now (`docs/tasks/language-matrix.md` §7), so a test states
 * the one it means.
 */
const CEFR = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

describe('missions', () => {
  it('orders the authored journey and respects the course ceiling', () => {
    const a1 = missionsForCourse(MISSIONS, { language: 'es', level: 'a1' }, CEFR);

    expect(a1).toHaveLength(13);
    expect(a1.map((mission) => mission.id)).toEqual([
      'greet-and-respond',
      'make-yourself-understood',
      'cafe-order',
      'ask-directions',
      'shop-clothes',
      'hotel-check-in',
      'make-plans',
      'morning-routine',
      'your-work',
      'your-home',
      'buy-a-ticket',
      'market-shopping',
      'introduce-your-family',
    ]);
    expect(missionsForCourse(MISSIONS, { language: 'fr', level: 'all' }, CEFR)).toEqual([]);
  });

  it('never resolves a mission outside the current language', () => {
    expect(
      missionById(MISSIONS, { language: 'fr', level: 'all' }, 'cafe-order', CEFR),
    ).toBeUndefined();
  });

  it('gives every mission a substantial response palette', () => {
    for (const mission of MISSIONS) {
      expect(mission.responsePalettes?.length, mission.id).toBeGreaterThan(0);
      for (const palette of mission.responsePalettes ?? []) {
        expect(palette.responses.length, `${mission.id}/${palette.id}`).toBeGreaterThanOrEqual(8);
        expect(new Set(palette.responses.map((response) => response.item)).size).toBe(
          palette.responses.length,
        );
      }
    }
  });

  it('derives completion only when every passage item has retrieval evidence', () => {
    expect(missionIsComplete(['one', 'two'], new Set(['one']))).toBe(false);
    expect(missionIsComplete(['one', 'two'], new Set(['one', 'two']))).toBe(true);
    expect(missionIsComplete([], new Set())).toBe(false);
  });

  it('completes a capability mission only after every ability has retrieval evidence', () => {
    const abilities = ['order', 'price', 'close'];

    expect(missionCapabilitiesHaveEvidence(abilities, new Set(['order', 'price']))).toBe(false);
    expect(missionCapabilitiesHaveEvidence(abilities, new Set(abilities))).toBe(true);
    expect(missionCapabilitiesHaveEvidence([], new Set())).toBe(false);
  });

  it('uses a different connected situation for transfer when one is authored', () => {
    const greeting = missionById(
      MISSIONS,
      { language: 'es', level: 'a1' },
      'greet-and-respond',
      CEFR,
    )!;
    expect(missionPassageForStage(greeting, 'understand')).toBe('700033');
    expect(missionTransfers(greeting).map((transfer) => transfer.passage)).toEqual([
      '700034',
      '700035',
      '700036',
    ]);
    expect(greeting.responsePalettes?.[0]?.responses).toHaveLength(10);

    const cafe = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'cafe-order', CEFR)!;

    expect(missionPassageForStage(cafe, 'understand')).toBe('700009');
    expect(missionPassageForStage(cafe, 'practise')).toBe('700009');
    expect(missionPassageForStage(cafe, 'use')).toBe('700015');
    expect(missionTransfers(cafe).map((transfer) => transfer.passage)).toEqual([
      '700015',
      '700021',
      '700022',
    ]);
    expect(cafe.capabilities).toEqual([
      'order-food-drink',
      'handle-add-on',
      'ask-understand-price',
      'close-service-exchange',
    ]);

    const directions = missionById(
      MISSIONS,
      { language: 'es', level: 'a1' },
      'ask-directions',
      CEFR,
    )!;
    expect(missionPassageForStage(directions, 'understand')).toBe('700011');
    expect(missionPassageForStage(directions, 'use')).toBe('700016');
    expect(directions.capabilities).toEqual([
      'ask-for-directions',
      'follow-simple-directions',
      'check-distance',
      'thank-for-help',
    ]);

    const shopping = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'shop-clothes', CEFR)!;
    expect(missionPassageForStage(shopping, 'understand')).toBe('700010');
    expect(missionPassageForStage(shopping, 'use')).toBe('700017');
    expect(shopping.capabilities).toEqual([
      'seek-clothing-item',
      'handle-clothing-size',
      'ask-to-try-on',
      'choose-clothing-purchase',
      'ask-understand-item-price',
    ]);

    const hotel = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'hotel-check-in', CEFR)!;
    expect(missionPassageForStage(hotel, 'understand')).toBe('700012');
    expect(missionPassageForStage(hotel, 'use')).toBe('700018');
    expect(hotel.capabilities).toEqual([
      'confirm-hotel-reservation',
      'give-stay-details',
      'ask-whats-included',
      'understand-hotel-schedule',
      'locate-hotel-facility',
    ]);

    const plans = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'make-plans', CEFR)!;
    expect(missionPassageForStage(plans, 'understand')).toBe('700014');
    expect(missionPassageForStage(plans, 'use')).toBe('700019');
    expect(plans.capabilities).toEqual([
      'open-social-planning',
      'suggest-social-activity',
      'respond-to-suggestion',
      'coordinate-plan-time',
      'confirm-social-plan',
    ]);

    const routine = missionById(
      MISSIONS,
      { language: 'es', level: 'a1' },
      'morning-routine',
      CEFR,
    )!;
    expect(missionPassageForStage(routine, 'understand')).toBe('700001');
    expect(missionPassageForStage(routine, 'use')).toBe('700020');
    expect(routine.capabilities).toEqual([
      'anchor-routine-in-time',
      'describe-routine-actions',
      'add-context-to-routine',
      'sequence-routine-events',
      'connect-routine-to-destination',
    ]);
  });

  it('selects the first unfinished transfer and revisits the final rung after completion', () => {
    const cafe = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'cafe-order', CEFR)!;

    expect(nextMissionTransfer(cafe, new Set())).toMatchObject({ index: 0, total: 3 });
    expect(nextMissionTransfer(cafe, new Set(['700015']))).toMatchObject({
      index: 1,
      total: 3,
    });
    expect(nextMissionTransfer(cafe, new Set(['700015', '700021']))).toMatchObject({
      index: 2,
      total: 3,
    });
    expect(nextMissionTransfer(cafe, new Set(['700015', '700021', '700022']))).toMatchObject({
      index: 2,
      total: 3,
    });
  });
});
