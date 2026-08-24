/**
 * The appearance axis: one mechanism, five uses.
 *
 * Every axis that decides how the app looks does the same five things — name a
 * closed set of values, name a default, validate a stored string, write the choice
 * onto the root element, and mirror it to `localStorage` so the pre-paint script
 * can restore it without a flash. Those five were written out five times, once per
 * axis, with five copies of the same `try`/`catch` around a storage write and five
 * chances for one of them to spell its dataset key differently from the CSS that
 * reads it.
 *
 * This is that shape, once. An axis is now a declaration:
 *
 * ```ts
 * export const CONTRAST = defineAxis({
 *   key: 'contrast',
 *   values: ['soft', 'normal', 'more', 'max'],
 *   fallback: 'normal',
 * });
 * ```
 *
 * and `CONTRAST.apply(level)`, `CONTRAST.is(value)` and `CONTRAST.storageKey`
 * come with it.
 *
 * ## Why this file is worth having
 *
 * Three reasons, in the order they matter:
 *
 * 1. **A new axis costs a declaration.** Adding the intensity axis to this app
 *    meant a registry file, a storage key, a validator, an `apply`, an entry in
 *    the pre-paint script and a line in a test that lists them — six places, five
 *    of which were copies of something. That is the tax that stops an axis being
 *    added, and it is now one.
 * 2. **The pre-paint duplication is gone.** `index.html` cannot import
 *    TypeScript, so its script used to repeat every axis's values as literal
 *    arrays, with a test comparing the two lists to catch the drift. The
 *    registry below is injected into the HTML at build time — the same mechanism
 *    `identity.ts` already uses for the app id — so there is nothing left to
 *    drift and nothing left to police.
 * 3. **It is app-agnostic.** This module knows nothing about palettes, contrast
 *    or Spanish. An app scaffolded from this skeleton keeps the mechanism and
 *    replaces the declarations, which is the split `docs/skeleton.md` is built
 *    around.
 *
 * ## What it deliberately does not do
 *
 * It does not own **labels**. Which axes a picker shows, in what order, under what
 * wording, is a product decision that belongs beside the picker — an axis here
 * carries only what the machine needs. And it does not own **resolution**: the
 * theme axis turns `system` into `light` or `dark` against an OS media query, and
 * that is one axis's special case rather than a generalisation worth building for
 * the other four. It is declared as a flag (`resolvesFromSystem`) so the pre-paint
 * script can honour it without hard-coding the word "theme".
 *
 * ## Why it does not assume a browser
 *
 * `vite.config.ts` reads the axis registry at build time to generate the
 * pre-paint script, and the config project compiles with `lib: ["ES2023"]` — no
 * DOM — precisely so that config code cannot reach for the document. That guard
 * is worth keeping, so this module reaches the document through `globalThis`
 * rather than assuming it is there.
 *
 * The result is not a workaround but the more correct shape: an appearance axis is
 * a *value* with a closed set and a default, and only one of the things it does
 * needs a document. Outside a browser — the config, a build script, a node test —
 * `apply` becomes a no-op instead of a crash, and everything else keeps working.
 * A skeleton whose theming layer only compiles inside a browser is a skeleton that
 * cannot be read by its own build.
 */

import { storageKey } from '../app/identity';

/**
 * The document and storage, as much of them as an axis needs, and optional.
 *
 * Declared structurally rather than imported from the DOM lib so this module
 * compiles in both TypeScript projects — see the note above. It is narrow on
 * purpose: widening it to the real `Document` would let the next edit reach for
 * something that genuinely does need a browser.
 */
interface AppearanceHost {
  readonly document?: { readonly documentElement: { readonly dataset: Record<string, string> } };
  readonly localStorage?: { setItem: (key: string, value: string) => void };
}

const host = (): AppearanceHost => globalThis as AppearanceHost;

export interface AxisSpec<T extends string> {
  /**
   * The axis's name, used for three things at once: the `localStorage` key
   * (namespaced by the app id), the `data-*` attribute, and the label in the
   * pre-paint script.
   *
   * One name rather than three fields, because they were never allowed to differ
   * — and when they are separate fields, one day they do.
   */
  readonly key: string;
  readonly values: readonly T[];
  readonly fallback: T;
  /**
   * Whether an OS preference can decide this axis's value, as `system` does for
   * light and dark.
   *
   * A flag rather than a resolver function, because the resolution differs per
   * axis and the *pre-paint script* has to perform it in plain ES5 before any
   * module loads. This tells it which axis to ask the media query about; the
   * in-app resolution lives with the axis that needs it.
   */
  readonly resolvesFromSystem?: boolean;
}

export interface AppearanceAxis<T extends string> extends AxisSpec<T> {
  /** `linguastein.palette` — namespaced, because an origin is shared. */
  readonly storageKey: string;
  /** `readingSize` for `data-reading-size`, i.e. the `dataset` spelling. */
  readonly datasetKey: string;
  readonly is: (value: unknown) => value is T;
  readonly apply: (value: T) => void;
}

/**
 * An axis with its value type erased: everything a registry needs, and nothing
 * that varies with `T`.
 *
 * The list in `axes.ts` holds five axes with five different value unions, and
 * `AppearanceAxis<PaletteId>` is *not* assignable to `AppearanceAxis<string>` —
 * `apply` and `is` take `T` as a parameter, so they are contravariant and a
 * `readonly AppearanceAxis<string>[]` would let a caller pass a contrast level to
 * the palette axis. Narrowing the registry to the covariant half is the honest
 * fix: the registry exists to enumerate and serialise axes, not to apply them.
 */
export type AxisMetadata = Pick<
  AppearanceAxis<string>,
  'key' | 'storageKey' | 'datasetKey' | 'resolvesFromSystem'
> & {
  readonly values: readonly string[];
  readonly fallback: string;
};

/** `reading-size` → `readingSize`, which is how `dataset` spells it. */
export function datasetKeyFor(key: string): string {
  return key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function defineAxis<T extends string>(spec: AxisSpec<T>): AppearanceAxis<T> {
  const key = storageKey(spec.key);
  const datasetKey = datasetKeyFor(spec.key);

  return {
    ...spec,
    storageKey: key,
    datasetKey,
    is: (value: unknown): value is T =>
      typeof value === 'string' && (spec.values as readonly string[]).includes(value),
    /**
     * Writes the value to the root and caches it.
     *
     * The default is written out like any other value even though no stylesheet
     * matches it: a missing attribute and an explicit default then mean the same
     * thing, which is what lets a preview swatch be handed a value without a
     * special case. IndexedDB stays the source of truth for preferences — this is
     * a cache, and a browser that refuses it costs a learner one flash on the next
     * load rather than their choice.
     */
    apply: (value: T) => {
      const { document, localStorage } = host();
      // No document is not an error: this module is read by the build, where
      // applying an axis is meaningless and crashing would be a build failure.
      if (!document) return;
      document.documentElement.dataset[datasetKey] = value;
      try {
        localStorage?.setItem(key, value);
      } catch {
        // Private browsing can refuse storage; the choice still applies this session.
      }
    },
  };
}
