import { describe, expect, it } from 'vitest';
import { MISSION_VARIATIONS } from '../../src/app/mission-variations';
import {
  defaultVariationSelections,
  renderVariation,
  variationProblems,
} from '../../src/domain/exercises';

describe('variation practice', () => {
  it('covers every mission with 574 deliberately bounded combinations', () => {
    expect(Object.keys(MISSION_VARIATIONS)).toEqual([
      'greet-and-respond',
      'cafe-order',
      'ask-directions',
      'shop-clothes',
      'hotel-check-in',
      'make-plans',
      'morning-routine',
      'doctor-visit',
      'your-work',
      'your-home',
      'buy-a-ticket',
      'market-shopping',
      'introduce-your-family',
    ]);

    const combinations = Object.values(MISSION_VARIATIONS).reduce(
      (catalogTotal, patterns) =>
        catalogTotal +
        patterns.reduce(
          (missionTotal, pattern) =>
            missionTotal +
            pattern.slots.reduce((patternTotal, slot) => patternTotal * slot.choices.length, 1),
          0,
        ),
      0,
    );

    expect(combinations).toBe(574);
  });

  it.each([
    ['greet-and-respond', 0, 'Estoy genial.'],
    ['cafe-order', 0, 'Quiero un café solo, por favor.'],
    ['ask-directions', 0, 'Perdón, ¿dónde está la farmacia?'],
    ['shop-clothes', 0, 'Busco una camisa blanca.'],
    ['hotel-check-in', 0, 'Sí, una habitación individual para una noche.'],
    ['make-plans', 0, 'Sí, vamos al cine.'],
    ['make-plans', 1, 'Hoy no puedo, pero podemos ir mañana.'],
    ['morning-routine', 0, 'Primero, me despierto.'],
  ] as const)('renders a useful default for %s pattern %s', (missionId, patternIndex, target) => {
    const pattern = MISSION_VARIATIONS[missionId]![patternIndex]!;

    expect(renderVariation(pattern, defaultVariationSelections(pattern)).target).toBe(target);
  });

  it('builds the deliberately ordered default phrase', () => {
    const pattern = MISSION_VARIATIONS['cafe-order']![0]!;
    const variation = renderVariation(pattern, defaultVariationSelections(pattern));

    expect(variation).toMatchObject({
      target: 'Quiero un café solo, por favor.',
      reference: "I'd like a black coffee, please.",
    });
  });

  it('recombines independently selected meanings into a new phrase', () => {
    const pattern = MISSION_VARIATIONS['cafe-order']![0]!;
    const variation = renderVariation(pattern, {
      lead: 'para-mi',
      drink: 'agua',
      finish: 'plain',
    });

    expect(variation.target).toBe('Para mí, un agua.');
    expect(variation.reference).toBe('For me, a water.');
  });

  it('rejects a selection that the pattern did not declare', () => {
    const pattern = MISSION_VARIATIONS['ask-directions']![0]!;

    expect(() => renderVariation(pattern, { opener: 'perdon', place: 'airport' })).toThrowError(
      'Unknown choice for variation slot “place”',
    );
  });

  it('keeps every authored pattern structurally sound', () => {
    const broken = Object.entries(MISSION_VARIATIONS).flatMap(([mission, patterns]) =>
      patterns.flatMap((pattern) =>
        variationProblems(pattern).map((problem) => `${mission}/${pattern.id}: ${problem}`),
      ),
    );

    expect(broken).toEqual([]);
  });
});
