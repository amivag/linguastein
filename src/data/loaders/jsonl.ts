/**
 * JSONL is the canonical format for large collections of independent records
 * (spec §9). One record per line, blank lines ignored, `#` comments allowed at
 * the start of a line so datasets can carry editorial notes.
 */

import type { LineRecord, ValidationIssue } from '../validation';

export interface JsonlParseResult {
  readonly records: readonly LineRecord[];
  readonly issues: readonly ValidationIssue[];
}

export function parseJsonl(text: string, source: string): JsonlParseResult {
  const records: LineRecord[] = [];
  const issues: ValidationIssue[] = [];

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index] ?? '';
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    try {
      records.push({ line: index + 1, value: JSON.parse(trimmed) });
    } catch (error) {
      issues.push({
        severity: 'error',
        source,
        line: index + 1,
        message: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  return { records, issues };
}

export function stringifyJsonl(records: readonly unknown[]): string {
  return records.map((record) => JSON.stringify(record)).join('\n') + '\n';
}
