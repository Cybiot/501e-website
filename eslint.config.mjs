// Configuration ESLint commune (flat config) pour l'API, le bot et le front.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.angular/**', '**/node_modules/**', '**/coverage/**', 'apps/api/prisma/migrations/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // Angular s'appuie sur des décorateurs et l'injection de dépendances : on garde des imports de valeur.
    files: ['apps/web/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
);
