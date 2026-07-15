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
        { name: 'description', content: 'Control operativo de Summer Camp IECS / IEDIS' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/png', href: '/icons/dinos.png' },
        { rel: 'apple-touch-icon', href: '/icons/dinos-180.png' }
      ]
    }
  },
  runtimeConfig: {
    summerSigningSecret: process.env.SUMMER_SIGNING_SECRET,
    summerYear: process.env.SUMMER_YEAR || '2026',
    summerCycle: process.env.SUMMER_CYCLE || '2026',
    summerConceptIds: process.env.SUMMER_CONCEPT_IDS || '986,987,988',
    summerPlanteles: process.env.SUMMER_PLANTELES || 'PREEM,GM,PM,SM,PREET,PT,ST',
    summerSourceMode: process.env.SUMMER_SOURCE_MODE || 'aurora',
    auroraBaseUrl: process.env.AURORA_BASE_URL,
    auroraApiToken: process.env.AURORA_API_TOKEN,
    auroraTimeoutMs: process.env.AURORA_TIMEOUT_MS || '12000',
    appMysqlHost: process.env.APP_MYSQL_HOST,
    appMysqlPort: process.env.APP_MYSQL_PORT || '3306',
    appMysqlUser: process.env.APP_MYSQL_USER,
    appMysqlPassword: process.env.APP_MYSQL_PASSWORD,
    appMysqlDatabase: process.env.APP_MYSQL_DATABASE,
    appMysqlSsl: process.env.APP_MYSQL_SSL || 'false',
    financialMysqlHost: process.env.FINANCIAL_MYSQL_HOST,
    financialMysqlPort: process.env.FINANCIAL_MYSQL_PORT || '3306',
    financialMysqlUser: process.env.FINANCIAL_MYSQL_USER,
    financialMysqlPassword: process.env.FINANCIAL_MYSQL_PASSWORD,
    financialMysqlDatabase: process.env.FINANCIAL_MYSQL_DATABASE,
    financialMysqlSsl: process.env.FINANCIAL_MYSQL_SSL || 'false',
    studentPhotoBaseUrl: process.env.STUDENT_PHOTO_BASE_URL,
    studentPhotoApiKey: process.env.STUDENT_PHOTO_API_KEY,
    demoMode: process.env.SUMMER_DEMO_MODE || 'false',
    public: {
      refreshIntervalMs: Number(process.env.NUXT_PUBLIC_REFRESH_INTERVAL_MS || 120000),
      healthIntervalMs: Number(process.env.NUXT_PUBLIC_HEALTH_INTERVAL_MS || 45000),
      appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local'
    }
  },
  nitro: {
    preset: 'vercel',
    compressPublicAssets: true,
    routeRules: {
      '/api/**': { headers: { 'Cache-Control': 'no-store' } },
      '/icons/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
      '/brand/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  }
})
