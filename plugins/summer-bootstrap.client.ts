export default defineNuxtPlugin((nuxtApp) => {
  const summer = useSummerData()
  let started = false

  const boot = (trigger: string) => {
    if (started) return
    started = true
    summer.noteClientMounted(trigger)
    if (!summer.loadLifecycle.value.loadAttempted) void summer.load(trigger)
  }

  nuxtApp.hook('app:mounted', () => boot('app:mounted'))

  window.setTimeout(() => {
    if (!summer.loadLifecycle.value.loadAttempted) boot('bootstrap-failsafe-2500ms')
  }, 2500)
})
