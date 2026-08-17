/**
 * Dataset validation: shape first (zod), then referential integrity across the
 * whole pack. Bad records are reported and skipped rather than crashing a
 * practice session — a dataset with three broken lines is still usable.
 */

import type { z } from 'zod';
import type { ContentPack } from '../../domain/content';
import { RECORD_SCHEMAS, type RecordKind } from './schemas';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  readonly severity: IssueSeverity;
  /** File or logical origin, e.g. `es-a1-core-phrases.jsonl`. */
  readonly source: string;
  /** 1-based line number for JSONL sources. */
  readonly line?: number;
  readonly path?: string;
  readonly message: string;
}

export interface ParseResult<T> {
  readonly records: readonly T[];
  readonly issues: readonly ValidationIssue[];
}

export interface LineRecord {
  readonly line: number;
  readonly value: unknown;
}

/** Validates already-parsed JSON values for one pack file kind. */
export function validateRecords<K extends RecordKind>(
  kind: K,
  values: readonly LineRecord[],
  source: string,
): ParseResult<z.infer<(typeof RECORD_SCHEMAS)[K]>> {
  const schema = RECORD_SCHEMAS[kind];
  const records: z.infer<(typeof RECORD_SCHEMAS)[K]>[] = [];
  const issues: ValidationIssue[] = [];

  for (const { line, value } of values) {
    const result = schema.safeParse(value);
    if (result.success) {
      records.push(result.data as z.infer<(typeof RECORD_SCHEMAS)[K]>);
      continue;
    }
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      issues.push({
        severity: 'error',
        source,
        line,
        message: issue.message,
        ...(path ? { path } : {}),
      });
    }
  }

  return { records, issues };
}

/**
 * Cross-record checks that no single-record schema can express: duplicate IDs,
 * dangling references, translations pointing at nothing, annotations naming
 * tokens that do not exist.
 */
export function validatePackIntegrity(pack: ContentPack): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const source = pack.manifest.id;
  const report = (message: string, severity: IssueSeverity = 'error', path?: string) => {
    issues.push({ severity, source, message, ...(path !== undefined ? { path } : {}) });
  };

  const itemIds = new Set<string>();
  const lexemeIds = new Set(pack.lexemes.map((lexeme) => lexeme.id));
  const skillIds = new Set(pack.skills.map((skill) => skill.id));
  const senseIds = new Set(pack.senses.map((sense) => sense.id));
  const formIds = new Set(pack.verbForms.map((form) => form.id));

  for (const duplicate of duplicates(pack.lexemes.map((lexeme) => lexeme.id))) {
    report(`duplicate lexeme id: ${duplicate}`);
  }
  for (const duplicate of duplicates(pack.skills.map((skill) => skill.id))) {
    report(`duplicate skill id: ${duplicate}`);
  }

  for (const item of pack.items) {
    if (itemIds.has(item.id)) report(`duplicate item id: ${item.id}`, 'error', item.id);
    itemIds.add(item.id);

    if (item.pack !== pack.manifest.id) {
      report(`item ${item.id} declares pack "${item.pack}"`, 'error', item.id);
    }

    for (const lexeme of item.lexemes ?? []) {
      if (!lexemeIds.has(lexeme)) report(`unknown lexeme ${lexeme}`, 'warning', item.id);
    }
    for (const skill of item.skills ?? []) {
      if (!skillIds.has(skill)) report(`unknown skill ${skill}`, 'warning', item.id);
    }

    const tokenIds = new Set((item.tokens ?? []).map((token) => token.id));
    if (item.tokens && tokenIds.size !== item.tokens.length) {
      report(`duplicate token ids in ${item.id}`, 'error', item.id);
    }
    for (const annotation of item.annotations ?? []) {
      for (const token of annotation.tokens) {
        if (!tokenIds.has(token)) {
          report(`annotation references unknown token "${token}"`, 'error', item.id);
        }
      }
      if (annotation.skill && !skillIds.has(annotation.skill)) {
        report(`annotation references unknown skill ${annotation.skill}`, 'warning', item.id);
      }
    }
    for (const token of item.tokens ?? []) {
      if (token.lexeme && !lexemeIds.has(token.lexeme)) {
        report(
          `token "${token.text}" references unknown lexeme ${token.lexeme}`,
          'warning',
          item.id,
        );
      }
    }
  }

  // Example links are checked after all items are known, so order in the file
  // never matters.
  for (const item of pack.items) {
    for (const example of item.examples ?? []) {
      if (!itemIds.has(example)) report(`unknown example item ${example}`, 'warning', item.id);
    }
  }

  for (const sense of pack.senses) {
    if (!lexemeIds.has(sense.lexeme)) {
      report(`sense ${sense.id} references unknown lexeme ${sense.lexeme}`, 'warning', sense.id);
    }
  }
  for (const form of pack.verbForms) {
    if (!lexemeIds.has(form.lexeme)) {
      report(`verb form ${form.id} references unknown lexeme ${form.lexeme}`, 'warning', form.id);
    }
  }

  const known = new Set([...itemIds, ...lexemeIds, ...skillIds, ...senseIds, ...formIds]);
  for (const translation of pack.translations) {
    if (!known.has(translation.ref)) {
      report(
        `translation references unknown entity ${translation.ref}`,
        'warning',
        translation.ref,
      );
    }
  }

  const declaredKinds = new Set(pack.manifest.files.map((file) => file.kind));
  if (!declaredKinds.has('items')) {
    report('manifest declares no items file', 'warning');
  }

  return issues;
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function formatIssue(issue: ValidationIssue): string {
  const location = [
    issue.source,
    issue.line !== undefined ? `:${issue.line}` : '',
    issue.path ? ` (${issue.path})` : '',
  ]
    .join('')
    .trim();
  return `${issue.severity}: ${location} — ${issue.message}`;
}

function duplicates(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}
