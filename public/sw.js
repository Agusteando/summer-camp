const CACHE = 'summer-camp-shell-scope-v4'
const CORE = [
  '/', '/attendance', '/manifest.webmanifest', '/brand/iecs-iedis-logo.png',
  '/icons/dinos.png', '/icons/dinos-192.png', '/icons/dinos-512.png',
  '/icons/abejas.png', '/icons/leones.png', '/icons/tigres.png', '/icons/pandas.png'
]

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

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match('/'))))
    return
  }

  if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/') || request.destination === 'image' || request.destination === 'manifest') {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
      return response
    })))
  }
})
