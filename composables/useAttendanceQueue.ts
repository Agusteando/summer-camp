import type { AttendanceMutation } from '~/types/summer'

const DB_NAME = 'summer-camp-offline'
const STORE = 'attendance_queue'

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 4)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'queueKey' })
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const runTransaction = async <T>(mode: IDBTransactionMode, execute: (store: IDBObjectStore, setResult: (value: T) => void) => void) => {
  const db = await openDb()
  return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    let result: T
    let hasResult = false
    const setResult = (value: T) => { result = value; hasResult = true }
    tx.oncomplete = () => { db.close(); resolve(hasResult ? result! : undefined as T) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error || new Error('La cola local fue cancelada.')) }
    try { execute(store, setResult) } catch (error) { tx.abort(); reject(error) }
  })
}

export const useAttendanceQueue = () => {
  const pendingCount = useState('pending-attendance-count-v2', () => 0)
  const flushing = useState('attendance-flushing-v2', () => false)

  const list = async () => {
    if (!import.meta.client || !('indexedDB' in window)) return [] as AttendanceMutation[]
    return await runTransaction<AttendanceMutation[]>('readonly', (store, setResult) => {
      const request = store.getAll()
      request.onsuccess = () => setResult((request.result || []) as AttendanceMutation[])
    })
  }

  const refreshCount = async () => { pendingCount.value = (await list()).length }

  const put = async (mutation: AttendanceMutation) => {
    if (!import.meta.client || !('indexedDB' in window)) return
    await runTransaction<void>('readwrite', (store) => { store.put(mutation) })
    await refreshCount()
  }

  const remove = async (keys: string[]) => {
    if (!keys.length || !import.meta.client || !('indexedDB' in window)) return
    await runTransaction<void>('readwrite', (store) => { keys.forEach((key) => store.delete(key)) })
    await refreshCount()
  }

  const flush = async () => {
    if (!import.meta.client || flushing.value || !navigator.onLine) return false
    flushing.value = true
    try {
      let queued = await list()
      while (queued.length) {
        const batch = queued.slice(0, 250)
        const deviceId = batch[0]?.deviceId || 'anonymous'
        const response = await $fetch<{ accepted: string[] }>('/api/summer/attendance/batch', {
          method: 'POST',
          headers: {
            'x-summer-device-id': deviceId,
            'x-summer-actor-name': `Dispositivo ${deviceId.slice(0, 8)}`
          },
          body: { mutations: batch }
        })
        const accepted = new Set(response.accepted || [])
        const keys = batch.filter((item) => accepted.has(item.idempotencyKey)).map((item) => item.queueKey)
        if (!keys.length) return false
        await remove(keys)
        queued = await list()
      }
      return true
    } catch {
      return false
    } finally {
      flushing.value = false
    }
  }

  return { pendingCount, flushing, list, put, remove, flush, refreshCount }
}
