/**
 * The on-device error record.
 *
 * On a phone there is no console, so an error nobody kept is an error nobody can
 * report. These tests pin what is kept, how much, and that capture never throws.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createErrorLog, errorReport } from '../src/index.ts';

const KEY = 'test.errors';
const { clearErrors, installErrorCapture, recentErrors, recordError } = createErrorLog({
  key: KEY,
});

let uninstall = () => {};

beforeEach(() => {
  clearErrors();
});

afterEach(() => {
  uninstall();
  clearErrors();
});

describe('recordError', () => {
  it('keeps the message, the source and the stack', () => {
    recordError('interface', new TypeError('x is undefined'));

    const [record] = recentErrors();
    expect(record).toMatchObject({ source: 'interface', message: 'TypeError: x is undefined' });
    expect(record?.detail).toContain('x is undefined');
  });

  it('keeps only the most recent twenty', () => {
    for (let index = 0; index < 25; index += 1) recordError('uncaught', `error ${index}`);

    const records = recentErrors();
    expect(records).toHaveLength(20);
    expect(records[0]?.message).toBe('error 5');
    expect(records.at(-1)?.message).toBe('error 24');
  });

  it('describes a value that is not an Error', () => {
    recordError('rejection', { code: 42 });

    expect(recentErrors()[0]?.message).toBe('{"code":42}');
  });

  it('ignores a corrupted record instead of failing', () => {
    localStorage.setItem(KEY, '{not json');

    expect(recentErrors()).toEqual([]);
    expect(() => recordError('uncaught', 'still recorded')).not.toThrow();
    expect(recentErrors()).toHaveLength(1);
  });
});

describe('the limit', () => {
  it('is configurable per log', () => {
    const short = createErrorLog({ key: 'short.errors', limit: 2 });
    for (const message of ['a', 'b', 'c']) short.recordError('uncaught', message);

    expect(short.recentErrors().map((record) => record.message)).toEqual(['b', 'c']);
    short.clearErrors();
  });
});

describe('installErrorCapture', () => {
  it('records uncaught errors, rejections and policy violations, until removed', () => {
    uninstall = installErrorCapture(window);

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('boom'), message: 'boom' }));
    const rejection = new Event('unhandledrejection') as Event & { reason: unknown };
    rejection.reason = new Error('nope');
    window.dispatchEvent(rejection);
    const violation = new Event('securitypolicyviolation') as Event & {
      effectiveDirective: string;
      blockedURI: string;
    };
    violation.effectiveDirective = 'script-src-elem';
    violation.blockedURI = 'https://example.test/x.js';
    document.dispatchEvent(violation);

    expect(recentErrors().map((record) => record.source)).toEqual([
      'uncaught',
      'rejection',
      'policy',
    ]);
    expect(recentErrors()[2]).toMatchObject({
      message: 'Blocked by script-src-elem',
      detail: 'https://example.test/x.js',
    });

    uninstall();
    window.dispatchEvent(new ErrorEvent('error', { message: 'after' }));
    expect(recentErrors()).toHaveLength(3);
  });
});

describe('errorReport', () => {
  it('starts with the build, so a report says what it is about', () => {
    recordError('uncaught', 'boom');

    const report = errorReport('Linguastein 1.0.0 (abc1234)', recentErrors());
    expect(report.split('\n')[0]).toBe('Linguastein 1.0.0 (abc1234)');
    expect(report).toContain('[uncaught] boom');
  });
});
