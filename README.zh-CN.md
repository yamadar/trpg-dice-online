<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>口袋里的骰子房，陪你度过 TRPG 之夜。</strong></p>

<p align="center">
  打开网页，把一段短短的房间码报给同伴，整桌人就能一起开骰 ——<br/>
  无需账号、无需安装、不靠任何游戏服务器，只要一个链接和骰子。
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>打开在线 Demo →</strong></a>
</p>

<p align="center">
  <em><strong>语言:</strong></em>
  <a href="README.md">English</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.th.md">ไทย</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.id.md">Bahasa Indonesia</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.vi.md">Tiếng Việt</a> ·
  <a href="README.hi.md">हिन्दी</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.uk.md">Українська</a>
</p>

<p align="center">
  <img src="public/images/lobby-mobile.png" width="280" alt="手机上的空大厅，带 Dice & Chat 品牌标识" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="实时显示骰点与聊天的信息流" />
</p>

## 为什么选它来跑下一场团

- **报个房间码就能开骰。** GM 创建房间后把 4–6 位的房间码读出来，其他人输入即可。没有账号，没有邮箱验证，什么都不用注册。
- **骰点只在你们之间。** 完全基于 WebRTC 的 P2P：骰点和聊天直接在设备间传递，不会经过我们的任何服务器。
- **桌上手机刚好顺手。** 移动优先布局，可在 iOS / Android 上安装为 PWA，启动后全屏运行。
- **支持 19 种语言，还能自动翻译聊天。** 德语牧师可以和日语游侠斗嘴，所有人都不会跳出沉浸感。
- **下次还想再打开。** 角色、模板、主题、字体大小、过去的房间都保存在本机，App 用起来就像*你自己的*骰盒，而不是别人借你的工具。

## 30 秒开局

1. **GM:** 打开 Demo，点 **房间 → 创建**，把房间码读出来。
2. **玩家:** 打开 Demo，点 **房间 → 加入**，输入房间码。
3. **全体:** 一起开骰、聊天、为第一颗自然 20 欢呼。

GM 就是 host：只要这个标签页还开着，房间就在。关掉标签页 = 本场结束 —— 过去的房间会留在本地，之后可以再翻看记录。

## 骰盒里有什么

### 一眼就能读懂的骰子

`d4 · d6 · d8 · d10 · d12 · d20 · d100`，可设置数量、带符号的修正值，以及 **伤害 / 检定** 两种类型，结果会按桌面说话的方式呈现 —— *"侦查检定结果：18"*、*"巨剑：11 点伤害"*。每个出目以与骰子顶视轮廓相符的小图标显示，看一眼就懂。

### 模板 —— 拿手好戏一键搞定

把 `2D6 + 3 — 伤害` 起个名字，比如 *"巨剑"*，下回合一点就重玩。模板挂在角色名下，所以同一台设备上的两个 PC 各有各的模板，互不混淆。

### 带头像、备注与专属模板的角色

每位玩家可以管理多个 PC。每个角色都有名字、与全员共享的背景、只有自己能看的私密备注、可选头像、专属模板列表，以及"导出时是否包含备注"的个人偏好。可以导出 JSON 备份，在别的设备导入，把 PC 带到下一场团。当某人正在扮演角色时，名字会显示为 `角色名（玩家名）`。

### 骰点与聊天 *同一条信息流*

骰点和聊天共用一条时间线，带 **全部 / 骰点 / 聊天 / 文件** 过滤。`@` 自动补全可以提到正确的玩家，`@all` 一次喊全场。给消息附图片会自动压缩后再发送。

### 可回顾的过去房间

每场过去的会话都以会话级日志的形式保存在本地。在大厅可以以只读方式打开旧房间；点击旧记录里的玩家名字，可以看到当时的角色快照与最后一次的头像。整间房（聊天、骰点、图片）可以打包为单个 ZIP 导出。

### GM 工具

GM 可以 **暗骰**：其他人只看到 *"有人做了一次暗骰"*，看不到数字。GM 专区还把改名和重新生成房间码收进了折叠菜单，GM 的退出按钮写的是 **关闭房间**，让人一目了然这是结束本场。

