# dsh-link-plugin

把本机运行的 **DeepSeek Harness (dsh)** 安全地连接到 **dsh 社区网站**([dsh.cbnac.com](https://dsh.cbnac.com)),从浏览器远程安装插件、看看商店注册表,离线也能浏览可安装条目。

> 它是 [dsh](https://github.com/deepseek-ai/dsh) 的社区远程连接插件:由本机插件**主动连出**到服务器的 WebSocket 网关,网站下发指令后由**本机自己**执行 `dsh plugin add`,因此安装动作始终发生在你的机器上。

## 安装

在你的 dsh profile 中安装:

```bash
dsh plugin --profile web add "github:qwert702/dsh-link-plugin#main"
```

## 配置

在 dsh Web UI 的插件设置里填写:

| 字段 | 说明 |
|------|------|
| `serverUrl` | WebSocket 服务器地址,默认 `wss://dsh.cbnac.com/ws/harness` |
| `pairingCode` | 一次性配对码(在网站「远程控制台」生成,15 分钟有效) |
| `profile` | 要管理的 profile,默认 `web` |
| `requireConfirm` | 收到安装指令时确认(当前无交互确认 UI,默认自动接受) |
| `autoStart` | 启动 dsh 时自动连接 |

首次连接成功后,插件会把 `token` 与 `deviceId` 持久化到 `~/.dsh/src-state-link.json`,之后断线重连自动恢复。

## 配对流程

1. 在 [dsh.cbnac.com/console](https://dsh.cbnac.com/console) 登录并点击「生成配对码」。
2. 在 dsh-link-plugin 设置里填入 `serverUrl` + `配对码` + `profile`。
3. 保存后插件自动连接并握手;回到控制台即可看到设备上线、已装插件列表。
4. 在插件详情页点「远程安装」,选择设备,本机执行安装,控制台显示进度。

## 安全模型

- **白名单安装**:安装源 `spec` 必须是商店注册表中 `approved/manual` 的行(`GET /api/plugins/registry.json`),本地二次校验。
- **拒绝危险输入**:`./`、`../`、`file:`、`link:` 以及含 `&&` `;` `|` 空格/引号等字符的指令一律拦截。
- **令牌安全**:设备令牌在服务器只存 sha256 哈希;指令仅设备所有者可下发;链路经 TLS(wss)。
- **了解风险**:安装一个插件会运行其构建脚本(prepare)。只从你信任的来源安装。

## 离线商店

插件连接服务器时会缓存一份注册表(5 秒内重复拉取会被跳过,离线沿用旧缓存)。即使断网,你在 dsh Web UI 中也能看到可安装条目。

## 开发

```bash
cd packages/dsh-link-plugin
pnpm install
node --test test/
```

## 许可证

MIT