import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/app/missions';
import { missionById, missionIsComplete, missionsForCourse } from '../../src/domain/missions';

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
});
