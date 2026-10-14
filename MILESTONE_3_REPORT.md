# Milestone 3 — 1v1 Battle Core

狀態：完成，停止於 Milestone 3，未開始 Milestone 4。

## 開始前驗證

- Git status 已檢查：目前專案檔案仍是 untracked，尚無 Git commit。工作目錄不是已提交的乾淨基線；既有程式經測試確認可執行，保留後再增量修改。未清除、重置或覆蓋其他工作。
- 既有 `npm test`：28 / 28 PASS。
- 初始 `npm run build`：成功，內含 `tsc --noEmit`、0 errors。
- 本階段未安裝新套件、未修改 package.json / package-lock.json。

## 完成摘要

World 草原遭遇 → BattleScene → 選戰鬥 / 技能 → AI 選招 → priority / 有效 Speed / tie RNG → 命中 → 傷害或特殊效果 → HP 與文字 → 下一回合或勝敗 → 返回世界。

玩家固定使用 Prototype config 的 CUTE_001 吉伊卡哇、Lv.5，四招為舔一口、頭頂、縮成一團、嗚啦。每次進入戰鬥建立獨立玩家狀態，HP 35 / 35；未建立 Party System。

Skill、能力值、屬性、傷害、出手順序、AI、暫時效果與勝敗全部位於獨立模組，Scene 只串接選單、文字播放、輸入鎖定與世界返回。

## 技能與生物資料

`data/skills.ts` 定義完整 14 招，包含 id、name、category、power、accuracy、priority、effect；技能本身沒有 attribute。

| ID | 名稱 | Category | Power | Accuracy | Priority | Effect |
| --- | --- | --- | --- | --- | --- | --- |
| SKILL_001 | 舔一口 | STABLE | 20 | 100 | 0 | NONE |
| SKILL_002 | 戳鼻子 | STABLE | 24 | 100 | 0 | NONE |
| SKILL_003 | 頭頂 | STABLE | 28 | 95 | 0 | NONE |
| SKILL_004 | 慢慢揍 | STABLE | 32 | 90 | 0 | NONE |
| SKILL_005 | 超大聲嚇人 | HEAVY | 45 | 80 | 0 | NONE |
| SKILL_006 | 狠狠揍 | HEAVY | 50 | 75 | 0 | NONE |
| SKILL_007 | 呀哈飛踢 | HEAVY | 55 | 70 | 0 | NONE |
| SKILL_008 | 偷偷打一下 | QUICK | 14 | 100 | 1 | NONE |
| SKILL_009 | 突然踢一下 | QUICK | 18 | 95 | 1 | NONE |
| SKILL_010 | 縮成一團 | SPECIAL | 0 | 100 | 0 | DAMAGE_REDUCTION_50 |
| SKILL_011 | 嗚啦 | SPECIAL | 0 | 100 | 0 | HEAL_20_PERCENT |
| SKILL_012 | 瞪著看 | SPECIAL | 0 | 90 | 0 | NEXT_ATTACK_DAMAGE_REDUCTION_20 |
| SKILL_013 | 原地亂叫 | SPECIAL | 0 | 85 | 0 | NEXT_ACTION_SPEED_REDUCTION_30 |
| SKILL_014 | 裝死 | SPECIAL | 0 | 80 | 1 | DAMAGE_REDUCTION_70 |

五隻小可愛與兩隻普通怪物的技能配置依本次指定配置；每隻至多四招，所有 id 可解析。MON_003 只保留原 Boss 資料與技能，不入草原遭遇池、不加入 Boss AI。

所有 CreatureDefinition 新增 hpGrowth / attackGrowth / speedGrowth。

| 生物 | HP 成長 | Attack 成長 | Speed 成長 |
| --- | --- | --- | --- |
| 吉伊卡哇 | 2.0 | 0.8 | 0.8 |
| 小八 | 1.8 | 0.8 | 1.2 |
| 兔兔 | 1.7 | 1.3 | 1.0 |
| 栗子饅頭 | 2.5 | 0.9 | 0.5 |
| 飛鼠 | 2.0 | 0.6 | 0.9 |
| 黑團蟲 | 1.8 | 0.7 | 0.6 |
| 暴躁大嘴怪 | 2.4 | 1.2 | 0.7 |
| 巨型森林怪 | 0 | 0 | 0 |

StatCalculator 使用 `floor(Lv5BaseStat + growth × (level - 5))`，最低 1；等級計算限制在 1～50。Boss 使用零成長以保留原參考數值，本階段不進實際遭遇。Encounter payload 現在包含依遭遇等級計算的 stats、hp、maxHp。

## 戰鬥規則

