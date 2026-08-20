// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*'],
  },
  {
    rules: {
      // These React Compiler-readiness rules flag valid, idiomatic patterns
      // in this codebase — Reanimated shared values are mutated by design
      // (react-hooks/immutability), and several lightweight timestamp reads
      // in render/useMemo are intentional, not accidental impurity. Keeping
      // the rest of the hooks ruleset (exhaustive-deps, rules-of-hooks) on.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'jest.setup.js'],
    languageOptions: {
      globals: globals.jest,
    },
  },
];
