/** Portable appearance mechanics. No app identity, CSS catalog or DOM imports. */
export interface AppearanceHost {
  readonly document?: { readonly documentElement: { readonly dataset: Record<string, string> } };
  readonly localStorage?: { setItem(key: string, value: string): void };
}
export interface AxisSpec<T extends string> {
  readonly key: string;
  readonly values: readonly T[];
  readonly fallback: T;
  readonly resolvesFromSystem?: boolean;
}
export interface AppearanceAxis<T extends string> extends AxisSpec<T> {
  readonly storageKey: string;
  readonly datasetKey: string;
  readonly is: (value: unknown) => value is T;
  /** Cache the preference while optionally rendering a resolved value (system -> dark). */
  readonly apply: (value: T, renderedValue?: string) => void;
}
export type AxisMetadata = Pick<
  AppearanceAxis<string>,
  'key' | 'storageKey' | 'datasetKey' | 'resolvesFromSystem'
> & {
  readonly values: readonly string[];
  readonly fallback: string;
};
export interface AppearanceOptions {
  readonly namespace: string;
  /** Lazy so importing configuration never reads a browser global. */
  readonly host?: () => AppearanceHost;
}
export function datasetKeyFor(key: string): string {
  return key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
export function createAppearance({
  namespace,
  host = () => globalThis as AppearanceHost,
}: AppearanceOptions) {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(namespace))
    throw new Error('Invalid appearance namespace');
  function defineAxis<T extends string>(spec: AxisSpec<T>): AppearanceAxis<T> {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(spec.key))
      throw new Error('Invalid appearance axis key');
    const values = Object.freeze([...spec.values]);
    if (
      values.length === 0 ||
      new Set(values).size !== values.length ||
      !values.includes(spec.fallback)
    ) {
      throw new Error('An axis needs unique values and a registered fallback');
    }
    const storageKey = `${namespace}.${spec.key}`;
    const datasetKey = datasetKeyFor(spec.key);
    return Object.freeze({
      ...spec,
      values,
      storageKey,
      datasetKey,
      is: (value: unknown): value is T =>
        typeof value === 'string' && (values as readonly string[]).includes(value),
      apply(value: T, renderedValue: string = value) {
        const target = host();
        if (!target.document) return;
        target.document.documentElement.dataset[datasetKey] = renderedValue;
        try {
          // Access can itself throw when browser storage is blocked.
          target.localStorage?.setItem(storageKey, value);
        } catch {
          // Appearance still applies to this session without the pre-paint cache.
        }
      },
    });
  }
  return { defineAxis };
}

export interface PrePaintAxis {
  readonly key: string;
  readonly storageKey: string;
  readonly dataset: string;
  readonly values: readonly string[];
  readonly fallback: string;
  readonly system: boolean;
}
export function serializeAxes(axes: readonly AxisMetadata[]): readonly PrePaintAxis[] {
  const keys = new Set<string>();
  return axes.map((axis) => {
    if (keys.has(axis.key)) throw new Error(`Duplicate appearance axis: ${axis.key}`);
    keys.add(axis.key);
    return {
      key: axis.key,
      storageKey: axis.storageKey,
      dataset: axis.datasetKey,
      values: [...axis.values],
      fallback: axis.fallback,
      system: axis.resolvesFromSystem ?? false,
    };
  });
}
