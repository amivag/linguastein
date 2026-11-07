/**
 * The capability vocabulary is shared, so a second direction cannot fork it.
 *
 * `function` skills are the one part of the curriculum that is not about a
 * language: "Order food or a drink politely" is the same real-world capability
 * in Spanish, English or Greek, and the slug naming it was already neutral.
 * Before this split, the slug, the description and the prerequisite graph all
 * lived in `content/es/skills.tsv` — so `content/en/skills.tsv` would have
 * restated all three, and nothing would have noticed when the two drifted.
 *
 * What is shared is the *capability*, not the skill. Ids stay pack-namespaced,
 * because ordering food in Spanish and ordering food in English are two things
 * to be good at and mastery of one is not evidence of the other. See
 * `docs/tasks/language-matrix.md` §4.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createScratchPack, repoRoot, shippedRecords } from '../fixtures/dataset';

const REGISTRY = 'capabilities.tsv';
const SKILLS = 'skills.tsv';

interface SkillRecord {
  id: string;
  kind: string;
  label: string;
  prerequisites?: string[];
}

interface TranslationRecord {
  ref: string;
  lang: string;
  text: string;
}

const rows = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.startsWith('#'))
    .map((line) => line.split('\t'));

const registry = rows(readFileSync(join(repoRoot, 'content', REGISTRY), 'utf8'));
const spanishSkills = rows(readFileSync(join(repoRoot, 'content/es', SKILLS), 'utf8'));

describe('the shared registry', () => {
  it('holds the neutral half of every authored function', () => {
    const functions = spanishSkills.filter(([, kind]) => kind === 'function');
    expect(functions.length).toBeGreaterThan(0);

    const known = new Set(registry.map(([slug]) => slug));
    for (const [slug] of functions) expect(known).toContain(slug);
  });

  it('keeps no Spanish in it', () => {
    // The description is the capability, not the sentence a learner says, so it
    // must not have picked up target-language text. Spanish is the only language
    // authored today, and its orthography is what a slip would show up as.
    for (const [slug, description] of registry) {
      expect(description, slug).toBeTruthy();
      expect(description, slug).not.toMatch(/[áéíóúñ¿¡«»]/i);
    }
  });

  it('leaves the per-language file with only what is Spanish about a function', () => {
    const description = new Map(registry.map(([slug, text]) => [slug, text]));

    for (const [slug, , , level, gloss] of spanishSkills.filter(
      ([, kind]) => kind === 'function',
    )) {
      expect(level, slug).toBeTruthy();
      // The fifth column is an override and nothing else may follow it. A sixth
      // would mean the neutral half had started growing back here.
      if (gloss === undefined || gloss.length === 0) continue;
      // An override that restates the shared description is the fork returning
      // one row at a time, so it has to say something the default cannot.
      expect(gloss, slug).not.toBe(description.get(slug));
    }
  });

  it('overrides the shared description only where the language is the point', () => {
    const overridden = spanishSkills
      .filter(([, kind]) => kind === 'function')
      .filter((row) => (row[4] ?? '').length > 0);

    // One row of ninety-three, and it is the tag-question one: Spanish can name
    // ¿verdad? where a neutral description can only say "a tag question". If
    // this list grows much, the registry's descriptions are the thing to fix.
    expect(overridden.map(([slug]) => slug)).toEqual(['confirm-with-a-tag']);
  });
});

describe('the shipped pack', () => {
  const skills = shippedRecords<SkillRecord>('skills');
  const translations = shippedRecords<TranslationRecord>('translations-en');

  it('namespaces every capability into the pack, rather than sharing an id', () => {
    const functions = skills.filter((skill) => skill.kind === 'function');
    expect(functions.length).toBeGreaterThan(0);
    for (const skill of functions) expect(skill.id).toMatch(/^core-es:skill:/);
  });

  it('still carries the prerequisite graph the registry declares', () => {
    const declared = new Map(
      registry.map(([slug, , prerequisites]) => [
        slug,
        (prerequisites ?? '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      ]),
    );

    const emitted = skills.filter((skill) => skill.kind === 'function');
    const withPrerequisites = emitted.filter((skill) => skill.prerequisites?.length);
    expect(withPrerequisites.length).toBeGreaterThan(0);

    for (const skill of emitted) {
      const slug = skill.id.split(':')[2]!;
      const expected = (declared.get(slug) ?? []).map((entry) => `core-es:skill:${entry}`);
      expect(skill.prerequisites ?? [], slug).toEqual(expected);
    }
  });

  it('glosses a function with the registry description', () => {
    const gloss = new Map(
      translations
        .filter((translation) => translation.ref.startsWith('core-es:skill:'))
        .map((translation) => [translation.ref, translation.text]),
    );

    const override = new Map(
      spanishSkills
        .filter(([, kind]) => kind === 'function')
        .flatMap((row) => ((row[4] ?? '').length > 0 ? [[row[0]!, row[4]!] as const] : [])),
    );

    for (const [slug, description] of registry) {
      if (slug === undefined) continue;
      const id = `core-es:skill:${slug}`;
      // Only capabilities this pack actually uses are emitted; an unused one
      // having no gloss is correct rather than missing.
      if (!gloss.has(id)) continue;
      // The shared description, unless this language said it better — which is
      // the whole point of the override being a separate column.
      expect(gloss.get(id), slug).toBe(override.get(slug) ?? description);
    }
  });
});

describe('the build gate', () => {
  const pack = createScratchPack('capabilities');
  let pristineRegistry = '';
  let pristineSkills = '';

  beforeAll(() => {
    pristineRegistry = pack.readCapabilities();
    pristineSkills = pack.read(SKILLS);
    expect(pack.tryBuild().ok).toBe(true);
  });
  afterAll(() => pack.dispose());

  // Each case breaks one thing, so each starts from a pack that builds. Without
  // this the later assertions would pass on problems an earlier case left behind.
  beforeEach(() => {
    pack.writeCapabilities(pristineRegistry);
    pack.write(SKILLS, pristineSkills);
  });

  it('rejects a function the registry does not name', () => {
    // What a second language inventing its own vocabulary looks like to the
    // build: a plausible slug, spelled locally, in no shared registry.
    pack.append(SKILLS, 'haggle-over-price\tfunction\tRegatear el precio\ta1');

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('haggle-over-price');
    expect(output).toContain(REGISTRY);
    // The message has to point at the shared file, or the obvious fix is to add
    // a column back here — which is the fork this split exists to prevent.
    expect(output).toContain('shared with every language');
  });

  it('rejects a capability whose prerequisite this language has not authored', () => {
    // A curriculum hole rather than a typo, and it has to be loud: the emitted
    // record would otherwise name a prerequisite id the pack does not contain.
    pack.write(
      SKILLS,
      spanishSkills
        .filter(([slug]) => slug !== 'order-food-drink')
        .map((row) => row.join('\t'))
        .join('\n'),
    );

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('order-food-drink');
    expect(output).toContain('does not cover');
  });

  it('rejects a prerequisite naming a capability that does not exist', () => {
    pack.writeCapabilities(
      `${pack.readCapabilities().trimEnd()}\ntip-the-waiter\tLeave a tip\tsettle-the-bill\n`,
    );

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('unknown capability "settle-the-bill"');
  });

  it('rejects a capability registered twice', () => {
    pack.writeCapabilities(
      `${pack.readCapabilities().trimEnd()}\norder-food-drink\tOrder something to eat\t\n`,
    );

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('"order-food-drink" is registered more than once');
  });

  it('rejects an override that only restates the shared description', () => {
    // Left unchecked, this is how the registry becomes decoration: the column is
    // copied forward by habit until every language owns its own description again.
    pack.append(SKILLS, 'thank-for-help	function	Dar las gracias	a1	Thank someone for their help');

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('the same text');
  });

  it('rejects a capability with no description, since that is what glosses it', () => {
    pack.writeCapabilities(`${pack.readCapabilities().trimEnd()}\nsplit-the-bill\t\t\n`);

    const { ok, output } = pack.tryBuild();
    expect(ok).toBe(false);
    expect(output).toContain('"split-the-bill" has no description');
  });
});
