/**
 * How the subjunctive lands in the shipped pack.
 *
 * The conjugator's own paradigms are checked in
 * `tests/languages/conjugation.test.ts`. What is checked here is everything the
 * *dataset* has to get right once those forms exist, because generating a second
 * paradigm that shares `tense: 'present'` with the first turned out to change
 * the meaning of three things that were already correct — and each of the three
 * shipped wrong once before it was noticed.
 */

import { describe, expect, it } from 'vitest';
import { packFiles, readJsonl, repoRoot } from '../fixtures/dataset';
import { join } from 'node:path';

interface Token {
  readonly text: string;
  readonly lemma?: string;
  readonly pos?: string;
  readonly morph?: Readonly<Record<string, unknown>>;
}

interface Item {
  readonly id: string;
  readonly text: string;
  readonly level?: string;
  readonly address?: string;
  readonly skills?: readonly string[];
  readonly tokens?: readonly Token[];
}

interface Form {
  readonly id: string;
  readonly form: string;
  readonly level: string;
  readonly morph: Readonly<Record<string, unknown>>;
}

const PACKS = join(repoRoot, 'public/packs');
const items = packFiles(PACKS, 'sentences').flatMap((path) => readJsonl<Item>(path));
const forms = packFiles(PACKS, 'forms').flatMap((path) => readJsonl<Form>(path));

const byText = (text: string): Item => {
  const found = items.find((item) => item.text === text);
  if (!found) throw new Error(`no shipped sentence "${text}"`);
  return found;
};

const skillsOf = (text: string) =>
  (byText(text).skills ?? []).map((skill) => skill.split(':').pop());

const tokenFor = (text: string, word: string) =>
  byText(text).tokens?.find((token) => token.text.toLowerCase() === word.toLowerCase());

describe('subjunctive forms in the pack', () => {
  it('ship at b1, with mood carried beside the tense', () => {
    const subjunctive = forms.filter((form) => form.morph['mood'] === 'subjunctive');
    expect(subjunctive.length).toBeGreaterThan(600);
    expect(subjunctive.every((form) => form.level === 'b1')).toBe(true);
    // Not a seventh tense: it is the present, in another mood.
    expect(subjunctive.every((form) => form.morph['tense'] === 'present')).toBe(true);
  });

  it('never share a form id with the indicative', () => {
    // The collision this guards is silent: two forms with one id means the
    // second overwrites the first, and `hablo`/`hable` are the pair that would
    // have done it.
    const ids = forms.map((form) => form.id);
    expect(new Set(ids).size).toBe(ids.length);

    const hablar = forms.filter((form) => form.id.includes('hablar-') && form.form === 'hable');
    expect(hablar.length).toBeGreaterThan(0);
    expect(forms.find((form) => form.form === 'hablo')?.id).not.toBe(hablar[0]?.id);
  });
});

describe('a subjunctive sentence', () => {
  it('is filed under the subjunctive, not the present indicative', () => {
    /*
     * The form carries `tense: 'present'`, so a skill loop reading tense before
     * mood labels the whole level `presente de indicativo`.
     *
     * Checked on a sentence whose *only* finite verb is subjunctive, which is
     * rarer than it sounds — a trigger is usually an indicative verb, so
     * `Dudo que sea…` is honestly both and proves nothing here. `Ojalá` is the
     * trigger that is not a verb.
     */
    expect(skillsOf('Ojalá no llueva mañana.')).toContain('present-subjunctive');
    expect(skillsOf('Ojalá no llueva mañana.')).not.toContain('present-indicative');
  });

  it('keeps the indicative skill where the sentence has both', () => {
    // `Espero` is indicative and `sea` is not; a sentence with a main clause and
    // a subordinate one is honestly both.
    const skills = skillsOf('Espero que no sea nada grave.');
    expect(skills).toContain('present-indicative');
    expect(skills).toContain('present-subjunctive');
  });
});

describe('what the subjunctive must not take over', () => {
  it('leaves `entre` as the preposition', () => {
    /*
     * `entre` is the preposition and `entrar`'s subjunctive both. Generating the
     * mood made a word that had never been ambiguous ambiguous, and `ADP`
     * survives neither branch of `disambiguate` — so the preposition lost every
     * sentence it had, and the A2 recycling ratchet is what caught it.
     */
    const uses = items.flatMap((item) =>
      (item.tokens ?? []).filter((token) => token.text.toLowerCase() === 'entre'),
    );
    expect(uses.length).toBeGreaterThan(3);
    expect(uses.every((token) => token.lemma === 'entre')).toBe(true);
  });

  it('does not turn a verb into a command addressed to nobody', () => {
    /*
     * A usted command is indexed wherever no *other* lexeme claims the surface,
     * so `salga` is `salir`'s command and its subjunctive at once. Preferring the
     * non-subjunctive reading — right for `entre`, where a second lexeme is at
     * stake — picked the command here, and `Ojalá que todo salga bien` shipped
     * marked `usted` with nobody in it to address.
     */
    const sentence = byText('Ojalá que todo salga bien.');
    expect(sentence.address).toBeUndefined();
    expect(tokenFor(sentence.text, 'salga')?.morph?.['mood']).toBe('subjunctive');
    expect(skillsOf(sentence.text)).not.toContain('imperative');
  });
});

describe('the negative command', () => {
  it('is recognised where one is actually given', () => {
    expect(skillsOf('No te preocupes por la factura.')).toContain('negative-command');
    expect(skillsOf('No firmes nada que no entiendas.')).toContain('negative-command');
  });

  it('is not `no` plus a subjunctive wherever that appears', () => {
    // `Ojalá no llueva mañana` and `Espero que no sea nada grave` are the same
    // two words in the same order and neither orders anybody about. The first
    // shipped tagged as a command.
    expect(skillsOf('Ojalá no llueva mañana.')).not.toContain('negative-command');
    expect(skillsOf('Espero que no sea nada grave.')).not.toContain('negative-command');
  });

  it('reaches past the pronouns that sit between', () => {
    // `No te quejes`: before a finite verb the pronoun is its own word.
    expect(skillsOf('No te quejes sin proponer una solución.')).toContain('negative-command');
  });
});
