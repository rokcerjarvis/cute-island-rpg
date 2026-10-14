# Milestone 4 — Capture, Party & Progression Integration

狀態：完成，停止於 Milestone 4，未開始 Milestone 5。

## 完成摘要

探索 → 草叢遭遇 → 戰鬥 / 捕捉 → 加入五隻隊伍或營地備用收容 → 換人 → EXP → 升級 → 學招 → 帶著當前 HP 繼續探索。營地可確認治療全隊。

本階段移除每場戰鬥自動滿血與固定四招的玩家 Demo 行為，改用正式 CreatureInstance。正常新遊戲仍為 Lv.5 吉伊卡哇、1 / 5、35 HP，依 Learnset 只有舔一口與頭頂。

## 開始前驗證

- Git status 已檢查：既有檔案仍為 untracked，尚無 commit；沒有清除、重置或建立提交。
- 原 62 項單元測試全部 PASS。
- 原 5 項 Edge 整合測試全部 PASS。
- TypeScript check 0 errors，build 成功。
- 本次未新增依賴或修改 package.json / package-lock.json。

## 核心功能與架構

### Definition / Instance / Runtime

CreatureDefinition 保存種族、能力值與成長、捕捉率、baseExp、Learnset，並預留可選 evolutionTarget / evolutionLevel。CreatureInstance 保存 instanceId、creatureId、level、累積 currentExp、currentHp、maxHp、attack、speed、knownSkills、OK / FAINTED status，沒有持有 Definition 或 Phaser object。

RuntimeGameState 放在 Phaser registry 的 game-state，保存 party、reserveStorage、activeInstanceId、唯一 ID 計數、世界位置、戰鬥摘要與待學招隊列。戰鬥摘要含敵人種族 / 等級 / HP / 技能、回合、結果、強制換人與返回位置。狀態皆為普通資料，可 JSON 序列化；沒有寫入 localStorage，也沒有實作 Save / Load。

WorldScene 保留原 sleep / wake；PartyBattleSession 統一串接 PartySystem、BattleManager、CaptureSystem、ExperienceSystem 與 SkillLearningSystem，Scene 只負責 UI / 按鍵 / timing。WorldScene 重建時也會讀取執行期世界位置。

### Party 與 HP

- 最多五隻，重複種類 / 屬性合法；超額捕捉建立新 instance 並進 reserveStorage。
- PartySystem 的輸入型別只接受 CuteCreatureDefinition，執行期再檢查種族 registry，Monster / 偽造可捕捉旗標不能加入 Party 或 Reserve。
- 捕捉者保留遭遇等級、剩餘 HP、該級最低累積 EXP 與依 Learnset 建立的最新四招。
- 戰鬥每次行動後同步出戰成員 HP / status；勝利、逃跑、捕捉與下一场戰鬥之間不重置 HP。
- 世界 P 可查看五隻成員的名稱、等級、HP、屬性與出戰標記；另外顯示 Reserve 數量。Esc / P 關閉，面板中不移動或遭遇。

### Capture

CAPTURE_ITEM_001「收容球」無限使用，Battle 道具選單可操作。公式位於 CaptureSystem，rng 可注入：

`chance = clamp(baseCaptureRate / 100 × hpModifier × levelDifferenceModifier × itemModifier, .01, .95)`

| HP 比率 | 倍率 |
| --- | --- |
| >=80% | .6 |
| >=50% | .85 |
| >=25% | 1.15 |
| >=10% | 1.5 |
| <10% | 1.8 |

| 玩家 Level - 目標 Level | 倍率 |
| --- | --- |
| <=-6 | .55 |
| -5～-3 | .7 |
| -2～+2 | 1 |
| +3～+5 | 1.2 |
| +6～+10 | 1.4 |
| >=+11 | 1.6 |

所有分段集中在 CAPTURE_CONFIG；道具倍率 1.0。Monster 在公式 / RNG 前拒絕，顯示「這個東西看起來根本抓不了！」，此無效操作不消耗回合。HP 0 在系統入口拒絕。

