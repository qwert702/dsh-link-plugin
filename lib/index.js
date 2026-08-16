import z from '@deepseek-ai/schemastery'
import { ConnectionClient } from './connection.js'
import { handleCommand } from './commander.js'
import { loadProfile } from './profile.js'
import { isSafeCommand } from './security.js'
import { cachedRegistry, refreshRegistry } from './registry-cache.js'

/**
 * dsh-link-plugin —— 远程连接插件
 * 本机 dsh 主动连出到 dsh 社区网站,接收 command 指令并执行
 * `dsh plugin --profile <x> add|remove <spec>`,安装源仅允许商店注册表白名单。
 */
export const name = 'dsh-link-plugin'

export const Config = z.object({
  serverUrl: z.string().required().description('WebSocket 服务器地址'),
  pairingCode: z.string().description('一次性配对码(首次连接填写)'),
  token: z.string().role('secret').description('已配对的设备令牌(自动写入)'),
  deviceId: z.string().description('设备唯一 ID(自动生成)'),
  profile: z.string().default('web').description('要管理的 dsh profile'),
  proxy: z.string().description('安装子进程的 HTTP 代理(可选,如 http://127.0.0.1:7897)'),
  requireConfirm: z.boolean().default(true).description('收到安装指令时是否需要确认'),
  autoStart: z.boolean().default(true).description('启动 dsh 时自动连接'),
})

export async function apply(ctx, config) {
  console.error('[dsh-link] apply config=', JSON.stringify(config))
  const serverUrl = (config.serverUrl || '').trim()
  if (!serverUrl) {
    ctx.logger.warn('dsh-link-plugin: 未配置 serverUrl,远程连接未启用')
    console.error('[dsh-link] NO_SERVER_URL, disabled')
    return
  }

  // deviceId 持久化到状态文件
  const client = new ConnectionClient({
    url: serverUrl,
    deviceId: config.deviceId || '',
    pairingCode: config.pairingCode || '',
    token: config.token || '',
    profile: config.profile || 'web',
    name: loadProfile()?.name ?? 'dsh-device',
    onResult: (payload) => send('command.result', payload),
    onState: () => {
      const p = loadProfile(config.profile || 'web')
      return {
        installed: p?.bundles ?? [],
        dshVersion: undefined,
        platform: process.platform,
      }
    },
  })

  // 拉取商店注册表缓存(离线商店形态)
  refreshRegistry(serverUrl).catch(() => {})

  client.on('ready', () => console.error('[dsh-link] READY'))
  client.on('error', (e) => console.error('[dsh-link] rpc-error', JSON.stringify(e)))
  client.on('reconnecting', () => console.error('[dsh-link] reconnecting'))

  client.on('command', async (cmd) => {
    const { commandId, action, spec } = cmd.params || {}
    ctx.logger.info(`dsh-link-plugin: 收到 ${action} ${spec || ''} (${commandId})`)
    console.error(`[dsh-link] command ${action} ${spec || ''}`)
    send('command.progress', { commandId, status: 'running' })

    // 校验前强制刷新注册表缓存(指令可能早于首次拉取完成)
    await refreshRegistry(serverUrl, { force: true })
    const check = isSafeCommand({ action, spec, registry: cachedRegistry() })
    if (!check.ok) {
      ctx.logger.warn(`dsh-link-plugin: 拒绝指令 ${check.reason}`)
      send('command.result', {
        commandId,
        ok: false,
        exitCode: 1,
        output: `blocked: ${check.reason}`,
      })
      return
    }

    if (config.requireConfirm) {
      ctx.logger.info(
        'dsh-link-plugin: 指令需确认(当前无交互确认 UI,自动接受;可在设置关闭 requireConfirm)',
      )
    }

    const result = await handleCommand({
      profile: config.profile || 'web',
      action,
      spec,
      proxy: config.proxy,
    })
    send('command.result', { commandId, ...result })
  })

  // 直接启动连接(不依赖 ctx ready 事件 —— apply 为异步时可能错过)
  client.start()

  ctx.on('dispose', () => client.stop())

  function send(method, params) {
    return client.send({ method, params })
  }
}

export default {
  name,
  Config,
  apply,
}