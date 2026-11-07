/**
 * Where this build is going, read from the environment.
 *
 * The defaults reproduce today's GitHub Pages build exactly, so an unset
 * environment changes nothing. Moving hosts is a matter of setting these in the
 * deploy workflow (see `docs/deploy.md`, "Switching hosts"), not of editing code:
 *
 * - `DEPLOY_TARGET`: `github-pages` (default) or `cloudflare`. Cloudflare builds
 *   also emit `_headers`, carrying the security headers Pages cannot send.
 * - `APP_BASE_PATH`: overrides `APP.basePath`. A subdomain per app serves from `/`.
 * - `APP_MOVED_TO`: the app's new address. When set, the build tells learners the
 *   app has moved and how to bring their data along.
 */

export const DEPLOY_TARGETS = ['github-pages', 'cloudflare'] as const;
export type DeployTarget = (typeof DEPLOY_TARGETS)[number];

export interface Deployment {
  readonly target: DeployTarget;
  readonly basePath: string;
  /** An absolute `https:` URL, or `''` when the app has not moved. */
  readonly movedTo: string;
}

type Environment = Readonly<Record<string, string | undefined>>;

/** Throws on a value that would build a broken app, rather than building one. */
export function deploymentFrom(env: Environment, defaultBasePath: string): Deployment {
  const target = env['DEPLOY_TARGET'] || 'github-pages';
  if (!(DEPLOY_TARGETS as readonly string[]).includes(target)) {
    throw new Error(`DEPLOY_TARGET must be one of ${DEPLOY_TARGETS.join(', ')}; got "${target}"`);
  }

  const basePath = env['APP_BASE_PATH'] || defaultBasePath;
  if (!basePath.startsWith('/') || !basePath.endsWith('/')) {
    throw new Error(`APP_BASE_PATH needs a leading and a trailing slash; got "${basePath}"`);
  }

  const movedTo = env['APP_MOVED_TO'] ?? '';
  if (movedTo && new URL(movedTo).protocol !== 'https:') {
    throw new Error(`APP_MOVED_TO must be an https: URL; got "${movedTo}"`);
  }

  return { target: target as DeployTarget, basePath, movedTo };
}
