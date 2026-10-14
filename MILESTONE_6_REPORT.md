# Milestone 6 — New Game, Save/Load & Creature Dex

狀態：完成。停止於 Milestone 6，未開始 Milestone 7。

## 開始前驗證

- 已檢查 Git status。專案尚無已追蹤的檔案／commit，既有專案皆 untracked；未 reset、清除或建立 commit。
- Milestone 5 原 170 項單元測試全部 PASS，TypeScript 0 errors，Build 成功。
- Edge 首次基線 23/24；Boss 敗北再挑戰流程單獨重跑通過，原因為快捷鍵後立即移動的輸入時序。完成版本保留原 24 項断言，並加等待 teleport 處理、經過正式新遊戲 UI。
- 未新增依賴，package.json / package-lock.json 不變。

## 最終驗證

| 項目 | 結果 |
| --- | --- |
| npm test | 264 / 264 PASS，6 個 test files；原 170 + 新 94 |
| npm run test:e2e | Microsoft Edge 31 / 31 PASS；原 24 + 新 7，完整固定版本跑 46.3 秒 |
| TypeScript | npm run typecheck（build 內執行），0 errors |
| npm run build | PASS，44 modules；JS 1,262.50 kB / gzip 339.71 kB |
| 本機啟動 | http://127.0.0.1:5187/ HTTP 200，頁面 MILESTONE 06 |
| UI 檢查 | 以 Edge 真實鍵盤／滑鼠操作與截圖檢查 Title、Starter、Dex、Continue |

Build 保留原 Phaser 大 bundle >500 kB 提示，無編譯錯誤。瀏覽器 UI 是 640×360 像素 prototype，沒有新增正式素材。

## New Game

- Boot 建立原 procedural textures 後進 TitleScene，不再直接給吉伊卡哇進世界。
- Title 顯示 Pan & James / 狗狗猩猩大冒險、New Game、Continue。沒有有效 Save 時 Continue 停用。
- 既有紀錄下 New Game 必須確認「已經有冒險紀錄，開始新遊戲會覆蓋原本進度。」；取消／離開 Starter 不刪檔。新冒險第一次成功儲存才取代舊紀錄。
- 四個 Starter：吉伊卡哇 WATER 平衡、小八 WIND 速度、兔兔 FIRE 高攻、栗子饅頭 EARTH 耐久。顯示 HP / Attack / Speed、屬性、定位。一般 Starter 不包含飛鼠或進化形。
- 確認同伴前 createNewGameState 的 Party 空白；確認後建立 Lv.5、完整 HP、learnset 技能、Party 1/5、獨立 instance id，Starter 圖鑑 Captured。
- 工廠集中初始化 schemaVersion、世界位置、Party / Reserve、Boss / 區域 / 營地旗標、pity、Dex、worldFlags、playTime、metadata、settings、dirty。
- WorldScene 缺少有效隊伍時返回 Title，不自行補預設 Starter。

## Save / Load 架構

`RuntimeGameState → serializeGameState → SaveData v1 → StorageAdapter`

`StorageAdapter → JSON parse → migrateSaveData / validateSaveData → deserializeGameState → RuntimeGameState`

SaveSystem 不依賴 Phaser，也不直接使用 window.localStorage。BrowserLocalStorageAdapter 包裝一槽 key `pan-james.save.v1`；單元測試用 MemoryStorage。未來 file adapter 可替換，這次未實作或封裝 exe。

### Schema v1

| 欄位 | 保存內容 |
| --- | --- |
| schemaVersion | 1 |
| metadata | createdAt、updatedAt、playTimeSeconds |
| player | worldPosition x/y、currentZone |
| party / reserveStorage | instanceId、creatureId、level、累積 currentExp、currentHp、knownSkills、status |
| activeInstanceId / nextInstanceNumber | 出戰者與後續唯一 instance id |
| progress | bossDefeated、firstAreaComplete、campUpgradeSeen、pureCuteMissCount |
| dex | 七種 UNKNOWN / SEEN / CAPTURED |
| worldFlags / settings | 世界旗標與保留設定欄位 |

