import type { AttendanceMutation, AttendanceStatus, SnapshotResponse, SummerStudent } from '~/types/summer'

const localDate = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export const useSummerData = () => {
  const snapshot = useState<SnapshotResponse | null>('summer-snapshot', () => null)
  const selectedDate = useState('summer-date', localDate)
  const loading = useState('summer-loading', () => false)
  const updating = useState('summer-updating', () => false)
  const error = useState<string | null>('summer-error', () => null)
  const lastUpdatedAt = useState<string | null>('summer-last-updated', () => null)
  const poller = useState<ReturnType<typeof setInterval> | null>('summer-poller', () => null)
  const queue = useAttendanceQueue()
  const device = useDeviceIdentity()
  const config = useRuntimeConfig()

  const cacheKey = () => `summer-snapshot:v2:${selectedDate.value}`

  const recalculateSummaries = () => {
    if (!snapshot.value) return
    snapshot.value.summaries = snapshot.value.summaries.map((summary) => {
      const rows = snapshot.value!.students.filter((student) => student.plantel === summary.plantel)
      return {
        ...summary,
        total: rows.length,
        present: rows.filter((student) => student.attendance === 'present').length,
        absent: rows.filter((student) => student.attendance === 'absent').length,
        unmarked: rows.filter((student) => student.attendance === 'unmarked').length,
        food: rows.filter((student) => student.mealCount > 0).length,
        pendingProgram: rows.filter((student) => student.program === 'unassigned').length
      }
    })
  }

  const applyPending = async () => {
    if (!snapshot.value) return
    const pending = await queue.list()
    const latest = new Map<string, AttendanceMutation>()
    const students = new Map(snapshot.value.students.map((student) => [student.matricula, student]))
    const tokenUpdates: AttendanceMutation[] = []
    pending.filter((item) => item.date === selectedDate.value).forEach((item) => {
      const token = students.get(item.matricula)?.attendanceToken
      const current = token && token !== item.studentToken ? { ...item, studentToken: token } : item
      if (current !== item) tokenUpdates.push(current)
      latest.set(item.matricula, current)
    })
    if (tokenUpdates.length) await queue.putMany(tokenUpdates)
    if (!latest.size) return
    snapshot.value.students = snapshot.value.students.map((student) => {
      const mutation = latest.get(student.matricula)
      return mutation ? { ...student, attendance: mutation.status, attendanceUpdatedAt: mutation.clientTimestamp } : student
    })
    recalculateSummaries()
  }

  const paintCache = async () => {
    if (!import.meta.client) return false
    try {
      const raw = localStorage.getItem(cacheKey())
      if (!raw) return false
      snapshot.value = JSON.parse(raw)
      if (snapshot.value) snapshot.value.meta.cached = true
      await applyPending()
      return true
    } catch {
      return false
    }
  }

  const refresh = async (background = false) => {
    if (updating.value) return
    if (background) updating.value = true
    else loading.value = true
    error.value = null
    try {
      const result = await $fetch<SnapshotResponse>('/api/summer/snapshot', { query: { date: selectedDate.value }, cache: 'no-store' })
      snapshot.value = result
      lastUpdatedAt.value = result.meta.generatedAt
      if (import.meta.client) localStorage.setItem(cacheKey(), JSON.stringify(result))
      await applyPending()
      if (import.meta.client) void queue.flush()
    } catch (cause: any) {
      error.value = cause?.data?.message || cause?.message || 'No se pudo actualizar.'
    } finally {
      loading.value = false
      updating.value = false
    }
  }

  const load = async () => {
    device.get()
    const painted = await paintCache()
    await queue.refreshCount()
    await refresh(painted)
  }

  const setDate = async (date: string) => {
    selectedDate.value = date
    snapshot.value = null
    await load()
  }

  const markAttendance = async (student: SummerStudent, status: Exclude<AttendanceStatus, 'unmarked'>) => {
    if (!snapshot.value) return
    const deviceId = device.get()
    const now = new Date().toISOString()
    const mutation: AttendanceMutation = {
      queueKey: `${selectedDate.value}|${student.matricula}`,
      idempotencyKey: `${selectedDate.value}:${student.matricula}`,
      deviceId,
      studentToken: student.attendanceToken,
      matricula: student.matricula,
      date: selectedDate.value,
      status,
      clientTimestamp: now
    }
    snapshot.value.students = snapshot.value.students.map((row) => row.matricula === student.matricula ? { ...row, attendance: status, attendanceUpdatedAt: now } : row)
    recalculateSummaries()
    if (import.meta.client) localStorage.setItem(cacheKey(), JSON.stringify(snapshot.value))
    await queue.put(mutation)
    await queue.flush()
  }

  const startPolling = () => {
    if (!import.meta.client || poller.value) return
    const interval = Number(config.public.refreshIntervalMs || 120000)
    poller.value = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refresh(true)
    }, interval)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void queue.flush()
        void refresh(true)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    onBeforeUnmount(() => {
      if (poller.value) clearInterval(poller.value)
      poller.value = null
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    })
  }

  return {
    snapshot,
    selectedDate,
    loading,
    updating,
    error,
    lastUpdatedAt,
    pendingCount: queue.pendingCount,
    flushing: queue.flushing,
    load,
    refresh,
    setDate,
    markAttendance,
    startPolling
  }
}
