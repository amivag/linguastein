#!/usr/bin/env tsx
/**
 * Validates every pack in the catalog against the dataset schemas.
 *
 * Runs in CI and locally (`npm run validate:data`), so a malformed dataset is
 * caught before it ever reaches a learner.
 *
 * Usage: tsx scripts/validate-datasets.ts [dataset-root]
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  formatIssue,
  validateAcrossPacks,
  validateTranslationsAgainst,
} from '../src/data/validation/validate.ts';
import { loadCatalog, loadPack } from '../src/data/loaders/pack.ts';
import { loadTranslationUnit } from '../src/data/loaders/translations.ts';
import type { DatasetSource } from '../src/data/loaders/source.ts';
import type { ContentPack, Translation } from '../src/domain/content/model.ts';

const root = resolve(process.argv[2] ?? 'public/packs');

const fileSource: DatasetSource = {
  name: root,
  read: (path) => readFile(resolve(root, path), 'utf8'),
};

const catalog = await loadCatalog(fileSource);
let errors = 0;
let warnings = 0;
const loaded: ContentPack[] = [];

/*
 * The meanings, gathered before the packs so each pack can be checked with its
 * own.
 *
 * A translation unit is addressed and versioned separately now
 * (`docs/tasks/language-matrix.md` §3), so validating only what `catalog.packs`
 * lists would check every sentence and none of its translations — and the
 * cross-record check that a translation points at a record that exists is one of
 * the few that can catch a build that silently dropped content.
 */
const meanings = new Map<string, Translation[]>();
for (const entry of catalog.translations ?? []) {
  const unit = await loadTranslationUnit(fileSource, entry.manifest);
  const unitErrors = unit.issues.filter((issue) => issue.severity === 'error');
  errors += unitErrors.length;
  warnings += unit.issues.filter((issue) => issue.severity === 'warning').length;

  const held = meanings.get(entry.pack) ?? [];
  held.push(...unit.translations);
  meanings.set(entry.pack, held);

  console.log(
    `
${entry.pack} · ${unit.manifest.referenceLanguage} v${unit.manifest.version} — ` +
      `${unit.translations.length} translations`,
  );
  for (const issue of unit.issues) console.log(`  ${formatIssue(issue)}`);
}

for (const entry of catalog.packs) {
  const { pack: loadedPack, issues: packIssues } = await loadPack(fileSource, entry.manifest);
  // The unit's records folded back in, so every check below reads a pack that is
  // whole in the sense the app's repository is: content and meanings together.
  const pack: ContentPack = {
    ...loadedPack,
    translations: [...loadedPack.translations, ...(meanings.get(entry.id) ?? [])],
  };
  loaded.push(pack);
  /*
   * The dangling-reference check, made where it can now fail: `loadPack` runs it
   * over the pack's own `translations`, which is empty, because the meanings
   * arrived separately and may have been published against a different version
   * of this pack.
   */
  const unitIssues = validateTranslationsAgainst(loadedPack, meanings.get(entry.id) ?? []);
  const issues = [...packIssues, ...unitIssues];
  const packErrors = issues.filter((issue) => issue.severity === 'error');
  const packWarnings = issues.filter((issue) => issue.severity === 'warning');
  errors += packErrors.length;
  warnings += packWarnings.length;

  console.log(
    `\n${pack.manifest.id} v${pack.manifest.version} — ${pack.items.length} items, ` +
      `${pack.lexemes.length} lexemes, ${pack.forms.length} forms, ` +
      `${pack.skills.length} skills, ${pack.passages.length} passages, ` +
      `${pack.translations.length} translations`,
  );
  for (const issue of issues) console.log(`  ${formatIssue(issue)}`);
}

// Between the packs, not inside them: a link addresses a passage and a skill by
// local id, so two packs claiming one is a link that means two things.
const across = validateAcrossPacks(loaded);
errors += across.filter((issue) => issue.severity === 'error').length;
warnings += across.filter((issue) => issue.severity === 'warning').length;
if (across.length > 0) {
  console.log('\nacross packs');
  for (const issue of across) console.log(`  ${formatIssue(issue)}`);
}

console.log(
  `\n${catalog.packs.length} pack(s) checked — ${errors} error(s), ${warnings} warning(s).`,
);
process.exit(errors > 0 ? 1 : 0);
