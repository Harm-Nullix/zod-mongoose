// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: [
    '@nullix/zod-mongoose-studio'
  ],
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    'nuxt-og-image',
    'nuxt-llms',
    '@nuxtjs/mcp-toolkit'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  content: {
    build: {
      markdown: {
        toc: {
          searchDepth: 1
        }
      }
    }
  },

  runtimeConfig: {
    public: {
      isDocsMode: true,
      isLocalMode: false
    }
  },

  build: {
    transpile: ['estree-walker']
  },

  routeRules: {
    '/getting-started/installation': { redirect: '/getting-started' },
    '/getting-started/usage': { redirect: '/guides' },
    '/api/nested-object-ids': { redirect: '/guides/nested-object-ids' },
    '/api/reusing-object-schemas': { redirect: '/guides/reusing-object-schemas' },
    '/api/strict-model': { redirect: '/guides/strict-model' },
    '/api/hooks-and-plugins': { redirect: '/guides/plugins-and-hooks' },
    '/api/deprecated': { redirect: '/guides/migration' },
    '/online-playground': { redirect: '/studio' }
  },

  experimental: {
    asyncContext: true,
    payloadExtraction: false
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    prerender: {
      routes: [
        '/',
        '/playground'
      ],
      crawlLinks: true,
      autoSubfolderIndex: false,
      failOnError: false
    }
  },

  vite: {
    optimizeDeps: {
      exclude: ['monaco-editor']
    }
  },

  hooks: {
    'nitro:config'(config) {
      config.externals = config.externals || {}
      config.externals.external = config.externals.external || []
      config.externals.external.push('esbuild')
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  icon: {
    provider: 'iconify'
  },

  llms: {
    domain: 'https://zodmongoose.com',
    title: 'zod-mongoose',
    description: 'Seamlessly integrate Zod with Mongoose for full type safety.',
    full: {
      title: 'zod-mongoose - Full Documentation',
      description: 'This is the full documentation for zod-mongoose.'
    },
    sections: [
      {
        title: 'Getting Started',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/getting-started%' }
        ]
      },
      {
        title: 'Guides',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/guides%' }
        ]
      },
      {
        title: 'API Reference',
        contentCollection: 'docs',
        contentFilters: [
          { field: 'path', operator: 'LIKE', value: '/api%' }
        ]
      }
    ]
  },

  mcp: {
    name: 'zod-mongoose'
  }
})
