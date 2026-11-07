/**
 * Automated accessibility checks.
 *
 * axe catches the mechanical failures (missing names, bad contrast, broken
 * roles). It cannot check focus order, announcement quality or whether a
 * control makes sense — those are covered by the behavioural tests alongside
 * these, and by manual review.
 */

import axe, { type AxeResults, type Result } from 'axe-core';
import { expect } from 'vitest';

const RULES = {
  // WCAG 2.2 AA is the target; best-practice rules are advisory and excluded
  // so the suite fails only on real conformance problems.
  runOnly: {
    type: 'tag' as const,
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  },
};

export async function analyse(container: HTMLElement): Promise<AxeResults> {
  return axe.run(container, RULES);
}

export function formatViolations(violations: readonly Result[]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => `      ${node.target.join(' ')}\n        ${node.failureSummary ?? ''}`)
        .join('\n');
      return `  [${violation.impact}] ${violation.id}: ${violation.help}\n${targets}`;
    })
    .join('\n');
}

/** Fails with a readable report rather than a bare object diff. */
export async function expectNoViolations(container: HTMLElement): Promise<void> {
  const results = await analyse(container);
  expect(formatViolations(results.violations)).toBe('');
}
