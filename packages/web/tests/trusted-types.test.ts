/** The default Trusted Types policy: same-origin script URLs, and nothing else. */

import { describe, expect, it } from 'vitest';
import { installTrustedTypesPolicy } from '../src/index.ts';

type Rules = { createScriptURL: (input: string) => string };

function scope(withFactory: boolean) {
  const created: { name: string; rules: Rules }[] = [];
  const fake = {
    location: { href: 'https://app.example.test/start', origin: 'https://app.example.test' },
    ...(withFactory
      ? {
          trustedTypes: {
            createPolicy: (name: string, rules: Rules) => created.push({ name, rules }),
          },
        }
      : {}),
  } as unknown as typeof globalThis;
  return { fake, created };
}

describe('installTrustedTypesPolicy', () => {
  it('does nothing in an engine without Trusted Types', () => {
    const { fake, created } = scope(false);

    expect(() => installTrustedTypesPolicy(fake)).not.toThrow();
    expect(created).toEqual([]);
  });

  it('registers the default policy, admitting script URLs from this origin only', () => {
    const { fake, created } = scope(true);
    installTrustedTypesPolicy(fake);
    const [policy] = created;

    expect(policy?.name).toBe('default');
    expect(policy?.rules.createScriptURL('sw.js')).toBe('https://app.example.test/sw.js');
    expect(() => policy?.rules.createScriptURL('https://evil.example.test/x.js')).toThrow(
      /another origin/,
    );
  });

  it('defines no HTML or script rules, so those strings stay blocked', () => {
    const { fake, created } = scope(true);
    installTrustedTypesPolicy(fake);

    expect(Object.keys(created[0]?.rules ?? {})).toEqual(['createScriptURL']);
  });
});