合法捕捉先顯示「丟出了收容球！」、短延遲、「……」，再顯示結果；文字間隔 400 ms，期間鎖定輸入。失敗後敵人正常行動；成功結束為 CAPTURED，敵人不再行動，不同時結算 Victory。捕捉加入隊伍 / Reserve 的回饋在 Battle 與 World 都可看到。

### Switching 與 Faint

Battle 隊伍選單顯示最多五隻的名稱、Lv、HP、屬性及出戰 / 昏倒情況。正常換人先保存換下成員，再換入另一隻活著的成員，敵人攻擊新成員，計一回合。當前成員、昏倒者、未知 id 與 Reserve 成員不能切入。

出戰成員昏倒時，有活著隊友就進入 needsSwitch，顯示「請選擇下一隻小可愛。」；其他行動、Esc / 返回被阻擋。強制換人不增加回合、不給敵人額外行動。只有全 Party 昏倒才 DEFEAT，按返回回營地且全隊滿血、解除昏倒。

換下成員的暫時戰鬥效果不保留，換入者建立新的 temporary effects；敵方效果仍沿用本場戰鬥。沒有狀態異常或換人追擊。

### EXP / Level Up

- expForLevel(L) = floor(1.15 × L³)，Lv.1～50；currentExp 為累積 EXP，不是該級進度值。
- baseExp：吉伊卡哇 10、小八 10、兔兔 12、栗子饅頭 11、飛鼠 15、黑團蟲 12、暴躁大嘴怪 18、Boss 40。
- defeatExp = max(1, floor(baseExp × enemyLevel × expLevelModifier))。
- 敵人比玩家低至少 6 / 低 3～5 / 差距 ±2 / 高 3～5 / 高至少 6 的倍率為 .5 / .75 / 1 / 1.25 / 1.5。
- 勝利 100%，捕捉 floor(defeatExp ×.5)，僅給最後實際出戰成員，且一場僅結算一次。逃跑 / 捕捉失敗不給 EXP。
- 可一次連升多級；每級依 StatCalculator 更新 maxHp、attack、speed。currentHp 只加 maxHp 成長差額，不突然滿血；昏倒者不因能力值更新復活。
- Lv.50 不再升級，累積 EXP 封頂。EXP 與 Level Up 文字逐行呈現，再進入必要的學招決策。

### Learnset / 第五招

五隻小可愛的 Lv.1 / 4 / 8 / 12 / 16 / 22 / 30 / 40 Learnset 完全依本次規格；怪物亦配置合法等級技能。野生 BattleEntity、新捕捉 instance 與初始 Party 都依等級選最新最多四個不同技能。

升級未滿四招自動學習；滿四招顯示想學的新招與「但是已經會四個技能了。」，可選忘記一招或放棄。忘記頁列出目前四招，Esc 回學習選項；放棄不改原技能。多級結算的待學技能依順序處理，每個決策完成後才處理下一招。全部完成前不可返回 World，沒有 browser alert。

### 營地 Heal Point

營地 (240,368) 標記休息處，互動半徑 72 px。靠近按 E / Space →「休息一下？」→確認（滑鼠 / Enter / 1）後全 Party 恢復，Esc / 2 取消。顯示「小可愛們精神都恢復了！」。不需要 NPC，也不治療 Reserve。

## 新增檔案

- src/entities/CreatureInstance.ts
- src/state/RuntimeGameState.ts
- src/data/learnsets.ts
- src/systems/PartySystem.ts
- src/systems/ExperienceSystem.ts
- src/systems/SkillLearningSystem.ts
- src/battle/CaptureSystem.ts
- src/battle/PartyBattleSession.ts
- src/ui/WorldPartyUI.ts
- tests/progression.test.ts
- e2e/progression.spec.ts
- MILESTONE_4_REPORT.md
- artifacts/milestone-4-capture.png、milestone-4-world-party.png、milestone-4-forced-switch.png、milestone-4-heal.png、milestone-4-learn.png

## 修改檔案

