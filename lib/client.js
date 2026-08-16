// dsh-link-plugin 客户端:设置 → 插件 → dsh-link 卡片
window.__ModuleLoader__.load({
  id: 'dsh-link-plugin',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let React = require('react')

    const CHANNEL = '/dsh-link'

    const CSS = `
.dsh-link-set-card {
  list-style: none;
  margin: 0;
  padding: 10px 12px;
  background: rgba(20, 26, 44, 0.6);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
}
.dsh-link-set-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 0;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.dsh-link-set-headtext { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; flex: 1; text-align: left; }
.dsh-link-set-title { font-weight: 600; }
.dsh-link-set-desc { font-size: 12px; opacity: 0.6; }
.dsh-link-set-caret { font-size: 11px; opacity: 0.5; }
.dsh-link-set-body { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
.dsh-link-set-label { font-size: 12px; opacity: 0.7; display: block; margin-bottom: 4px; }
.dsh-link-set-input {
  width: 100%;
  padding: 7px 9px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(8, 12, 22, 0.7);
  color: inherit;
  font: inherit;
  font-size: 13px;
  box-sizing: border-box;
}
.dsh-link-set-row { display: flex; gap: 8px; }
.dsh-link-set-row .dsh-link-set-inputwrap { flex: 1; }
.dsh-link-set-save {
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  background: #22b8f0;
  color: #08121c;
  font-weight: 600;
  cursor: pointer;
}
.dsh-link-set-save:disabled { opacity: 0.5; cursor: default; }
.dsh-link-set-status { font-size: 12px; opacity: 0.7; min-height: 16px; }
.dsh-link-set-hint { font-size: 11px; opacity: 0.5; }
`

    function installStyles() {
      const style = document.createElement('style')
      style.textContent = CSS
      document.head.appendChild(style)
      return () => {
        if (style.parentNode) style.parentNode.removeChild(style)
      }
    }

    function SettingsCard(props) {
      const rpc = props.rpc
      const [open, setOpen] = React.useState(false)
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
        if (!serverUrl.trim()) {
          setStatus('serverUrl 不能为空')
          return
        }
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

      return React.createElement('li', { className: 'dsh-link-set-card' },
        React.createElement('button', {
          type: 'button',
          className: 'dsh-link-set-header',
          'aria-expanded': open,
          onClick: () => setOpen(!open),
        },
          React.createElement('span', { className: 'dsh-link-set-headtext' },
            React.createElement('span', { className: 'dsh-link-set-title' }, 'dsh-link'),
            React.createElement('span', { className: 'dsh-link-set-desc' }, '远程连接 dsh 社区'),
          ),
          React.createElement('span', { className: 'dsh-link-set-badge' }, ''),
          React.createElement('span', { className: 'dsh-link-set-caret', 'aria-hidden': 'true' }, open ? '▴' : '▾'),
        ),
        open
          ? React.createElement('div', { className: 'dsh-link-set-body' },
              React.createElement('div', null,
                React.createElement('label', { className: 'dsh-link-set-label' }, 'serverUrl'),
                React.createElement('input', {
                  className: 'dsh-link-set-input',
                  value: serverUrl,
                  placeholder: loaded ? 'wss://dsh.cbnac.com/ws/harness' : '加载中…',
                  onChange: (e) => setServerUrl(e.target.value),
                }),
              ),
              React.createElement('div', null,
                React.createElement('label', { className: 'dsh-link-set-label' }, '配对码(首次连接填写)'),
                React.createElement('input', {
                  className: 'dsh-link-set-input',
                  value: pairingCode,
                  placeholder: '8 位配对码',
                  onChange: (e) => setPairingCode(e.target.value),
                }),
              ),
              React.createElement('div', null,
                React.createElement('label', { className: 'dsh-link-set-label' }, 'profile'),
                React.createElement('input', {
                  className: 'dsh-link-set-input',
                  value: profile,
                  onChange: (e) => setProfile(e.target.value),
                }),
              ),
              React.createElement('div', null,
                React.createElement('label', { className: 'dsh-link-set-label' }, 'HTTP 代理(可选)'),
                React.createElement('input', {
                  className: 'dsh-link-set-input',
                  value: proxy,
                  placeholder: 'http://127.0.0.1:7897',
                  onChange: (e) => setProxy(e.target.value),
                }),
              ),
              React.createElement('div', null,
                React.createElement('button', {
                  type: 'button',
                  className: 'dsh-link-set-save',
                  onClick: save,
                }, '保存并连接'),
              ),
              React.createElement('div', { className: 'dsh-link-set-status' }, status),
              React.createElement('div', { className: 'dsh-link-set-hint' },
                '在 dsh.cbnac.com/console 生成配对码;已配对后 token 自动持久化,无需重复填写。',
              ),
            )
          : null,
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
      slots.inject('settings.plugin.item', () => slots.register(
        { name: 'settings.plugin.item', id: 'dsh-link', order: 45 },
        () => React.createElement(SettingsCard, { rpc }),
      ))
      ctx.effect(() => disposeStyle, 'dsh-link: styles')
    }

    exports.apply = apply
    return module.exports
  },
})