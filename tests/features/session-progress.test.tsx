/**
 * Session position, as pips and as a bar.
 *
 * A continuous bar under-sells a ten-item session — three quarters along is a
 * smear, where "two left" is countable. Short sessions therefore get one pip per
 * item, and long ones keep the bar, because past twenty a pip is thinner than
 * the gap beside it.
 *
 * What must not change either way is the `role="progressbar"`: its name and
 * values are what a screen reader and an agent read, and the segments are
 * decoration layered on top. `tests/a11y/screens.test.tsx` holds that contract
 * for the real screen; these cover the rendering decision itself.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionProgress } from '../../src/features/practice/SessionProgress';

const pips = () => screen.getByRole('progressbar').querySelectorAll('[data-state]');

describe('session progress', () => {
  it('reports the same position however it renders', () => {
    for (const total of [4, 40]) {
      const { unmount } = render(<SessionProgress index={2} total={total} />);
      const bar = screen.getByRole('progressbar');

      expect(bar).toHaveAttribute('aria-valuenow', '3');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', String(total));
      expect(bar).toHaveAccessibleName(`Item 3 of ${total}`);
      unmount();
    }
  });

  it('draws one pip per item in a short session', () => {
    render(<SessionProgress index={0} total={10} />);
    expect(pips()).toHaveLength(10);
  });

  it('marks what is done, what is current and what is to come', () => {
    render(<SessionProgress index={2} total={5} />);
    const states = [...pips()].map((pip) => pip.getAttribute('data-state'));
    expect(states).toEqual(['done', 'done', 'current', 'todo', 'todo']);
  });

  it('falls back to a bar once pips stop being countable', () => {
    render(<SessionProgress index={0} total={40} />);
    expect(pips()).toHaveLength(0);
    // The bar is still there, carrying the same value.
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('keeps the pips out of the accessibility tree', () => {
    // The progressbar already says "Item 3 of 5". Twenty anonymous spans saying
    // nothing would be noise, and the count is not a second source of truth.
    render(<SessionProgress index={2} total={5} />);
    const bar = screen.getByRole('progressbar');
    for (const pip of pips()) expect(pip).toHaveAttribute('aria-hidden', 'true');
    expect(within(bar).queryAllByRole('generic')).toHaveLength(0);
  });

  it('does not pip a single-item session', () => {
    // One pip is not progress, it is a dot.
    render(<SessionProgress index={0} total={1} />);
    expect(pips()).toHaveLength(0);
  });
});

/**
 * jsdom cannot resolve `[data-state]` through the cascade, so the styling
 * contract is asserted against the stylesheet — the same approach
 * `contrast.test.ts` and `hover-states.test.ts` take.
 */
describe('what the pip states look like', () => {
  const css = readFileSync(
    resolve(process.cwd(), 'src/features/practice/Practice.module.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  /** Declarations of the rule whose selector contains `needle`. */
  function block(needle: string): string {
    const rule = css.split('}').find((part) => part.includes(needle) && part.includes('{'));
    return rule?.slice(rule.indexOf('{') + 1) ?? '';
  }

  it('paints done and current differently from to-come', () => {
    expect(block("data-state='done'")).toMatch(/background:\s*var\(--color-accent\)/);
    expect(block("data-state='current'")).toMatch(/background:\s*var\(--color-accent\)/);
    expect(block('.progressPip {')).toMatch(/background:\s*var\(--color-border\)/);
  });

  it('distinguishes the current pip by more than colour', () => {
    // Position has to survive a colour-vision difference: the pip you are on is
    // taller as well as accent-coloured, so colour is never the only signal.
    expect(block("data-state='current'")).toMatch(/height:/);
  });

  it('keeps every pip colour on a role token', () => {
    const literals = [...css.matchAll(/\.progressPip[^{]*\{([^}]*)\}/g)]
      .flatMap(([, body]) => [...body!.matchAll(/background:\s*([^;]+)/g)])
      .map(([, value]) => value!.trim())
      .filter((value) => !value.startsWith('var(--color-'));
    expect(literals).toEqual([]);
  });
});
