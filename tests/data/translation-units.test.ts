/**
 * Meanings as their own addressed, independently versioned unit.
 *
 * `docs/tasks/language-matrix.md` §3 calls this the pivot decision of the whole
 * brief, and the reason is arithmetic: while a translation set is a file *inside*
 * a pack's manifest, adding a reference language edits that manifest, which
 * re-versions the pack, which changes every one of its file URLs — so giving
 * Chinese speakers a Spanish course costs every existing learner a 6.4 MB
 * re-download of Spanish that did not change. Keyed `(pack, referenceLanguage)`
 * and versioned separately, the matrix is additive.
 *
 * The assertions below are that claim taken apart. The pack must not mention the
 * unit anywhere — not in `files`, not in `referenceLanguages` — because anything
 * it mentions is something that has to be edited to add a language. The catalog
 * must mention it, because something has to. And the two versions must be able
 * to move independently, which is the one property a test can check directly:
 * bump the meanings, and the pack is byte-identical.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createScratchPack,
  readJsonl,
  translationUnitPath,
  type ScratchPack,
} from '../fixtures/dataset';
import { memoryDatasetSource, loadTranslationUnit } from '../../src/data/loaders';
import type { PackManifest, Translation } from '../../src/domain/content';

let pack: ScratchPack;

beforeAll(() => {
  pack = createScratchPack('translation-units');
  pack.build();
});

afterAll(() => pack.dispose());

const manifest = () =>
  JSON.parse(
    readFileSync(join(pack.packs, 'core-es', packVersion(), 'pack.json'), 'utf8'),
  ) as PackManifest;

const packVersion = () =>
  readdirSync(join(pack.packs, 'core-es')).find((name) =>
    existsSync(join(pack.packs, 'core-es', name, 'pack.json')),
  )!;

const catalog = () =>
  JSON.parse(readFileSync(join(pack.packs, 'catalog.json'), 'utf8')) as {
    packs: readonly { id: string; version: string; manifest: string }[];
    translations?: readonly { pack: string; language: string; version: string; manifest: string }[];
  };

describe('a pack and its meanings', () => {
  it('leaves the meanings out of the pack entirely', () => {
    const files = manifest().files;

    expect(files.some((file) => file.kind === 'translations')).toBe(false);
    expect(files.some((file) => file.path.includes('translations'))).toBe(false);
    /*
     * And the field that named the languages is gone too, which is the half that
     * is easy to miss: a pack could ship no translation *file* and still have to
     * be re-versioned to add a language, if its manifest went on listing which
     * languages explained it. The picker reads the catalog and the index instead
     * (`referenceLanguages` in `src/domain/content/packs.ts`).
     */
    expect(manifest().referenceLanguages).toBeUndefined();

    const dir = join(pack.packs, 'core-es', packVersion());
    expect(readdirSync(dir).filter((name) => name.includes('translations'))).toEqual([]);
  });

  it('addresses the unit by the pack, the language and its own version', () => {
    const path = translationUnitPath(pack.packs, 'en');
    const unit = JSON.parse(readFileSync(join(pack.packs, path), 'utf8')) as {
      pack: string;
      referenceLanguage: string;
      version: string;
      files: readonly { kind: string; path: string; bytes: number }[];
    };

    expect(path.replace(/\\/g, '/')).toMatch(
      /^translations\/core-es\/en\/\d+\.\d+\.\d+\/translations\.json$/,
    );
    expect(unit.pack).toBe('core-es');
    expect(unit.referenceLanguage).toBe('en');
    // Priced, so Settings → Packs can add the meanings to what keeping the
    // course offline costs. A pack held without them opens offline and cannot
    // explain a single word.
    expect(unit.files[0]?.bytes).toBeGreaterThan(0);
    expect(unit.files.every((file) => file.kind === 'translations')).toBe(true);
  });

  it('names the unit in the catalog, which is the only unversioned file there is', () => {
    const listed = catalog().translations ?? [];

    expect(listed).toHaveLength(1);
    expect(listed[0]?.pack).toBe('core-es');
    expect(listed[0]?.language).toBe('en');
    /*
     * The whole mechanism in one assertion. The catalog is fetched fresh on every
     * load and is the one file with no version in its path, so it is the only
     * place that can name a unit published *after* the pack it explains — which
     * is what "add Chinese without touching German" actually requires.
     */
    expect(listed[0]?.manifest.replace(/\\/g, '/')).toBe(
      translationUnitPath(pack.packs, 'en').replace(/\\/g, '/'),
    );
  });
});

