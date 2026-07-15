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
      script: [
        {
          key: 'summer-stability-preboot-v13',
          innerHTML: `(() => {
            const state = { buildId: 'summer-v13-shared-snapshot-cache', startedAt: new Date().toISOString(), finishedAt: null, serviceWorkersFound: 0, serviceWorkersUnregistered: 0, cachesFound: [], cachesDeleted: [], legacySnapshotsDeleted: [], errors: [] };
            window.__SUMMER_PREBOOT__ = state;
            const jobs = [];
            try {
              if ('serviceWorker' in navigator) jobs.push(navigator.serviceWorker.getRegistrations().then(async (registrations) => {
                state.serviceWorkersFound = registrations.length;
                const obsolete = registrations.filter((registration) => ![registration.active, registration.waiting, registration.installing].some((worker) => worker?.scriptURL?.includes('/sw.js?v=13')));
                const results = await Promise.allSettled(obsolete.map((registration) => registration.unregister()));
                state.serviceWorkersUnregistered = results.filter((result) => result.status === 'fulfilled' && result.value === true).length;
              }).catch((error) => state.errors.push({ stage: 'service-workers', message: String(error?.message || error) })));
              if ('caches' in window) jobs.push(caches.keys().then(async (names) => {
                state.cachesFound = names;
                const obsolete = names.filter((name) => name.startsWith('summer-camp-shell-') && name !== 'summer-camp-shell-v13');
                const results = await Promise.allSettled(obsolete.map(async (name) => ({ name, deleted: await caches.delete(name) })));
                state.cachesDeleted = results.filter((result) => result.status === 'fulfilled' && result.value.deleted).map((result) => result.value.name);
              }).catch((error) => state.errors.push({ stage: 'cache-storage', message: String(error?.message || error) })));
              try {
                const keys = Object.keys(localStorage);
                for (const key of keys) {
                  if (/^summer-snapshot:v(?:[1-9]|1[0-2]):/.test(key)) { localStorage.removeItem(key); state.legacySnapshotsDeleted.push(key); }
                }
              } catch (error) { state.errors.push({ stage: 'local-storage', message: String(error?.message || error) }); }
            } catch (error) { state.errors.push({ stage: 'preboot', message: String(error?.message || error) }); }
            Promise.allSettled(jobs).finally(() => {
              state.finishedAt = new Date().toISOString();
              const needsCleanReload = state.serviceWorkersUnregistered > 0 || state.cachesDeleted.length > 0;
              const guardKey = 'summer-v13-clean-reload';
              if (needsCleanReload && !sessionStorage.getItem(guardKey)) {
                sessionStorage.setItem(guardKey, state.finishedAt);
                state.reloadScheduled = true;
                const next = new URL(window.location.href);
                next.searchParams.set('__summer_build', 'v13');
                window.location.replace(next.toString());
                return;
              }
              if (!needsCleanReload) sessionStorage.removeItem(guardKey);
              window.dispatchEvent(new CustomEvent('summer:preboot-complete', { detail: state }));
            });
          })();`
        }
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
    summerPlanteles: process.env.SUMMER_PLANTELES || 'CT,PT,ST,PREEM,GM,PM,SM',
    summerSourceMode: process.env.SUMMER_SOURCE_MODE || 'aurora',
    auroraBaseUrl: process.env.AURORA_BASE_URL,
    auroraApiToken: process.env.AURORA_API_TOKEN,
    auroraTimeoutMs: process.env.AURORA_TIMEOUT_MS || '60000',
    appMysqlHost: process.env.APP_MYSQL_HOST,
    appMysqlPort: process.env.APP_MYSQL_PORT || '3306',
    appMysqlUser: process.env.APP_MYSQL_USER,
    appMysqlPassword: process.env.APP_MYSQL_PASSWORD,
    appMysqlDatabase: process.env.APP_MYSQL_DATABASE,
    financialMysqlHost: process.env.FINANCIAL_MYSQL_HOST,
    financialMysqlPort: process.env.FINANCIAL_MYSQL_PORT || '3306',
    financialMysqlUser: process.env.FINANCIAL_MYSQL_USER,
    financialMysqlPassword: process.env.FINANCIAL_MYSQL_PASSWORD,
    financialMysqlDatabase: process.env.FINANCIAL_MYSQL_DATABASE,
    studentPhotoBaseUrl: process.env.STUDENT_PHOTO_BASE_URL,
    studentPhotoApiKey: process.env.STUDENT_PHOTO_API_KEY,
    demoMode: process.env.SUMMER_DEMO_MODE || 'false',
    public: {
      refreshIntervalMs: Number(process.env.NUXT_PUBLIC_REFRESH_INTERVAL_MS || 120000),
      healthIntervalMs: Number(process.env.NUXT_PUBLIC_HEALTH_INTERVAL_MS || 45000),
      appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
      buildId: 'summer-v13-shared-snapshot-cache',
      diagnosticVersion: 13,
      diagnosticsEnabled: process.env.NUXT_PUBLIC_SUMMER_DIAGNOSTICS !== 'false'
    }
  },
  nitro: {
    preset: 'vercel',
    compressPublicAssets: true,
    routeRules: {
      '/api/summer/snapshot': { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'CDN-Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600', 'Vercel-CDN-Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } },
      '/api/summer/health': { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'CDN-Cache-Control': 'public, s-maxage=45, stale-while-revalidate=90', 'Vercel-CDN-Cache-Control': 'public, s-maxage=45, stale-while-revalidate=90' } },
      '/': { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
      '/attendance': { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
      '/setup': { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
      '/icons/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
      '/brand/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  }
})