不保存 Scene、class、function、Definition 物件、計算能力值、Battle 暫時 buff、待學技能或進化中狀態。HP 上限 / attack / speed / attribute 從相應 Definition 與 level 重算，保留持有技能與當前 HP。

Migration entry point 已建立；v1 回傳獨立深拷貝、不改原 input。未來版本安全拒絕，不刪檔。本 prototype 在 M6 前沒有持久 Save 格式，因此本次沒有虛構舊版轉換規則。

### 驗證與錯誤

- 驗證 JSON、schema、日期／playtime、Party 1～5、Reserve array、唯一 instance id／counter、cute species、Lv.1～50、EXP 等級區間、HP／status、已存在且該種能學的技能、最多四招不重複、progress、七種圖鑑與 worldFlags。
- 壞 JSON／未知 species／未來 schema／錯誤資料：Title 顯示「冒險紀錄似乎壞掉了。」、Continue 停用，提供返回與确认刪除；不自動清除。
- Storage 讀取、寫入、刪除失敗不 crash。寫入顯示「儲存失敗。」並保留當前 runtime 與 dirty；失敗的自動 checkpoint 不逐 frame 重試。
- 世界位置按 Player 實際腳部 rectangle 驗證，超出地圖、非法 tile、重疊牆體則回 Camp Spawn (240,400)，顯示 warning，位置修復維持 dirty。
- 儲存前同步停住的畫面位置，避免 Scene update 與 physics step 間一 frame 的座標差異。

### 儲存觸發

| 操作／事件 | 時機 |
| --- | --- |
| 手動 | Esc → 儲存遊戲 |
| 捕捉、Level Up、Evolution | 標記 checkpoint；完整學招／進化後按返回進 World 寫入 |
| Boss Victory | 完整結算返回 World，寫入 Boss + firstAreaComplete |
| Heal Point | 確認治療、恢復全 Party 後 |
| 返回營地 | 從營地外跨回營地範圍 |
| 營地升級初次提示 | 設定 campUpgradeSeen 後保存，避免重载重複提示 |

不逐步寫 storage。Party HP、捕捉、EXP／技能、進化、Boss、Dex、出戰者與跨 tile 移動標記 dirty。成功儲存清 dirty。若尚有 pendingLearning / pendingEvolution / battle，SaveSystem 不保存不完整狀態。

### Continue / Summary / Play Time

Continue 正確恢復所有上述資料、獨立 instance、Reserve 與位置，不重新給 Lv.5 吉伊卡哇。campCompletionShown 與舊 capturedSpeciesIds 從正式保存資料推導，維持 M5 行為相容。

Title Preview 用驗證過的 SaveData summary 顯示隊长、最高 Level、Seen（含 Captured）X/7、HH:MM:SS 與第一區完成，不建立完整 RuntimeGameState。實際 World／Battle active frame 計時；Title、世界面板、背景分頁不計，長時間停滯不補計。

## Game Menu 與控制

- World：WASD / Arrow 四方向移動保留；S 仍向下，不與 Save 共用。
- Esc 沒有其他面板時打開隊伍／圖鑑／儲存／返回標題／關閉；已有面板時只關閉該面板。
- 方向鍵切換、Enter / Space、數字或滑鼠選擇；P 保留隊伍捷徑，E / Space 仍為營地治療。
- 返回 Title 若 dirty，必須選儲存並返回／直接返回／取消；儲存失敗留在遊戲。
- UI 子物件明確固定 scroll factor，鏡頭跟隨時滑鼠命中位置仍正確。原 Party 面板也可點底部文字關閉。
- 每個 native keyboard event 只處理一次，避免 Phaser queue 在同一按鍵下多次開關面板。

## Creature Dex

七個小可愛（CUTE_001～005、EVO_001～002）；所有 MON_* 排除。

