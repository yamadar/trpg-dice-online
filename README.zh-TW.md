<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>口袋裡的骰子房，陪你度過 TRPG 之夜。</strong></p>

<p align="center">
  打開網頁，把一段短短的房間碼告訴同伴，整桌人就能一起開骰 ——<br/>
  不用帳號、不用安裝、不靠任何遊戲伺服器，只要一個連結和骰子。
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>開啟線上 Demo →</strong></a>
</p>

<p align="center">
  <em><strong>語言:</strong></em>
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
  <img src="public/images/lobby-mobile.png" width="280" alt="手機上的空大廳，帶 Dice & Chat 品牌標誌" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="即時顯示骰點與聊天的訊息流" />
</p>

## 為什麼選它跑下一場團

- **報個房間碼就能開骰。** GM 建立房間後把 4–6 位的房間碼讀出來，其他人輸入即可。沒有帳號、沒有 email 驗證、什麼都不用註冊。
- **骰點只在你們之間。** 完全基於 WebRTC 的 P2P：骰點與聊天直接在裝置之間傳遞，不會經過我們的任何伺服器。
- **桌上手機剛好順手。** 行動優先設計，可在 iOS / Android 安裝為 PWA，啟動後全螢幕運行。
- **支援 19 種語言，還能自動翻譯聊天。** 德語牧師可以和日語遊俠互動鬥嘴，所有人都不會跳出沉浸感。
- **下次還想再打開。** 角色、模板、主題、字體大小、過去的房間都儲存在本機，App 用起來就像*你自己的*骰盒，而不是別人借的工具。

## 30 秒開局

1. **GM:** 打開 Demo，點 **房間 → 建立**，把房間碼讀出來。
2. **玩家:** 打開 Demo，點 **房間 → 加入**，輸入房間碼。
3. **全體:** 一起開骰、聊天、為第一顆自然 20 歡呼。

GM 就是 host：只要分頁還開著，房間就在。關掉分頁就是本場結束 —— 過去的房間會留在本機，之後可以再翻看紀錄。

## 骰盒裡有什麼

### 一眼就讀得懂的骰子

`d4 · d6 · d8 · d10 · d12 · d20 · d100`，可設定數量、附正負號的修正值，以及 **傷害 / 判定** 兩種類型，結果會按桌面說話的方式呈現 —— *「偵查判定結果：18」*、*「巨劍：11 點傷害」*。每個出目以與骰子俯視輪廓相符的小圖示顯示，看一眼就懂。

### 模板 —— 拿手招式一鍵搞定

把 `2D6 + 3 — 傷害` 取個名字，例如 *「巨劍」*，下回合一點就重新開骰。模板掛在角色名下，所以同一台裝置上的兩個 PC 各有各的模板，不會混。

### 帶頭像、備忘與專屬模板的角色

每位玩家可管理多個 PC。每個角色都有名字、與全員共享的背景、只有自己能看的私密備忘、可選頭像、專屬模板清單，以及「匯出時是否包含備忘」的個人偏好。可匯出為 JSON 備份，並在別的裝置匯入，把 PC 帶到下一場團。當某人正在扮演角色時，名字會顯示成 `角色名（玩家名）`。

### 骰點與聊天 *同一條訊息流*

骰點與聊天共用一條時間線，附 **全部 / 骰點 / 聊天 / 檔案** 篩選。`@` 自動完成可以提及正確的玩家，`@all` 一次叫齊全場。給訊息附圖會自動縮圖再傳送。

### 可回顧的過去房間

每場過去的會話都以會話級日誌的形式保存在本機。從大廳可以唯讀方式打開舊房間；點擊舊紀錄裡的玩家名字，可看到當時的角色快照與最後一次的頭像。整間房（聊天、骰點、圖片）可以打包成單一 ZIP 匯出。

### GM 工具

GM 可以 **暗骰**：其他人只看到 *「有人做了一次暗骰」*，看不到數字。GM 專區還把改名與重新產生房間碼收進折疊選單，GM 的離開按鈕寫的是 **關閉房間**，明確表示這是結束本場。

### 19 種介面語言 &amp; 聊天自動翻譯

