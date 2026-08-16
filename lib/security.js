/**
 * 指令安全校验。
 * - 只允许 install/uninstall/list
 * - spec 必须命中缓存的商店注册表白名单(approved/manual 行)
 * - 拒绝本地路径与危险字符
 */

// 拒绝任何本地路径片段或 shell 元字符
const FORBIDDEN = [/(^|\/)\.\.(\/|$)/, /(^|[:/\\])\.[\\/]/, /^file:/i, /^link:/i, /^\.{1,2}\//, /[;&|`$()[\]]/, /\s+/]

export function isSafeCommand({ action, spec, registry }) {
  if (!['install', 'uninstall', 'list'].includes(action)) {
    return { ok: false, reason: `action '${action}' 不允许` }
  }
  if (action === 'list') return { ok: true }

  if (!spec || typeof spec !== 'string') {
    return { ok: false, reason: '缺少 spec' }
  }
  for (const re of FORBIDDEN) {
    if (re.test(spec)) {
      return { ok: false, reason: `spec 含有禁止内容: ${spec}` }
    }
  }
  if (action === 'install') {
    const hit = (registry?.plugins ?? []).some((p) => p.spec === spec)
    if (!hit) {
      return { ok: false, reason: `spec 不在商店注册表白名单中` }
    }
  }
  return { ok: true }
}

export default isSafeCommand