- 一般相剋：水 > 火 > 風 > 土 > 水，優勢 1.5、反向 0.75，其他 1.0。PURE_CUTE 進攻與防守皆為 1.0。
- DamageCalculator：`floor((power + attack × 0.6) × attributeMultiplier × randomFactor)`，randomFactor 為 0.9～1.1，最低傷害 1。零 Power 技能不進一般傷害公式。
- Accuracy：`rng() × 100 < accuracy`；miss 沒有傷害或特殊效果，顯示「但是沒有打中！」。
- 出手：priority 優先，其次有效 Speed，再以 RNG <0.5 判玩家先手。第一次行動擊倒對方就不執行第二次行動。
- AI：從目前有效技能隨機選招，HP >=90% 且有其他技能時排除 heal；只有 heal 的 loadout 可例外。
- 傷害扣除最低 HP 0，戰鬥文字顯示實際扣掉的 HP。包含使招、傷害、效果很好 / 不太好、miss、昏倒與勝敗提示。
- RNG 集中於可注入的戰鬥系統與函式，Scene 沒有散落 Math.random。

### 暫時效果生命週期

TemporaryEffects 保存在 Combatant 模型，沒有把效果 boolean 散落到 Scene。

- 縮成一團：成功施放後，本回合承受傷害 ×0.5，回合結束清除。
- 裝死：priority 1，成功施放後本回合傷害 ×0.3，回合結束清除。
- 減傷不回溯到技能施放之前；慢速角色縮成一團可能來不及保護這回合已受到的攻擊。
- 嗚啦：回復 floor(MaxHP ×0.2)，不超過 MaxHP。
- 瞪著看：對方下一次命中的 damaging attack 傷害 ×0.8，命中並造成傷害後消耗；miss / 特殊技能不消耗。
- 原地亂叫：對方下一次出手順序判定的有效 Speed ×0.7，判定後消耗；不改變已排好的當前回合順序。當回合新施加的效果保留到下一回合。
- 同種效果重複施放刷新狀態，不疊乘。不同類型減傷可相乘，最後 floor 且傷害至少 1。

BattleManager 預留 `onSuccessfulDamagingAttack` callback，可供後續 PURE_CUTE 被動接入；本次未接入任何被動事件。

## UI、輸入與返回

BattleScene 顯示雙方名稱、等級、屬性、HP / MaxHP，敵方種類與捕捉尚未實作標記。按戰鬥顯示玩家四招；點技能後同步結算一整回合，HP 先更新至結算值，戰鬥訊息每 220 ms 逐行呈現，區域保留最近五行。

回合文字播放期間隱藏技能、淡化選單且所有選單 / Esc / 返回操作均被 guard 阻擋，避免重複回合或中途離開。回合完成後再按戰鬥選下一招。

- 勝利：敵方昏倒、戰鬥勝利，顯示返回按鈕，回原遭遇位置。
- 戰敗：吉伊卡哇昏倒、你被送回營地了，顯示返回按鈕，回出生點 (240, 400)。不扣錢、不掉物品，下一次戰鬥滿血。
- 逃跑：固定 100% 成功；仍回遭遇位置。回合播放中不可逃跑，播放完可使用逃跑或 Esc。
- 原 WorldScene 維持 sleep / wake，沒有重新建立地圖；所有返回結果都沿用 step guard 與兩個草叢 step cooldown。
- 道具 / 隊伍仍顯示「尚未實作」，不啟動其他系統。

## 新增檔案

- `src/data/skills.ts`
- `src/config/prototype.ts`
- `src/battle/StatCalculator.ts`
- `src/battle/AttributeMultiplier.ts`
- `src/battle/DamageCalculator.ts`
- `src/battle/TurnOrder.ts`
- `src/battle/EnemyAI.ts`
- `src/battle/BattleManager.ts`
- `tests/battle.test.ts`
- `e2e/battle.spec.ts`
- `MILESTONE_3_REPORT.md`
- `artifacts/milestone-3-skills.png`
- `artifacts/milestone-3-victory.png`
- `artifacts/milestone-3-defeat.png`

## 修改檔案

- `src/entities/BattleEntity.ts`：成長欄位、runtime stats 與統一 BattleEntity factory。
- `src/data/creatures.ts`、`src/data/monsters.ts`：技能配置與成長資料。
- `src/scenes/BattleScene.ts`：實際玩家、技能選單、回合文字與 HP、input lock、勝敗返回。
- `src/scenes/WorldScene.ts`、`index.html`：Milestone 03 標記；遭遇與返回邏輯保持原有方式。
- `tests/encounter.test.ts`：payload 驗證改為 Lv.3 成長後的 HP / stats，不再期待固定 Lv.5 HP。
- `e2e/encounter.spec.ts`：戰鬥按鈕驗證改為顯示技能選單，其餘既有往返驗證保留。
- `README.md`：目前架構、規則、測試、操作與限制。
- 既有 Milestone 1 / 2 截圖由原 Edge tests 重跑更新，顯示目前版本。

## 最終驗證結果

