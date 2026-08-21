/**
 * The design tokens, read back out of the stylesheets that declare them.
 *
 * This is what makes the style guide a view of the design system rather than a
 * copy of it, so the property worth testing is not "it finds `--space-4`" — it
 * is "it finds whatever is *there*". Each case below adds a declaration and
 * asserts it appears, which is the same thing a contributor does when they add a
 * token and expect the page to show it.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { declaredTokens, group, readTokens, ungrouped } from '../../src/styles/tokens';

const sheets: HTMLStyleElement[] = [];

/** Adds a stylesheet for one case, and remembers it for teardown. */
function withCss(css: string): void {
  const element = document.createElement('style');
  element.textContent = css;
  document.head.append(element);
  sheets.push(element);
}

afterEach(() => {
  for (const sheet of sheets.splice(0)) sheet.remove();
  document.documentElement.removeAttribute('data-theme');
});

describe('declaredTokens', () => {
  it('finds what a stylesheet declares on :root', () => {
    withCss(':root { --test-alpha: 1px; --test-beta: 2px; }');

    expect(declaredTokens('--test-')).toEqual(['--test-alpha', '--test-beta']);
  });

  it('keeps declaration order rather than sorting', () => {
    // The order in `primitives.css` is editorial: spacing, then shape, then
    // type. Sorting would put `--text-2xl` before `--text-base` and throw away
    // the sequence someone chose to explain the system in.
    withCss(':root { --test-zulu: 1px; --test-alpha: 2px; --test-mike: 3px; }');

    expect(declaredTokens('--test-')).toEqual(['--test-zulu', '--test-alpha', '--test-mike']);
  });

  it('reads a theme block, so a colour role is found wherever it is declared', () => {
    withCss("[data-theme='test'] { --test-role: #abcdef; }");

    expect(declaredTokens('--test-')).toContain('--test-role');
  });

  it('descends into a media query, where the responsive scale lives', () => {
    // `primitives.css` redeclares the type scale at two breakpoints. A reader
    // that only looked at top-level rules would miss any token introduced there.
    withCss('@media (min-width: 1px) { :root { --test-responsive: 4px; } }');

    expect(declaredTokens('--test-')).toContain('--test-responsive');
  });

  it("ignores a component's own locals", () => {
    // `--button-bg` and `--chip-bg` are implementation detail of one component,
    // not part of the shared vocabulary, and listing them on the style guide
    // would invite a screen to reach for one.
    withCss('.some-component { --test-local: 1px; }');

    expect(declaredTokens('--test-')).not.toContain('--test-local');
  });

  it('reports a name once, however many themes redeclare it', () => {
    withCss(":root { --test-shared: 1px; } [data-theme='other'] { --test-shared: 2px; }");

    expect(declaredTokens('--test-').filter((name) => name === '--test-shared')).toHaveLength(1);
  });
});

describe('readTokens', () => {
  it('resolves each name against the active theme', () => {
    withCss(":root { --test-value: 3px; } [data-theme='alt'] { --test-value: 9px; }");

    const before = readTokens('--test-').find((token) => token.name === '--test-value');
    expect(before?.value).toBe('3px');

    document.documentElement.dataset['theme'] = 'alt';

    const after = readTokens('--test-').find((token) => token.name === '--test-value');
    expect(after?.value).toBe('9px');
  });
});

describe('grouping', () => {
  const tokens = [
    { name: '--space-1', value: '4px' },
    { name: '--radius-sm', value: '8px' },
    { name: '--stray', value: 'x' },
  ];

  it('collects a group by name prefix, so the group grows on its own', () => {
    expect(group(tokens, '--space-').map((token) => token.name)).toEqual(['--space-1']);
  });

  it('leaves nothing unaccounted for', () => {
    // The reason the style guide has an "Everything else" section: a token must
    // never be able to go silently unshown, because a page that looks complete
    // is the one nobody checks.
    expect(ungrouped(tokens, [['--space-'], ['--radius-']]).map((token) => token.name)).toEqual([
      '--stray',
    ]);
  });
});
