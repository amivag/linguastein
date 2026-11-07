/**
 * The build rules every app shares: the content security policy, the host
 * headers, the deployment settings and the plugins that apply them.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cloudflareHeaders,
  contentSecurityPolicy,
  contentSecurityPolicyPlugin,
  deploymentFrom,
  hostHeaders,
  htmlPlaceholders,
  inlineScriptHashes,
  withContentSecurityPolicy,
} from '../src/index.ts';

const INLINE = 'document.documentElement.dataset.theme = "dark";';
const HTML = `<!doctype html><html><head><meta charset="UTF-8" />
<script>${INLINE}</script></head>
<body><script type="module" src="/assets/index.js"></script></body></html>`;

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('base64');

describe('the content security policy', () => {
  it('allows each inline script by the hash of its exact text, and no other', () => {
    expect(inlineScriptHashes(HTML)).toEqual([`'sha256-${sha(INLINE)}'`]);
    expect(inlineScriptHashes('<script type="module" src="/x.js"></script>')).toEqual([]);
  });

  it('never allows arbitrary inline script or eval, and requires Trusted Types', () => {
    const policy = contentSecurityPolicy(HTML);
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

  it('goes straight after the charset, before anything it governs', () => {
    const built = withContentSecurityPolicy(HTML);

    expect(built.indexOf('Content-Security-Policy')).toBeGreaterThan(built.indexOf('charset'));
    expect(built.indexOf('Content-Security-Policy')).toBeLessThan(built.indexOf('<script'));
  });

  it('refuses a document with no charset to anchor it', () => {
    expect(() => withContentSecurityPolicy('<html><head></head></html>')).toThrow(/charset/);
  });
});

describe('deploymentFrom', () => {
  it('builds for GitHub Pages at the default base path when nothing is set', () => {
    expect(deploymentFrom({}, '/app/')).toEqual({
      target: 'github-pages',
      basePath: '/app/',
      movedTo: '',
    });
  });

  it('builds for Cloudflare at a subdomain root when told to', () => {
    expect(deploymentFrom({ DEPLOY_TARGET: 'cloudflare', APP_BASE_PATH: '/' }, '/app/')).toEqual({
      target: 'cloudflare',
      basePath: '/',
      movedTo: '',
    });
  });

  it('accepts a new https address for the moved notice', () => {
    expect(deploymentFrom({ APP_MOVED_TO: 'https://app.example.test/' }, '/').movedTo).toBe(
      'https://app.example.test/',
    );
  });

  it('refuses values that would build a broken app', () => {
    expect(() => deploymentFrom({ DEPLOY_TARGET: 'netlfy' }, '/')).toThrow(/DEPLOY_TARGET/);
    expect(() => deploymentFrom({ APP_BASE_PATH: 'app/' }, '/')).toThrow(/leading/);
    expect(() => deploymentFrom({ APP_MOVED_TO: 'http://example.test' }, '/')).toThrow(/https/);
    expect(() => deploymentFrom({ APP_MOVED_TO: 'not a url' }, '/')).toThrow();
  });
});

describe('the Cloudflare headers', () => {
  const headers = cloudflareHeaders(HTML, { basePath: '/', allow: ['microphone'] });

  it('send the meta policy plus what only a header can carry', () => {
    expect(headers).toContain("require-trusted-types-for 'script'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain('X-Content-Type-Options: nosniff');
  });

  it('allow only the features the app names', () => {
    expect(headers).toContain('microphone=(self)');
    expect(headers).toContain('camera=()');
    expect(cloudflareHeaders(HTML, { basePath: '/' })).toContain('microphone=()');
  });

  it('keep the app out of search results unless it says otherwise', () => {
    expect(headers).toContain('X-Robots-Tag: noindex');
    expect(cloudflareHeaders(HTML, { basePath: '/', indexable: true })).not.toContain(
      'X-Robots-Tag',
    );
  });

  it('cache hashed assets forever and the service worker never, under the base path', () => {
    expect(headers).toMatch(
      /^\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable$/m,
    );
    expect(headers).toMatch(/^\/sw\.js\n {2}Cache-Control: no-cache$/m);
    expect(cloudflareHeaders(HTML, { basePath: '/app/' })).toContain('/app/assets/*');
  });
});

describe('htmlPlaceholders', () => {
  it('fills every named placeholder, wherever it appears', () => {
    const plugin = htmlPlaceholders({ APP_NAME: 'Rhythm', APP_ID: 'rhythm' });
    const hook = plugin.transformIndexHtml as { handler: (html: string) => string };

    expect(hook.handler('<title>%APP_NAME%</title><i>%APP_ID%.%APP_NAME%</i>')).toBe(
      '<title>Rhythm</title><i>rhythm.Rhythm</i>',
    );
  });
});

describe('contentSecurityPolicyPlugin', () => {
  it('runs on production builds only, after placeholders, writing the policy in', () => {
    const plugin = contentSecurityPolicyPlugin();
    const hook = plugin.transformIndexHtml as {
      order: string;
      handler: (html: string) => string;
    };

    expect(plugin.apply).toBe('build');
    expect(hook.order).toBe('post');
    expect(hook.handler(HTML)).toContain('Content-Security-Policy');
  });
});

describe('hostHeaders', () => {
  type Hooks = {
    apply: () => boolean;
    configResolved: (config: { root: string; build: { outDir: string } }) => void;
    closeBundle: () => void;
  };

  it('applies only when building for a host that reads _headers', () => {
    const pages = hostHeaders(deploymentFrom({}, '/')) as unknown as Hooks;
    const cloudflare = hostHeaders(
      deploymentFrom({ DEPLOY_TARGET: 'cloudflare' }, '/'),
    ) as unknown as Hooks;

    expect(pages.apply()).toBe(false);
    expect(cloudflare.apply()).toBe(true);
  });

  it('writes _headers beside the built HTML, hashing what shipped', () => {
    const root = mkdtempSync(join(tmpdir(), 'platform-build-'));
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist', 'index.html'), HTML);
    const plugin = hostHeaders(deploymentFrom({ DEPLOY_TARGET: 'cloudflare' }, '/app/'), {
      allow: ['microphone'],
    }) as unknown as Hooks;

    plugin.configResolved({ root, build: { outDir: 'dist' } });
    plugin.closeBundle();

    const headers = readFileSync(join(root, 'dist', '_headers'), 'utf8');
    expect(headers).toContain(`'sha256-${sha(INLINE)}'`);
    expect(headers).toContain('/app/assets/*');
    expect(headers).toContain('microphone=(self)');
    rmSync(root, { recursive: true, force: true });
  });
});
