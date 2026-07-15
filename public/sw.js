const BUILD_ID = 'summer-v10-stability'
const CACHE = 'summer-camp-shell-v10'
const CORE = [
  '/', '/attendance', '/setup', '/manifest.webmanifest', '/brand/iecs-iedis-logo.png',
  '/icons/dinos.png', '/icons/dinos-192.png', '/icons/dinos-512.png', '/icons/abejas.png', '/icons/leones.png', '/icons/tigres.png', '/icons/pandas.png',
  '/icons/comida.svg', '/icons/cena.svg'
]

const withTimeout = (request, timeoutMs = 5000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(request, { signal: controller.signal, cache: 'no-store' }).finally(() => clearTimeout(timer))
}

const cacheResponse = async (request, response) => {
  if (response?.ok) await (await caches.open(CACHE)).put(request, response.clone())
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('summer-camp-shell-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SUMMER_BUILD' && event.data.buildId !== BUILD_ID) self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  const isNavigation = request.mode === 'navigate'
  const isVersionedStatic = url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/') || request.destination === 'image' || request.destination === 'manifest'

  if (isVersionedStatic) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => cacheResponse(request, response))))
    return
  }

  if (isNavigation || url.pathname.startsWith('/_nuxt/') || request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      withTimeout(request)
        .then((response) => cacheResponse(request, response))
        .catch(async () => (await caches.match(request)) || (isNavigation ? await caches.match('/') : Response.error()))
    )
  }
})