- src/entities/BattleEntity.ts：baseExp、Learnset、Cute Definition 型別與依等級技能初始化。
- src/data/creatures.ts、src/data/monsters.ts：接上獨立 Learnset / baseExp。
- src/battle/BattleManager.ts：CAPTURED、enemy-only action、換人、強制換人、活隊友判定，保留原傷害 / 特殊效果。
- src/scenes/BattleScene.ts：正式 Party 玩家、道具 / 隊伍 / 學招 UI、結果與持續狀態整合、數字鍵 / Esc。
- src/scenes/WorldScene.ts：Runtime state、P / Heal UI、dev-only工具、位置及捕捉回饋。
- index.html：Milestone 04 及操作提示。
- README.md：更新架構、Party、Heal、Capture、World Panel 與 Debug 使用方式。
- tests/battle.test.ts：fixture 明確定義測試 Learnset，保留原 34 項戰鬥驗證。
- tests/encounter.test.ts：依新 Learnset 驗證 Lv.3 飛鼠只會戳鼻子，其他遭遇驗證保留。
- e2e/encounter.spec.ts：道具 / 隊伍從未實作提示改為可操作選單的驗證。
- e2e/battle.spec.ts：Lv.5 玩家已學技能依新 Learnset，用合法舔一口驗證戰敗；原完整回合 / 勝敗流程保留。
- 既有 Milestone 1～3 截圖由原測試重跑更新，顯示目前版本。

沒有更動既有地圖資料、Player 移動、碰撞、EncounterSystem、weighted table、冷卻規則、傷害公式、屬性倍率、技能效果或依賴版本。

## 最終驗證

| 項目 | 結果 |
| --- | --- |
| npm test | 131 / 131 PASS（原 62 + 新 69） |
| npm run test:e2e | 13 / 13 PASS（原 5 + 新 8） |
| npm run typecheck | 0 errors |
| npm run build | 成功，dist 已產生 |
| 畫面檢查 | 已目視檢查捕捉、世界隊伍、強制換人、學招與治療截圖 |

新單元測試覆蓋 Party 初始值、容量、Reserve、ID 唯一性、Monster compile-time / runtime 拒絕、偽造旗標拒絕、HP 延續、全隊治療、昏倒換人限制與序列化；捕捉全部 HP / Level 分段、上下限、道具倍率、RNG 邊界、HP 0、成功 / 失敗行動與 50% EXP；EXP 曲線、bonus / penalty / floor / 最小值、單級 / 多級 / 上限成長、HP 差額、最後出戰者及 Monster EXP；全物種等級合法技能、最新四招、自動學習、替換 / 放棄、連續決策與返回 guard；正常 / 強制換人、活隊友不敗北、全隊敗北恢復與結果互斥。

新增 Edge 流程：

- A：World 草叢 → 真實點擊攻擊，野生 HP 降至 12 → 收容球成功 → EXP 25 → World → P 面板驗證 Party 2 / 5、捕捉者 HP 12。
- B：F4 設為升級門檻差 1 → 真實兩回合勝利 → EXP 50 → Lv.6、MaxHP 37、CurrentHP 14 → World 保留。
- C：兩隻 Party → 正常換人 → 敵人擊倒換入者 → 強制免費切回 → 繼續戰鬥 → 全隊敗北 → 營地全隊恢復。
- D：Party 5 / 5 → 捕捉成功 → Reserve 1 → World P 顯示營地收容數。
- E：戰鬥受傷 → 逃跑 → 下一場保留 HP 12 → 返回營地 → 取消休息不治療 → Space / Enter 確認恢復 → P 面板期間不移動。
- 多級學招：一場升至 Lv.22，自動學前兩招；第五招替換，下一招放棄；未完成前 Esc 不返回世界，最終仍四招。
- 捕捉失敗給敵人正常回合；Monster 即使強制捕捉成功參數也拒絕，不給回合、不入隊。
- 無明確 debug flag 時 F4 / F5 / F6 與 query 不影響初始隊伍；Esc 從技能頁退主選單，再 Esc 逃跑。

