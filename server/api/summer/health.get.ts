import { SUMMER_BUILD_ID, SUMMER_DX_VERSION } from '../../utils/build'
import { appQuery } from '../../utils/db'
import { testSourceHealth } from '../../utils/summer-source'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')
  setResponseHeader(event, 'X-Summer-Build-Id', SUMMER_BUILD_ID)
  setResponseHeader(event, 'X-Summer-DX-Version', String(SUMMER_DX_VERSION))
  const started = Date.now()
  const source = await testSourceHealth()
  let app = { reachable: true, latencyMs: 0 }
  if (String(useRuntimeConfig().demoMode || '').toLowerCase() !== 'true') {
    const appStarted = Date.now()
    try {
      await appQuery('SELECT 1 AS ok')
      app = { reachable: true, latencyMs: Date.now() - appStarted }
    } catch {
      app = { reachable: false, latencyMs: Date.now() - appStarted }
    }
  }
  return { ok: source.reachable && app.reachable, buildId: SUMMER_BUILD_ID, dxVersion: SUMMER_DX_VERSION, source, app, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started }
})
