import importPlugin from 'eslint-plugin-import';

/**
 * Minimal ESLint flat config.
 *
 * Currently the only rule we enforce is the one-way dependency arrow
 * between `src/core/` and `src/features/`: features may import from core,
 * core must NOT import from features.
 */
export default [
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
        node: true,
      },
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/core',
              from: './src/features',
              message:
                'core/ must not import from features/. Dependencies flow one way: features → core.',
            },
          ],
        },
      ],
    },
  },
];