### 19 种界面语言 &amp; 聊天自动翻译

UI 支持 19 种语言。可选的聊天自动翻译会优先使用设备端的 Chrome Translator API；若不可用，则回落到无需密钥的 [MyMemory](https://mymemory.translated.net/) REST API。点击已翻译消息上的 **原文** 即可查看对方原始发送内容。

### 一些贴心小细节

每位玩家固定颜色、低调的"正在输入"指示、入退房事件写进信息流、可切换主题、可调节字号，以及 GM 关闭房间时的友好提示。

## 加入主屏幕（PWA）

本站是 Progressive Web App，可添加到 iOS / Android 主屏幕，全屏启动 —— 没有浏览器外壳，再次打开几乎瞬时。

- **Android (Chrome):** 打开 Demo，从浏览器菜单选择 **安装应用**（或 *添加到主屏幕*）。
- **iOS (Safari):** 打开 Demo，点分享按钮选择 **添加到主屏幕**。

Service Worker 会预缓存 App 外壳，所以再次启动几乎瞬时；但房间本身是 WebRTC P2P，仍需要实时网络连接。

**屏幕方向：** manifest 没有固定或覆盖方向，因此 PWA 启动后会遵循设备本身的"自动旋转 / 旋转锁定"设置（例如 Android 关闭自动旋转后，即便倾斜设备 App 也保持当前方向）。

## 在线共享如何工作

房间使用 [PeerJS](https://peerjs.com/) 的 **WebRTC P2P** 连接。房间创建者（GM）作为 host，其他玩家直接连到 GM，由 GM 转发共享状态。本项目不运营任何会经过游戏数据的服务器。由于是 P2P，只要 GM 关掉标签页，房间就关闭。

## 技术栈

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/)（WebRTC P2P 房间）
- [Vitest](https://vitest.dev/)（单元测试）
- GitHub Pages + GitHub Actions（托管）

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器
npm test         # 运行单元测试
npm run lint     # 代码 Lint
npm run build    # 生产构建到 dist/
```

## 配置（TURN 中继，可选）

WebRTC 在 UDP 被屏蔽或对称型 NAT 的网络（咖啡馆、公共 Wi-Fi 等很常见）下需要 TURN 中继。默认情况下 App 会回落到 Open Relay Project 的免费公共 TURN —— 临时玩玩够用，但是 best-effort。

如果想要稳定的中继，请把 `.env.example` 复制为 `.env` 并填写：

- `VITE_TURN_URLS` —— 用逗号分隔的 TURN URL。请包含一条 TCP/443 的 `turns:` 项，以便在 UDP 被屏蔽时也能通。
- `VITE_TURN_USERNAME` —— TURN 用户名。
- `VITE_TURN_CREDENTIAL` —— TURN 密钥 / 密码。

> **安全提示：** Vite 会把所有 `VITE_*` 变量内联进生产 bundle，所以这里设置的 TURN 凭据对任何打开页面的访客都是可见的。请使用短期 / 临时 TURN 凭据（例如 TURN REST API 限时凭据模式），并配合服务商端限制（允许来源、IP 过滤、月度配额）。不要把长期有效的生产凭据用在这里。

要在 GitHub Pages 部署中使用，把这些值加为仓库 Secrets，并在 `.github/workflows/deploy.yml` 的构建步骤里传入。免费选项包括 [Metered](https://www.metered.ca/) 免费额度或自托管 [coturn](https://github.com/coturn/coturn)。

## 部署

推送到 `main` 会触发 GitHub Actions 工作流（`.github/workflows/deploy.yml`），依次执行 lint、test、build，然后发布到 GitHub Pages。生产 base path 是 `/trpg-dice-online/`；如部署到别处，可以用 `BASE_PATH` 环境变量覆盖。

## 文档

- 需求与实现方案: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- 实时翻译 API 调研: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## 许可证

[MIT](LICENSE) © 2026 yamadar
