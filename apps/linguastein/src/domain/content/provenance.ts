/**
 * Where a piece of content came from (spec §18.1, §19, §20.1).
 *
 * Imported dictionary data, community submissions and AI-generated material
 * must always stay distinguishable from reviewed editorial curriculum.
 */

export const PROVENANCE_SOURCES = ['editorial', 'community', 'imported', 'generated'] as const;
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

export const REVIEW_STATES = ['unreviewed', 'reviewed', 'deprecated'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export interface Provenance {
  readonly source: ProvenanceSource;
  /** Upstream dataset or model, e.g. `wikidata-lexemes`, `tatoeba`. */
  readonly origin?: string;
  readonly license?: string;
  readonly review?: ReviewState;
  /** Monotonic revision of this entity; identity stays stable across revisions. */
  readonly revision?: number;
  /** Set when an item is superseded by a materially different learning object. */
  readonly replacedBy?: string;
}

export const DEFAULT_PROVENANCE: Provenance = { source: 'editorial', review: 'unreviewed' };

export function isCanonical(provenance: Provenance | undefined): boolean {
  return provenance === undefined || provenance.source === 'editorial';
}
