import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * ESLint, kept for the React rules alone.
 *
 * Everything else moved to `.oxlintrc.json` — the architecture boundaries, the
 * import seam, the core and TypeScript rule sets — because oxlint runs them in a
 * fraction of the time and, on the 91 rules this project actually enforced,
 * implements 88. The three it does not cannot fire in strict-mode ES modules.
 *
 * These two plugins are the exception, and the reason is not performance:
 *
 * - `eslint-plugin-react-hooks` v7 enables **16** rules, of which oxlint 1.78
 *   implements two (`rules-of-hooks`, `exhaustive-deps`). The other fourteen are
 *   the React Compiler set — `purity`, `immutability`, `set-state-in-effect`,
 *   `preserve-manual-memoization` and the rest. `AGENTS.md` names one of them as
 *   a standing constraint ("do not call `Date.now()` during render"), so dropping
 *   them would turn an enforced rule back into a paragraph. That is the trade this
 *   repository exists to refuse.
 * - `react-refresh` has no oxlint equivalent at all, not even a partial one.
 *
 * So `npm run lint` runs both, oxlint first because it is the one that will fail
 * fast. Delete this file the day oxlint ports the compiler rules; nothing else
 * depends on it.
 *
 * The parser is the cost of keeping ESLint. `@typescript-eslint/parser` is what
 * lets ESLint read `.tsx` at all — plain espree treats the first type annotation
 * as a syntax error — and it declares `typescript: >=4.8.4 <6.1.0`. That ceiling
 * is the whole reason TypeScript stays on 5.9; see **Known constraints** in
 * `AGENTS.md`.
 *
 * Only `src` is matched, so `eslint .` lints the app and leaves tests, scripts and
 * config to oxlint. `ignores` is still required despite that: ESLint applies an
 * implicit config to every `.js` file it walks, which is enough to make it report
 * the `eslint-disable` headers in generated `coverage/` output as unused.
 */
export default [
  { ignores: ['dist', 'dev-dist', 'coverage', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
