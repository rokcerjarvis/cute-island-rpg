# Milestone 2 — Encounter System & Battle Entry

狀態：完成，停止於 Milestone 2，未開始 Milestone 3。

## 開始前驗證

- Git status：Milestone 1 檔案均為 untracked，尚無 commit；未刪除或覆蓋既有架構。
- `npm test`：既有 10 / 10 通過。
- `npm run build`：成功，內含 TypeScript 檢查。
- 本次沒有新增套件或修改 package.json / package-lock.json。

## 完成摘要

草原草叢移動 → step 判定 → 8% 遭遇 → 加權生物抽選 → Lv.2～5 → 遭遇提示與 BattleScene → 逃跑 / Esc → 原 WorldScene 與遭遇位置。

保留原四方向移動、WASD / Arrow Keys、世界邊界、障礙碰撞、Camera follow 與 `exploration:tile-entered` 事件。地圖、Player、移動規則與素材產生方式沒有修改。

### 生物與遭遇資料

共用模型包含 id、name、kind、attribute、baseStats、baseCaptureRate、capturable、skills。kind 支援 CUTE_CREATURE / MONSTER，attribute 支援五屬性；捕捉率欄位單位為百分比。

| ID | 名稱 | 屬性 | HP / Attack / Speed | 捕捉率 | 可捕捉 |
| --- | --- | --- | --- | --- | --- |
| CUTE_001 | 吉伊卡哇 | WATER | 35 / 10 / 10 | 70 | 是 |
| CUTE_002 | 小八 | WIND | 30 / 10 / 15 | 65 | 是 |
| CUTE_003 | 兔兔 | FIRE | 28 / 16 / 12 | 55 | 是 |
| CUTE_004 | 栗子饅頭 | EARTH | 44 / 11 / 6 | 60 | 是 |
| CUTE_005 | 飛鼠 | PURE_CUTE | 34 / 7 / 11 | 30 | 是 |
| MON_001 | 黑團蟲 | EARTH | 26 / 8 / 7 | 0 | 否 |
| MON_002 | 暴躁大嘴怪 | FIRE | 38 / 16 / 9 | 0 | 否 |
| MON_003 | 巨型森林怪 | WIND | 80 / 15 / 13 | 0 | 否 |

MON_003 有 boss=true，但不進隨機池。skills 僅為佔位 skill id array，沒有執行效果。

GRASSLAND 位於獨立 `data/encounters.ts`，映射既有 meadow region。遭遇機率 0.08，等級 2～5。權重：小八 32、栗子饅頭 32、吉伊卡哇 16、兔兔 10、飛鼠 5、黑團蟲 5。系統按權重總和抽選，可使用非 100 總和。

### step guard 與 cooldown

角色腳部中心跨入新 Tile 時遞增 stepId。初始觀察 step 0 不算遭遇；需有移動速度且為草叢。停留不重複發事件，同一或過去 stepId 不重判，道路不擲骰。EncounterSystem 的 RNG 可透過建構子注入。

返回時記錄最後 stepId，接下來兩個新的有效草叢 step 不擲骰；道路不消耗保護步數。Debug 強制遭遇也遵守道路、移動、step guard 與 cooldown。

### Scene payload 與返回

BattleEntryPayload 包含 enemy（definition、level、hp、maxHp）、messages、world（x、y、zoneId、stepId）。WorldScene 停止移動、清除鍵盤狀態，launch BattleScene 後 sleep；地圖、障礙物、Camera、區域 HUD 與 tracker 保存在原 Scene instance。

BattleScene 顯示敵方名稱、等級、屬性、HP、種類與可捕捉標記，以及「玩家小可愛」。戰鬥、道具、隊伍顯示「尚未實作」；逃跑按鈕 / Esc 會 wake 原 WorldScene、還原位置、清除輸入並啟用 cooldown。沒有回出生點或重建世界。

每一次 PURE_CUTE 小可愛遭遇都以第一行顯示「這是什麼？上網查一下！」，第二行顯示野生飛鼠出現；沒有 only-first flag。怪物使用「怪物 黑團蟲 出現了！」。

## 新增檔案

- `src/entities/BattleEntity.ts`：模型、transition payload、每次遭遇提示。
- `src/data/creatures.ts`：五隻小可愛。
- `src/data/monsters.ts`：三隻怪物。
- `src/data/encounters.ts`：生物 registry、GRASSLAND table、region mapping。
- `src/systems/EncounterSystem.ts`：chance、權重抽選、等級 RNG、step guard、cooldown。
- `src/scenes/BattleScene.ts`：戰鬥入口骨架與返回操作。
- `tests/encounter.test.ts`：18 項新增單元測試。
- `e2e/encounter.spec.ts`：2 項新增 Edge 整合測試。
- `MILESTONE_2_REPORT.md`：本報告。
- `artifacts/milestone-2-battle.png`、`artifacts/milestone-2-world.png`：實際瀏覽器截圖。

