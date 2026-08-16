import { spawn } from 'node:child_process'
import { loadProfile } from './profile.js'

/**
 * 执行 `dsh plugin --profile <profile> add|remove <spec>`。
 * 用 execFile 而非 shell,避免任何注入面;Windows 下加 shell 以解析 .cmd。
 */
export async function handleCommand({ profile, action, spec }) {
  const dshBin = process.env.DSH_BIN || 'dsh'

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
  const args = ['plugin', '--profile', profile, sub]
  if (spec) args.push(spec)

  return run(dshBin, args, { timeout: 180000 })
}

function run(bin, args, { timeout } = {}) {
  return new Promise((resolve) => {
    const proc = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
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