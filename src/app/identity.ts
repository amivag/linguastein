/**
 * Who this app is — in one place, because it used to be in eleven.
 *
 * The name, the machine id and the base path were written out across
 * `vite.config.ts`, `index.html`, `package.json`, the IndexedDB module, the theme
 * registry, `AppShell`, Settings, the share sheet and two build scripts: 36
 * occurrences of a string that is *the same decision*. Starting a second app from
 * this skeleton meant a find-and-replace across all of them, and the failure mode
 * of a find-and-replace is doing 90% of it — an IndexedDB still named after the
 * old app, a `localStorage` key that collides with it on the same origin.
 *
 * So this module is the edit. Everything downstream derives.
 *
 * It is deliberately plain data with no imports: `vite.config.ts` reads it at
 * build time to set the base path and the manifest, and a config file cannot
 * import anything that touches the DOM.
 */

export const APP = {
  /**
   * Machine name. Lower case, no spaces — it becomes the IndexedDB database, the
   * `localStorage` key prefix and the service worker's cache names.
   *
   * Changing it on a deployed app orphans every learner's stored state, which is
   * a migration rather than a rename. Choose it once.
   */
  id: 'linguastein',

  /** What a person sees: document titles, the share sheet, the install prompt. */
  name: 'Linguastein',

  /** The half of the name that says what the app is *for*. */
  tagline: 'Spanish Practice',

  /**
   * Where the app is served from.
   *
   * A project page (`user.github.io/<repo>/`) rather than a domain root, so every
   * absolute path the build emits has to carry it: Vite's `base`, the manifest's
   * `start_url`, `scope` and icons, and the router's basename by way of
   * `import.meta.env.BASE_URL`. Set in development too, so a base-path mistake
   * shows up locally rather than only once deployed.
   *
   * A leading and trailing slash are both required.
   */
  basePath: '/linguastein/',
} as const;

/** `Browse · Linguastein` — the one spelling of a document title. */
export function documentTitle(screen: string): string {
  return `${screen} · ${APP.name}`;
}

/**
 * A namespaced key for `localStorage` or a cache.
 *
 * Namespaced because a browser origin is shared: two apps from this skeleton
 * deployed under one domain would otherwise fight over `theme`.
 */
export function storageKey(name: string): string {
  return `${APP.id}.${name}`;
}

/**
 * `linguastein-packs` — the one spelling of a runtime cache's name.
 *
 * Two files have to agree on it exactly: `vite.config.ts` declares the cache a
 * Workbox strategy writes into, and `src/app/offline.ts` opens the same one to
 * put a pack there or take it away. A typo would not fail anything — it would
 * quietly give the app a second, empty cache and a Settings screen reporting
 * that nothing is kept while the worker serves everything from the other one.
 */
export function cacheName(name: string): string {
  return `${APP.id}-${name}`;
}
