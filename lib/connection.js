import { EventEmitter } from 'node:events'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.join(os.homedir(), '.dsh', 'src-state-link.json')

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveState(s) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2))
  } catch {
    /* 只读目录时忽略 */
  }
}

/**
 * WS 客户端:指数退避重连 + 心跳 + jsonrpc 信封。
 * - hello(配对/恢复)-> hello.result(token, deviceId)
 * - command -> 执行后 command.result
 * - state 上报已装列表
 */
export class ConnectionClient extends EventEmitter {
  constructor(opts) {
    super()
    this.url = opts.url
    this.deviceId = opts.deviceId
    this.pairingCode = opts.pairingCode || ''
    this.profile = opts.profile || 'web'
    this.name = opts.name || os.hostname()
    this.onResult = opts.onResult
    this.onState = opts.onState

    // 从磁盘恢复持久 token
    const state = loadState()
    if (state.deviceId) this.deviceId = state.deviceId
    this.token = state.token || opts.token || ''

    // 无 deviceId 时生成并持久化,保证重连用同一 id
    if (!this.deviceId) {
      this.deviceId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      saveState({ token: this.token, deviceId: this.deviceId })
    }

    this.ws = null
    this.running = false
    this.backoff = 1000
    this.handshakeDone = false
    this.reconnectTimer = null
    this.pingTimer = null
  }

  start() {
    if (this.running) return
    this.running = true
    this.connect()
  }

  stop() {
    this.running = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.pingTimer) clearInterval(this.pingTimer)
    if (this.ws) {
      try {
        this.ws.close()
      } catch {}
      this.ws = null
    }
  }

  connect() {
    if (!this.running) return
    const ws = (this.ws = new WebSocket(this.url))
    ws.on('open', () => {
      this.backoff = 1000
      this.send({
        method: 'hello',
        params: {
          deviceId: this.deviceId,
          // 配置了配对码 → 用配对码重新配对(覆盖旧 token);否则用持久化 token 重连
          ...(this.pairingCode ? { pairingCode: this.pairingCode } : this.token ? { token: this.token } : {}),
          profile: this.profile,
          name: this.name,
          platform: process.platform,
        },
      })
    })
    ws.on('message', (buf) => this.onMessage(buf.toString()))
    ws.on('pong', () => {})
    ws.on('close', () => {
      this.ws = null
      this.handshakeDone = false
      if (this.running) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.backoff)
        this.backoff = Math.min(this.backoff * 2, 60000)
        this.emit('reconnecting')
      }
    })
    ws.on('error', (e) => {
      // 连接失败交给 close 处理
      try {
        ws.terminate()
      } catch {}
    })

    // 心跳
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.ping()
    }, 30000)
  }

  onMessage(text) {
    let msg
    try {
      msg = JSON.parse(text)
    } catch {
      return
    }
    if (msg.error) {
      this.emit('error', msg.error)
      return
    }
    switch (msg.method) {
      case 'hello.result': {
        const { token, deviceId } = msg.params || {}
        // 只有拿到真实 token(新配对)才持久化;'resumed' 是重连哨兵,不覆盖已有 token
        if (token && token !== 'resumed') {
          this.token = token
          this.deviceId = deviceId || this.deviceId
          this.pairingCode = '' // 配对成功,后续重连用 token
          saveState({ token, deviceId: this.deviceId })
        }
        this.handshakeDone = true
        this.emit('ready')
        // 连上即上报状态
        if (this.onState) {
          this.send({ method: 'state', params: this.onState() })
        }
        break
      }
      case 'ping': {
        this.send({ method: 'pong' })
        break
      }
      case 'command': {
        this.emit('command', msg)
        break
      }
      default:
        break
    }
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
      return true
    }
    return false
  }

  result(payload) {
    return this.send({ method: 'command.result', params: payload })
  }
}

export default ConnectionClient