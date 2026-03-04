import tsParser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import importPlugin from 'eslint-plugin-import'
// @ts-expect-error - package has no TypeScript declarations
import importTypescript from 'eslint-plugin-import-typescript'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import vueParser from 'vue-eslint-parser'

export default defineConfig([
  {
    ignores: [
      '.output/**',
      '.data/**',
      '.nuxt/**',
      '.nitro/**',
      '.cache/**',
      'dist/**',
      'node_modules/**',
      'logs/**',
      '*.log',
      '.DS_Store',
      '.fleet/**',
      '.env',
      '.env.*',
    ],
  },
  {
    files: [ '**/*.ts', '**/*.tsx', '**/*.vue', '**/*.json' ],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: [ '.vue' ],
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
      },
    },
    plugins: {
      import: importPlugin,
      'simple-import-sort': simpleImportSort,
      'import-typescript': importTypescript,
    },
    rules: {
      // imports
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'import/no-duplicates': 'error',
      'import-typescript/no-relative-parent-imports': [ 'error' ],

      // spacing inside array brackets
      'array-bracket-spacing': [ 'error', 'always' ],
    },
  },
])
