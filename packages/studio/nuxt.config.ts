export default defineNuxtConfig({
  modules: ["@nuxt/ui"],

  runtimeConfig: {
    public: {
      // Standalone Studio development uses the loopback-only local endpoint.
      // Embedders must explicitly opt into docs mode.
      isDocsMode: process.env.DOCS_MODE === "true",

      // By default, local file system access is OFF.
      // The CLI script will explicitly pass LOCAL_MODE="true" to enable it.
      isLocalMode: process.env.LOCAL_MODE === "true",
      isExecutionEnabled: true,
    },
  },
  css: ["~/assets/css/main.css"],

  compatibilityDate: "2026-04-01",
});
