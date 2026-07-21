import { ATTENDANCE_TYPES, attendanceStatusFor } from '~/shared/catalog'
import type { AttendanceByType, AttendanceMutation, AttendanceStatus, AttendanceType, AttendanceUpdatedAtByType, SnapshotResponse, SummerStudent } from '~/types/summer'

let activeRefresh: { date: string; promise: Promise<boolean> } | null = null

const localDate = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const makeId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const blankAttendance = () => Object.fromEntries(ATTENDANCE_TYPES.map((type) => [type.key, 'unmarked'])) as AttendanceByType
const blankAttendanceTimes = () => Object.fromEntries(ATTENDANCE_TYPES.map((type) => [type.key, null])) as AttendanceUpdatedAtByType

const withAttendance = (student: SummerStudent, type: AttendanceType, status: AttendanceStatus, updatedAt: string | null): SummerStudent => {
  const attendanceByType = { ...blankAttendance(), ...(student.attendanceByType || {}), [type]: status }
  const attendanceUpdatedAtByType = { ...blankAttendanceTimes(), ...(student.attendanceUpdatedAtByType || {}), [type]: updatedAt }
  return {
    ...student,
    attendanceByType,
    attendanceUpdatedAtByType,
    attendance: type === 'general' ? status : attendanceByType.general,
    attendanceUpdatedAt: type === 'general' ? updatedAt : attendanceUpdatedAtByType.general
  }
}

export const useSummerData = () => {
  const snapshot = useState<SnapshotResponse | null>('summer-snapshot-sheets-v3', () => null)
  const selectedDate = useState('summer-date-sheets-v3', localDate)
  const loading = useState('summer-loading-sheets-v3', () => false)
  const updating = useState('summer-updating-sheets-v3', () => false)
  const error = useState<string | null>('summer-error-sheets-v3', () => null)
  const initialized = useState('summer-initialized-sheets-v3', () => false)
  const poller = useState<ReturnType<typeof setInterval> | null>('summer-poller-sheets-v3', () => null)
  const queue = useAttendanceQueue()
  const device = useDeviceIdentity()
  const config = useRuntimeConfig()

  const cacheKey = () => `summer-snapshot:sheets-v3:${selectedDate.value}`
  const legacyCacheKey = () => `summer-snapshot:sheets-v2:${selectedDate.value}`

  const normalizeSnapshot = (value: SnapshotResponse): SnapshotResponse => ({
    ...value,
    students: value.students.map((student) => {
      const attendanceByType = { ...blankAttendance(), ...(student.attendanceByType || {}), general: student.attendance || student.attendanceByType?.general || 'unmarked' }
      const attendanceUpdatedAtByType = {
        ...blankAttendanceTimes(),
        ...(student.attendanceUpdatedAtByType || {}),
        general: student.attendanceUpdatedAt || student.attendanceUpdatedAtByType?.general || null
      }
      return { ...student, attendance: attendanceByType.general, attendanceUpdatedAt: attendanceUpdatedAtByType.general, attendanceByType, attendanceUpdatedAtByType }
    })
  })

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
        present: rows.filter((student) => attendanceStatusFor(student, 'general') === 'present').length,
        absent: rows.filter((student) => attendanceStatusFor(student, 'general') === 'absent').length,
        unmarked: rows.filter((student) => attendanceStatusFor(student, 'general') === 'unmarked').length
      }
    })
  }

  const applyPending = async () => {
    if (!snapshot.value) return
    const pending = await queue.list()
    const latest = new Map<string, AttendanceMutation>()
    pending
      .filter((item) => item.date === selectedDate.value)
      .forEach((item) => {
        const attendanceType = item.attendanceType || 'general'
        latest.set(`${item.studentId}:${attendanceType}`, { ...item, attendanceType })
      })
    if (!latest.size) return
    snapshot.value.students = snapshot.value.students.map((student) => {
      let next = student
      ATTENDANCE_TYPES.forEach(({ key }) => {
        const mutation = latest.get(`${student.id}:${key}`)
        if (mutation) next = withAttendance(next, key, mutation.status, mutation.clientTimestamp)
      })
      return next
    })
    recalculateSummaries()
  }

  const paintLocal = async () => {
    if (!import.meta.client) return false
    try {
      const currentKey = cacheKey()
      const raw = localStorage.getItem(currentKey) || localStorage.getItem(legacyCacheKey())
      if (!raw) return false
      const parsed = JSON.parse(raw) as SnapshotResponse
      if (!Array.isArray(parsed?.students) || !Array.isArray(parsed?.summaries)) return false
      snapshot.value = normalizeSnapshot(parsed)
      await applyPending()
      saveLocal()
      return true
    } catch {
      localStorage.removeItem(cacheKey())
      localStorage.removeItem(legacyCacheKey())
      return false
    }
  }

  const refresh = async (background = false) => {
    const requestedDate = selectedDate.value
    if (activeRefresh?.date === requestedDate) return await activeRefresh.promise

    const promise = (async () => {
      const hasSnapshot = Boolean(snapshot.value)
      loading.value = !background && !hasSnapshot
      updating.value = background || hasSnapshot
      error.value = null
      try {
        const result = await $fetch<SnapshotResponse>('/api/summer/snapshot', {
          query: { date: requestedDate },
          cache: 'no-store',
          retry: 0
        })
        if (!Array.isArray(result?.students) || !Array.isArray(result?.summaries)) {
          throw new Error('La respuesta de alumnos no tiene la estructura esperada.')
        }
        if (selectedDate.value !== requestedDate) return false
        snapshot.value = normalizeSnapshot(result)
        await applyPending()
        saveLocal()
        if (import.meta.client) void queue.flush()
        return true
      } catch (cause: any) {
        if (selectedDate.value === requestedDate) {
          error.value = cause?.data?.message || cause?.message || 'No se pudo actualizar la lista.'
        }
        return false
      } finally {
        if (selectedDate.value === requestedDate) {
          loading.value = false
          updating.value = false
        }
      }
    })()

    activeRefresh = { date: requestedDate, promise }
    try {
      return await promise
    } finally {
      if (activeRefresh?.promise === promise) activeRefresh = null
    }
  }

  const load = async () => {
    if (initialized.value) return
    initialized.value = true
    device.get()
    await queue.refreshCount()
    const painted = await paintLocal()
    await refresh(painted)
  }

  const markAttendance = async (
    student: SummerStudent,
    requested: Exclude<AttendanceStatus, 'unmarked'>,
    attendanceType: AttendanceType = 'general'
  ) => {
    if (!snapshot.value) return
    const current = attendanceStatusFor(student, attendanceType)
    const status: AttendanceStatus = current === requested ? 'unmarked' : requested
    const now = new Date().toISOString()
    snapshot.value.students = snapshot.value.students.map((row) => row.id === student.id
      ? withAttendance(row, attendanceType, status, now)
      : row)
    recalculateSummaries()
    saveLocal()

    const mutation: AttendanceMutation = {
      queueKey: `${selectedDate.value}:${attendanceType}:${student.id}`,
      idempotencyKey: makeId(),
      deviceId: device.get(),
      studentId: student.id,
      date: selectedDate.value,
      attendanceType,
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
