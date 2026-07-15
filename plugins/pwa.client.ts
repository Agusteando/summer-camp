export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js?v=13', { updateViaCache: 'none' })
      await registration.update().catch(() => undefined)
      await navigator.serviceWorker.ready
      const worker = registration.active || registration.waiting || registration.installing
      worker?.postMessage({ type: 'SUMMER_BUILD', buildId: 'summer-v13-shared-snapshot-cache' })
    } catch (cause) {
      ;(window as any).__SUMMER_PWA_ERROR__ = {
        at: new Date().toISOString(),
        message: String((cause as any)?.message || cause)
      }
    }
  }, { once: true })
})
