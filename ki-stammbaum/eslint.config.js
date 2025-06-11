import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  {
    // Global ignores
    ignores: ['.nuxt/', '.output/', 'dist/', 'node_modules/'],
  },
  // Base configuration for all JavaScript/TypeScript files
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        defineNuxtConfig: 'readonly',
        defineNuxtPlugin: 'readonly',
        defineNuxtRouteMiddleware: 'readonly',
      },
    },
  },
  // TypeScript configurations (applies to .ts, .js, .mjs, .cjs)
  // This uses tseslint.configs.recommended as a base
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs', '**/*.cjs'],
    // ignores: ['**/*.vue'], // We don't need to ignore .vue here, as Vue config below is more specific
    extends: tseslint.configs.recommended, // Spread the rules, etc.
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    rules: {
      // Add any specific TS/JS rule overrides here
    },
  },

  // Vue configurations
  // Apply all recommended flat configs from eslint-plugin-vue
  ...pluginVue.configs['flat/recommended'],

  // Add specific parser options for <script lang="ts"> in .vue files
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser, // Use TypeScript parser for <script lang="ts">
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaVersion: 'latest',
        extraFileExtensions: ['.vue'], // Important for vue-eslint-parser to correctly pass <script> content
      },
    },
    rules: {
      // Add any Vue specific rule overrides here if needed
      // e.g. 'vue/no-unused-vars': 'error' (if not covered by TS checks)
    },
  },

  // Prettier configuration should be last to override other formatting rules
  prettierRecommended,
);
