/**
 * Build identity.
 *
 * The point of these is the wiring, not the arithmetic: the version is injected
 * by `define` in `vite.config.ts`, and a typo there fails silently — the app
 * would render `0.0.0-dev` forever and nobody would notice until a bug report
 * quoted a version that does not exist. So the first test compares against
 * `package.json` itself.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_VERSION,
  BUILD_COMMIT,
  BUILD_TIME,
  buildDate,
  buildLabel,
  formatBuildDate,
} from '../../src/app/version';

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  version: string;
};

describe('build identity', () => {
  it('takes the version from package.json, not a hand-copied constant', () => {
    expect(APP_VERSION).toBe(pkg.version);
    // i.e. the define is actually substituting, rather than falling back.
    expect(APP_VERSION).not.toBe('0.0.0-dev');
  });

  it('records a commit, or says plainly that it does not know one', () => {
    expect(BUILD_COMMIT === 'unknown' || /^[0-9a-f]{7,40}$/.test(BUILD_COMMIT)).toBe(true);
  });

  it('records a parseable build time', () => {
    expect(BUILD_TIME).not.toBe('');
    expect(Number.isNaN(new Date(BUILD_TIME).getTime())).toBe(false);
  });
});

describe('buildLabel', () => {
  it('is a string a person can quote in a bug report', () => {
    expect(buildLabel()).toContain(APP_VERSION);
    if (BUILD_COMMIT !== 'unknown') expect(buildLabel()).toContain(BUILD_COMMIT);
  });

  it('omits the commit rather than showing "unknown"', () => {
    // "unknown" in a version string tells a reader nothing they can act on.
    expect(buildLabel()).not.toContain('unknown');
  });
});

describe('formatBuildDate', () => {
  it('reads as a date, at day precision', () => {
    expect(formatBuildDate('2026-08-18T09:30:00Z')).toBe('18 August 2026');
  });

  it('treats a missing or broken stamp as unknown rather than Invalid Date', () => {
    expect(formatBuildDate('')).toBe('');
    expect(formatBuildDate('not a date')).toBe('');
  });

  it('is used by buildDate against the real stamp', () => {
    expect(buildDate()).toBe(formatBuildDate(BUILD_TIME));
    expect(buildDate()).not.toContain('Invalid');
  });
});
