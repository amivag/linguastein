import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/app/missions';
import {
  missionById,
  missionCapabilitiesHaveEvidence,
  missionIsComplete,
  missionPassageForStage,
  missionsForCourse,
} from '../../src/domain/missions';

describe('missions', () => {
  it('orders the authored journey and respects the course ceiling', () => {
    const a1 = missionsForCourse(MISSIONS, { language: 'es', level: 'a1' });

    expect(a1).toHaveLength(6);
    expect(a1.map((mission) => mission.id)).toEqual([
      'cafe-order',
      'ask-directions',
      'shop-clothes',
      'hotel-check-in',
      'make-plans',
      'morning-routine',
    ]);
    expect(missionsForCourse(MISSIONS, { language: 'fr', level: 'all' })).toEqual([]);
  });

  it('never resolves a mission outside the current language', () => {
    expect(missionById(MISSIONS, { language: 'fr', level: 'all' }, 'cafe-order')).toBeUndefined();
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
    const cafe = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'cafe-order')!;

    expect(missionPassageForStage(cafe, 'understand')).toBe('700009');
    expect(missionPassageForStage(cafe, 'practise')).toBe('700009');
    expect(missionPassageForStage(cafe, 'use')).toBe('700015');
    expect(cafe.capabilities).toEqual([
      'order-food-drink',
      'handle-add-on',
      'ask-understand-price',
      'close-service-exchange',
    ]);

    const directions = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'ask-directions')!;
    expect(missionPassageForStage(directions, 'understand')).toBe('700011');
    expect(missionPassageForStage(directions, 'use')).toBe('700016');
    expect(directions.capabilities).toEqual([
      'ask-for-directions',
      'follow-simple-directions',
      'check-distance',
      'thank-for-help',
    ]);

    const shopping = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'shop-clothes')!;
    expect(missionPassageForStage(shopping, 'understand')).toBe('700010');
    expect(missionPassageForStage(shopping, 'use')).toBe('700017');
    expect(shopping.capabilities).toEqual([
      'seek-clothing-item',
      'handle-clothing-size',
      'ask-to-try-on',
      'choose-clothing-purchase',
      'ask-understand-item-price',
    ]);

    const hotel = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'hotel-check-in')!;
    expect(missionPassageForStage(hotel, 'understand')).toBe('700012');
    expect(missionPassageForStage(hotel, 'use')).toBe('700018');
    expect(hotel.capabilities).toEqual([
      'confirm-hotel-reservation',
      'give-stay-details',
      'ask-whats-included',
      'understand-hotel-schedule',
      'locate-hotel-facility',
    ]);

    const plans = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'make-plans')!;
    expect(missionPassageForStage(plans, 'understand')).toBe('700014');
    expect(missionPassageForStage(plans, 'use')).toBe('700019');
    expect(plans.capabilities).toEqual([
      'open-social-planning',
      'suggest-social-activity',
      'respond-to-suggestion',
      'coordinate-plan-time',
      'confirm-social-plan',
    ]);

    const routine = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'morning-routine')!;
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
});
