// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  app: {
    // Allow hosting the app in a sub-directory by respecting the
    // NUXT_APP_BASE_URL environment variable. Defaults to '/'.
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
  },
});
