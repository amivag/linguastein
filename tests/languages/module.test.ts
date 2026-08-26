/**
 * The seam every language arrives through, and the loader that keeps them apart.
 *
 * `languageModule` exists so the dataset build can be a build rather than
 * `core-es`'s build. Two properties matter and neither is obvious from reading
 * the interface: a tag with no directory gets a real module with no capabilities
 * rather than an error, and asking for one language must not bring another into
 * memory. See `docs/tasks/language-matrix.md` §6.
 */

import { describe, expect, it } from 'vitest';
import { languageModule } from '../../src/languages';
import { spanish } from '../../src/languages/es';
import { IRREGULAR_VERBS } from '../../src/languages/es/irregulars';

describe('the registry', () => {
  it('loads the module for a tag that has one', async () => {
    await expect(languageModule('es')).resolves.toBe(spanish);
  });

  it('resolves an accent to its language, because an accent is not a grammar', async () => {
    await expect(languageModule('es-MX')).resolves.toBe(spanish);
    await expect(languageModule('es-419')).resolves.toBe(spanish);
  });

  /**
   * Not an error, and that is the design. A language nobody has written
   * morphology for still has sentences worth shipping, and every capability
   * being optional is what lets the build derive nothing without special-casing
   * the absence at each step.
   */
  it('gives a tag with no module an empty one rather than failing', async () => {
    const module = await languageModule('de');

    expect(module.tag).toBe('de');
    expect(module.verbs).toBeUndefined();
    expect(module.nominals).toBeUndefined();
    expect(module.numerals).toBeUndefined();
    expect(module.alphabet).toBeUndefined();
    expect(module.addressForms).toBeUndefined();
  });
});

describe('Spanish as a module', () => {
  it('conjugates through the seam, keeping the level and the region', () => {
    const forms = spanish.verbs!.conjugate('tener');
    const tengo = forms.find((form) => form.form === 'tengo');

    expect(tengo?.morph).toMatchObject({ person: 1, number: 'singular', tense: 'present' });
    expect(tengo?.level).toBe('a1');

    // `vosotros` is Spain's, and the form has to carry that or a Mexican learner
    // is taught a pronoun nobody says to them.
    const vosotros = forms.find((form) => form.form === 'tenéis');
    expect(vosotros?.regions).toEqual(['es-ES']);
  });

  it('reports the irregulars the source column is checked against', () => {
    expect(spanish.verbs!.isDeclaredIrregular('tener')).toBe(true);
    expect(spanish.verbs!.isDeclaredIrregular('hablar')).toBe(false);
    // The same table, so the build's gate and the module cannot disagree.
    expect(Object.keys(IRREGULAR_VERBS)).toContain('tener');
  });

  it('derives plurals and agreement forms', () => {
    expect(spanish.nominals!.pluralOf!('casa')).toBe('casas');

    const forms = spanish.nominals!.adjectiveForms!('alto');
    expect(forms.map((form) => form.form)).toEqual(['alto', 'altos', 'alta', 'altas']);
    // No level: an adjective's agreement inherits the level of the row that
    // declared the adjective, which is why `GeneratedForm.level` is optional.
    expect(forms.every((form) => form.level === undefined)).toBe(true);
  });

  it('pairs every numeral rule with the label its skill is shown under', () => {
    const skills = spanish.numerals!.skills;

    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(skill.rule).toBeTruthy();
      expect(skill.label).toBeTruthy();
      expect(skill.gloss).toBeTruthy();
      expect(skill.level).toMatch(/^[abc][12]$/);
    }
    expect(skills.map((skill) => skill.rule)).toContain('teens');
  });

  it('spells and reads numerals, and shortens an ordinal before a noun', () => {
    expect(spanish.numerals!.spellCardinal(16)).toBe('dieciséis');
    expect(spanish.numerals!.parseCardinal('dieciséis')).toBe(16);
    expect(spanish.numerals!.parseCardinal('sixteen')).toBeNull();

    expect(spanish.numerals!.spellOrdinal(1)).toBe('primero');
    expect(spanish.numerals!.spellOrdinal(1, { beforeNoun: true })).toBe('primer');
    expect(spanish.numerals!.parseOrdinal('primero')).toBe(1);
  });

  it('knows a letter name from an ordinary word', () => {
    expect(spanish.alphabet!.isLetterName('eñe')).toBe(true);
    expect(spanish.alphabet!.isLetterName('casa')).toBe(false);
  });

  it('declares its address forms with both halves of each one', () => {
    // The label a learner reads and the neutral pair the build reasons with, in
    // one row. They were in three places before — `UsageBadges`, the domain enum
    // and the build's own `COMMAND_AUDIENCE` — and only one of them listed the
    // forms, so `vosotros` could have had a region and no label or the reverse.
    const forms = spanish.addressForms!;
    expect(forms.map((form) => form.id)).toEqual(['tu', 'usted', 'vosotros', 'ustedes']);
    for (const form of forms) {
      expect(form.label).toBeTruthy();
      expect(form.title).toBeTruthy();
      expect(form.number).toBeTruthy();
      expect(form.formality).toBeTruthy();
    }
  });

  it('narrows only the address form that is regional', () => {
    const regionsOf = (id: string) =>
      spanish.addressForms!.find((form) => form.id === id)?.regions ?? [];

    expect(regionsOf('vosotros')).toEqual(['es-ES']);
    expect(regionsOf('ustedes')).toEqual([]);
    expect(regionsOf('')).toEqual([]);
  });
});
