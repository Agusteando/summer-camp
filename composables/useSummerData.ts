import type { AttendanceMutation, AttendanceStatus, ClientRequestDiagnostic, ClientTraceEvent, SnapshotResponse, SummerLoadLifecycle, SummerStudent } from '~/types/summer'

let activeRefresh: Promise<boolean> | null = null
let cacheFollowupTimer: ReturnType<typeof setTimeout> | null = null
let cacheFollowupGeneration: string | null = null

const localDate = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const text = (value: unknown, max = 12000) => {
  const result = String(value ?? '').trim()
  return result ? result.slice(0, max) : null
}

const safeDetails = (value: unknown) => {
  try { return JSON.parse(JSON.stringify(value)) } catch { return text(value, 4000) }
}

const responseShape = (value: unknown) => {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null
  return {
    type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
    keys: object ? Object.keys(object).sort() : [],
    studentsIsArray: Array.isArray(object?.students),
    studentsLength: Array.isArray(object?.students) ? object.students.length : null,
    summariesIsArray: Array.isArray(object?.summaries),
    summariesLength: Array.isArray(object?.summaries) ? object.summaries.length : null,
    metaType: object?.meta === null ? 'null' : typeof object?.meta,
    metaKeys: object?.meta && typeof object.meta === 'object' ? Object.keys(object.meta).sort() : []
  }
}

const serializeClientError = (cause: any, url: string, startedAt: string, started: number, lifecycle: ClientTraceEvent[]): ClientRequestDiagnostic => ({
  url,
  startedAt,
  finishedAt: new Date().toISOString(),
  durationMs: Date.now() - started,
  ok: false,
  statusCode: Number.isFinite(Number(cause?.statusCode || cause?.status || cause?.response?.status))
    ? Number(cause?.statusCode || cause?.status || cause?.response?.status)
    : null,
  statusMessage: text(cause?.statusMessage || cause?.response?.statusText, 500),
  message: text(cause?.data?.message || cause?.message, 4000),
  responseData: safeDetails(cause?.data ?? null),
  stack: text(cause?.stack, 12000),
  lifecycle: [...lifecycle]
})

function validateSnapshot(value: unknown): asserts value is SnapshotResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error: any = new Error('El endpoint /snapshot terminó sin un objeto JSON.')
    error.code = 'CLIENT_SNAPSHOT_NO_OBJECT'
    error.diagnostic = responseShape(value)
    throw error
  }
  const candidate = value as any
  if (!Array.isArray(candidate.students) || !Array.isArray(candidate.summaries) || !candidate.meta || typeof candidate.meta !== 'object') {
    const error: any = new Error('El endpoint /snapshot respondió, pero su estructura no coincide con SnapshotResponse.')
    error.code = 'CLIENT_SNAPSHOT_SHAPE_INVALID'
    error.diagnostic = responseShape(value)
    throw error
  }
}