describe('versioning the meanings apart from the pack', () => {
  it('moves the unit and leaves every pack file exactly where it was', () => {
    const before = {
      version: packVersion(),
      files: readdirSync(join(pack.packs, 'core-es', packVersion())).sort(),
      manifest: readFileSync(join(pack.packs, 'core-es', packVersion(), 'pack.json'), 'utf8'),
    };
    const records = readJsonl<Translation>(
      join(
        pack.packs,
        translationUnitPath(pack.packs, 'en').replace(/translations\.json$/, ''),
        JSON.parse(readFileSync(join(pack.packs, translationUnitPath(pack.packs, 'en')), 'utf8'))
          .files[0].path,
      ),
    ).length;

    // A reworded gloss: same records, new version. The count guard is what makes
    // this the *only* edit needed, and what would fail if it were not.
    pack.write(
      'translations.tsv',
      `# Columns: language\tversion\trecords\tupdated\tnote\nen\t9.9.9\t${records}\t2026-08-30\tbumped\n`,
    );
    pack.build();

    // The meanings moved.
    expect(translationUnitPath(pack.packs, 'en').replace(/\\/g, '/')).toContain('/en/9.9.9/');
    expect(catalog().translations?.[0]?.version).toBe('9.9.9');

    /*
     * And the pack did not — same version, same files, byte-identical manifest.
     * This is the property the whole change exists for: every installed learner's
     * pack URLs still resolve and nothing re-downloads, because from the pack's
     * point of view nothing happened.
     */
    expect(packVersion()).toBe(before.version);
    expect(readdirSync(join(pack.packs, 'core-es', before.version)).sort()).toEqual(before.files);
    expect(readFileSync(join(pack.packs, 'core-es', before.version, 'pack.json'), 'utf8')).toBe(
      before.manifest,
    );

    // One version of the unit in the artifact, for the reason there is one of the
    // pack: two are harmless to correctness and both would be precached.
    expect(readdirSync(join(pack.packs, 'translations', 'core-es', 'en'))).toEqual(['9.9.9']);
  });
});

describe('what the build refuses', () => {
  it('refuses meanings with no authored version, because the version is the path', () => {
    pack.write('translations.tsv', '# Columns: language\tversion\trecords\tupdated\tnote\n');
    const result = pack.tryBuild();

    expect(result.ok).toBe(false);
    expect(result.output).toContain('no row for "en"');
  });

  it('refuses a row for a language nothing is written in', () => {
    pack.write(
      'translations.tsv',
      '# Columns: language\tversion\trecords\tupdated\tnote\n' +
        'en\t0.16.0\t5013\t2026-08-30\tfine\n' +
        'zh\t1.0.0\t0\t2026-08-30\tno such glosses\n',
    );
    const result = pack.tryBuild();

    expect(result.ok).toBe(false);
    expect(result.output).toContain('a row for "zh" but no translation records are in it');
  });
});

describe('loading a unit', () => {
  /**
   * The unit is addressed by its language and each record repeats it in a field,
   * and the repository indexes by the field.
   *
   * So a mis-built unit is invisible rather than broken: a German gloss filed
   * under `en/` is fetched by a learner who asked for English and then indexed as
   * German — present in the download, absent from the screen, and counted in
   * neither language's total. Worth a check precisely because nothing downstream
   * can notice it.
   */
  it('reports records that are not in the language the unit is addressed by', async () => {
    const source = memoryDatasetSource({
      'translations.json': JSON.stringify({
        pack: 'core-es',
        referenceLanguage: 'en',
        version: '1.0.0',
        files: [{ kind: 'translations', path: 'meanings.jsonl' }],
      }),
      'meanings.jsonl': [
        JSON.stringify({ ref: 'core-es:item:000001', lang: 'en', text: 'the house' }),
        JSON.stringify({ ref: 'core-es:item:000002', lang: 'de', text: 'das Haus' }),
      ].join('\n'),
    });

    const unit = await loadTranslationUnit(source, 'translations.json');

    expect(unit.translations).toHaveLength(2);
    expect(unit.issues.map((issue) => issue.message)).toEqual([
      expect.stringContaining('1 translation(s) are not in en'),
    ]);
  });
});
