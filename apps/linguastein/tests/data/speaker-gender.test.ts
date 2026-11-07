/**
 * The gender a sentence commits its speaker to, as the build derives it.
 *
 * Two failures matter here and they are not symmetric. A **missed** marking
 * costs nothing a learner can see: the sentence goes on being offered to
 * everybody, exactly as it did before this field existed. A **wrong** marking
 * takes content away silently — a sentence about a dining room, filed as a
 * masculine learner's self-description, simply stops being taught to half the
 * learners and nothing on screen says so.
 *
 * So the assertions below are weighted that way: the shipped pack is checked
 * item by item for false positives, and the derivation is checked against the
 * two traps that produce them — the imperfect, where first and third person are
 * spelled the same, and a feminine noun like `persona` that is feminine whoever
 * says it.
 */

import { afterAll, describe, expect, it } from 'vitest';
import type { LearningItem } from '../../src/domain/content';
import { createScratchPack, shippedRecords } from '../fixtures/dataset';

const items = shippedRecords<LearningItem>('sentences');
const marked = items.filter((item) => item.speakerGender);

describe('the shipped pack', () => {
  it('marks only sentences that describe the speaker', () => {
    // Every marked sentence, listed rather than counted: this is the assertion
    // that catches a derivation that got looser, and a diff of the list is the
    // review. A new pair belongs here.
    expect(marked.map((item) => item.text).sort()).toEqual([
      'Como bien, pero estoy muy cansada.',
      'Como bien, pero estoy muy cansado.',
      'Estoy cansada.',
      'Estoy cansado.',
      'Estoy contenta.',
      'Estoy contento.',
      'Estoy dispuesta a trabajar los sábados.',
      'Estoy dispuesto a trabajar los sábados.',
      'Estoy enferma desde ayer.',
      'Estoy enfermo desde ayer.',
      'Estoy muy ocupada esta semana.',
      'Estoy muy ocupado esta semana.',
      'Hoy estoy muy cansada.',
      'Hoy estoy muy cansado.',
      'Hoy termino pronto y estoy contenta.',
      'Hoy termino pronto y estoy contento.',
      'No estoy dispuesta a pagar más.',
      'No estoy dispuesto a pagar más.',
      'No estoy nerviosa.',
      'No estoy nervioso.',
      'Porque estoy muy cansada.',
      'Porque estoy muy cansado.',
      'Soy griega, de Atenas.',
      'Soy griego, de Atenas.',
    ]);
  });

  it('ships both halves of every pair, so neither learner loses a sentence', () => {
    const masculine = marked.filter((item) => item.speakerGender === 'masculine');
    const feminine = marked.filter((item) => item.speakerGender === 'feminine');

    // The reason this is a test rather than a note: the filter is what makes an
    // unpaired sentence invisible, and it goes invisible for exactly the people
    // who cannot see that it is missing.
    expect(masculine).toHaveLength(feminine.length);
    expect(masculine.length).toBeGreaterThan(0);
  });

  it('never marks a line inside a passage, where the speaker is a character', () => {
    const inPassages = new Set(
      shippedRecords<{ items: readonly string[] }>('passages').flatMap((passage) => passage.items),
    );

    // A narrowed passage would lose a line from the middle of a text somebody
    // is reading, which is a worse failure than the one this feature fixes.
    expect(marked.filter((item) => inPassages.has(item.id))).toEqual([]);
  });
});

describe('deriving it', () => {
  const pack = createScratchPack('speaker-gender');
  afterAll(() => pack.dispose());

  const buildWith = (rows: readonly string[]): readonly LearningItem[] => {
    for (const row of rows) pack.append('sentences-core.tsv', row);
    pack.build();
    return pack.records<LearningItem>('sentences');
  };

  it('reads the speaker off an unambiguous first person, and leaves everything else alone', () => {
    const built = buildWith([
      // Derived: `estoy` is first person and nothing else, and `alto` agrees
      // with whoever said it.
      'Estoy alto hoy.\tI am tall today.\ta1\thealth',
      // Not derived: the imperfect is spelled the same in the first and third
      // person, so this says nothing reliable about who is speaking. The linker
      // resolves it to `person: 1` all the same, which is the trap.
      'El vaso estaba lleno.\tThe glass was full.\ta1\thome',
      // Not derived: `tranquila` agrees with `persona`, which is feminine
      // whoever is speaking — marking it would hide the sentence from men.
      'Soy una persona tranquila.\tI am a calm person.\ta1\tfeelings',
      // Not derived: the gendered word is an object, not a description of the
      // speaker.
      'Estoy buscando una camisa blanca.\tI am looking for a white shirt.\ta1\tshopping',
    ]);

    const gender = (text: string) => built.find((item) => item.text === text)?.speakerGender;

    expect(gender('Estoy alto hoy.')).toBe('masculine');
    expect(gender('El vaso estaba lleno.')).toBeUndefined();
    expect(gender('Soy una persona tranquila.')).toBeUndefined();
    expect(gender('Estoy buscando una camisa blanca.')).toBeUndefined();
  });
});

describe('declaring it', () => {
  const pack = createScratchPack('speaker-gender-declared');
  afterAll(() => pack.dispose());

  it('takes the author’s word where the morphology cannot show it', () => {
    // A profession is the case the derivation deliberately gives up on: it stops
    // at a noun, so `Soy profesora` needs the column.
    pack.append(
      'sentences-core.tsv',
      'Soy profesora de música.\tI am a music teacher.\ta1\twork\t\t\t\t\t\t\t\tfeminine',
    );
    pack.build();

    const item = pack
      .records<LearningItem>('sentences')
      .find((entry) => entry.text === 'Soy profesora de música.');

    expect(item?.speakerGender).toBe('feminine');
  });

  it('refuses a value that is not a gender, rather than ignoring it', () => {
    // The column is the escape hatch, so a typo in it would fail silently: the
    // sentence would go on being offered to everyone and nothing would say why.
    pack.append(
      'sentences-core.tsv',
      'Soy vegetariano estricto.\tI am a strict vegetarian.\ta1\tfood-drink\t\t\t\t\t\t\t\tmale',
    );

    const result = pack.tryBuild();

    expect(result.ok).toBe(false);
    expect(result.output).toContain('is not masculine or feminine');
  });
});
