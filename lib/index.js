import z from '@deepseek-ai/schemastery'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { ConnectionClient } from './connection.js'
import { handleCommand } from './commander.js'
import { loadProfile } from './profile.js'
import { isSafeCommand } from './security.js'
import { cachedRegistry, refreshRegistry } from './registry-cache.js'

/**
 * dsh-link-plugin —— 远程连接插件(host 侧)
 * 本机 dsh 主动连出到 dsh 社区网站,接收 command 指令并执行
 * `dsh plugin --profile <x> add|remove <spec>`,安装源仅允许商店注册表白名单。
 * 配置来源:组合配置(entry)为兜底,`~/.dsh/link-plugin.json` 用户配置覆盖;
 * dsh 设置卡片(设置 → 插件 → dsh-link)通过 RPC 读写该文件,保存即重连。
 */
export const name = 'dsh-link-plugin'

export const Config = z.object({
  serverUrl: z.string().description('WebSocket 服务器地址(如 wss://dsh.cbnac.com/ws/harness)'),
  pairingCode: z.string().description('一次性配对码(首次连接填写)'),
  profile: z.string().default('web').description('要管理的 dsh profile'),
  proxy: z.string().description('安装子进程的 HTTP 代理(可选)'),
  requireConfirm: z.boolean().default(true).description('收到安装指令时是否需要确认'),
  autoStart: z.boolean().default(true).description('启动 dsh 时自动连接'),
})

const CHANNEL = '/dsh-link'
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const CONFIG_PATH = join(DSH_HOME, 'link-plugin.json')

function defaultConfig() {
  return {
    serverUrl: '',
    pairingCode: '',
    profile: 'web',
    proxy: '',
    requireConfirm: true,
    autoStart: true,
  }
}

async function readConfigFile() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8')
    return { ...defaultConfig(), ...JSON.parse(raw) }
  } catch {
    return defaultConfig()
  }
}

async function writeConfigFile(patch) {
  const cur = await readConfigFile()
  const next = { ...cur, ...patch }
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2))
  return next
}

export async function apply(ctx, config) {
  console.error('[dsh-link] apply', JSON.stringify(config))
  const entry = {
    serverUrl: config.serverUrl || '',
    pairingCode: config.pairingCode || '',
    profile: config.profile || 'web',
    proxy: config.proxy || '',
    requireConfirm: config.requireConfirm ?? true,
    autoStart: config.autoStart ?? true,
  }

  let client = null
  let merged = { ...entry }

  function makeClient(cfg) {
    if (!cfg.serverUrl) return null
    const c = new ConnectionClient({
      url: cfg.serverUrl,
      deviceId: cfg.deviceId || '',
      pairingCode: cfg.pairingCode || '',
      token: cfg.token || '',
      profile: cfg.profile || 'web',
      name: loadProfile()?.name ?? 'dsh-device',
      onState: () => {
        const p = loadProfile(cfg.profile || 'web')
        return { installed: p?.bundles ?? [], dshVersion: undefined, platform: process.platform }
      },
    })
    c.on('ready', () => console.error('[dsh-link] READY'))
    c.on('error', (e) => console.error('[dsh-link] rpc-error', JSON.stringify(e)))
    c.on('reconnecting', () => console.error('[dsh-link] reconnecting'))
    c.on('command', async (cmd) => {
      const { commandId, action, spec } = cmd.params || {}
      console.error(`[dsh-link] command ${action} ${spec || ''}`)
      await refreshRegistry(cfg.serverUrl, { force: true })
      const check = isSafeCommand({ action, spec, registry: cachedRegistry() })
      if (!check.ok) {
        console.error(`[dsh-link] blocked ${check.reason}`)
        c.send({
          method: 'command.result',
          params: { commandId, ok: false, exitCode: 1, output: `blocked: ${check.reason}` },
        })
        return
      }
      const result = await handleCommand({
        profile: cfg.profile || 'web',
        action,
        spec,
        proxy: cfg.proxy,
      })
      c.send({ method: 'command.result', params: { commandId, ...result } })
    })
    return c
  }

  function stop() {
    if (client) {
      client.stop()
      client = null
    }
  }

  async function rebuild() {
    stop()
    const file = await readConfigFile()
    merged = { ...entry, ...file }
    console.error('[dsh-link] merged.serverUrl=', merged.serverUrl)
    if (!merged.serverUrl) {
      console.error('[dsh-link] NO_SERVER_URL, disabled')
      return
    }
    client = makeClient(merged)
    if (client) client.start()
  }

  // 设置卡片 RPC:读配置 / 保存配置(保存后重建连接)
  async function handleRpc(endpoint, payload) {
    if (endpoint === 'config') {
      if (payload && Object.keys(payload).length) {
        await writeConfigFile(payload)
        await rebuild()
      } else {
        merged = { ...entry, ...(await readConfigFile()) }
      }
      return { ok: true, value: merged }
    }
    return { ok: false, error: { code: 'unknown', details: endpoint } }
  }

  ctx.inject(['connection'], (connectionCtx) => {
    connectionCtx.effect(() => {
      return connectionCtx.connection.rpc.handle(CHANNEL, handleRpc, { authority: 'loopback' })
    }, 'dsh-link: rpc')
  })

  refreshRegistry(entry.serverUrl).catch(() => {})
  await rebuild()
  ctx.on('dispose', () => stop())
}

export default {
  name,
  Config,
  apply,
}