UI 支援 19 種語言。可選的聊天自動翻譯會優先使用裝置端的 Chrome Translator API；若不可用則回退到無需金鑰的 [MyMemory](https://mymemory.translated.net/) REST API。點擊已翻譯訊息上的 **原文** 即可查看對方原始發送內容。

### 一些貼心小細節

每位玩家固定顏色、低調的「正在輸入」提示、入退房事件寫進訊息流、可切換主題、可調整字級，以及 GM 關閉房間時的友善通知。

## 加入主畫面（PWA）

本站是 Progressive Web App，可加入 iOS / Android 的主畫面，全螢幕啟動 —— 沒有瀏覽器邊框，再次打開幾乎瞬間。

- **Android (Chrome):** 打開 Demo，從瀏覽器選單選擇 **安裝應用程式**（或 *加入主畫面*）。
- **iOS (Safari):** 打開 Demo，點分享按鈕選擇 **加入主畫面**。

Service Worker 會預先快取 App 外殼，所以再次啟動近乎瞬時；但房間本身是 WebRTC P2P，仍需即時網路連線。

**螢幕方向：** manifest 沒有鎖定或覆寫方向，因此 PWA 啟動後會遵循裝置本身的「自動旋轉 / 螢幕鎖定」設定（例如 Android 關閉自動旋轉後，即使傾斜裝置 App 也保持目前方向）。

## 線上共享是怎麼運作的

房間使用 [PeerJS](https://peerjs.com/) 的 **WebRTC P2P** 連線。房間建立者（GM）作為 host，其他玩家直接連到 GM，由 GM 轉發共享狀態。本專案不營運任何會經手遊戲資料的伺服器。由於是 P2P，只要 GM 關掉分頁，房間就關閉。

## 技術堆疊

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/)（WebRTC P2P 房間）
- [Vitest](https://vitest.dev/)（單元測試）
- GitHub Pages + GitHub Actions（部署）

## 開發

```bash
npm install      # 安裝依賴
npm run dev      # 啟動開發伺服器
npm test         # 執行單元測試
npm run lint     # 程式碼 Lint
npm run build    # 正式版建置到 dist/
```

## 設定（TURN 中繼，可選）

WebRTC 在 UDP 被阻擋或對稱型 NAT 的網路（咖啡廳、公共 Wi-Fi 上常見）下需要 TURN 中繼。預設情況下 App 會回退到 Open Relay Project 的免費公開 TURN —— 試用足夠，但是 best-effort。

如果想要穩定的中繼，請把 `.env.example` 複製為 `.env` 並填入：

- `VITE_TURN_URLS` —— 用逗號分隔的 TURN URL。請包含一條 TCP/443 的 `turns:` 項目，以便 UDP 被阻擋時也能通。
- `VITE_TURN_USERNAME` —— TURN 使用者名稱。
- `VITE_TURN_CREDENTIAL` —— TURN 金鑰 / 密碼。

> **安全提示：** Vite 會把所有 `VITE_*` 變數內嵌到正式版 bundle，所以在這裡設定的 TURN 憑證對任何打開頁面的人都是可見的。請使用短期 / 臨時 TURN 憑證（例如 TURN REST API 限時憑證模式），並搭配服務商端的限制（允許來源、IP 過濾、月度配額）。不要把長期有效的正式憑證放在這裡。

要在 GitHub Pages 部署中使用，請把這些值加為 Repository Secrets，並在 `.github/workflows/deploy.yml` 的建置步驟中傳入。免費選項包含 [Metered](https://www.metered.ca/) 的免費額度或自架 [coturn](https://github.com/coturn/coturn)。

## 部署

推送到 `main` 會觸發 GitHub Actions 工作流（`.github/workflows/deploy.yml`），依序執行 lint、test、build，並發佈到 GitHub Pages。正式版 base path 是 `/trpg-dice-online/`；如部署到別處，可以用 `BASE_PATH` 環境變數覆寫。

## 文件

- 需求與實作計畫: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- 變更紀錄: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- 即時翻譯 API 研究: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## 授權

[MIT](LICENSE) © 2026 yamadar
