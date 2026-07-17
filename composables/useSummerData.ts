import type { AttendanceMutation, AttendanceStatus, SnapshotResponse, SummerStudent } from '~/types/summer'

let activeRefresh: Promise<boolean> | null = null

const localDate = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const makeId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export const useSummerData = () => {
  const snapshot = useState<SnapshotResponse | null>('summer-snapshot-sheets-v1', () => null)
  const selectedDate = useState('summer-date-sheets-v1', localDate)
  const loading = useState('summer-loading-sheets-v1', () => false)
  const updating = useState('summer-updating-sheets-v1', () => false)
  const error = useState<string | null>('summer-error-sheets-v1', () => null)
  const initialized = useState('summer-initialized-sheets-v1', () => false)
  const poller = useState<ReturnType<typeof setInterval> | null>('summer-poller-sheets-v1', () => null)
  const queue = useAttendanceQueue()
  const device = useDeviceIdentity()
  const config = useRuntimeConfig()

  const cacheKey = () => `summer-snapshot:sheets-v1:${selectedDate.value}`

  const saveLocal = () => {
    if (!import.meta.client || !snapshot.value) return
    localStorage.setItem(cacheKey(), JSON.stringify(snapshot.value))
  }

  const recalculateSummaries = () => {
    if (!snapshot.value) return
    snapshot.value.summaries = snapshot.value.summaries.map((summary) => {
      const rows = snapshot.value!.students.filter((student) => student.plantel === summary.plantel)
      return {
        ...summary,
        total: rows.length,
        present: rows.filter((student) => student.attendance === 'present').length,
        absent: rows.filter((student) => student.attendance === 'absent').length,
        unmarked: rows.filter((student) => student.attendance === 'unmarked').length
      }
    })
  }

  const applyPending = async () => {
    if (!snapshot.value) return
    const pending = await queue.list()
    const latest = new Map<string, AttendanceMutation>()
    pending
      .filter((item) => item.date === selectedDate.value)
      .forEach((item) => latest.set(item.studentId, item))
    if (!latest.size) return
    snapshot.value.students = snapshot.value.students.map((student) => {
      const mutation = latest.get(student.id)
      return mutation ? { ...student, attendance: mutation.status, attendanceUpdatedAt: mutation.clientTimestamp } : student
    })
    recalculateSummaries()
  }

  const paintLocal = async () => {
    if (!import.meta.client) return false
    try {
      const raw = localStorage.getItem(cacheKey())
      if (!raw) return false
      const parsed = JSON.parse(raw) as SnapshotResponse
      if (!Array.isArray(parsed?.students) || !Array.isArray(parsed?.summaries)) return false
      snapshot.value = parsed
      await applyPending()
      return true
    } catch {
      localStorage.removeItem(cacheKey())
      return false
    }
  }

  const refresh = async (background = false) => {
    if (activeRefresh) return await activeRefresh
    activeRefresh = (async () => {
      const hasSnapshot = Boolean(snapshot.value)
      loading.value = !background && !hasSnapshot
      updating.value = background || hasSnapshot
      error.value = null
      try {
        const result = await $fetch<SnapshotResponse>('/api/summer/snapshot', {
          query: { date: selectedDate.value },
          cache: 'no-store',
          retry: 0
        })
        if (!Array.isArray(result?.students) || !Array.isArray(result?.summaries)) {
          throw new Error('La respuesta de alumnos no tiene la estructura esperada.')
        }
        snapshot.value = result
        await applyPending()
        saveLocal()
        if (import.meta.client) void queue.flush()
        return true
      } catch (cause: any) {
        error.value = cause?.data?.message || cause?.message || 'No se pudo actualizar la lista.'
        return false
      } finally {
        loading.value = false
        updating.value = false
      }
    })()
    try { return await activeRefresh } finally { activeRefresh = null }
  }

  const load = async () => {
    if (initialized.value) return
    initialized.value = true
    device.get()
    await queue.refreshCount()
    const painted = await paintLocal()
    await refresh(painted)
  }

  const markAttendance = async (student: SummerStudent, requested: Exclude<AttendanceStatus, 'unmarked'>) => {
    if (!snapshot.value) return
    const status: AttendanceStatus = student.attendance === requested ? 'unmarked' : requested
    const now = new Date().toISOString()
    snapshot.value.students = snapshot.value.students.map((row) => row.id === student.id
      ? { ...row, attendance: status, attendanceUpdatedAt: now }
      : row)
    recalculateSummaries()
    saveLocal()

    const mutation: AttendanceMutation = {
      queueKey: `${selectedDate.value}:${student.id}`,
      idempotencyKey: makeId(),
      deviceId: device.get(),
      studentId: student.id,
      date: selectedDate.value,
      status,
      clientTimestamp: now
    }
    await queue.put(mutation)
    void queue.flush()
  }

  const setDate = async (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date === selectedDate.value) return
    selectedDate.value = date
    snapshot.value = null
    error.value = null
    const painted = await paintLocal()
    await refresh(painted)
  }

  const stopPolling = () => {
    if (poller.value) clearInterval(poller.value)
    poller.value = null
  }

  const startPolling = () => {
    if (!import.meta.client || poller.value) return
    void load()
    poller.value = setInterval(() => void refresh(true), Number(config.public.refreshIntervalMs || 120000))
  }

  return {
    snapshot,
    selectedDate,
    loading,
    updating,
    error,
    pendingCount: queue.pendingCount,
    flushing: queue.flushing,
    load,
    refresh,
    setDate,
    markAttendance,
    startPolling,
    stopPolling
  }
}
