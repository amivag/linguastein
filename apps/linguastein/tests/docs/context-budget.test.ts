/** Keep automatically read guidance and current project memory cheap to load.
 * Topic docs have separate budgets; historical briefs should be read on demand.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceRoot } from '../fixtures/dataset';

const budgets = [
  ['AGENTS.md', 1800],
  ['CLAUDE.md', 80],
  ['docs/current-state.md', 450],
  ['docs/README.md', 500],
  ['apps/linguastein/docs/working-conventions.md', 650],
  ['docs/skeleton.md', 700],
  ['docs/framework.md', 750],
  ['docs/theming.md', 1400],
  ['apps/linguastein/docs/storage.md', 700],
  ['docs/server-foundation.md', 1200],
  ['docs/roadmap.md', 800],
  ['docs/tasks/accounts-and-sync.md', 450],
] as const;

describe('documentation context budgets', () => {
  it.each(budgets)('%s stays within %i words', (file, budget) => {
    const words = readFileSync(join(workspaceRoot, file), 'utf8').trim().split(/\s+/u).length;
    expect(
      words,
      `${file}: move detail to its owning topic instead of growing the entry point`,
    ).toBeLessThanOrEqual(budget);
  });
});
