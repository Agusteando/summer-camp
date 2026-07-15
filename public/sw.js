const CACHE = 'summer-camp-shell-v3'
const CORE = [
  '/', '/attendance', '/setup', '/manifest.webmanifest', '/brand/iecs-iedis-logo.png',
  '/icons/dinos.png', '/icons/dinos-192.png', '/icons/dinos-512.png', '/icons/abejas.png', '/icons/leones.png', '/icons/tigres.png', '/icons/pandas.png',
  '/icons/comida.svg', '/icons/cena.svg'
]

const sameOriginRequest = (value) => {
  const url = new URL(value, self.location.origin)
  return url.origin === self.location.origin && !url.pathname.startsWith('/api/') ? url.toString() : null
}

const put = async (request, response) => {
  if (response?.ok) await (await caches.open(CACHE)).put(request, response.clone())
  return response
}

const fetchWithTimeout = (request, timeoutMs = 3500) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_URLS' || !Array.isArray(event.data.urls)) return
  const urls = Array.from(new Set(event.data.urls.map(sameOriginRequest).filter(Boolean)))
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await Promise.allSettled(urls.map((url) => cache.add(url)))
  }))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  const isAsset = url.pathname.startsWith('/_nuxt/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/') || request.destination === 'script' || request.destination === 'style' || request.destination === 'image' || request.destination === 'manifest'

  if (isAsset) {
    event.respondWith(caches.match(request).then((cached) => {
      const update = fetch(request).then((response) => put(request, response)).catch(() => null)
      return cached || update
    }))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetchWithTimeout(request).then((response) => put(request, response)).catch(async () => {
      return await caches.match(request) || await caches.match('/')
    }))
    return
  }

  event.respondWith(fetch(request).then((response) => put(request, response)).catch(() => caches.match(request)))
})
