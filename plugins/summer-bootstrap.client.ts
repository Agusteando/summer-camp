export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const summer = useSummerData()
    void summer.load()
  })
})
