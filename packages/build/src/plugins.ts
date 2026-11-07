/**
 * Vite plugins every app's build uses, so the rules they carry are written once.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { withContentSecurityPolicy } from './csp.ts';
import type { Deployment } from './deployment.ts';
import { cloudflareHeaders, type HeaderOptions } from './headers.ts';

/**
 * Fills `%NAME%` placeholders in `index.html`, at build and dev time alike.
 *
 * `index.html` cannot import TypeScript, so anything it needs from the app
 * (its name, its storage prefix, its appearance axes) arrives this way. That is
 * one spelling of each value rather than a copy kept in step by hand.
 */
export function htmlPlaceholders(values: Readonly<Record<string, string>>): Plugin {
  return {
    name: 'platform:html-placeholders',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        Object.entries(values).reduce(
          (filled, [name, value]) => filled.replaceAll(`%${name}%`, value),
          html,
        ),
    },
  };
}

/**
 * The content security policy, hashed against the finished HTML. `post` so the
 * inline script it hashes is the one that ships, after placeholders are filled;
 * build-only because the dev server's hot-reload preamble is inline script no
 * production policy should allow.
 */
export function contentSecurityPolicyPlugin(): Plugin {
  return {
    name: 'platform:content-security-policy',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: withContentSecurityPolicy },
  };
}

/**
 * Response headers for a host that reads `_headers`, written once the HTML is on
 * disk so the policy hashes the inline script that actually shipped. Only for
 * that host: GitHub Pages would serve the file as a page instead.
 */
export function hostHeaders(
  deployment: Deployment,
  options: Omit<HeaderOptions, 'basePath'> = {},
): Plugin {
  let outDir = '';
  return {
    name: 'platform:host-headers',
    apply: () => deployment.target === 'cloudflare',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      writeFileSync(
        resolve(outDir, '_headers'),
        cloudflareHeaders(html, { ...options, basePath: deployment.basePath }),
      );
    },
  };
}
