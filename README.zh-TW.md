# Dice & Chat

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

桌上 TRPG 用的線上骰子工具：擲骰、儲存可重複使用的範本，並與夥伴即時共享結果、歷史與聊天——全部由一個無後端的靜態頁面完成。

**🎲 線上展示：** https://yamadar.github.io/trpg-dice-online/

## 功能

- **骰子 (A)** — 每次投擲前選擇數量與種類（`D4, D6, D8, D10, D12, D20, D100`）。`D100` 以兩顆 d10 作為位數，`00` 視為 100。
- **修正 (B)** — 對結果加減整數修正。
- **用途 (C)** — `傷害` 或 `判定`。傷害顯示「`{範本}` `{值}` 點傷害」；判定顯示「`{範本}` 判定結果 `{值}`」。
- **角色** — 管理多個角色（名稱、公開背景、私人備忘錄、可選頭像、範本清單與依角色儲存的「匯出時包含備忘錄」偏好），可切換並以 JSON 匯入/匯出。
- **範本** — 把 A + B + C 命名後依角色儲存，從清單一鍵投擲。
- **歷史 & 聊天動態** — 投擲與聊天在同一時間軸，可按 全部 / 骰子 / 聊天 / 檔案 篩選。
- **過往房間歷史** — 每次會話皆會永久儲存；可在大廳以唯讀模式瀏覽動態，依會話或全部刪除。輕觸動態中的名稱可看到當時的角色快照與最後已知頭像。
- **線上房間** — 建立 / 加入分別使用獨立介面，房間代碼至少 4 位（自動產生為 6 位）；歷史、聊天和玩家清單透過 P2P 共享，重新整理後 GM 自動重新主持，玩家自動重新加入。
- **GM 控制** — 房間改名與代碼變更集中在可折疊的 GM 區域，GM 的離開按鈕為「關閉房間」。
- **GM 暗骰** — GM 可隱藏點數，其他人只看到發生了暗骰。
- **玩家顏色與輸入提示** — 每位參與者有穩定顏色；提示器低調顯示誰在輸入。
- **房間動態** — 加入/離開會寫入動態，GM 關閉房間時會通知所有人。
- **多語言與自動翻譯** — 介面支援 19 種語言。可選的自動翻譯會把其他玩家的聊天翻譯為你的介面語言；優先使用裝置上的 Chrome Translator API，無法使用時回退到無需金鑰的 [MyMemory](https://mymemory.translated.net/) REST API。在已翻譯的訊息上點擊「原文」可看到對方原本送出的內容。

## 線上共享原理

應用使用 **基於 [PeerJS](https://peerjs.com/) 的 WebRTC P2P 連線**。房間建立者（GM）擔任主機；其他玩家直接連到 GM，由 GM 轉發共享狀態。沒有任何資料經過本專案的伺服器。由於是 P2P，房間僅在 GM 保持頁面開啟時有效。

## 技術堆疊

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/)(WebRTC P2P)
- [Vitest](https://vitest.dev/)（單元測試）
- GitHub Pages + GitHub Actions（代管）

## 開發

```bash
npm install      # 安裝相依套件
npm run dev      # 啟動開發伺服器
npm test         # 執行單元測試
npm run lint     # 程式檢查
npm run build    # 正式建置至 dist/
```

## 設定（TURN 中繼）

當玩家所在網路封鎖 UDP 或使用對稱式 NAT（公共 Wi-Fi 常見）時，WebRTC 需要 TURN 中繼才能建立連線。預設會回退到 Open Relay Project 的免費公共 TURN 伺服器——適合試用但屬於「盡力而為」。若要使用穩定的中繼，將 `.env.example` 複製為 `.env` 並設定：

- `VITE_TURN_URLS` — 以逗號分隔的 TURN URL。請包含 TCP/443 的 `turns:` 項目，讓 UDP 被封鎖的網路也能連通。
- `VITE_TURN_USERNAME` — TURN 使用者名稱。
- `VITE_TURN_CREDENTIAL` — TURN 認證資訊（密碼）。

**安全提示：** Vite 會把所有 `VITE_*` 變數內嵌到正式建置的套件中，因此你在這裡設定的 TURN 認證資訊任何開啟頁面的人都能看到。為降低被濫用的風險，請使用短期 / 暫時的 TURN 認證資訊（例如 TURN REST API 的時限式認證模式），並搭配服務提供方的限制（允許來源、IP 篩選、每月配額）。請勿把長期有效的正式環境認證資訊重複使用於此處。

若要在 GitHub Pages 部署中使用，請將其加入 Repository Secrets，並在 `.github/workflows/deploy.yml` 的建置步驟中傳入。免費選項包括 [Metered](https://www.metered.ca/) 的免費方案，或自架 [coturn](https://github.com/coturn/coturn)。

## 部署

向 `main` 推送會觸發 GitHub Actions 工作流程（`.github/workflows/deploy.yml`），執行 lint、測試、建置並發佈至 GitHub Pages。正式環境的 base path 為 `/trpg-dice-online/`；如要部署到他處，可透過 `BASE_PATH` 環境變數覆寫。

## 文件

- 需求與實作計畫：[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- 變更紀錄：[`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- 翻譯 API 調查：[`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## 授權

[MIT](LICENSE) © 2026 yamadar
