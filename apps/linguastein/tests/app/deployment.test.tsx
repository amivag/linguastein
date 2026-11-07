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
import { APP } from '../../src/app/identity';
import { MovedNotice } from '../../src/components/MovedNotice';

// The deployment settings and headers themselves are tested in @platform/build.

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
