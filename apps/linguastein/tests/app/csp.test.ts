/**
 * The content security policy the build writes into `index.html`.
 *
 * The built HTML cannot be read here, because `npm run check` builds after it
 * tests. So these tests run the same transform over the source `index.html` and
 * pin the properties that matter: the inline script is allowed by its exact
 * hash, nothing allows arbitrary inline code or `eval`, and Trusted Types are on.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contentSecurityPolicy,
  inlineScriptHashes,
  withContentSecurityPolicy,
} from '../../scripts/csp';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

describe('the content security policy', () => {
  it('allows each inline script by the hash of its exact text', () => {
    const body = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    const hash = createHash('sha256').update(body, 'utf8').digest('base64');

    expect(body.length).toBeGreaterThan(0);
    expect(inlineScriptHashes(html)).toEqual([`'sha256-${hash}'`]);
  });

  it('ignores scripts loaded by URL, which `self` already covers', () => {
    expect(inlineScriptHashes('<script type="module" src="/x.js"></script>')).toEqual([]);
  });

  it('never allows arbitrary inline code or eval', () => {
    const policy = contentSecurityPolicy(html);
    const directive = (name: string) =>
      policy.split('; ').find((entry) => entry.startsWith(`${name} `)) ?? '';

    expect(directive('script-src')).not.toContain("'unsafe-inline'");
    expect(directive('style-src')).not.toContain("'unsafe-inline'");
    // Style attributes only, for WebKit's handling of CSSOM writes; see csp.ts.
    expect(directive('style-src-attr')).toBe("style-src-attr 'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("require-trusted-types-for 'script'");
  });

  it('comes straight after the charset, before anything it governs', () => {
    const built = withContentSecurityPolicy(html);
    const head = built.slice(built.indexOf('<head>'));

    expect(head.indexOf('Content-Security-Policy')).toBeGreaterThan(head.indexOf('charset'));
    expect(head.indexOf('Content-Security-Policy')).toBeLessThan(head.indexOf('<script'));
  });
});
