import { spawn } from 'node:child_process'
import path from 'node:path'
import { loadProfile } from './profile.js'

/**
 * 执行 `dsh plugin --profile <profile> add|remove <spec>`。
 * 优先用 DSH_BIN 环境变量;否则用当前进程的 dsh 入口(process.argv[1],即 harness
 * 正在运行的 bin.js),用 node 直接执行 —— 不依赖 PATH(Windows 下 'dsh' 常不在 PATH)。
 */
function resolveDsh() {
  if (process.env.DSH_BIN) return { bin: process.env.DSH_BIN, viaNode: false }
  const argv1 = process.argv[1] || ''
  if (/\.(js|mjs|cjs)$/.test(argv1)) return { bin: argv1, viaNode: true }
  return { bin: 'dsh', viaNode: false }
}

export async function handleCommand({ profile, action, spec }) {
  const { bin, viaNode } = resolveDsh()

  if (action === 'list') {
    const p = loadProfile(profile)
    return {
      ok: true,
      exitCode: 0,
      output: JSON.stringify({ bundles: p?.bundles ?? [], deps: Object.keys(p?.dependencies ?? {}) }),
    }
  }

  if (action !== 'add' && action !== 'install' && action !== 'remove' && action !== 'uninstall') {
    return { ok: false, exitCode: 1, output: `unknown action ${action}` }
  }

  const sub = action === 'remove' || action === 'uninstall' ? 'remove' : 'add'
  const dshArgs = ['plugin', '--profile', profile, sub]
  if (spec) dshArgs.push(spec)

  // viaNode: node <bin.js> plugin ... (无需 shell,防注入)
  // 否则: 直接执行 bin(win32 下 .cmd 需 shell)
  return viaNode
    ? run(process.execPath, [bin, ...dshArgs], { timeout: 180000 })
    : run(bin, dshArgs, { timeout: 180000, shell: process.platform === 'win32' })
}

function run(bin, args, { timeout, shell } = {}) {
  return new Promise((resolve) => {
    const proc = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell,
    })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      try {
        proc.kill()
      } catch {}
    }, timeout)

    proc.stdout.on('data', (d) => (out += d.toString()))
    proc.stderr.on('data', (d) => (err += d.toString()))

    proc.on('error', (e) => {
      clearTimeout(timer)
      resolve({ ok: false, exitCode: 1, output: `无法运行 ${bin}: ${e.message}` })
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      const output = (out || err).slice(0, 4000)
      resolve({ ok: code === 0, exitCode: code ?? 1, output })
    })
  })
}

export { loadProfile }