import js from '@eslint/js';
import globals from 'globals';
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.generated/**',
      '_site/**',
      'test-results/**',
      'test-results-built/**',
      'playwright-report/**',
      'supabase/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
