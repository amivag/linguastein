/**
 * The content security policy, written into the built HTML.
 *
 * GitHub Pages cannot send response headers, so the policy travels as a
 * `<meta http-equiv>` instead. A meta policy cannot carry `frame-ancestors`,
 * `report-to` or `sandbox`; everything below is valid in one. Moving to a host
 * with headers should move this to a header and add those three.
 *
 * Inline script is allowed by hash and nothing else. The only inline script is
 * the pre-paint appearance resolver in `index.html`, and its text changes with
 * the appearance registry, so the hash is computed from the finished HTML at
 * build time rather than written down.
 *
 * Applied to production builds only. The dev server injects inline scripts and
 * styles for hot reload that no production policy should allow.
 */

import { createHash } from 'node:crypto';

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

/** The `sha256-…` source for each inline script, in document order. */
export function inlineScriptHashes(html: string): readonly string[] {
  return [...html.matchAll(INLINE_SCRIPT)].map(
    ([, body]) =>
      `'sha256-${createHash('sha256')
        .update(body ?? '', 'utf8')
        .digest('base64')}'`,
  );
}

export function contentSecurityPolicy(html: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes(html).join(' ')}`.trim(),
    "style-src 'self'",
    /*
     * Inline `style` attributes are allowed. React writes them through the
     * CSSOM, which the CSP spec exempts, but WebKit still checks those writes
     * against `style-src-attr` and drops them, so without this Safari loses
     * every dynamic style (found by `e2e/boot.spec.ts`). Style elements and
     * stylesheets stay restricted to this origin. Script is unaffected, and
     * Trusted Types already stop injected HTML from carrying attributes in.
     */
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "require-trusted-types-for 'script'",
    'trusted-types default',
  ].join('; ');
}

/**
 * The HTML with its policy as the first element of `<head>` after the charset,
 * so it governs everything the document loads after it.
 */
export function withContentSecurityPolicy(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(html)}" />`;
  const charset = /<meta charset="[^"]*"\s*\/?>/i;
  if (!charset.test(html))
    throw new Error('index.html needs a <meta charset> for the CSP to follow');
  return html.replace(charset, (tag) => `${tag}\n    ${meta}`);
}
