const {defineConfig, globalIgnores} = require('eslint/config');

const globals = require('globals');
const typescriptEslint = require('typescript-eslint');
const unicorn = require('eslint-plugin-unicorn').default;
const prettier = require('eslint-plugin-prettier/recommended');
const promise = require('eslint-plugin-promise');
const node = require('eslint-plugin-node');
const optimizeRegex = require('eslint-plugin-optimize-regex');
const requireExtensions = require('eslint-plugin-require-extensions');

const {fixupConfigRules, fixupPluginRules} = require('@eslint/compat');

const js = require('@eslint/js');

const {FlatCompat} = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  globalIgnores([
    '**/dist/',
    '**/node_modules/',
    '**/.idea',
    '**/oldSrc',
    '**/scripts/',
    '**/packages/playground/.nuxt',
    '**/packages/playground/.output',
    '**/packages/playground/server/models/index.ts',
  ]),
  js.configs.recommended,
  unicorn.configs.recommended,
  ...typescriptEslint.configs.recommended,
  prettier,
  {
    rules: {
      'prettier/prettier': 0,
    },
  },
  ...fixupConfigRules(
    compat.extends(
      'airbnb-base',
      'plugin:require-extensions/recommended',
      'plugin:node/recommended',
      'plugin:promise/recommended',
    ),
  ),
  {
    languageOptions: {
      globals: {
        ...globals.commonjs,
        ...globals.node,
      },

      ecmaVersion: 2021,
      sourceType: 'module',

      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },

    plugins: {
      'optimize-regex': fixupPluginRules(optimizeRegex),
      'require-extensions': fixupPluginRules(requireExtensions),
      node: fixupPluginRules(node),
      promise: fixupPluginRules(promise),
    },

    settings: {},

    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },

    rules: {
      'import/no-unresolved': 0,
      'import/no-cycle': 0,
      'optimize-regex/optimize-regex': 1,
      'sonarjs/cognitive-complexity': 0,
      'sonarjs/no-duplicate-string': 0,
      'sonarjs/no-nested-template-literals': 0,
      'sonarjs/prefer-immediate-return': 0,
      'unicorn/catch-error-name': 0,
      'unicorn/consistent-destructuring': 0,
      'unicorn/filename-case': 0,
      'unicorn/no-array-callback-reference': 0,
      'unicorn/no-array-for-each': 0,
      'unicorn/no-array-reduce': 0,
      'unicorn/no-await-expression-member': 0,
      'unicorn/no-for-loop': 0,
      'unicorn/no-nested-ternary': 0,
      'unicorn/no-null': 0,
      'unicorn/no-unreadable-array-destructuring': 0,
      'unicorn/no-useless-undefined': 0,

      'array-callback-return': [
        2,
        {
          allowImplicit: true,
        },
      ],

      'unicorn/numeric-separators-style': [
        2,
        {
          onlyIfContainsSeparator: true,
        },
      ],

      'unicorn/prefer-module': 0,
      'unicorn/prefer-node-protocol': 0,
      'unicorn/prefer-regexp-test': 0,
      'unicorn/prefer-spread': 0,

      'unicorn/prefer-switch': [
        2,
        {
          minimumCases: 4,
          emptyDefaultCase: 'do-nothing-comment',
        },
      ],

      'unicorn/prevent-abbreviations': 0,
      'unicorn/explicit-length-check': 0,

      'import/extensions': 0,

      'import/order': 0,
      'no-unused-vars': 0,
      '@typescript-eslint/no-unused-vars': 0,
      '@typescript-eslint/no-empty-object-type': 0,
      'no-undef': 0,
      indent: 0,
      quotes: 0,
      'object-curly-spacing': 0,
      '@typescript-eslint/no-require-imports': 0,
      'node/no-missing-require': 0,
      'import/no-extraneous-dependencies': 0,
      'import/prefer-default-export': 0,
      'node/no-missing-import': 0,
      'node/no-unpublished-import': 0,
      '@typescript-eslint/no-explicit-any': 0,
      'comma-dangle': 0,
      'quote-props': 0,
      '@typescript-eslint/no-unsafe-function-type': 0,
      'sonarjs/public-static-readonly': 0,
      'no-confusing-arrow': 0,
      'implicit-arrow-linebreak': 0,
      'operator-linebreak': 0,
      'sonarjs/no-nested-conditional': 0,
      'prefer-arrow-callback': 0,
      '@typescript-eslint/no-unused-expressions': 0,
      'max-len': 0,
      'no-spaced-func': 0,
      'func-call-spacing': 0,
      'object-curly-newline': 0,
      'unicorn/no-array-sort': 0,
      'newline-per-chained-call': 0,
      'global-require': 0,
      'import/no-dynamic-require': 0,
      'sonarjs/no-ignored-exceptions': 0,
      'unicorn/prefer-optional-catch-binding': 0,
      'unicorn/no-abusive-eslint-disable': 0,
      'no-lonely-if': 0,
      'node/no-unsupported-features/es-syntax': 0,
      'no-process-exit': 1,
      camelcase: 1,
      'class-methods-use-this': 0,
      'func-names': 0,
      'lines-between-class-members': 0,
      'max-classes-per-file': 0,
      'no-await-in-loop': 1,
      'no-bitwise': 0,
      'no-continue': 0,

      'no-implicit-coercion': [
        2,
        {
          boolean: true,
        },
      ],

      'no-nested-ternary': 0,
      'no-new': 1,

      'no-param-reassign': [
        2,
        {
          props: false,
        },
      ],

      'no-plusplus': 0,
      'no-restricted-syntax': [2, 'ForInStatement', 'LabeledStatement', 'WithStatement'],
      'no-return-await': 0,
      'no-sequences': 0,
      'no-shadow': 0,
      'no-underscore-dangle': 0,

      'no-unused-expressions': [
        2,
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],

      'no-useless-constructor': 0,
      'prefer-const': 2,

      'prefer-destructuring': [
        2,
        {
          VariableDeclarator: {
            array: false,
            object: true,
          },

          AssignmentExpression: {
            array: false,
            object: false,
          },
        },
      ],

      'prefer-rest-params': 0,

      'sort-imports': 0,
    },
  },
]);
