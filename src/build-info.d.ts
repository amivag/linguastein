/**
 * Build identity, substituted by Vite's `define` (see `vite.config.ts`).
 *
 * Declared as globals rather than imported from anywhere: they do not exist as
 * a module, they are literals inlined at build time. `src/app/version.ts` is the
 * only place that should read them, so the rest of the app has one import to
 * follow and a fallback for environments where the define is absent.
 */

declare const __APP_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_TIME__: string;
