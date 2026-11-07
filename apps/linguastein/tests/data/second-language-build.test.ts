/**
 * The build is a build, not `core-es`'s build.
 *
 * It used to import `conjugate`, `IRREGULAR_VERBS`, `pluralOf`,
 * `adjectiveForms`, `spellCardinal` and `isLetterName` directly and call them
 * unconditionally, so `content/de` could not be built at all: the verb gate
 * would compare German lemmas against a Spanish irregularity table, and the
 * numeral gate would read every `NUM` row as unspellable. Everything
 * language-specific now arrives through `LanguageModule`, loaded by tag.
 *
 * The two "Spanish is not loaded" assertions below are behavioural rather than
 * introspective, which makes them worth more than a module-registry check: the
 * fixture contains a verb Spanish *does* list as irregular and declares it
 * regular, and a `NUM` row Spanish cannot spell. Under the old build each is a
 * hard failure. Passing means the Spanish table was genuinely not consulted.
 *
 * See `docs/tasks/language-matrix.md` and `second-language.md` §2.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJsonl, tryRunScript } from '../fixtures/dataset';
import type { PackManifest } from '../../src/domain/content';

const workspace = mkdtempSync(join(tmpdir(), 'build-de-'));
const content = join(workspace, 'content');
const packs = join(workspace, 'packs');
/**
 * `core-de/<version>/`, because a pack's files live under its version now — an
 * update is a new URL so `CacheFirst` is safe for a 6 MB file
 * (`docs/tasks/language-matrix.md` §5). Resolved from the manifest the same way
 * `loadPack` does, rather than by spelling the version here, so a fixture that
 * bumps its `pack.tsv` does not also have to edit five paths.
 */
const packDir = () => join(packs, 'core-de', '0.1.0');

const write = (name: string, text: string) => writeFileSync(join(content, name), text, 'utf8');

let result: { ok: boolean; output: string };

beforeAll(() => {
  mkdirSync(content, { recursive: true });

  // A pack that uses levels declares the ladder they climb, and the build refuses
  // a level the ladder does not name. CEFR here because the fixture's rows are
  // A1; `non-cefr-ladder.test.ts` is where a ladder that is not CEFR is proven.
  write('levels.tsv', '# Columns: id\tlabel\na1\na2\n');
  write('pack.tsv', '# Columns: version\titems\tupdated\tnote\n0.1.0\t2\t2026-08-25\tfixture\n');
  /*
   * And a version for the meanings, which are their own unit now
   * (`docs/tasks/language-matrix.md` §3). Required rather than defaulted, for the
   * reason `pack.tsv` is: the version is in the *path*, so a unit without one
   * would ship at `0.0.0` and the next build would overwrite it at the same URL —
   * exactly the hazard the versioned path exists to remove.
   */
  write(
    'translations.tsv',
    '# Columns: language\tversion\trecords\tupdated\tnote\nen\t0.1.0\t7\t2026-08-25\tfixture\n',
  );
  write(
    'manifest.tsv',
    '# Columns: key\tvalue\nname\tGerman Core\ndescription\tA fixture.\nglossLanguage\ten\n',
  );

  // `tener` on purpose: Spanish really does list it as irregular, and this row
  // declares it regular. If the Spanish module were loaded for a German build,
  // the consistency gate would fail here. It is not German — a fixture is not a
  // curriculum, and using a lemma Spanish knows is the whole test.
  write(
    'verbs.tsv',
    '# Columns: lemma\tgloss\tlevel\tregularity\ttopics\ntener\tto have\ta1\tregular\t\n',
  );
  write(
    'nouns.tsv',
    '# Columns: lemma\tgloss\tgender\tplural\tlevel\ttopics\tregions\tregister\nHaus\thouse\tm\t\ta1\t\t\t\n',
  );
  // `zwanzig` is a NUM row no Spanish numeral module can read or spell.
  write(
    'modifiers.tsv',
    '# Columns: lemma\tgloss\tpos\tlevel\ttopics\tforms\nzwanzig\ttwenty\tNUM\ta1\t\t\n',
  );
  write(
    'sentences-core.tsv',
    '# Columns: id\ttarget\tgloss\tlevel\ttopics\tnote\tregister\taddress\tregions\tpassage\tspeaker\tskills\n' +
      // No leading tab. The id column is *omitted* on a new row, not left empty —
      // the sentences header says so and this fixture did it anyway, which parsed
      // the gloss as the level and shipped an item with no text. It built for as
      // long as nothing checked a level against a ladder.
      'Das Haus ist alt.\tThe house is old.\ta1\n',
  );

  result = tryRunScript('scripts/build-dataset.ts', {
    args: ['de'],
    env: { LINGUASTEIN_CONTENT_DIR: content, LINGUASTEIN_PACKS_DIR: packs },
  });
});

afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('building a language with no module', () => {
  it('builds at all', () => {
    expect(result.output).toBeDefined();
    expect(result.ok, result.output).toBe(true);
  });

  it('writes core-de from content/de, named and tagged for the language', () => {
    const manifest = JSON.parse(readFileSync(join(packDir(), 'pack.json'), 'utf8')) as PackManifest;

    expect(manifest.id).toBe('core-de');
    expect(manifest.targetLanguage).toBe('de');
    // The base name is authored; the level range is derived and appended.
    expect(manifest.name).toBe('German Core A1');
    // No accents declared, so the bare tag: a pack with no regional accents is
    // still speakable, and the device picks the voice.
    expect(manifest.pronunciationLocales).toEqual(['de']);
    /*
     * And nothing about which languages explain it, because that is no longer a
     * fact about the pack. A translation set is its own addressed, independently
     * versioned unit (`docs/tasks/language-matrix.md` §3), so a `referenceLanguages`
     * field here would be the one thing that still had to be edited — and the pack
     * re-versioned — to add a language, which is the exact cost the split removes.
     * The catalog is where the languages are named; the assertion below is the
     * other half of this one.
     */
    expect(manifest.referenceLanguages).toBeUndefined();
  });

  it('writes its meanings as a unit of their own, versioned apart from the pack', () => {
    const unit = join(packs, 'translations', 'core-de', 'en', '0.1.0');
    const manifest = JSON.parse(readFileSync(join(unit, 'translations.json'), 'utf8')) as {
      pack: string;
      referenceLanguage: string;
      version: string;
      files: readonly { path: string; bytes: number }[];
    };

    expect(manifest.pack).toBe('core-de');
    expect(manifest.referenceLanguage).toBe('en');
    // Its own, from `translations.tsv`, and not the pack's — which happens to be
    // the same string here because the fixture cut both at once. The point is
    // that it was *read* from the other file: `es` ships 0.16.0 for both today
    // and they diverge the first time a gloss is reworded on its own.
    expect(manifest.version).toBe('0.1.0');
    // Priced, so Settings can add it to what keeping the course offline costs.
    expect(manifest.files[0]?.bytes).toBeGreaterThan(0);

    // And the file is not in the pack, which is the whole of the change.
    const packFiles = readdirSync(packDir()).filter((name) => name.endsWith('.jsonl'));
    expect(packFiles.some((name) => name.includes('translations'))).toBe(false);
  });

  it('names its files for its own language and levels', () => {
    const names = readdirSync(packDir()).filter((name) => name.endsWith('.jsonl'));
    expect(names).toContain('de-a1-core-sentences-a1.jsonl');
    expect(names.every((name) => name.startsWith('de-a1-core-'))).toBe(true);
  });

  it('derives only what needs no module, and says nothing it cannot derive', () => {
    const forms = readJsonl<{ form: string; morph: { number?: string } }>(
      join(packDir(), 'de-a1-core-forms-a1.jsonl'),
    );

    // A noun's singular *is* its lemma, so it needs no morphology and ships.
    expect(forms.map((form) => form.form)).toEqual(['Haus']);
    // The plural would have to be derived, and nothing can derive it yet — so
    // there is no plural record rather than a wrong one, and no verb paradigm
    // for `tener` at all.
    expect(forms.some((form) => form.morph.number === 'plural')).toBe(false);

    // A numeral rule is a skill, and the rules come from the module.
    const skills = existsSync(join(packDir(), 'de-a1-core-skills.jsonl'))
      ? readJsonl<{ id: string }>(join(packDir(), 'de-a1-core-skills.jsonl'))
      : [];
    expect(skills.filter((skill) => skill.id.includes('numerals-'))).toEqual([]);
  });

  it('does not consult the Spanish irregularity table', () => {
    // `tener` declared regular. With Spanish loaded this is
    // "declared regular but the language module lists it as irregular".
    expect(result.output).not.toContain('tener');
  });

  it('does not check German numerals against Spanish spellings', () => {
    // With Spanish loaded, `zwanzig` is "tagged NUM but the language module
    // cannot read it". With no module the numeral gates are skipped entirely.
    expect(result.output).not.toContain('zwanzig');
  });

  /**
   * The catalog used to be a literal naming `core-es`, so building any other
   * language would have written a catalog listing only that one — deleting every
   * Spanish course from the app on the next deploy without deleting a file. It
   * now reports the packs actually on disk, which here is only the one built,
   * and in the repository is every language present.
   */
  it('writes a catalog of the packs that are there, not of the one just built', () => {
    const catalog = JSON.parse(readFileSync(join(packs, 'catalog.json'), 'utf8')) as {
      packs: { id: string; version: string; manifest: string }[];
    };

    // The version is in the path, so the catalog carries it too — it is what a
    // fresh install resolves the manifest through, and a deployment may serve
    // more than one release at once.
    expect(catalog.packs).toEqual([
      { id: 'core-de', version: '0.1.0', manifest: 'core-de/0.1.0/pack.json' },
    ]);
    expect(existsSync(join(packs, 'core-es'))).toBe(false);
  });
});
