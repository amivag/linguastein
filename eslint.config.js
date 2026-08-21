import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * The architecture, as rules rather than as prose.
 *
 * `AGENTS.md` has stated these since the first commit and every one of them was
 * being obeyed — by discipline, with nothing checking. That is fine for one app
 * with one author. It is not fine for a skeleton other projects are scaffolded
 * from: the next agent will read the document or it will not, and either way
 * nothing failed. So the load-bearing ones are spelled out below, where breaking
 * them stops the build.
 *
 * `no-restricted-imports` is deliberately the mechanism, rather than a boundary
 * plugin: it needs no new dependency, and a violation reports the reason at the
 * import that caused it, which is where somebody can act on it.
 *
 * One flat-config subtlety worth knowing before editing: for a given file, the
 * *last* matching block wins a rule outright — options are replaced, not merged.
 * So the engine block below has to restate the vendor restriction rather than
 * relying on the broader block above it.
 */

/** Vendors that mean "this code is running in a browser, in this app's UI". */
const UI_VENDORS = ['react', 'react-dom', 'react-dom/*', 'react-router', 'react-router-dom'];

const ICON_VENDOR = {
  group: ['lucide-react', 'lucide-react/*'],
  message:
    'The icon set lives behind a seam: import from `components/Icon` (or add a semantic name to `components/icons.ts`, the only file allowed to name the vendor). Swapping icon sets should be one edit, not forty.',
};

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    // CLI tooling talks to the terminal.
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
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

  /*
   * Seam: the icon vendor is named in exactly one file.
   *
   * `icons.ts` is excluded rather than special-cased inside the rule, so the
   * exception is visible in the config instead of buried in a message.
   */
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/icons.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ICON_VENDOR] }],
    },
  },

  /*
   * The engine may not know it is in a browser.
   *
   * `src/domain` is the content, exercise, session and progress model;
   * `src/languages` is build-time morphology. Both are pure TypeScript, which is
   * what makes them cheap to test — the coverage floors hold them far higher than
   * the app as a whole precisely because nothing in them needs a DOM.
   *
   * Importing React into either is not a small mistake. It makes the model
   * unrunnable outside a browser, unusable from a build script, and impossible to
   * hold at that coverage. It is also the single easiest rule to break by
   * accident, because the fix for "I need this in the UI" always looks local.
   */
  {
    files: ['src/domain/**/*.ts', 'src/languages/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ICON_VENDOR,
            {
              group: UI_VENDORS,
              message:
                'The engine is pure TypeScript: no React, no router, no DOM. If the UI needs something from here, export the data and let a component render it.',
            },
            {
              group: [
                '**/components/**',
                '**/features/**',
                '**/app/**',
                '**/storage/**',
                '**/data/**',
                '**/audio/**',
                '**/ai/**',
              ],
              message:
                'The engine may not import the layers built on top of it. Dependencies point inward: features → domain, never the reverse.',
            },
          ],
        },
      ],
    },
  },

  /*
   * Shared components stay shared.
   *
   * A component under `src/components` is one every screen may use, so it must
   * not reach into a particular screen. `AppNav` and `CourseBar` legitimately use
   * `app/course`, which is composition rather than a feature — the restriction is
   * on `features/`, not on `app/`.
   */
  {
    files: ['src/components/**/*.{ts,tsx}'],
    // The seam file again. It is under `src/components`, so this block would
    // otherwise re-apply the vendor ban that the block above excludes it from —
    // the last-block-wins behaviour noted at the top of this file, which caught
    // the author of that note within a minute of writing it.
    ignores: ['src/components/icons.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ICON_VENDOR,
            {
              group: ['**/features/**'],
              message:
                'A shared component cannot depend on one screen. Take what it needs as a prop, or move the component into that feature.',
            },
          ],
        },
      ],
    },
  },
);
