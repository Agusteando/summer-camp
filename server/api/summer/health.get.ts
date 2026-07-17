import { attendanceDatabaseHealth } from '../../utils/attendance-store'
import { sheetSourceHealth } from '../../utils/sheet-source'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=0, must-revalidate')
  setResponseHeader(event, 'CDN-Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
  const started = Date.now()
  const [source, app] = await Promise.all([sheetSourceHealth(), attendanceDatabaseHealth()])
  return {
    ok: source.reachable && app.reachable,
    source: { ...source, name: 'google-sheets' },
    app,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started
  }
})
