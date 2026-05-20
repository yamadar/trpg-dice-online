# TRPG 在线骰子

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

桌上 TRPG 用的在线骰子工具：投掷骰子、保存可复用的模板，并与同伴实时共享
结果、历史与聊天——全部由一个无后端的静态页面完成。

**🎲 在线演示：** https://yamadar.github.io/trpg-dice-online/

## 功能

- **骰子 (A)** — 每次投掷前选择数量与种类
  （`D4, D6, D8, D10, D12, D20, D100`）。`D100` 用两枚 d10 作为位数，
  `00` 视为 100。
- **修正 (B)** — 对结果加减整数修正。
- **用途 (C)** — `伤害` 或 `判定`。伤害显示「`{模板}` `{值}` 点伤害」；
  判定显示「`{模板}` 判定结果 `{值}`」。
- **角色** — 维护多个角色（名称、公开背景、私密备注、可选头像、模板列表
  与按角色保存的「导出时包含备注」偏好），可切换并以 JSON 导入/导出。
- **模板** — 把 A + B + C 取名后按角色保存，从列表一键投掷。
- **历史 & 聊天动态** — 投掷与聊天在同一时间线，可按 全部 / 骰子 /
  聊天 / 文件 过滤。
- **过往房间历史** — 每次会话都会持久化保存；可在大厅以只读模式浏览动态，
  按会话或全部删除。轻触动态中的姓名可查看当时的角色快照与最后已知头像。
- **在线房间** — 创建 / 加入分别使用独立界面，房间代码最少 4 位（自动
  生成为 6 位）；历史、聊天和玩家列表通过 P2P 共享，刷新后 GM 自动重新
  主持，玩家自动重新加入。
- **GM 控制** — 房间改名与代码变更收纳在折叠的 GM 区域，GM 的离开按钮
  写作「关闭房间」。
- **GM 暗骰** — GM 可隐藏点数，其他人只看到发生了暗骰。
- **玩家颜色与输入提示** — 每位参与者拥有稳定颜色；提示器低调显示谁在
  输入。
- **房间动态** — 加入/离开会写入动态，GM 关闭房间时会通知所有人。
- **多语言与自动翻译** — 界面支持 19 种语言。可选的自动翻译会把其他玩家
  的聊天翻译为你的界面语言；优先使用设备上的 Chrome Translator API，无法
  使用时回退到无需密钥的
  [MyMemory](https://mymemory.translated.net/) REST API。在已翻译的消息上
  点击「原文」可查看对方原本发送的内容。

## 在线共享原理

应用使用 **基于 [PeerJS](https://peerjs.com/) 的 WebRTC P2P 连接**。
房间创建者（GM）作为主机；其他玩家直接连到 GM，由 GM 转发共享状态。没有
任何数据经过本项目的服务器。由于是 P2P，房间仅在 GM 保持页面打开时有效。

## 技术栈

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/)（WebRTC P2P）
- [Vitest](https://vitest.dev/)（单元测试）
- GitHub Pages + GitHub Actions（托管）

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器
npm test         # 运行单元测试
npm run lint     # 代码检查
npm run build    # 生产构建至 dist/
```

## 配置（TURN 中继）

当玩家所在网络封禁 UDP 或使用对称型 NAT（公共 Wi-Fi 常见）时，WebRTC
需要 TURN 中继才能建立连接。默认会回退到 Open Relay Project 的免费公共
TURN 服务器——足以试用，但属于「尽力而为」。要使用稳定的中继，请将
`.env.example` 复制为 `.env` 并设置：

- `VITE_TURN_URLS` — 用逗号分隔的 TURN URL。请包含通过 TCP/443 的
  `turns:` 条目，以便在封禁 UDP 的网络仍能连通。
- `VITE_TURN_USERNAME` — TURN 用户名。
- `VITE_TURN_CREDENTIAL` — TURN 凭据（密码）。

若要在 GitHub Pages 部署中使用，请将其添加为仓库 Secrets，并在
`.github/workflows/deploy.yml` 的构建步骤中传入。免费选择包括
[Metered](https://www.metered.ca/) 免费额度或自托管
[coturn](https://github.com/coturn/coturn)。

## 部署

向 `main` 推送会触发 GitHub Actions 工作流
（`.github/workflows/deploy.yml`），执行 lint、测试、构建并发布到 GitHub
Pages。生产基础路径为 `/trpg-dice-online/`；如要在别处托管，请用
`BASE_PATH` 环境变量覆盖。

## 文档

- 需求与实现计划：[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- 翻译 API 研究：[`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## 许可证

[MIT](LICENSE) © 2026 yamadar
