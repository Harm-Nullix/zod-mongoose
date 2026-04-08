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

  runtimeConfig: {
    public: {
      isDocsMode: true,
      isLocalMode: false
    }
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

  build: {
    transpile: ['estree-walker']
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
