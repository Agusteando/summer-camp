import type { SnapshotResponse } from '~/types/summer'
import { loadSummerSource, type SourceResult } from './summer-source'
import { buildSnapshot } from './summer-state'

export type SummerCacheState = 'miss' | 'fresh' | 'stale-while-revalidate' | 'stale-if-error'

type SerializedError = {
  name: string
  message: string
  code: string | null
  statusCode: number | null
  at: string
}

type CacheEntry<T> = {
  value: T | null
  storedAt: number | null
  inFlight: Promise<T> | null
  refreshStartedAt: number | null
  lastAttemptAt: number | null
  lastSuccessAt: number | null
  lastError: SerializedError | null
  hits: number
  misses: number
  staleHits: number
  refreshes: number
}

type CacheStore = {
  instanceId: string
  source: CacheEntry<SourceResult>
  snapshots: Map<string, CacheEntry<SnapshotResponse>>
}

type CacheDurations = {
  sourceFreshMs: number
  sourceStaleMs: number
  snapshotFreshMs: number
  snapshotStaleMs: number
  edgeFreshSeconds: number
  edgeStaleSeconds: number
}

type CacheRead<T> = {
  value: T
  state: SummerCacheState
  ageMs: number
  refreshing: boolean
  backgroundTask: Promise<unknown> | null
  lastError: SerializedError | null
}

const globalKey = Symbol.for('iecs.summer.cache.v13')
const root = globalThis as any

const emptyEntry = <T>(): CacheEntry<T> => ({
  value: null,
  storedAt: null,
  inFlight: null,
  refreshStartedAt: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  hits: 0,
  misses: 0,
  staleHits: 0,
  refreshes: 0
})