| 檢查 | 結果 |
| --- | --- |
| npm test | 62 / 62 PASS：原 28 + 新 34 |
| npm run typecheck | 0 errors |
| npm run build | 成功，內含第二次 TypeScript check |
| npm run test:e2e | 5 / 5 PASS：原 3 + 新 2 |
| 視覺 QA | 已檢查技能、勝利與戰敗的真實 Edge 截圖 |

新單元測試涵蓋四組相剋與反向、PURE_CUTE 全屬中立、傷害係數 / 下限 / 零 Power、命中與 miss、線性能力值、技能 loadout、priority / Speed / tie、AI 合法選招 / 90% heal 門檻、完整雙方行動、擊倒中止、勝敗、五種特殊效果與生命週期、逃跑 / 勝敗 return payload、成功攻擊 hook 及新戰鬥狀態獨立。

新 Edge tests 使用真正 World 草叢移動進入戰鬥，以明確 dev debug 選敵人，並注入固定 RNG 讓流程可重現，沒有改敵我 HP 或能力值來跳過戰鬥：

1. Lv.5 吉伊卡哇對 Lv.5 野生吉伊卡哇：真實點擊舔一口，完整雙方行動後 HP 都為 12；雙擊技能及回合中按 Esc 不新增回合。第二回合擊倒敵人，敵人不反擊，點返回恢復遭遇位置。
2. Lv.5 吉伊卡哇對 Lv.5 栗子饅頭：玩家滿血用嗚啦，土屬性敵人以舔一口造成 35 傷害，出現戰敗訊息；點返回到營地 (240,400)，再從世界移動遇敵確認玩家 35 / 35，最後逃跑。

原行走、碰撞、Camera follow、加權遭遇、Lv.2～5、飛鼠連續两次提示、兩步 cooldown、怪物遭遇與逃跑原位置 tests 全部 PASS。新增戰鬥 tests 未發現 pageerror。

Build 仍有主 bundle 超過 500 kB 提示：主 JS 約 1.217 MB、gzip 約 327 kB；包含 Phaser，為警告而不是 build error。

## 手動驗證步驟

1. 重新整理 `http://127.0.0.1:5187/`。若伺服器不在執行，於專案目錄執行 `npm run dev -- --port 5187 --strictPort`。
2. 從營地往下約四格，再向右進草原草叢，跨格移動等待 8% 遭遇。核對敵方 Lv.2～5、玩家 Lv.5、雙方 HP。
3. 按戰鬥，核對四招；選舔一口或頭頂。觀察先後、HP 更新與每招文字，等文字播放完再按戰鬥繼續。
4. 測試嗚啦回復 / 不超上限、縮成一團本回合減傷。可遇不同敵人觀察 WATER 對 FIRE 優勢、對 EARTH 劣勢及對 PURE_CUTE 中立；其餘特殊技能可由敵方施放，完整規則另由單元測試覆蓋。
5. 擊倒敵人後確認勝利文字，按返回核對原位置。自己 HP 歸零後確認戰敗文字，按返回核對營地；下一次戰鬥玩家滿血。
6. 回合進行中多點按鈕或按 Esc，不應額外結算或退出；回合結束後逃跑應回遭遇位置。返回後停留不重複遇敵，下一兩個草叢 step 有保護。
7. 快速測試可開 `http://127.0.0.1:5187/?debugEncounters=1&entity=CUTE_001`，按 F2，再跨新草原草叢格。可換 CUTE_003 看火屬敵人、CUTE_004 看土屬敵人、CUTE_005 看每次飛鼠特殊台詞、MON_001 看怪物。等級及 AI / 命中仍随机，手動結果不保證與固定 RNG test 相同。

Debug 仍只限 dev + 明確 query flag；正式 build / preview 不啟用。指定 entity 只接受草原池成員，不改 Boss pool。

## 已知限制

- 只有草原遭遇表；怪物 MON_002 與 Boss 只有資料，未進隨機遭遇。
- 沒有捕捉、隊伍管理、EXP、升級、學招、進化、PURE_CUTE 攻擊被動、pity、Boss scripting、完整存檔、音效、正式美術或 exe。
- 玩家固定吉伊卡哇，沒有 Starter UI。每次進入戰鬥都滿血，不保存跨戰鬥 HP；未引入 PartySystem。
- Battle log 只呈現最近五行，不提供歷史捲動；HP 先結算，再播放文字，沒有攻擊動畫。
- prototype 傷害相對 HP 高，普通戰鬥可能一至兩回合結束；未擴充戰鬥平衡調整功能。
- 五種 special skills 已實作，但玩家四招中只有縮成一團與嗚啦，其他效果可由野生生物使用或透過測試驗證。
- 重新整理仍回營地；工作目錄尚未提交 Git。

## 建議下一 Milestone

Milestone 4 可聚焦 CaptureSystem 與最小道具入口：捕捉機率、不可捕捉怪物限制、成功 / 失敗回合成本、捕捉結果資料交接及測試。完整五隻隊伍與成長系統另行分階段，需先由使用者指定範圍，本次不實作。
