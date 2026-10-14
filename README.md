# 狗狗猩猩大冒險 — Pan & James

目前進度：**Post-M8 / Milestone 8.1 — Overworld Party Management & Creature Status**。

非戰鬥世界按 P 可選同伴、設為隊首或查看狀態。隊首為 Party 第0格；選 C 會將 A B C D E 重排為 C A B D E，其他同伴資料保持。下一場普通／怪物／Boss戰先派隊首，Battle臨時換人不改健康隊首。昏倒者可看狀態，不能設隊首；原隊首昏倒時自動提升第一位可戰鬥者，全隊昏倒沿用營地治療。

Party 使用 ↑↓／Enter、1～5或滑鼠；目前隊首為no-op。Status顯示portrait、HP／Attack／Speed、累積EXP／升級所需／進度條、最多4個目前技能、既有進化與PURE_CUTE。特殊技能顯示效果，沒有P0。←→或頁面箭頭循環切同伴；Enter無額外行動，Esc回Party，P關閉。沒有新增Starter身分flag，也不推測初始夥伴。

隊首與Party順序直接沿用v1陣列，不新增leader欄位。更換時標記一次autosave，關閉面板返回World後建立checkpoint；單純查看不寫入Save。Legacy忽略舊臨時active作隊首，採第0格／第一位存活者。Battle／Encounter fade／Evolution期間不開Overworld Party，其他modal不疊開。Reserve只看數量。完整狀態見 MILESTONE_8_1_REPORT.md。

Windows 本機瀏覽器 Prototype。延續四方向探索、草叢遭遇、1v1 戰鬥、五隻隊伍、EXP／學招／進化、PURE_CUTE、第一區 Boss、圖鑑及單槽存檔。這次重平衡 HP／傷害，並將玩家看到的玩法改成「邀請同行」。保留 Milestone 7 的像素 placeholder、動畫鎖與世界 UI。

## 開啟

技術：TypeScript + Phaser 3，使用 Vite 開發與 build；Vitest 單元測試、Playwright + Microsoft Edge 整合測試。

在專案根目錄安裝依賴（此 baseline 使用 Node.js 24）：

```powershell
npm install
```

```powershell
npm run dev -- --port 5187
```

開啟 http://127.0.0.1:5187/ 。保留原服務時直接重新整理。此里程碑沒有 .exe 封裝、部署或新套件。

## 操作

|位置|操作|
|---|---|
|標題|新遊戲／Continue；仍保留四位 Lv5 Starter|
|世界|WASD／方向鍵四方向移動；P 隊伍；Esc 選單／圖鑑／儲存|
|營地|靠近休息處，E／Space → 確認治療全 Party|
|戰鬥|戰鬥／道具／隊伍／逃跑；方向鍵、Enter／Space 或滑鼠|
|技能|Stable／Heavy／Quick／Special；Quick 以 priority 為特色|
|文字|動畫鎖期間 Enter／Space 只加快文字，不執行新指令|
|PURE_CUTE|每次遭遇都需確認「這是什麼？上網查一下！」|
|換人|正常換人敵人行動；昏倒後強制換人不給敵人額外回合|
|結算|學招、進化完成後返回世界；逃跑保留原位置，戰敗回營地|

## Milestone 8 平衡

傷害：floor((Attack × 0.7 + SkillPower × 0.25 + Level × 0.3) × 屬性 × random(0.9,1.1))；有傷害技能 minimum 1，Power 0 維持特殊效果。

Advantage 1.5、Disadvantage 0.75、PURE_CUTE 全 neutral；技能沒有獨立屬性、沒有 Defense、IV／EV／Nature 或隨機能力。同種同級必定同 stats。HP／Attack 線性成長仍以 Lv5 為基準。

|同伴|Lv5 HP / ATK / SPD|HP growth|ATK growth|
|---|---|---:|---:|
|吉伊卡哇|52 / 10 / 10|2.8|0.65|
|小八|46 / 10 / 15|2.5|0.65|
|兔兔|44 / 16 / 12|2.4|0.9|
|栗子饅頭|64 / 11 / 6|3.3|0.7|
|飛鼠|50 / 7 / 11|2.7|0.45|

Speed growth 不變。兩個進化與普通怪物也調整 HP／growth，避免進化能力倒退或怪物戰明顯過短。14 技能、20% Heal、Defend、debuff、30% PURE_CUTE Sleep／Charm／Fart／Pose 保留。

第一 Boss：森林深處 column34／row21 區域，Lv11 WIND，HP128／Attack14／Speed11。Stable／頭頂／Heavy／Defend 混合選招；不能逃跑或邀請。勝利後回營地觸發升級與存檔。

`npm run simulate:balance` 重現 120 組各 1,000 次模擬與 5,000 場 Boss engine 模擬，輸出 BATTLE_BALANCE_REPORT.md 及 artifacts/milestone-8-balance.json。KO 統計含命中失敗；Boss 有效行動採玩家成功 ACTION 計數，不把敵人行動算入。

## 邀請同行

|道具|效果|新遊戲／舊存檔預設|
|---|---|---:|
|小點心包|原 probability formula，item modifier 1|10|
|豪華點心包|item modifier 1.5，仍受 1%～95% 限制|3|
|拿錢收買小可愛|合法小可愛直接 100%，不擲 RNG、不經 formula/cap|0|

