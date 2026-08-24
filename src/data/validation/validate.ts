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
  const formIds = new Set(pack.forms.map((form) => form.id));

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
  for (const form of pack.forms) {
    if (!lexemeIds.has(form.lexeme)) {
      report(`form ${form.id} references unknown lexeme ${form.lexeme}`, 'warning', form.id);
    }
  }

  const passageIds = new Set<string>();
  for (const passage of pack.passages) {
    if (passageIds.has(passage.id)) {
      report(`duplicate passage id: ${passage.id}`, 'error', passage.id);
    }
    passageIds.add(passage.id);

    if (passage.pack !== pack.manifest.id) {
      report(`passage ${passage.id} declares pack "${passage.pack}"`, 'error', passage.id);
    }
    // A passage the reader cannot follow is worse than no passage: its sentences
    // are the text, so a missing one leaves a hole mid-paragraph.
    for (const item of passage.items) {
      if (!itemIds.has(item)) {
        report(`passage ${passage.id} references unknown item ${item}`, 'error', passage.id);
      }
    }
    if (new Set(passage.items).size !== passage.items.length) {
      report(`passage ${passage.id} lists the same item twice`, 'error', passage.id);
    }
    if (passage.speakers && passage.speakers.length !== passage.items.length) {
      report(
        `passage ${passage.id} has ${passage.speakers.length} speakers for ${passage.items.length} lines`,
        'error',
        passage.id,
      );
    }
    if (passage.kind === 'dialogue' && !passage.speakers) {
      report(`dialogue ${passage.id} names no speakers`, 'warning', passage.id);
    }
  }

  const known = new Set([
    ...itemIds,
    ...lexemeIds,
    ...skillIds,
    ...senseIds,
    ...formIds,
    ...passageIds,
  ]);
  for (const translation of pack.translations) {
    if (!known.has(translation.ref)) {
      report(
        `translation references unknown entity ${translation.ref}`,
        'warning',
        translation.ref,
      );
    }
  }

  const audioIds = new Set<string>();
  const declaredVoices = new Set((pack.manifest.voices ?? []).map((voice) => voice.id));
  for (const clip of pack.audio) {
    if (audioIds.has(clip.id)) report(`duplicate audio id: ${clip.id}`, 'error', clip.id);
    audioIds.add(clip.id);

    if (clip.pack !== pack.manifest.id) {
      report(`audio ${clip.id} declares pack "${clip.pack}"`, 'error', clip.id);
    }
    // A clip for an item that is not here plays for nobody. Only a warning: the
    // audio is useless but everything else in the pack still works.
    if (!itemIds.has(clip.item)) {
      report(`audio ${clip.id} references unknown item ${clip.item}`, 'warning', clip.id);
    }
    // An undeclared voice cannot be credited, licensed or offered in settings,
    // and the licence is the part that matters — see docs/tasks/canonical-audio.md.
    if (declaredVoices.size > 0 && !declaredVoices.has(clip.voice)) {
      report(
        `audio ${clip.id} uses voice "${clip.voice}" the manifest does not declare`,
        'warning',
        clip.id,
      );
    }
  }

  // Two clips of the same words in the same voice and locale means one is stale:
  // a regenerated clip should replace its predecessor, not sit beside it.
  for (const duplicate of duplicates(
    pack.audio.map((clip) => `${clip.item}\t${clip.locale}\t${clip.voice}`),
  )) {
    report(`two clips for the same item, locale and voice: ${duplicate.replaceAll('\t', ' ')}`);
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
/**
 * Checks that hold *between* packs, which no per-pack pass can see.
 *
 * A URL addresses a passage and a skill by their **local** id — `/es/all/read/700001`,
 * `?skill=preterite` — deliberately, so a shared link does not carry a pack
 * namespace it will outlive. `passageByLocalId` and `skillByLocalId` therefore
 * resolve by first match, and both say so in a comment: a route is unambiguous
 * only while local ids are.
 *
 * With one pack that is free. The moment a second is loaded — an add-on to the
 * Spanish A-level content, or a B1 pack — two packs can claim `700001`, and the
 * link silently opens whichever loaded first. That is the worst failure shape
 * available: not an error, not an empty screen, but confidently the wrong text.
 * So the collision is reported where content is validated, rather than waited on.
 *
 * An error rather than a warning, because the alternative to failing here is
 * shipping a link that means two things.
 */
export function validateAcrossPacks(packs: readonly ContentPack[]): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const kinds = [
    { kind: 'passage', of: (pack: ContentPack) => pack.passages.map((entry) => entry.id) },
    { kind: 'skill', of: (pack: ContentPack) => pack.skills.map((entry) => entry.id) },
  ] as const;

  for (const { kind, of } of kinds) {
    const owners = new Map<string, string[]>();
    for (const pack of packs) {
      for (const id of of(pack)) {
        const local = id.slice(id.lastIndexOf(':') + 1);
        const seen = owners.get(local);
        if (seen) seen.push(pack.manifest.id);
        else owners.set(local, [pack.manifest.id]);
      }
    }
    for (const [local, claimants] of owners) {
      // Repeats inside one pack are that pack's own duplicate-id problem, which
      // `validatePackIntegrity` already reports against the pack that has it.
      const across = [...new Set(claimants)];
      if (across.length < 2) continue;
      issues.push({
        severity: 'error',
        source: across.join(' + '),
        message:
          `${kind} local id "${local}" is claimed by ${across.length} packs — a link ` +
          `addressing it by local id would open whichever loaded first`,
        path: local,
      });
    }
  }

  return issues;
}
