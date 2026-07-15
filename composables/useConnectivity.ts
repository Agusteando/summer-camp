type HealthState = 'checking' | 'online' | 'offline'

export const useConnectivity = () => {
  const browserOnline = useState('browser-online', () => true)
  const sourceState = useState<HealthState>('source-state', () => 'checking')
  const appState = useState<HealthState>('app-state', () => 'checking')
  const sourceName = useState('source-name', () => 'aurora')
  const latencyMs = useState('health-latency', () => 0)
  const checkedAt = useState<string | null>('health-checked-at', () => null)
  const timer = useState<ReturnType<typeof setInterval> | null>('health-timer', () => null)
  const config = useRuntimeConfig()

  const check = async () => {
    if (import.meta.client) browserOnline.value = navigator.onLine
    if (!browserOnline.value) {
      sourceState.value = 'offline'
      appState.value = 'offline'
      return
    }
    try {
      const result: any = await $fetch('/api/summer/health', { cache: 'no-store' })
      sourceState.value = result?.source?.reachable ? 'online' : 'offline'
      sourceName.value = String(result?.source?.source || sourceName.value || 'aurora').toLowerCase()
      appState.value = result?.app?.reachable ? 'online' : 'offline'
      latencyMs.value = Number(result?.latencyMs || 0)
      checkedAt.value = result?.checkedAt || new Date().toISOString()
    } catch {
      sourceState.value = 'offline'
      appState.value = 'offline'
      checkedAt.value = new Date().toISOString()
    }
  }

  const start = () => {
    if (!import.meta.client || timer.value) return
    browserOnline.value = navigator.onLine
    const onOnline = () => { browserOnline.value = true; check() }
    const onOffline = () => { browserOnline.value = false; sourceState.value = 'offline'; appState.value = 'offline' }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    check()
    timer.value = setInterval(check, Number(config.public.healthIntervalMs || 45000))
    onBeforeUnmount(() => {
      if (timer.value) clearInterval(timer.value)
      timer.value = null
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    })
  }

  return { browserOnline, sourceState, sourceName, appState, latencyMs, checkedAt, check, start }
}
