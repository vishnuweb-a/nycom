import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      jsxA11y.flatConfigs.strict,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Production code ships without debug output (guidelines.md → Code Review Checklist).
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',

      // Business logic must be explicit and type-safe.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',

      // Enforce the `@/` alias so refactors never break relative import chains.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*'],
              message: "Use the '@/' alias instead of reaching across directories.",
            },
          ],
        },
      ],
    },
  },
  {
    /*
     * Vercel Functions run under Node, not in a browser. They also legitimately
     * reach into `src/constants/` for the shipping rules the server must price
     * with, so the `@/`-alias rule — which exists to stop relative chains
     * *inside* the app — does not apply here.
     */
    files: ['api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Node-context config files are not part of the browser app.
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