| 情況 | 結果 |
| --- | --- |
| 從未遇到 | UNKNOWN，隱藏 species 名称與資料 |
| 進 Battle | SEEN，顯示名稱、Attribute，其他資料遮蔽 |
| 逃跑／擊敗 | 維持 Seen |
| 捕捉／Starter | CAPTURED，顯示定位與狀態 |
| 已捕捉再遇到 | 保持 Captured，不降級 |
| Evolution | target Captured，source Captured 保留 |

countSeen 包含 Captured；countCaptured 計不同 species、不計重複個體。PURE_CUTE Seen／Captured 都保留「單純可愛」與「這是什麼？上網查一下！」；每次 Battle Encounter 台詞也保留。

Dex 儲存重載保留。第一區完成畫面新增圖鑑 X/7 與已捕捉 X；Boss 勝利仍為主要完成條件，不要求全圖鑑。

## Automated Test Coverage

新增 94 項單元測試，涵蓋請求列出的 Starter、serialize／deserialize、所有核心欄位、驗證、讀寫失敗、migration 深拷貝、位置安全、時間、Dex、捕捉／升級／進化／Boss／治療 checkpoint、戰鬥與學招／進化未完成禁止儲存。

新增七條 Edge：

- Flow J：Title → New → 兔兔選擇／取消／確認 → Lv.5 兔兔 World。
- Flow K：受傷 → 捕捉升級 → 滿隊捕捉進 Reserve → 手動儲存 → reload／Continue；比對 Party（HP／EXP／技能）、Reserve、Dex、位置、pity、Boss。
- Flow L：飛鼠 Encounter → Escape → Seen UI → 再捕捉 → Captured UI → Save／Load，含 PURE_CUTE flavor。
- Flow M：Boss 實際勝利 → 自動 Save → reload → Continue，Boss 不重生、營地升級；首次營地提示也能保存。
- Flow N：壞 JSON → Continue 停用 → reload 仍保留 → 刪除取消／确认 → 可恢復 New Game，無 pageerror。
- 覆蓋警告、Starter 返回、dirty 返回選項、暫停計時、鍵盤操作。
- Storage quota 失敗的 UI／dirty／遊戲不中斷，以及無 flag 時 debug 隔離。

原 24 Edge 的移动、碰撞、Camera、草叢步數／cooldown、攻擊、捕捉、換人、Reserve、EXP／學招、PURE_CUTE、進化、Boss／營地／pity 断言全部保留並 PASS。

## 最短人工驗證流程

固定使用：

http://127.0.0.1:5187/?debugEncounters=1&entity=CUTE_005&capture=success&bossHp=1

1. Title 點 DEBUG 清除 Save，再確認。此操作會刪除該網址的唯一紀錄。
2. 點新遊戲。
3. 選小八，確認 Lv.5 同伴後進 World。這條快速路線用小八的 Speed 15，確保在 HP1 Boss 前先出手。
4. 從營地走向右下草原：草叢約 x352～672、y512～736；按 F2，繼續移動到下一格，遇飛鼠。
5. 逃跑。Esc → 圖鑑確認飛鼠 SEEN、特殊描述；Esc 關閉。
6. 再按 F2，繼續至少三個有效草叢步數跨過返回 cooldown；道具 → 收容球，等结算完成後按返回。
7. Esc → 圖鑑確認飛鼠 CAPTURED；P 可檢查隊伍／HP。關閉面板。
8. Esc → 儲存遊戲，看到「冒險紀錄已保存。」。
9. 重新整理瀏覽器，回 Title。
10. 點繼續遊戲。
11. P 檢查 Party／HP；Esc → 圖鑑確認 Captured，確認人物位置恢復。
12. 關閉面板，F7 回營地 → E 確認治療；F9 到 Boss 入口，等畫面位置更新再向右；Enter 確認挑戰，戰鬥 → 戳鼻子，Boss HP1，完成結算按返回。若有學招選擇需先處理。
13. F7 回營地，關閉第一區完成畫面（新增圖鑑數）。重新整理 → Continue。
14. 確認營地小木屋、Boss 完成；F9 再向右走，不再發起 Boss 戰。不要使用 F10（它故意重置 Boss）。

