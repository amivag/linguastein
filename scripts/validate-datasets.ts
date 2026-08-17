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
import { formatIssue } from '../src/data/validation/validate.ts';
import { loadCatalog, loadPack } from '../src/data/loaders/pack.ts';
import type { DatasetSource } from '../src/data/loaders/source.ts';

const root = resolve(process.argv[2] ?? 'public/packs');

const fileSource: DatasetSource = {
  name: root,
  read: (path) => readFile(resolve(root, path), 'utf8'),
};

const catalog = await loadCatalog(fileSource);
let errors = 0;
let warnings = 0;

for (const entry of catalog.packs) {
  const { pack, issues } = await loadPack(fileSource, entry.manifest);
  const packErrors = issues.filter((issue) => issue.severity === 'error');
  const packWarnings = issues.filter((issue) => issue.severity === 'warning');
  errors += packErrors.length;
  warnings += packWarnings.length;

  console.log(
    `\n${pack.manifest.id} v${pack.manifest.version} — ${pack.items.length} items, ` +
      `${pack.lexemes.length} lexemes, ${pack.verbForms.length} forms, ` +
      `${pack.skills.length} skills, ${pack.passages.length} passages, ` +
      `${pack.translations.length} translations`,
  );
  for (const issue of issues) console.log(`  ${formatIssue(issue)}`);
}

console.log(
  `\n${catalog.packs.length} pack(s) checked — ${errors} error(s), ${warnings} warning(s).`,
);
process.exit(errors > 0 ? 1 : 0);
