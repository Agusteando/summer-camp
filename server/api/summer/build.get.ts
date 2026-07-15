import { SUMMER_BUILD_ID, SUMMER_DX_VERSION, SUMMER_SNAPSHOT_VERSION } from '../../utils/build'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')
  setResponseHeader(event, 'X-Summer-Build-Id', SUMMER_BUILD_ID)
  setResponseHeader(event, 'X-Summer-DX-Version', String(SUMMER_DX_VERSION))
  return {
    buildId: SUMMER_BUILD_ID,
    dxVersion: SUMMER_DX_VERSION,
    snapshotVersion: SUMMER_SNAPSHOT_VERSION,
    serverTime: new Date().toISOString(),
    node: process.version,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || null
  }
})
