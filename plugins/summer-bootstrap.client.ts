export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const scope = useSummerScope()
    scope.initialize()

    const summer = useSummerData()
    void summer.load()
  })
})