## 修改檔案

- `src/main.ts`：註冊 BattleScene。
- `src/scenes/WorldScene.ts`：串接系統、sleep / wake 返回、明確 dev debug flag。
- `src/systems/ExplorationTracker.ts`：既有事件增加 stepId，保留原欄位與行為。
- `index.html`：Milestone 02 標記與操作提示。
- `README.md`：目前架構、啟動、資料流、測試及手動驗證方式。
- `artifacts/milestone-1.png`：既有 walking test 重新執行時更新截圖，顯示目前版本。

## 最終驗證

| 檢查 | 結果 |
| --- | --- |
| npm test | 28 / 28 PASS（原 10 + 新 18） |
| TypeScript / tsc --noEmit | 0 errors（npm run build 內執行） |
| npm run build | 成功，dist 產生完成 |
| npm run test:e2e | 3 / 3 PASS（原 walking + 2 encounter tests） |
| 畫面檢查 | 已目視檢查 BattleScene 與返回世界截圖，資訊及按鈕完整 |

單元測試涵蓋非草叢、原地不動、草叢 step、8% 機率邊界、0 / 100% chance、重複與過去 step、返回格與兩步 cooldown、每個權重區間、非 100 權重總和、Lv.2～5、捕捉旗標、Boss 不入池、每次 PURE_CUTE 提示與正確獨立 world payload。

Edge 整合驗證保留原行走 / 碰撞 / 鏡頭測試，並新增：道路即使 F2 也不觸發；實際按鍵跨入草叢；飛鼠提示連續兩次；前三個選單顯示尚未實作；點擊逃跑與 Esc 返回；位置還原與原世界物件數不變；原地停留不重觸發；精確兩個草叢事件受 cooldown 保護；注入 RNG 走未強制的 chance / 權重 / 等級流程，抽到 Lv.5 黑團蟲並返回。PURE_CUTE 往返測試未發現 pageerror。

Build 仍有 Phaser 主 bundle 超過 500 kB 的提示（約 1.21 MB、gzip 324 kB），不是錯誤，不影響本機執行。

## 手動驗證方式

目前本機網址：`http://127.0.0.1:5187/`，重新整理載入新版。若伺服器未啟動，在此專案目錄執行：

```powershell
npm run dev -- --port 5187 --strictPort
```

1. 使用 WASD / 方向鍵。從出生營地往下走約四格，再往右進入第一大片草原草叢（column 11～20、row 16～22）。
2. 在草叢內跨格移動；每步 8% 機率不是保證遭遇。道路和原地停留不觸發。
3. 遭遇時核對生物名稱、Lv.2～5、屬性、HP 與種類。前三個按鈕應顯示尚未實作。
4. 點逃跑或按 Esc，確認回到遭遇位置，接下來兩個草叢格不會再次遭遇。
5. 為快速驗證飛鼠，開 `http://127.0.0.1:5187/?debugEncounters=1&entity=CUTE_005`，確認 DEBUG 標記；按 F2，再跨入新草原草叢格。返回後再次按 F2，走過兩步保護，再確認第二次同樣顯示特殊台詞。
6. 將 entity 改成 MON_001，可測怪物。只接受草原池 id；無效 / 非池 id 改走正常抽選，Boss 不會被加入隨機遭遇。

Debug 只在 Vite dev 且 query flag 為 1 時啟用。production build / preview 不啟用強制遭遇功能。

## 已知限制

- 目前只有 GRASSLAND 遭遇表，森林與其他區域草叢不隨機遭遇。
- HP / Attack / Speed 使用基準資料，沒有依遭遇等級縮放；技能 id 為資料佔位。
- 玩家方沒有實際 Party Entity，敵方為簡單色塊。
- 沒有攻擊、傷害、捕捉、EXP、升級、進化、PURE_CUTE 被動、pity、Boss 戰、完整存檔或 exe 封裝。
- 重新整理頁面會回出生點；world state 只保存在本次執行的 Scene 中。
- 整合測試使用 mock RNG / 明確 debug 控制讓結果可重現，沒有以大量樣本進行機率統計驗證。

## 建議 Milestone 3 範圍

聚焦可測試的 1v1 回合制：獨立技能資料、BattleManager、集中傷害係數與屬性倍率、priority / Speed 出手順序、命中與 HP 更新、勝敗返回。先保留固定玩家方，捕捉、完整隊伍、EXP 與成長再分 Milestone。需由使用者另行指定後才開始。
