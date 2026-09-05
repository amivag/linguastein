/**
 * Stable identity for published content (spec §20).
 *
 * Format: `<namespace>:<kind>:<local>` — e.g. `core-es:item:000001`,
 * `core-es:lexeme:tener`, `core-es:skill:tener-que-infinitive`.
 *
 * IDs are opaque strings at runtime and branded at compile time so that a
 * `LexemeId` can never silently be used where an `ItemId` is expected.
 * Display labels are never identity.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type PackId = Brand<string, 'PackId'>;
export type ItemId = Brand<string, 'ItemId'>;
export type LexemeId = Brand<string, 'LexemeId'>;
export type SenseId = Brand<string, 'SenseId'>;
export type FormId = Brand<string, 'FormId'>;
export type SkillId = Brand<string, 'SkillId'>;
export type PassageId = Brand<string, 'PassageId'>;
export type AudioId = Brand<string, 'AudioId'>;

/** Any entity that can be referenced by a translation, annotation or progress record. */
export type EntityId = ItemId | LexemeId | SenseId | FormId | SkillId | PassageId | AudioId;

export const ENTITY_KINDS = [
  'item',
  'lexeme',
  'sense',
  'form',
  'skill',
  'passage',
  'audio',
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface ParsedEntityId {
  readonly namespace: string;
  readonly kind: EntityKind;
  readonly local: string;
}

const NAMESPACE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL = /^[^\s:]+$/;

export function parseEntityId(id: string): ParsedEntityId | null {
  const parts = id.split(':');
  if (parts.length !== 3) return null;
  const [namespace, kind, local] = parts as [string, string, string];
  if (!NAMESPACE.test(namespace)) return null;
  if (!(ENTITY_KINDS as readonly string[]).includes(kind)) return null;
  if (!LOCAL.test(local)) return null;
  return { namespace, kind: kind as EntityKind, local };
}

export function isEntityId(id: string, kind?: EntityKind): boolean {
  const parsed = parseEntityId(id);
  return parsed !== null && (kind === undefined || parsed.kind === kind);
}

/**
 * Narrows an {@link EntityId} to an {@link ItemId}.
 *
 * A type predicate rather than a second call to {@link isEntityId}, because the
 * callers are the ones that only know what to do with items — `mastery.ts`
 * reading a progress row, a screen resolving a subject to something it can
 * render — and a bare boolean leaves each of them casting. Since
 * `SubjectProgress.subject` widened past `ItemId`, that cast would be in a dozen
 * places, each of them a chance to cast the wrong way.
 */
export function isItemId(id: EntityId): id is ItemId {
  return isEntityId(id, 'item');
}

export function formatEntityId(namespace: string, kind: EntityKind, local: string): string {
  return `${namespace}:${kind}:${local}`;
}

/** The pack an entity belongs to, derived from its namespace. */
export function packIdOf(id: EntityId): PackId | null {
  const parsed = parseEntityId(id);
  return parsed ? (parsed.namespace as PackId) : null;
}
