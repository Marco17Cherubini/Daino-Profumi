'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'assets/vendor-*.js', 'tests/dom/report/**'] },
  js.configs.recommended,
  {
    // Theme assets: classic browser scripts loaded with `defer`, sharing the `Daino` namespace.
    files: ['assets/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Vendor libraries (self-hosted, see docs/decisions.md ADR-007)
        gsap: 'readonly',
        ScrollTrigger: 'readonly',
        Draggable: 'readonly',
        Lenis: 'readonly',
        // CommonJS guard used to unit-test pure helpers in Node (ADR-001)
        module: 'readonly',
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js', '*.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // DOM specs execute callbacks inside the browser page via page.evaluate().
    files: ['tests/dom/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