const store = (): CacheStore => {
  if (!root[globalKey]) {
    root[globalKey] = {
      instanceId: `summer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      source: emptyEntry<SourceResult>(),
      snapshots: new Map<string, CacheEntry<SnapshotResponse>>()
    }
  }
  return root[globalKey]!
}

export const summerCacheDurations = (): CacheDurations => ({
  sourceFreshMs: 120000,
  sourceStaleMs: 900000,
  snapshotFreshMs: 15000,
  snapshotStaleMs: 180000,
  edgeFreshSeconds: 120,
  edgeStaleSeconds: 600
})

const serializeError = (cause: any): SerializedError => ({
  name: String(cause?.name || 'Error'),
  message: String(cause?.message || cause || 'Error desconocido').slice(0, 4000),
  code: cause?.code ? String(cause.code) : null,
  statusCode: Number.isFinite(Number(cause?.statusCode || cause?.status)) ? Number(cause.statusCode || cause.status) : null,
  at: new Date().toISOString()
})

const ageOf = (entry: CacheEntry<unknown>, now = Date.now()) => entry.storedAt === null ? Number.POSITIVE_INFINITY : Math.max(0, now - entry.storedAt)

const sourceRefresh = (): Promise<SourceResult> => {
  const entry = store().source
  if (entry.inFlight) return entry.inFlight
  entry.lastAttemptAt = Date.now()
  entry.refreshStartedAt = Date.now()
  entry.refreshes += 1
  const promise = loadSummerSource()
    .then((value) => {
      const now = Date.now()
      entry.value = value
      entry.storedAt = now
      entry.lastSuccessAt = now
      entry.lastError = null
      return value
    })
    .catch((cause) => {
      entry.lastError = serializeError(cause)
      throw cause
    })
    .finally(() => {
      entry.inFlight = null
      entry.refreshStartedAt = null
    })
  entry.inFlight = promise
  return promise
}

const readSource = async (): Promise<CacheRead<SourceResult>> => {
  const entry = store().source
  const { sourceFreshMs, sourceStaleMs } = summerCacheDurations()
  const ageMs = ageOf(entry)

  if (entry.value && ageMs <= sourceFreshMs) {
    entry.hits += 1
    return { value: entry.value, state: 'fresh', ageMs, refreshing: Boolean(entry.inFlight), backgroundTask: entry.inFlight, lastError: entry.lastError }
  }

  if (entry.value && ageMs <= sourceStaleMs) {
    entry.staleHits += 1
    const backgroundTask = sourceRefresh().catch(() => null)
    return {
      value: entry.value,
      state: entry.lastError ? 'stale-if-error' : 'stale-while-revalidate',
      ageMs,
      refreshing: true,
      backgroundTask,
      lastError: entry.lastError
    }
  }

  entry.misses += 1
  try {
    const value = await sourceRefresh()
    return { value, state: 'miss', ageMs: 0, refreshing: false, backgroundTask: null, lastError: null }
  } catch (cause) {
    throw cause
  }
}

const cloneSnapshot = (value: SnapshotResponse): SnapshotResponse => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as SnapshotResponse
}

const snapshotEntry = (date: string) => {
  const cache = store().snapshots
  let entry = cache.get(date)
  if (!entry) {
    entry = emptyEntry<SnapshotResponse>()
    cache.set(date, entry)
  }
  return entry
}

const buildAndStoreSnapshot = async (date: string, entry: CacheEntry<SnapshotResponse>): Promise<SnapshotResponse> => {
  const sourceRead = await readSource()
  const initial = await buildSnapshot(date, sourceRead.value.students, sourceRead.value)
  entry.value = initial
  entry.storedAt = Date.now()
  entry.lastSuccessAt = entry.storedAt
  entry.lastError = null

  if (sourceRead.backgroundTask) {
    try {
      const refreshedSource = await sourceRead.backgroundTask as SourceResult | null
      if (refreshedSource) {
        const refreshed = await buildSnapshot(date, refreshedSource.students, refreshedSource)
        entry.value = refreshed
        entry.storedAt = Date.now()
        entry.lastSuccessAt = entry.storedAt
        entry.lastError = null
        return refreshed
      }
    } catch {
      // The stale source remains usable; the cache status exposes the refresh error.
    }
  }

  return initial
}

const snapshotRefresh = (date: string): Promise<SnapshotResponse> => {
  const entry = snapshotEntry(date)
  if (entry.inFlight) return entry.inFlight
  entry.lastAttemptAt = Date.now()
  entry.refreshStartedAt = Date.now()
  entry.refreshes += 1
  const promise = buildAndStoreSnapshot(date, entry)
    .catch((cause) => {
      entry.lastError = serializeError(cause)
      throw cause
    })
    .finally(() => {
      entry.inFlight = null
      entry.refreshStartedAt = null
    })
  entry.inFlight = promise
  return promise
}

const sourceObservation = () => {
  const entry = store().source
  const ageMs = ageOf(entry)
  const { sourceFreshMs, sourceStaleMs } = summerCacheDurations()
  return {
    available: Boolean(entry.value),
    ageMs: Number.isFinite(ageMs) ? ageMs : null,
    fresh: Boolean(entry.value && ageMs <= sourceFreshMs),
    staleUsable: Boolean(entry.value && ageMs <= sourceStaleMs),
    refreshing: Boolean(entry.inFlight),
    storedAt: entry.storedAt ? new Date(entry.storedAt).toISOString() : null,
    refreshStartedAt: entry.refreshStartedAt ? new Date(entry.refreshStartedAt).toISOString() : null,
    lastAttemptAt: entry.lastAttemptAt ? new Date(entry.lastAttemptAt).toISOString() : null,
    lastSuccessAt: entry.lastSuccessAt ? new Date(entry.lastSuccessAt).toISOString() : null,
    lastError: entry.lastError,
    hits: entry.hits,
    misses: entry.misses,
    staleHits: entry.staleHits,
    refreshes: entry.refreshes,
    students: entry.value?.students.length ?? null,
    partial: entry.value?.partial ?? null,
    failedPlanteles: entry.value?.failedPlanteles ?? []
  }
}

const decorateSnapshot = (value: SnapshotResponse, state: SummerCacheState, ageMs: number, refreshing: boolean, entry: CacheEntry<SnapshotResponse>) => {
  const snapshot = cloneSnapshot(value)
  const source = sourceObservation()
  const durations = summerCacheDurations()
  snapshot.meta.serverCache = {
    strategy: 'vercel-edge-plus-instance-singleflight',
    state,
    refreshing: refreshing || source.refreshing,
    snapshotAgeMs: Math.round(ageMs),
    snapshotStoredAt: entry.storedAt ? new Date(entry.storedAt).toISOString() : null,
    snapshotLastError: entry.lastError,
    sourceAgeMs: source.ageMs,
    sourceStoredAt: source.storedAt,
    sourceRefreshing: source.refreshing,
    sourceLastError: source.lastError,
    sourceFreshMs: durations.sourceFreshMs,
    sourceStaleMs: durations.sourceStaleMs,
    snapshotFreshMs: durations.snapshotFreshMs,
    snapshotStaleMs: durations.snapshotStaleMs,
    edgeFreshSeconds: durations.edgeFreshSeconds,
    edgeStaleSeconds: durations.edgeStaleSeconds,
    instanceId: store().instanceId
  }
  return snapshot
}

export const readSummerSnapshot = async (date: string, options: { awaitFreshWhenStale?: boolean } = {}): Promise<{ snapshot: SnapshotResponse; backgroundTask: Promise<unknown> | null; state: SummerCacheState }> => {
  const entry = snapshotEntry(date)
  const { snapshotFreshMs, snapshotStaleMs } = summerCacheDurations()
  const ageMs = ageOf(entry)

  if (entry.value && ageMs <= snapshotFreshMs) {
    entry.hits += 1
    return {
      snapshot: decorateSnapshot(entry.value, 'fresh', ageMs, Boolean(entry.inFlight), entry),
      backgroundTask: entry.inFlight,
      state: 'fresh'
    }
  }

  if (entry.value && ageMs <= snapshotStaleMs) {
    entry.staleHits += 1
    if (options.awaitFreshWhenStale) {
      try {
        const value = await snapshotRefresh(date)
        const sourceFailed = Boolean(sourceObservation().lastError)
        const state: SummerCacheState = sourceFailed ? 'stale-if-error' : 'fresh'
        return { snapshot: decorateSnapshot(value, state, 0, false, entry), backgroundTask: null, state }
      } catch {
        return {
          snapshot: decorateSnapshot(entry.value, 'stale-if-error', ageMs, false, entry),
          backgroundTask: null,
          state: 'stale-if-error'
        }
      }
    }

    const backgroundTask = snapshotRefresh(date).catch(() => null)
    const state: SummerCacheState = entry.lastError ? 'stale-if-error' : 'stale-while-revalidate'
    return {
      snapshot: decorateSnapshot(entry.value, state, ageMs, true, entry),
      backgroundTask,
      state
    }
  }

  entry.misses += 1
  try {
    const value = await snapshotRefresh(date)
    return { snapshot: decorateSnapshot(value, 'miss', 0, false, entry), backgroundTask: null, state: 'miss' }
  } catch (cause) {
    throw cause
  }
}

export const invalidateSummerSnapshotDates = (dates: Iterable<string>) => {
  const cache = store().snapshots
  for (const date of dates) cache.delete(String(date))
}

export const invalidateAllSummerSnapshots = () => {
  store().snapshots.clear()
}

export const getSummerCacheDiagnostics = () => {
  const cache = store()
  const snapshots = Array.from(cache.snapshots.entries()).map(([date, entry]) => ({
    date,
    available: Boolean(entry.value),
    ageMs: Number.isFinite(ageOf(entry)) ? ageOf(entry) : null,
    refreshing: Boolean(entry.inFlight),
    storedAt: entry.storedAt ? new Date(entry.storedAt).toISOString() : null,
    refreshStartedAt: entry.refreshStartedAt ? new Date(entry.refreshStartedAt).toISOString() : null,
    lastAttemptAt: entry.lastAttemptAt ? new Date(entry.lastAttemptAt).toISOString() : null,
    lastSuccessAt: entry.lastSuccessAt ? new Date(entry.lastSuccessAt).toISOString() : null,
    lastError: entry.lastError,
    hits: entry.hits,
    misses: entry.misses,
    staleHits: entry.staleHits,
    refreshes: entry.refreshes,
    students: entry.value?.students.length ?? null
  }))
  return {
    instanceId: cache.instanceId,
    strategy: 'vercel-edge-plus-instance-singleflight',
    durations: summerCacheDurations(),
    source: sourceObservation(),
    snapshots
  }
}

export const sourceReachabilityFromCache = () => {
  const observation = sourceObservation()
  if (!observation.available) return null
  return {
    reachable: observation.staleUsable,
    source: store().source.value?.source || 'aurora',
    latencyMs: 0,
    cacheDerived: true,
    checkedAt: observation.lastSuccessAt,
    ageMs: observation.ageMs,
    refreshing: observation.refreshing,
    partial: observation.partial,
    failedPlanteles: observation.failedPlanteles,
    lastError: observation.lastError
  }
}

export const readSummerSourceCached = async (): Promise<{ source: SourceResult; state: SummerCacheState; backgroundTask: Promise<unknown> | null }> => {
  const result = await readSource()
  return { source: result.value, state: result.state, backgroundTask: result.backgroundTask }
}
