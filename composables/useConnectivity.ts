type HealthState = 'checking' | 'online' | 'offline'

type ConnectivityListeners = {
  online: () => void
  offline: () => void
}

export const useConnectivity = () => {
  const browserOnline = useState('browser-online-v1', () => true)
  const sourceState = useState<HealthState>('source-state-v1', () => 'checking')
  const appState = useState<HealthState>('app-state-v1', () => 'checking')
  const latencyMs = useState('health-latency-v1', () => 0)
  const checkedAt = useState<string | null>('health-checked-at-v1', () => null)
  const timer = useState<ReturnType<typeof setInterval> | null>('health-timer-v1', () => null)
  const listeners = useState<ConnectivityListeners | null>('health-listeners-v1', () => null)
  const config = useRuntimeConfig()

  const check = async () => {
    if (import.meta.client) browserOnline.value = navigator.onLine
    if (!browserOnline.value) {
      sourceState.value = 'offline'
      appState.value = 'offline'
      return
    }
    try {
      const result: any = await $fetch('/api/summer/health', { cache: 'default' })
      sourceState.value = result?.source?.reachable ? 'online' : 'offline'
      appState.value = result?.app?.reachable ? 'online' : 'offline'
      latencyMs.value = Number(result?.latencyMs || 0)
      checkedAt.value = result?.checkedAt || new Date().toISOString()
    } catch {
      sourceState.value = 'offline'
      appState.value = 'offline'
      checkedAt.value = new Date().toISOString()
    }
  }

  const stop = () => {
    if (timer.value) clearInterval(timer.value)
    timer.value = null
    if (import.meta.client && listeners.value) {
      window.removeEventListener('online', listeners.value.online)
      window.removeEventListener('offline', listeners.value.offline)
    }
    listeners.value = null
  }

  const start = () => {
    if (!import.meta.client || timer.value) return
    browserOnline.value = navigator.onLine
    const online = () => { browserOnline.value = true; void check() }
    const offline = () => { browserOnline.value = false; sourceState.value = 'offline'; appState.value = 'offline' }
    listeners.value = { online, offline }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    void check()
    timer.value = setInterval(check, Number(config.public.healthIntervalMs || 45000))
  }

  onBeforeUnmount(stop)

  return { browserOnline, sourceState, appState, latencyMs, checkedAt, check, start, stop }
}
