export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js?v=1', { updateViaCache: 'none' })
      await registration.update().catch(() => undefined)
    } catch {
      // La aplicación funciona sin service worker; solo se pierde el shell sin conexión.
    }
  }, { once: true })
})
