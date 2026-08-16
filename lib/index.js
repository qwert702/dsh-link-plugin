import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { ConnectionClient } from './connection.js'
import { handleCommand } from './commander.js'
import { loadProfile } from './profile.js'
import { isSafeCommand } from './security.js'
import { cachedRegistry, refreshRegistry } from './registry-cache.js'

/**
 * dsh-link-plugin —— 远程连接插件
 * 本机 dsh 主动连出到 dsh 社区网站,接收 command 指令并执行
 * `dsh plugin --profile <x> add|remove <spec>`,安装源仅允许商店注册表白名单。
 * 通过 dsh 设置系统暴露配置卡片(设置 → 插件 → dsh-link),保存即重连。
 */
export const name = 'dsh-link-plugin'

const SETTINGS_NAMESPACE = settingsNamespace('dsh-link')

const SETTINGS_SCHEMA = z.object({
  serverUrl: z.string().description('WebSocket 服务器地址(如 wss://dsh.cbnac.com/ws/harness)'),
  pairingCode: z.string().description('一次性配对码(首次连接填写)'),
  profile: z.string().default('web').description('要管理的 dsh profile'),
  proxy: z.string().description('安装子进程的 HTTP 代理(可选,如 http://127.0.0.1:7897)'),
  requireConfirm: z.boolean().default(true).description('收到安装指令时是否需要确认'),
  autoStart: z.boolean().default(true).description('启动 dsh 时自动连接'),
})

export const Config = SETTINGS_SCHEMA

export async function apply(ctx, config) {
  // 组合配置作为兜底(base);设置服务挂载后 source 指向用户层
  const entry = {
    serverUrl: config.serverUrl || '',
    pairingCode: config.pairingCode || '',
    profile: config.profile || 'web',
    proxy: config.proxy || '',
    requireConfirm: config.requireConfirm ?? true,
    autoStart: config.autoStart ?? true,
  }
  let source = () => entry
  let client = null

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
        return {
          installed: p?.bundles ?? [],
          dshVersion: undefined,
          platform: process.platform,
        }
      },
    })
    c.on('ready', () => console.error('[dsh-link] READY'))
    c.on('error', (e) => console.error('[dsh-link] rpc-error', JSON.stringify(e)))
    c.on('reconnecting', () => console.error('[dsh-link] reconnecting'))
    c.on('command', async (cmd) => {
      const { commandId, action, spec } = cmd.params || {}
      console.error(`[dsh-link] command ${action} ${spec || ''}`)
      // 校验前强制刷新注册表缓存(指令可能早于首次拉取完成)
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

  function start() {
    stop()
    const cfg = source()
    if (!cfg.serverUrl) {
      console.error('[dsh-link] NO_SERVER_URL, disabled')
      return
    }
    client = makeClient(cfg)
    if (client) client.start()
  }

  function stop() {
    if (client) {
      client.stop()
      client = null
    }
  }

  // 启动时先拉一次注册表缓存(离线商店形态)
  refreshRegistry(entry.serverUrl).catch(() => {})

  installSettingsSection(ctx, SETTINGS_NAMESPACE, SETTINGS_SCHEMA, entry, {
    setSource: (thunk) => {
      source = thunk
    },
    onChange: () => {
      console.error('[dsh-link] settings changed, reconnecting')
      start()
    },
  })

  start()
  ctx.on('dispose', () => stop())
}

export default {
  name,
  Config,
  apply,
}