// dsh-link-plugin 客户端:独立的"连接 dsh.cbnac.com"设置区块
window.__ModuleLoader__.load({
  id: 'dsh-link-plugin',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let React = require('react')

    const CHANNEL = '/dsh-link'

    const CSS = `
.dsh-link-section {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--dsw-alias-label-primary, #e6e9f0);
}
.dsh-link-section-title { margin: 0; font-size: 18px; font-weight: 600; line-height: 26px; }
.dsh-link-section-intro { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary, #8a91a3); }
.dsh-link-card {
  background: var(--dsw-alias-bg-module-platform, rgba(18,24,40,0.6));
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.08));
  border-left: 3px solid #22b8f0;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dsh-link-field { display: flex; flex-direction: column; gap: 6px; }
.dsh-link-label { font-size: 12px; font-weight: 500; line-height: 18px; color: var(--dsw-alias-label-secondary, #b6bdcc); }
.dsh-link-input {
  box-sizing: border-box;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.12));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, rgba(8,12,22,0.7));
  color: inherit;
}
.dsh-link-input:focus { border-color: #22b8f0; outline: none; }
.dsh-link-input::placeholder { color: var(--dsw-alias-label-dimmed, #5a6072); }
.dsh-link-actions { display: flex; align-items: center; gap: 12px; }
.dsh-link-save {
  height: 34px;
  padding: 0 16px;
  font: inherit;
  font-weight: 600;
  border: none;
  border-radius: 17px;
  background: #22b8f0;
  color: #08121c;
  cursor: pointer;
}
.dsh-link-save:hover { background: #4fd1ff; }
.dsh-link-status { font-size: 12px; min-height: 16px; color: var(--dsw-alias-label-secondary, #b6bdcc); }
.dsh-link-hint { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary, #8a91a3); }
.dsh-link-hint code { background: rgba(255,255,255,0.08); border-radius: 4px; padding: 1px 4px; }
`

    function installStyles() {
      const style = document.createElement('style')
      style.textContent = CSS
      document.head.appendChild(style)
      return () => {
        if (style.parentNode) style.parentNode.removeChild(style)
      }
    }

    // 独立设置区块:连接 dsh.cbnac.com
    function LinkSection(props) {
      const rpc = props.rpc
      const [serverUrl, setServerUrl] = React.useState('')
      const [pairingCode, setPairingCode] = React.useState('')
      const [profile, setProfile] = React.useState('web')
      const [proxy, setProxy] = React.useState('')
      const [loaded, setLoaded] = React.useState(false)
      const [status, setStatus] = React.useState('')

      React.useEffect(() => {
        rpc('config', {}).then((v) => {
          if (!v) return
          if (typeof v.serverUrl === 'string') setServerUrl(v.serverUrl)
          if (typeof v.pairingCode === 'string') setPairingCode(v.pairingCode)
          if (typeof v.profile === 'string') setProfile(v.profile)
          if (typeof v.proxy === 'string') setProxy(v.proxy)
        }).catch(() => {}).finally(() => setLoaded(true))
      }, [])

      function save() {
        if (!serverUrl.trim()) { setStatus('serverUrl 不能为空'); return }
        setStatus('保存中…')
        rpc('config', {
          serverUrl: serverUrl.trim(),
          pairingCode: pairingCode.trim(),
          profile: profile.trim() || 'web',
          proxy: proxy.trim(),
        }).then(() => {
          setStatus('✓ 已保存并重连')
          setTimeout(() => setStatus(''), 2500)
        }).catch(() => setStatus('保存失败'))
      }

      const input = (value, set, ph, onEnter) => React.createElement('input', {
        className: 'dsh-link-input',
        value,
        placeholder: ph,
        onChange: (e) => set(e.target.value),
        onKeyDown: (e) => { if (e.key === 'Enter') save() },
      })

      return React.createElement('section', { className: 'dsh-link-section' },
        React.createElement('h2', { className: 'dsh-link-section-title' }, '连接 dsh.cbnac.com'),
        React.createElement('p', { className: 'dsh-link-section-intro' },
          '把本机 dsh 连到 dsh.cbnac.com,即可从浏览器远程安装插件。在网站「远程控制台」生成配对码后填到下面。',
        ),
        React.createElement('div', { className: 'dsh-link-card' },
          React.createElement('div', { className: 'dsh-link-field' },
            React.createElement('label', { className: 'dsh-link-label' }, 'serverUrl'),
            input(serverUrl, setServerUrl, loaded ? 'wss://dsh.cbnac.com/ws/harness' : '加载中…'),
          ),
          React.createElement('div', { className: 'dsh-link-field' },
            React.createElement('label', { className: 'dsh-link-label' }, '配对码(首次连接填写)'),
            input(pairingCode, setPairingCode, '8 位配对码'),
          ),
          React.createElement('div', { className: 'dsh-link-field' },
            React.createElement('label', { className: 'dsh-link-label' }, 'profile'),
            input(profile, setProfile, 'web'),
          ),
          React.createElement('div', { className: 'dsh-link-field' },
            React.createElement('label', { className: 'dsh-link-label' }, 'HTTP 代理(可选)'),
            input(proxy, setProxy, 'http://127.0.0.1:7897'),
          ),
          React.createElement('div', { className: 'dsh-link-actions' },
            React.createElement('button', { type: 'button', className: 'dsh-link-save', onClick: save }, '保存并连接'),
            React.createElement('span', { className: 'dsh-link-status' }, status),
          ),
          React.createElement('p', { className: 'dsh-link-hint' },
            '在 <code>dsh.cbnac.com/console</code> 生成配对码;配对成功后 token 自动持久化,无需重复填写。',
          ),
        ),
      )
    }

    function apply(ctx) {
      const disposeStyle = installStyles()
      const connection = ctx.get('connection')
      if (connection === undefined) return
      const rpc = (endpoint, payload) => connection.rpc.call(CHANNEL, endpoint, payload || {}).then((result) => {
        if (!result.ok) throw new Error((result.error && (result.error.details || result.error.code)) || 'rpc failed')
        return result.value
      })

      const slots = ctx.get('slots')
      if (slots === undefined) return
      // 独立的"连接 dsh.cbnac.com"设置区块(左侧导航)
      slots.inject('settings.section', () => slots.register({
        name: 'settings.section',
        id: 'dsh-link',
        order: 15,
        label: () => '连接 dsh.cbnac.com',
        inject: () => ({ rpc }),
      }, LinkSection))

      ctx.effect(() => disposeStyle, 'dsh-link: styles')
    }

    exports.apply = apply
    return module.exports
  },
})