/**
 * 商店注册表离线缓存。
 * 连接时 GET https://<host>/api/plugins/registry.json,缓存白名单供离线展示与校验。
 */

const HTTP_RE = /^https?:\/\/([^/:]+)(:\d+)?(\/)?/

let cached = { version: '', generatedAt: '', plugins: [] }
let lastFetch = 0

export function cachedRegistry() {
  return cached
}

export async function refreshRegistry(serverUrl, opts) {
  const force = opts?.force ?? false
  const wsUrl = (serverUrl || '').trim()
  if (!wsUrl) return
  // wss://host/ws/harness -> https://host/api/plugins/registry.json
  const http = wsUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
  const m = HTTP_RE.exec(http)
  if (!m) return
  const base = m[0].replace(/\/+$/, '')
  const url = `${base}/api/plugins/registry.json`

  // 5 分钟内不重复拉取(除非 force)
  if (!force && Date.now() - lastFetch < 300000) return
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return
    const data = await res.json()
    if (data?.plugins) {
      cached = data
      lastFetch = Date.now()
    }
  } catch {
    /* 离线时沿用旧缓存 */
  }
}

export default { cachedRegistry, refreshRegistry }