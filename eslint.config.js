import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * Lint config. Note that `npm run lint` existed in package.json long before this file did,
 * with eslint not installed at all — so it had never once run. Treat any rule here as new
 * signal rather than something the codebase has been holding to.
 *
 * react-hooks is the reason this is worth having: the poster-pending bug in issue #17 was a
 * stale-closure/effect-lifecycle problem, exactly the class these rules catch.
 */
export default tseslint.config(
  { ignores: ['dist', 'functions/lib', 'functions/node_modules', 'coverage', '.remember'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Warn, not error, and deliberately so. This rule is new in react-hooks v7 and fires on
      // 10 pre-existing call sites — subscription effects and derived-state syncs that work
      // correctly today. Turning it into a build failure would either block every commit or
      // force a same-day refactor of working effect lifecycles with no test coverage behind
      // them, which is how regressions get introduced. Tracked separately; see issue #18.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Cloud Functions run on Node, not in a browser.
    files: ['functions/src/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
