/**
 * Which build of the app this is.
 *
 * Three facts, because a version alone does not identify a build: `0.1.0` is
 * every build between two releases, and the question behind "what version are
 * you on?" is usually "do you have the fix?". The commit answers that; the build
 * time answers "is this deploy actually live, or is a stale cache serving you?".
 *
 * Values come from `define` in `vite.config.ts`. The `typeof` guards are for
 * anything that loads these modules without that substitution, where a thrown
 * `ReferenceError` at import time would take the whole app down over a label.
 */

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';
export const BUILD_COMMIT = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'unknown';
export const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

/**
 * `0.1.0 (a1b2c3d)` — the string a bug report should quote, and short enough
 * that someone will actually copy it. The commit is dropped rather than shown as
 * "unknown", which tells a reader nothing they can act on.
 */
export function buildLabel(): string {
  return BUILD_COMMIT === 'unknown' ? APP_VERSION : `${APP_VERSION} (${BUILD_COMMIT})`;
}

/**
 * An ISO build stamp as `18 August 2026`, or `''` when it is missing or
 * unparseable — a broken stamp should read as "unknown", not as `Invalid Date`.
 *
 * Day precision on purpose: the minute a build was cut is noise to a learner, and
 * the date is enough to tell a fortnight-old cache from today's deploy. Split
 * from {@link buildDate} so the formatting is testable without rebuilding.
 */
export function formatBuildDate(iso: string, locale = 'en-GB'): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The date this build was produced, or `''` if it did not record one. */
export function buildDate(locale?: string): string {
  return formatBuildDate(BUILD_TIME, locale);
}
