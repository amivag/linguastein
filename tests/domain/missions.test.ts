import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/app/missions';
import {
  missionById,
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

  it('uses a different connected situation for transfer when one is authored', () => {
    const cafe = missionById(MISSIONS, { language: 'es', level: 'a1' }, 'cafe-order')!;

    expect(missionPassageForStage(cafe, 'understand')).toBe('700009');
    expect(missionPassageForStage(cafe, 'practise')).toBe('700009');
    expect(missionPassageForStage(cafe, 'use')).toBe('700015');
  });
});