為穩定重現，Edge 新增流程使用明確 dev flag 與可注入 RNG；C 流程在測試 fixture 將第二隻設定為低 HP，以驗證真實敵方攻擊造成昏倒。傷害 / 升級 / 捕捉均走正式系統，不直接呼叫 Scene 返回來跳過流程。新增 A～G 流程沒有 pageerror。

Build 主 JS 約 1.234 MB、gzip 332 kB，仍有超過 500 kB 提示，非 build error。

## 手動最短驗證路徑

正常遊戲：開 http://127.0.0.1:5187/，從營地往下約四格，再向右進草原草叢；戰鬥削低 HP，點道具使用收容球。捕捉成功後按返回 / P 檢查新成員；下一場點隊伍換人；持續勝利或捕捉獲得 EXP；走回營地休息處按 E 並確認治療。

快速且可重現的功能驗證可用：

`http://127.0.0.1:5187/?debugEncounters=1&entity=CUTE_002&capture=success`

1. 從營地走到草原草叢前，按 F2，跨入新草叢格；道具 → 收容球，等待捕捉結果 → 返回。
2. P 確認 Party 2 / 5，Esc 關閉。
3. F4 把目前出戰者設為下一級門檻差 1；F2 後跨新草叢格（返回兩步 cooldown 仍有效）。
4. Battle 點隊伍，選小八，觀察敵人正常行動；出戰者將成為最後 EXP recipient。若想驗證小八升級，回 World 再按 F4，下一場勝利 / 捕捉結算即可。
5. 需要安全完成升級時可直接使用強制成功收容球，获得 50% EXP，確認升級與能力值。返回後 F7 回營地，E / Space → 確認全隊恢復；P 核對 HP。

對怪物測試使用 entity=MON_001；第五招測試使用 entity=CUTE_001&expTarget=22，先按 F4，再勝利或捕捉，逐一完成替換 / 放棄。一般 RNG 下正常換人可能立即受傷或昏倒，這是回合規則的一部分。

## Debug 指令

僅同時符合 Vite dev 與 debugEncounters=1 時有效，正式 build / preview 不啟用：

- entity：只接受草原池成員，Boss 不可強制加入池。
- capture=success / failure：注入捕捉 RNG，不繞過 Monster / HP 0 限制。
- partyLevel=1～50：重新載入的新遊戲初始 Party 測試等級，正常預設 5。
- expTarget=目標等級：搭配 F4，測試多級 EXP 結算。
- F2：下一個有效草原 step 強制遭遇，保留道路 / cooldown guard。
- F4：出戰者 EXP 設為下一級或 expTarget 門檻差 1，下次成功結算才處理升級 / 學招。
- F5：出戰 HP 設為 1。
- F6：填滿 Party 五隻。
- F7：回營地。

F4～F7 只在 World 使用，UI 有 DEBUG 標示與操作回饋。Debug 進度修改不是正常遊戲機制。

## 已知限制

- Reserve 只有保存、數量與回饋，沒有選取 / 交換、完整 Box 或 Party 排序 / 丟棄功能。
- Runtime 狀態不寫磁碟，重新整理会開始新遊戲。Git 檔案尚未提交。
- 沒有進化、PURE_CUTE 四種攻擊後事件、Boss scripting、完整新區域、商店、金錢、庫存數量、裝備、IV / EV / Defense / 暴擊 / 狀態異常、Save / Load、正式音效 / 動畫 / Sprite 或 exe。
- Lv.5 初始只有兩招；14 招全部保留，但需依 Learnset 升級或遇到已學對應技能的生物。
- HP 先結算再播放文字；log 保留最近五行，多級結算可能較長。敵方是文字占位，沒有正式戰鬥動畫。
- 全隊治療只針對 Party，Reserve 不受此操作影響。
- 升級的能力值依現有線性成長，沒有另外擴充平衡模型；普通戰鬥仍可能很快結束。

## 建議 Milestone 5

建議聚焦 PURE_CUTE 四種成功傷害攻擊後事件，以及純等級進化與最小提示 UI；若希望先處理進度保存，也可另指定最小 Save / Load。以上皆未開始，本次完成後等待使用者下一個指令。