export const useSummerData = () => {
  const snapshot = useState<SnapshotResponse | null>('summer-snapshot-v13', () => null)
  const selectedDate = useState('summer-date', localDate)
  const loading = useState('summer-loading-v13', () => false)
  const updating = useState('summer-updating-v13', () => false)
  const error = useState<string | null>('summer-error-v13', () => null)
  const requestDiagnostic = useState<ClientRequestDiagnostic | null>('summer-request-diagnostic-v13', () => null)
  const clientTrace = useState<ClientTraceEvent[]>('summer-client-trace-v13', () => [])
  const lastUpdatedAt = useState<string | null>('summer-last-updated-v13', () => null)
  const loadLifecycle = useState<SummerLoadLifecycle>('summer-load-lifecycle-v13', () => ({
    composableCreatedAt: new Date().toISOString(),
    clientMountedAt: null,
    clientMountedSources: [],
    loadAttempted: false,
    loadCallCount: 0,
    firstLoadRequestedAt: null,
    lastLoadRequestedAt: null,
    lastLoadFinishedAt: null,
    lastLoadTrigger: null,
    lastLoadOutcome: 'idle',
    lastLoadDurationMs: null,
    lastLoadError: null
  }))
  const poller = useState<ReturnType<typeof setInterval> | null>('summer-poller-v13', () => null)
  const queue = useAttendanceQueue()
  const device = useDeviceIdentity()
  const config = useRuntimeConfig()

  const trace = (event: string, details?: unknown) => {
    clientTrace.value = [...clientTrace.value.slice(-119), { at: new Date().toISOString(), event, ...(details === undefined ? {} : { details: safeDetails(details) }) }]
  }

  const cacheKey = () => `summer-snapshot:v13:${selectedDate.value}`

  const scheduleCacheFollowup = (result: SnapshotResponse) => {
    if (!import.meta.client) return
    const generatedAt = String(result.meta.generatedAt || '')
    const generatedTime = Date.parse(generatedAt)
    const oldResponse = Number.isFinite(generatedTime) && Date.now() - generatedTime > 120000
    const serverRefreshing = Boolean(result.meta.serverCache?.refreshing || result.meta.serverCache?.state === 'stale-while-revalidate')
    if ((!oldResponse && !serverRefreshing) || !generatedAt || cacheFollowupGeneration === generatedAt) return
    cacheFollowupGeneration = generatedAt
    if (cacheFollowupTimer) clearTimeout(cacheFollowupTimer)
    trace('cache.followup_scheduled', { generatedAt, oldResponse, serverRefreshing, delayMs: 12000 })
    cacheFollowupTimer = setTimeout(() => {
      cacheFollowupTimer = null
      trace('cache.followup_started', { generatedAt })
      void refresh(true)
    }, 12000)
  }

  const noteClientMounted = (source: string) => {
    if (!import.meta.client) return
    const cleanSource = String(source || 'unknown').slice(0, 80)
    loadLifecycle.value = {
      ...loadLifecycle.value,
      clientMountedAt: loadLifecycle.value.clientMountedAt || new Date().toISOString(),
      clientMountedSources: Array.from(new Set([...loadLifecycle.value.clientMountedSources, cleanSource])).slice(-12)
    }
    trace('client.mounted', { source: cleanSource, documentReadyState: document.readyState })
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
        unmarked: rows.filter((student) => student.attendance === 'unmarked').length,
        food: rows.filter((student) => student.mealCount > 0).length,
        pendingProgram: rows.filter((student) => student.program === 'unassigned').length
      }
    })
  }

  const applyPending = async () => {
    if (!snapshot.value) {
      trace('pending.skipped', { reason: 'snapshot_null' })
      return
    }
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
    if (!latest.size) {
      trace('pending.none', { totalQueue: pending.length, date: selectedDate.value })
      return
    }
    snapshot.value.students = snapshot.value.students.map((student) => {
      const mutation = latest.get(student.matricula)
      return mutation ? { ...student, attendance: mutation.status, attendanceUpdatedAt: mutation.clientTimestamp } : student
    })
    recalculateSummaries()
    trace('pending.applied', { mutations: latest.size, tokenUpdates: tokenUpdates.length })
  }

  const paintCache = async () => {
    if (!import.meta.client) return false
    const key = cacheKey()
    try {
      const raw = localStorage.getItem(key)
      trace('cache.lookup', { key, found: Boolean(raw), characters: raw?.length || 0 })
      if (!raw) return false
      const parsed = JSON.parse(raw)
      validateSnapshot(parsed)
      parsed.meta.cached = true
      snapshot.value = parsed
      trace('cache.painted', responseShape(parsed))
      await applyPending()
      return true
    } catch (cause: any) {
      trace('cache.rejected', { key, message: cause?.message || String(cause), code: cause?.code || null, diagnostic: cause?.diagnostic || null })
      try { localStorage.removeItem(key) } catch {}
      return false
    }
  }

  const refresh = async (background = false): Promise<boolean> => {
    if (activeRefresh) {
      trace('refresh.join_existing', { background, loading: loading.value, updating: updating.value, hasSnapshot: Boolean(snapshot.value) })
      return await activeRefresh
    }

    const execute = async () => {
      const effectiveBackground = background && Boolean(snapshot.value)
      if (loading.value || updating.value) {
        trace('refresh.reset_stale_flags', { previousLoading: loading.value, previousUpdating: updating.value, hasActivePromise: false })
      }
      loading.value = !effectiveBackground
      updating.value = effectiveBackground
      error.value = null
      const url = `/api/summer/snapshot?date=${encodeURIComponent(selectedDate.value)}&clientBuild=${encodeURIComponent(String(config.public.buildId || 'unknown'))}`
      const started = Date.now()
      const startedAt = new Date().toISOString()
      const lifecycleStart = clientTrace.value.length
      trace('refresh.started', {
        url,
        requestedBackground: background,
        effectiveBackground,
        selectedDate: selectedDate.value,
        browserOnline: import.meta.client ? navigator.onLine : null,
        visibility: import.meta.client ? document.visibilityState : null,
        previousSnapshot: snapshot.value ? responseShape(snapshot.value) : null
      })

      try {
        const result = await $fetch<SnapshotResponse>('/api/summer/snapshot', {
          query: { date: selectedDate.value, clientBuild: String(config.public.buildId || 'unknown') },
          cache: 'default',
          retry: 0,
          headers: {
            Accept: 'application/json',
            'X-Summer-Client-Build': String(config.public.buildId || 'unknown'),
            'X-Summer-Client-DX-Version': String(config.public.diagnosticVersion || 10)
          }
        })
        trace('refresh.fetch_resolved', responseShape(result))
        validateSnapshot(result)
        trace('refresh.validation_passed', responseShape(result))
        snapshot.value = result
        lastUpdatedAt.value = result.meta.generatedAt
        trace('refresh.state_assigned', {
          students: result.students.length,
          summaries: result.summaries.length,
          generatedAt: result.meta.generatedAt,
          source: result.meta.source,
          partial: result.meta.partial,
          failedPlanteles: result.meta.failedPlanteles
        })
        requestDiagnostic.value = {
          url,
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - started,
          ok: true,
          statusCode: 200,
          statusMessage: 'OK',
          message: null,
          responseData: responseShape(result),
          stack: null,
          lifecycle: clientTrace.value.slice(lifecycleStart)
        }
        if (import.meta.client) {
          const serialized = JSON.stringify(result)
          localStorage.setItem(cacheKey(), serialized)
          trace('cache.saved', { key: cacheKey(), characters: serialized.length })
        }
        await applyPending()
        scheduleCacheFollowup(result)
        if (import.meta.client) void queue.flush()
        trace('refresh.completed', { success: true, snapshotPresent: Boolean(snapshot.value), students: snapshot.value?.students.length || 0 })
        return true
      } catch (cause: any) {
        trace('refresh.failed', {
          name: cause?.name || null,
          message: cause?.message || String(cause),
          code: cause?.code || cause?.data?.diagnostic?.error?.code || null,
          statusCode: cause?.statusCode || cause?.status || cause?.response?.status || null,
          statusMessage: cause?.statusMessage || cause?.response?.statusText || null,
          responseData: cause?.data || null,
          diagnostic: cause?.diagnostic || null,
          snapshotPresentAfterFailure: Boolean(snapshot.value)
        })
        requestDiagnostic.value = serializeClientError(cause, url, startedAt, started, clientTrace.value.slice(lifecycleStart))
        error.value = requestDiagnostic.value.message || 'No se pudo actualizar la lista.'
        return false
      } finally {
        loading.value = false
        updating.value = false
        trace('refresh.finally', { loading: loading.value, updating: updating.value, hasSnapshot: Boolean(snapshot.value), error: error.value })
      }
    }

    activeRefresh = execute()
    try {
      return await activeRefresh
    } finally {
      activeRefresh = null
      trace('refresh.promise_released', { hasSnapshot: Boolean(snapshot.value), loading: loading.value, updating: updating.value })
    }
  }

  const load = async (trigger = 'unspecified') => {
    const requestedAt = new Date().toISOString()
    const started = Date.now()
    loadLifecycle.value = {
      ...loadLifecycle.value,
      loadAttempted: true,
      loadCallCount: loadLifecycle.value.loadCallCount + 1,
      firstLoadRequestedAt: loadLifecycle.value.firstLoadRequestedAt || requestedAt,
      lastLoadRequestedAt: requestedAt,
      lastLoadFinishedAt: null,
      lastLoadTrigger: String(trigger || 'unspecified').slice(0, 120),
      lastLoadOutcome: 'running',
      lastLoadDurationMs: null,
      lastLoadError: null
    }
    trace('load.started', { trigger, selectedDate: selectedDate.value, loading: loading.value, updating: updating.value, hasSnapshot: Boolean(snapshot.value) })
    let success = false
    try {
      device.get()
      if (!activeRefresh && (loading.value || updating.value)) {
        trace('load.cleared_orphan_flags', { loading: loading.value, updating: updating.value })
        loading.value = false
        updating.value = false
      }
      const painted = await paintCache()
      await queue.refreshCount()
      trace('load.before_refresh', { trigger, cachePainted: painted, pendingCount: queue.pendingCount.value })
      success = await refresh(painted)
      trace('load.completed', { trigger, success, cachePainted: painted, hasSnapshot: Boolean(snapshot.value), students: snapshot.value?.students.length || 0, error: error.value })
      return success
    } catch (cause: any) {
      const message = cause?.data?.message || cause?.message || String(cause)
      error.value = error.value || message || 'No se pudo cargar la lista.'
      trace('load.unhandled_error', { trigger, message, name: cause?.name || null, stack: cause?.stack || null })
      return false
    } finally {
      loadLifecycle.value = {
        ...loadLifecycle.value,
        lastLoadFinishedAt: new Date().toISOString(),
        lastLoadOutcome: success && Boolean(snapshot.value) ? 'success' : 'failure',
        lastLoadDurationMs: Date.now() - started,
        lastLoadError: success && snapshot.value ? null : error.value || 'La carga terminó sin snapshot.'
      }
    }
  }

  const setDate = async (date: string) => {
    trace('date.changed', { from: selectedDate.value, to: date })
    selectedDate.value = date
    snapshot.value = null
    await load('date-change')
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
    trace('polling.started', { interval })
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
      trace('polling.stopped')
    })
  }

  return {
    snapshot,
    selectedDate,
    loading,
    updating,
    error,
    requestDiagnostic,
    clientTrace,
    loadLifecycle,
    lastUpdatedAt,
    pendingCount: queue.pendingCount,
    flushing: queue.flushing,
    load,
    noteClientMounted,
    refresh,
    setDate,
    markAttendance,
    startPolling
  }
}
