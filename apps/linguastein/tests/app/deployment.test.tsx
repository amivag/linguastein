/**
 * Being ready to switch hosts without switching.
 *
 * An unset environment must build exactly what GitHub Pages serves today. The
 * Cloudflare pieces (`_headers`, `wrangler.json`, the moved notice) must be
 * correct before the day they are turned on, because that day is when a mistake
 * strands learners' data at the wrong address.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { deploymentFrom } from '../../scripts/deployment';
import { cloudflareHeaders } from '../../scripts/headers';
import { APP } from '../../src/app/identity';
import { MovedNotice } from '../../src/components/MovedNotice';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

describe('deploymentFrom', () => {
  it('builds for GitHub Pages at the identity base path when nothing is set', () => {
    expect(deploymentFrom({}, APP.basePath)).toEqual({
      target: 'github-pages',
      basePath: APP.basePath,
      movedTo: '',
    });
  });

  it('builds for Cloudflare at a subdomain root when told to', () => {
    expect(
      deploymentFrom({ DEPLOY_TARGET: 'cloudflare', APP_BASE_PATH: '/' }, APP.basePath),
    ).toMatchObject({ target: 'cloudflare', basePath: '/' });
  });

  it('refuses values that would build a broken app', () => {
    expect(() => deploymentFrom({ DEPLOY_TARGET: 'netlfy' }, '/')).toThrow(/DEPLOY_TARGET/);
    expect(() => deploymentFrom({ APP_BASE_PATH: 'app/' }, '/')).toThrow(/leading/);
    expect(() => deploymentFrom({ APP_MOVED_TO: 'http://example.test' }, '/')).toThrow(/https/);
    expect(() => deploymentFrom({ APP_MOVED_TO: 'not a url' }, '/')).toThrow();
  });
});

describe('the Cloudflare headers', () => {
  const headers = cloudflareHeaders(html, '/');

  it('send the same policy as the meta, plus what only a header can carry', () => {
    expect(headers).toContain("require-trusted-types-for 'script'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain('X-Content-Type-Options: nosniff');
  });

  it('allow the microphone pronunciation practice needs, and nothing else', () => {
    expect(headers).toMatch(/Permissions-Policy: microphone=\(self\), camera=\(\)/);
  });

  it('cache hashed assets forever and the service worker never', () => {
    expect(headers).toMatch(
      /^\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable$/m,
    );
    expect(headers).toMatch(/^\/sw\.js\n {2}Cache-Control: no-cache$/m);
  });

  it('follow the base path', () => {
    expect(cloudflareHeaders(html, '/linguastein/')).toContain('/linguastein/assets/*');
  });
});

describe('wrangler.json', () => {
  const config = JSON.parse(readFileSync(join(process.cwd(), 'wrangler.json'), 'utf8')) as {
    name: string;
    assets: { directory: string; not_found_handling: string };
  };

  it('deploys the build as this app, answering deep links with the app', () => {
    expect(config.name).toBe(APP.id);
    expect(config.assets.directory).toBe('./dist');
    expect(config.assets.not_found_handling).toBe('single-page-application');
  });
});

describe('the moved notice', () => {
  it('is absent from every build that has not moved', () => {
    const { container } = render(<MovedNotice />);

    expect(container).toBeEmptyDOMElement();
  });

  it('names the new address and how to bring progress along', () => {
    render(<MovedNotice to="https://linguastein.example.test/" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Linguastein has moved to linguastein.example.test',
    );
    expect(screen.getByRole('link', { name: 'linguastein.example.test' })).toHaveAttribute(
      'href',
      'https://linguastein.example.test/',
    );
    expect(screen.getByRole('status')).toHaveTextContent('save a backup in Settings → You');
  });
});