普通邀請沿用 baseCaptureRate／100 × HP modifier × levelDifference modifier × itemModifier。HP bands .6／.85／1.15／1.5／1.8 與 level bands .55／.7／1／1.2／1.4／1.6 未變。

拿出點心 → 靠近觀察 → 願意跟你走／搖頭退回。金錢道具獨立錢袋演出與固定台詞「金錢建立了深厚的友情。」沒有丟球演出。

合法使用消耗 1 個；成功結束戰鬥，敵人不行動，Party 滿進 Reserve，EXP 為擊敗獎勵 50%。失敗敵人照常行動。沒有庫存或非法使用不耗道具、不耗回合；睡眠跳過合法行動時也不耗道具。

Monster：「這個傢伙根本不是來交朋友的！」；Boss：「現在不是交朋友的時候！」。兩者不播邀請動畫。definition.invitationBlocked 可禁止劇情角色，包括金錢道具。

Shop／Quest／Chest／Event acquisition metadata 已建立；尚未做取得流程、商店與經濟。Reserve 仍只顯示數量，尚未實作交換。

## 儲存與舊資料

localStorage key `pan-james.save.v1`，schemaVersion **1**。新增可選 inventory；舊資料缺少庫存時補入 10／3／0，不修改輸入。已有庫存會嚴格驗證並保留。存檔記錄 HP，不記錄 derived stats；載入後 current HP 保留、Max HP／ATK／SPD 使用新平衡重算。

M6／M7 v1 fixtures、Continue、Boss flag、進化同伴、Dex、Party、Reserve 均驗證。`CAPTURE_ITEM_001`、CAPTURED／capture API 與存檔內部名稱保留相容性；畫面顯示邀請／同行。戰鬥未结算、學招或進化未處理時禁止寫檔，安全 checkpoint 返回世界後只寫一次。

不同 localhost 埠的 localStorage 不共用。逐步 QA 使用獨立 5193，未修改使用者 5187 的紀錄。

## Debug（僅明確 dev flag）

http://127.0.0.1:5187/?debugEncounters=1&entity=CUTE_005&encounterLevel=5&invite=success

- F1：立即遭遇、species／level、下一次邀請成功／失敗、可愛事件、EXP／進化、完整 Boss、重置／治療／填滿隊伍／Save／回營地。
- 新增「補充邀請道具」與「同級 Boss QA 同伴」；後者加入同級兔兔與飛鼠，受五隻容量限制。
- F2：下一個有效草叢步強制遭遇；F7 營地；F9 Boss 附近。
- `invite=success/fail` 控制普通邀請 RNG；舊 `capture=success/failure` 繼續相容。
- `item=bribe` 在 dev 戰鬥缺少金錢道具時補 1 個；所有三種道具仍由 Items 選取。`item=snack/luxury` 可作測試網址標記。
- `partyLevel=12`／`partySpecies=CUTE_003` 只用於明確 dev 新遊戲測試；`bossHp=1` 不用於正常 Boss QA。
- 強制遭遇不污染 PURE_CUTE pity。Production 或沒有 debugEncounters=1 時均不提供 debug 操作。

## 驗證與報告

```powershell
npm test
npm run typecheck
npm run test:e2e
npm run simulate:balance
npm run build
```

Unit **425**（原383 + 新42），Edge **72**（原57 + 新15）。Edge 使用本機 Microsoft Edge、自動啟動5191。M8用例保留；M5飛鼠fixture改用正式setLeader，M8邀請失敗fixture固定戰鬥命中以避免合法Miss造成隨機失敗，正常Boss Flow K仍使用自然RNG。新增8.1 Leader／Party／Status／Save／legacy／cleanup驗證。

完整狀態見 MILESTONE_8_REPORT.md；120 組統計、係數、取樣限制見 BATTLE_BALANCE_REPORT.md。MILESTONE_1～7_REPORT.md 為各階段歷史紀錄。

新增主要模組：src/data/invitationItems.ts、src/battle/BalanceSimulation.ts、scripts/battle-balance.mjs、tests/milestone8.test.ts、e2e/milestone8.spec.ts。素材替換仍參考 ASSET_GUIDE.md。

目前仍為 prototype pixel placeholder；沒有正式音效／音樂、完整商店或任務、Reserve交換、.exe、網路／雲端儲存。Phaser bundle 的既有大檔提示仍存在。遊戲 baseline 停在 Milestone 8.1，未開始 Milestone 9。

## 私人 Prototype 聲明

此專案目前為私人／非商業 prototype。部分角色名稱、美術概念或 placeholder 內容來自／受第三方作品啟發，目前僅供開發測試。正式公開發布前將重新檢視並替換需要處理的素材與命名。本專案不宣稱擁有第三方 IP，也未授予第三方內容任何授權。顯示名稱為 working title，內部 save key、IDs 與 schema 保持不變。

## Repository 證據與本機產物

里程碑報告完整保留；歷史報告中的大部分 QA 截圖及 browser runtime dumps 僅保留在本機，Git 不追蹤。少量文件展示圖片、可重現的平衡統計與人工 Boss 操作紀錄保留在 `artifacts/`，清單見 `artifacts/README.md`。測試存檔 fixtures 為合成測試資料，與本機玩家存檔無關；node_modules、dist、測試輸出、環境變數與本機設定不納入 snapshot。