額外快速驗證：World F4 後捕捉可升級；要測進化可另開吉伊卡哇的冒險，F8 準備進化，完整處理學招／進化並返回後 reload，確認進化 species 與兩個 Dex 登錄都存在。Title DEBUG 壞 JSON 檢查錯誤與刪除確認。

## Debug Tools

只有 `import.meta.env.DEV && debugEncounters=1` 啟用。Production 不提供，不帶 flag 的參數不影響遊戲。

| 工具 | 操作 |
| --- | --- |
| 清除 Save | Title 按鈕 + 確認 |
| 產生測試 Save | Title 按鈕，Boss 完成／Dex／時間示範 |
| 破壞 JSON | Title 按鈕，不自動刪除 |
| Dex Seen / Captured | World F12，先 Unknown→Seen，再 Seen→Captured |
| Boss Completed | World Shift+B，完成旗標與 checkpoint |
| 快速 Starter | `quickStarter=CUTE_003`，無紀錄時直達同伴確認 |
| 原 M2～5 tools | F2～F11 與 entity / capture / partyLevel / partySpecies / expTarget / forceEvolution / cuteEvent / bossHp 保留 |

## 新增／修改檔案

新增：

- src/scenes/TitleScene.ts
- src/systems/SaveSystem.ts
- src/systems/StorageAdapter.ts
- src/systems/DexSystem.ts
- src/systems/PlayTimeSystem.ts
- src/state/StateChanges.ts
- tests/milestone6.test.ts
- e2e/helpers.ts
- e2e/milestone6.spec.ts
- MILESTONE_6_REPORT.md

修改：

- src/state/RuntimeGameState.ts：正式工廠、Starter、持久欄位与 dirty。
- src/systems/PartySystem.ts：捕捉登錄、HP／換人 dirty、治療 checkpoint。
- src/systems/BossSystem.ts：區域完成／autosave／圖鑑摘要。
- src/battle/PartyBattleSession.ts：Seen／Evolution 登錄與完整结算 checkpoint。
- src/scenes/BootScene.ts、src/main.ts：Title 入口註冊。
- src/scenes/WorldScene.ts：存讀檔／選單 callback、位置同步、計時、營地 checkpoint、debug。
- src/scenes/BattleScene.ts：戰鬥計時與鍵盤事件 guard。
- src/ui/WorldPartyUI.ts：Esc 選單／Dex／返回確認／save feedback／固定鏡頭互動。
- e2e/walking.spec.ts、encounter.spec.ts、battle.spec.ts、progression.spec.ts、milestone5.spec.ts：新入口 helper；Boss teleport 等待。
- index.html、README.md：Milestone 6 操作與狀態。

UI 截圖：artifacts/milestone-6-title.png、milestone-6-rabbit.png、milestone-6-dex.png、milestone-6-continue.png。

## 已知限制

- 一個 browser localStorage 槽。同一 profile / origin 才共用；改協定、host、port、瀏覽器或清除站台資料不會繼續同一紀錄。無雲端同步、匯出／匯入、FileStorageAdapter。
- 只從安全 World checkpoint 重載；尚未按返回的戰鬥與未完成選擇不保存。未儲存的探索位置會丟失，不是每步 auto save。
- 計時基於 active frame，Title／面板／背景不計，長時間遊戲停滯不補計。
- Reserve 只保存資料與數量，沒有 Box 管理；Party 仍不排序、放生或共享 EXP。
- Prototype UI／素材，Phaser bundle 大小提示保留。
- 未新增第二區、新 species、新 monster、Boss、NPC、任務、商店、金錢、inventory 數量、PP、Critical、Defense、完整異常、正式音樂／圖像或 exe。

## 建議 Milestone 7

最小 Reserve 管理與隊伍整理，配合持久化／容量驗證；或優先提供存檔匯出／匯入與明確備份流程。範圍需由使用者另行指定，本次未開始。
