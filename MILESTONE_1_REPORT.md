# Milestone 1 完成報告

## 初始狀態

工作目錄只有 `.git`，master 尚無提交、沒有已追蹤檔案或既有程式碼。未覆蓋既有程式。工具實測：Node.js 24.21.0、npm 11.19.0、Git 2.55.0.windows.5。

## 完成內容

- TypeScript + Phaser 3.90 + Vite 專案，套件版本由 package-lock.json 鎖定。
- BootScene 產生像素 Tile 與三歲寶包外型 placeholder 的四方向行走動畫。
- WorldScene 呈現 1280 × 896 地圖，包含营地、草原、水池、森林與森林深處。
- 方向鍵與 WASD 四方向移動、放開停止、切换視窗清除輸入。
- 地圖邊界與水池、樹、石頭、帳篷靜態碰撞；腳部碰撞盒。
- Camera follow 與鏡頭地圖邊界。
- 分離地圖資料、輸入規則、Player 與探索事件；只有草叢標記 encounterEligible。
- README、邏輯測試、真實瀏覽器整合測試與 build scripts。

執行形式為 Windows 本機瀏覽器遊戲，未封裝成獨立 exe；戰鬥及後續系統未實作。

## 新增 / 修改檔案

所有下列檔案均為本階段新增；開發過程修正也只在這些新檔案內進行。

| 檔案 | 用途 |
| --- | --- |
| package.json、package-lock.json | 套件與 npm scripts、鎖定版本 |
| .gitignore | 排除套件、建置與測試暫存 |
| tsconfig.json、src/vite-env.d.ts | 嚴格 TypeScript 與 Vite 型別 |
| index.html、src/main.ts、src/style.css | 遊戲入口、設定及畫面外框 |
| src/scenes/BootScene.ts | 生成像素素材與動畫 |
| src/scenes/WorldScene.ts | 地圖、碰撞、鏡頭、區域 HUD |
| src/entities/Player.ts | 輸入、移動、腳部碰撞盒 |
| src/data/world.ts | 地圖與區域資料 |
| src/systems/movement.ts | 四方向輸入解析 |
| src/systems/ExplorationTracker.ts | Tile 進入事件、遭遇介面 |
| tests/world.test.ts、vitest.config.ts | 10 項邏輯測試 |
| e2e/walking.spec.ts、playwright.config.ts | Edge 整合測試 |
| README.md、MILESTONE_1_REPORT.md | 啟動、架構及結果報告 |
| artifacts/milestone-1.png | 瀏覽器測試畫面截圖 |

另有忽略的 `dist/` 建置產物與 `node_modules/`；沒有建立 Git commit。

## 最終驗證結果

- `npm test`：10 / 10 通過。包含四方向、停止、相反輸入、禁止斜向、出生點、邊界查詢、障礙物分類、所有可行走 Tile 從營地可達，以及草叢事件去重與再次進入。
- `npm run test:e2e`：1 / 1 通過。使用本機 Microsoft Edge 啟動真正 Phaser 世界，驗證四方向鍵、WASD 的 D、放開停止、左側世界邊界、帳篷碰撞、Camera follow；未發現 pageerror。
- `npm run build`：成功，內含 `tsc --noEmit`，TypeScript 無 error。
- 已目視檢查 `artifacts/milestone-1.png`，地圖、角色、區域 HUD 與操作提示正常顯示。
- npm 安裝的套件 audit：0 vulnerabilities（安裝當時的結果）。

Build 提示單一 bundle 超過 500 kB，主 JavaScript 約 1.20 MB、gzip 約 322 kB，主要包含 Phaser；是警告，非 build error。現階段未加入大型封裝或載入優化功能。

## 啟動與下一步

在專案目錄執行 `npm run dev`，用本機瀏覽器開啟終端 URL，再以方向鍵或 WASD 操作。重新安裝依賴使用 `npm ci`。其他驗證指令與架構說明見 README。

建議先確認行走手感、地圖比例及碰撞盒，再由使用者指定 Milestone 2 的範圍。本次停在 Milestone 1。
