import { SUMMER_BUILD_ID, SUMMER_DX_VERSION } from '../../utils/build'
import { appQuery } from '../../utils/db'
import { sourceReachabilityFromCache } from '../../utils/summer-cache'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=0, must-revalidate')
  setResponseHeader(event, 'CDN-Cache-Control', 'public, s-maxage=45, stale-while-revalidate=90')
  setResponseHeader(event, 'Vercel-CDN-Cache-Control', 'public, s-maxage=45, stale-while-revalidate=90')
  setResponseHeader(event, 'X-Summer-Build-Id', SUMMER_BUILD_ID)
  setResponseHeader(event, 'X-Summer-DX-Version', String(SUMMER_DX_VERSION))

  const started = Date.now()
  const config = useRuntimeConfig()
  const cachedSource = sourceReachabilityFromCache()
  const source = cachedSource || {
    reachable: null,
    source: String(config.summerSourceMode || 'aurora').toLowerCase(),
    latencyMs: 0,
    cacheDerived: true,
    checking: true,
    checkedAt: null,
    ageMs: null,
    refreshing: true,
    partial: null,
    failedPlanteles: [],
    lastError: null
  }

  let app: { reachable: boolean; latencyMs: number }
  if (String(config.demoMode || '').toLowerCase() === 'true') {
    app = { reachable: true, latencyMs: 0 }
  } else {
    const appStarted = Date.now()
    try {
      await appQuery('SELECT 1 AS ok')
      app = { reachable: true, latencyMs: Date.now() - appStarted }
    } catch {
      app = { reachable: false, latencyMs: Date.now() - appStarted }
    }
  }

  return {
    ok: source.reachable !== false && app.reachable,
    buildId: SUMMER_BUILD_ID,
    dxVersion: SUMMER_DX_VERSION,
    source,
    app,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started
  }
})
