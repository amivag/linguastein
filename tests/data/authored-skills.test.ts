import { afterEach, describe, expect, it } from 'vitest';
import type { LearningItem, Skill, Translation } from '../../src/domain/content';
import { createScratchPack, shippedRecords, type ScratchPack } from '../fixtures/dataset';

const cafeIds = [
  'core-es:skill:order-food-drink',
  'core-es:skill:handle-add-on',
  'core-es:skill:ask-understand-price',
  'core-es:skill:close-service-exchange',
] as const;
const directionIds = [
  'core-es:skill:ask-for-directions',
  'core-es:skill:follow-simple-directions',
  'core-es:skill:check-distance',
  'core-es:skill:thank-for-help',
] as const;
const shoppingIds = [
  'core-es:skill:seek-clothing-item',
  'core-es:skill:handle-clothing-size',
  'core-es:skill:ask-to-try-on',
  'core-es:skill:choose-clothing-purchase',
  'core-es:skill:ask-understand-item-price',
] as const;
const hotelIds = [
  'core-es:skill:confirm-hotel-reservation',
  'core-es:skill:give-stay-details',
  'core-es:skill:ask-whats-included',
  'core-es:skill:understand-hotel-schedule',
  'core-es:skill:locate-hotel-facility',
] as const;
const planIds = [
  'core-es:skill:open-social-planning',
  'core-es:skill:suggest-social-activity',
  'core-es:skill:respond-to-suggestion',
  'core-es:skill:coordinate-plan-time',
  'core-es:skill:confirm-social-plan',
] as const;
const routineIds = [
  'core-es:skill:anchor-routine-in-time',
  'core-es:skill:describe-routine-actions',
  'core-es:skill:add-context-to-routine',
  'core-es:skill:sequence-routine-events',
  'core-es:skill:connect-routine-to-destination',
] as const;
const ids = [...cafeIds, ...directionIds, ...shoppingIds, ...hotelIds, ...planIds, ...routineIds];

describe('authored communicative skills', () => {
  let scratch: ScratchPack | undefined;

  afterEach(() => scratch?.dispose());

  it('ships target-language labels, reference-language glosses and prerequisites', () => {
    const skills = shippedRecords<Skill>('es-a1-a2-core-skills.jsonl');
    const translations = shippedRecords<Translation>('es-a1-a2-core-translations-en.jsonl');

    for (const id of ids) {
      const skill = skills.find((candidate) => candidate.id === id);
      expect(skill, id).toMatchObject({ kind: 'function', level: 'a1' });
      expect(skill!.label.length).toBeGreaterThan(0);
      expect(
        translations.find((translation) => translation.ref === id)?.text.length,
      ).toBeGreaterThan(0);
    }

    expect(skills.find((skill) => skill.id === cafeIds[1])?.prerequisites).toEqual([cafeIds[0]]);
    expect(skills.find((skill) => skill.id === directionIds[1])?.prerequisites).toEqual([
      directionIds[0],
    ]);
    expect(skills.find((skill) => skill.id === shoppingIds[4])?.prerequisites).toEqual([
      shoppingIds[3],
    ]);
    expect(skills.find((skill) => skill.id === hotelIds[3])?.prerequisites).toEqual([hotelIds[2]]);
    expect(skills.find((skill) => skill.id === planIds[4])?.prerequisites).toEqual([planIds[3]]);
    expect(skills.find((skill) => skill.id === routineIds[4])?.prerequisites).toEqual([
      routineIds[3],
    ]);
  });

  it('attaches the functions to the sentences that provide their evidence', () => {
    const items = shippedRecords<LearningItem>('es-a1-a2-core-sentences.jsonl');
    const capabilitiesIn = (locals: readonly string[]) => {
      const selected = items.filter((item) =>
        locals.some((local) => item.id.endsWith(`:item:${local}`)),
      );
      return {
        count: selected.length,
        used: new Set<string>(selected.flatMap((item) => item.skills ?? [])),
      };
    };

    const cafe = capabilitiesIn(['000556', '000557', '000558', '000559', '000560', '000561']);
    expect(cafe.count).toBe(6);
    expect(cafeIds.filter((id) => !cafe.used.has(id))).toEqual([]);

    const directions = capabilitiesIn(['000569', '000570', '000571', '000572', '000573']);
    expect(directions.count).toBe(5);
    expect(directionIds.filter((id) => !directions.used.has(id))).toEqual([]);

    const transfer = capabilitiesIn(['000599', '000600', '000601', '000602', '000603']);
    expect(transfer.count).toBe(5);
    expect(directionIds.filter((id) => !transfer.used.has(id))).toEqual([]);

    const shopping = capabilitiesIn([
      '000562',
      '000563',
      '000564',
      '000565',
      '000566',
      '000567',
      '000568',
    ]);
    expect(shopping.count).toBe(7);
    expect(shoppingIds.filter((id) => !shopping.used.has(id))).toEqual([]);

    const shoppingTransfer = capabilitiesIn([
      '000604',
      '000605',
      '000606',
      '000607',
      '000608',
      '000609',
      '000610',
    ]);
    expect(shoppingTransfer.count).toBe(7);
    expect(shoppingIds.filter((id) => !shoppingTransfer.used.has(id))).toEqual([]);

    const hotel = capabilitiesIn(['000574', '000575', '000576', '000577', '000578', '000579']);
    expect(hotel.count).toBe(6);
    expect(hotelIds.filter((id) => !hotel.used.has(id))).toEqual([]);

    const hotelTransfer = capabilitiesIn([
      '000611',
      '000612',
      '000613',
      '000614',
      '000615',
      '000616',
    ]);
    expect(hotelTransfer.count).toBe(6);
    expect(hotelIds.filter((id) => !hotelTransfer.used.has(id))).toEqual([]);

    const plans = capabilitiesIn(['000587', '000588', '000589', '000590', '000591', '000592']);
    expect(plans.count).toBe(6);
    expect(planIds.filter((id) => !plans.used.has(id))).toEqual([]);

    const plansTransfer = capabilitiesIn([
      '000617',
      '000618',
      '000619',
      '000620',
      '000621',
      '000622',
    ]);
    expect(plansTransfer.count).toBe(6);
    expect(planIds.filter((id) => !plansTransfer.used.has(id))).toEqual([]);

    const routine = capabilitiesIn(['000516', '000517', '000518', '000519', '000520']);
    expect(routine.count).toBe(5);
    expect(routineIds.filter((id) => !routine.used.has(id))).toEqual([]);

    const routineTransfer = capabilitiesIn(['000623', '000624', '000625', '000626', '000627']);
    expect(routineTransfer.count).toBe(5);
    expect(routineIds.filter((id) => !routineTransfer.used.has(id))).toEqual([]);
  });

  it('rejects a sentence that names an undeclared function', () => {
    scratch = createScratchPack('authored-skills');
    const rows = scratch.read('sentences-passages.tsv').split(/\r?\n/);
    const index = rows.findIndex((row) => row.startsWith('000556\t'));
    const columns = rows[index]!.split('\t');
    columns[11] = 'unknown-function';
    rows[index] = columns.join('\t');
    scratch.write('sentences-passages.tsv', rows.join('\n'));

    const result = scratch.tryBuild();
    expect(result.ok).toBe(false);
    expect(result.output).toContain('unknown authored skill "unknown-function"');
  });
});
