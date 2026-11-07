import type { Rng } from './random';

/** Target generation and durable curriculum, independent of response modality. */
export interface DrillMaterial<Target> {
  /** Stable rule keys in teaching order; the app resolves them to dataset-owned ids. */
  readonly rules: readonly string[];
  sampleFor(rule: string, rng: Rng): Target;
  /** Evidence belongs to these rules, never to an invented id for a generated target. */
  rulesFor(target: Target): readonly string[];
}
