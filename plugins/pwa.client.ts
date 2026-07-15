export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const urls = performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((value) => value.startsWith(location.origin) && !new URL(value).pathname.startsWith('/api/'))
      urls.push(location.href)
      const worker = registration.active || registration.waiting || registration.installing || navigator.serviceWorker.controller
      worker?.postMessage({ type: 'CACHE_URLS', urls })
    } catch {}
  }, { once: true })
})
