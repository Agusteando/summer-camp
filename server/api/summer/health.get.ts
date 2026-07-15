import { appQuery } from '../../utils/db'
import { testSourceHealth } from '../../utils/summer-source'

export default defineEventHandler(async () => {
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
  return { ok: source.reachable && app.reachable, source, app, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started }
})
