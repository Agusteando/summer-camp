const DEVICE_KEY = 'summer-device-id'

const createDeviceId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const useDeviceIdentity = () => {
  const deviceId = useState('summer-device-id', () => '')

  const get = () => {
    if (!import.meta.client) return deviceId.value || 'server'
    if (deviceId.value) return deviceId.value
    const stored = localStorage.getItem(DEVICE_KEY)
    deviceId.value = stored || createDeviceId()
    if (!stored) localStorage.setItem(DEVICE_KEY, deviceId.value)
    return deviceId.value
  }

  onMounted(get)
  return { deviceId, get }
}
