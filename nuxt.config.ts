export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'es-MX' },
      title: 'Summer Camp · IECS / IEDIS',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0b77c8' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'description', content: 'Operación diaria, servicios y asistencia de Summer Camp IECS / IEDIS' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/png', href: '/icons/dinos.png' },
        { rel: 'apple-touch-icon', href: '/icons/dinos-180.png' }
      ]
    }
  },
  runtimeConfig: {
    summerYear: process.env.SUMMER_YEAR || '2026',
    summerTimeZone: process.env.SUMMER_TIME_ZONE || 'America/Mexico_City',
    summerSheetsApiUrl: process.env.SUMMER_SHEETS_API_URL,
    summerSheetsApiKey: process.env.SUMMER_SHEETS_API_KEY,
    summerSheetsTimeoutMs: process.env.SUMMER_SHEETS_TIMEOUT_MS || '20000',
    summerSheetsCacheMs: process.env.SUMMER_SHEETS_CACHE_MS || '60000',
    summerSheetsStaleMs: process.env.SUMMER_SHEETS_STALE_MS || '900000',
    appMysqlHost: process.env.APP_MYSQL_HOST,
    appMysqlPort: process.env.APP_MYSQL_PORT || '3306',
    appMysqlUser: process.env.APP_MYSQL_USER,
    appMysqlPassword: process.env.APP_MYSQL_PASSWORD,
    appMysqlDatabase: process.env.APP_MYSQL_DATABASE,
    public: {
      refreshIntervalMs: Number(process.env.NUXT_PUBLIC_REFRESH_INTERVAL_MS || 120000),
      healthIntervalMs: Number(process.env.NUXT_PUBLIC_HEALTH_INTERVAL_MS || 45000),
      appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
      buildId: 'summer-sheets-v1'
    }
  },
  nitro: {
    preset: 'vercel',
    compressPublicAssets: true,
    routeRules: {
      '/api/summer/snapshot': { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
      '/api/summer/attendance/**': { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
      '/api/summer/health': { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
      '/': { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
      '/attendance': { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
      '/icons/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
      '/brand/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  }
})
