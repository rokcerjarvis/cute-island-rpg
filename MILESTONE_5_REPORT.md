# Milestone 5 — PURE_CUTE, Evolution & First Boss

狀態：完成，停止於 Milestone 5，未開始下一階段。

## 開始前驗證

- Git status 已檢查：專案檔案仍 untracked，沒有 Git commit；未重置、刪除或清除既有工作。
- 原 131 項單元測試 PASS，原 13 項 Edge 流程 PASS。
- TypeScript 0 errors，build 成功。
- 沒有新增套件或修改 package.json / package-lock.json。

## 完成內容

### PURE_CUTE

CuteEventSystem 獨立提供 shouldTriggerCuteEvent / rollCuteEvent / applyCuteEvent。BattleManager 在成功傷害事件後呼叫，不在 Scene 散落 RNG；原 onSuccessfulDamagingAttack hook 保留，可供其他被動擴充。

只有 PURE_CUTE、Power >0、命中、實際造成 >=1 傷害且目標未被擊倒，才擲 30% 判定。Miss、Heal、防禦、KO 與其他非傷害行動不擲 passive RNG。觸發後四種等權，最多一次事件：

| Event | 效果與生命週期 |
| --- | --- |
| SLEEP | 自己下一次可執行行動跳過，顯示還在睡覺，立刻清除；不是永久異常 |
| CHARM | 目標有效 Attack ×.8，持續本場，重複仍為 .8 |
| FART | 目標有效 Speed ×.8，持續本場，重複仍為 .8 |
| CUTE_POSE | floor(MaxHP ×.25) 回復，封頂；滿血有額外文字 |

SLEEP 也消耗合法捕捉、正常換人與逃跑嘗試，該回合敵人可正常行動；無效選擇 / 怪物捕捉拒絕不消耗睡眠。強制換人不給敵人额外行動，保持原規則。

CHARM / FART 不永久改變種族或 Party 能力值，透過 battle multiplier 計算；同場切出再切回仍保留這兩種 debuff，戰鬥結束後清除。FART 影響下次出手排序，不回溯已決定的本回合顺序。Battle UI 顯示 ATK↓ / SPD↓ / Zzz，四種事件文字都在遊戲中可見。

PURE_CUTE 對所有屬性的攻防仍 ×1.0。飛鼠可遭遇、捕捉、入隊、換上、升級、學招及戰鬥；每次遭遇特殊台詞保留，即使已經擁有飛鼠。

### Evolution

Definition 正式支援 evolution: { type: LEVEL, level, targetCreatureId } 或 null。

| Source | Level | Target | Attribute | Lv.5-equivalent HP / Attack / Speed | Growth |
| --- | --- | --- | --- | --- | --- |
| 吉伊卡哇 CUTE_001 | 15 | 大吉伊 EVO_001 | WATER | 44 / 13 / 12 | 2.4 / 1 / .9 |
| 飛鼠 CUTE_005 | 18 | 超級飛鼠 EVO_002 | PURE_CUTE | 42 / 8 / 14 | 2.4 / .65 / 1.1 |

大吉伊 Lv.15 為 68 HP、23 Attack、21 Speed；超級飛鼠 Lv.18 為 73 HP、16 Attack、28 Speed，Attack 仍明顯低於高攻型。兩個 target 使用來源 Learnset，沒有下一段進化，不加入隨機池。

EvolutionSystem 在 Level Up 後判定，包括跨級；PartyBattleSession 等所有 EXP / 學招決策完成後才建立 pendingEvolution。UI 有「咦……？」、來源名稱、輪廓 scale / flash 約 1.6 秒、進化後名稱與恭喜文字，完成前不可返回世界。

遷移保留 instanceId、level、currentExp、knownSkills，更新 creatureId、attribute、maxHp、attack、speed。Definition 由新 creatureId 解析，不把物件引用寫進 instance。HP 保留比例並 floor，活著最低 1，昏倒保持 0。沒有進化當下專屬技能；後續 Level Up 使用新 Definition Learnset。

Validation 允許同屬性、普通 → PURE_CUTE，拒絕普通元素互換、PURE_CUTE → 普通、自身 / Monster / 不存在 target。進化後不重複觸發。

### Boss 與第一區

在現有地圖新增 column 34 的南向路徑，連接主路與森林深處的巨木空地（columns 34～36、rows 21～22）。玩家走進區域觸發 intro，按確認 / Enter / 1 才進 Boss Battle；取消 intro 後需離開再進入才提示，不會原地反覆彈出。

MON_003 以 isBoss=true payload 進原 BattleScene：Lv.11、WIND、HP 80、Attack 15、Speed 13、baseExp 40、capturable=false。所有隨機池都不含 Boss，使用原 AI / Party / 技能 / 特殊效果 / PURE_CUTE / EXP / forced switch 引擎，沒有第二階段。

逃跑按鈕與主選單 Esc 顯示「現在好像不是逃跑的時候！」，engine / session 也拒絕逃跑，不能只靠 UI 隱藏繞過。收容球仍在公式 / RNG 前拒絕 Monster。

胜利依序顯示「巨型森林怪倒下了！」「森林好像安靜下來了。」，結算 EXP / 學招 / 可能進化，返回 World 才設 bossDefeated=true。巨大身影消失，同一 runtime 不再出現。全隊戰敗則回營地全隊恢復，bossDefeated 仍 false，能再次挑戰。

營地根據 bossDefeated 顯示小木屋（純裝飾，沒有建築系統）。第一次回營地顯示營地變熱鬧及第一區完成，附原始五種收集數、最高等級、Party / Reserve 數量；初始同伴計入種類，進化不遺失原種類記錄。campCompletionShown 控制僅顯示一次。

### Encounter Expansion / Pity

- GRASSLAND 原 Lv.2～5 / 權重 / 8% 每格與兩步 cooldown 保留。
- FOREST_DEPTHS：Lv.7～10、8%；兔兔 22、小八 18、栗子饅頭 15、吉伊卡哇 10、飛鼠 10、黑團蟲 10、暴躁大嘴怪 15。
- SPECIAL_CUTE_GRASS：森林深處 columns 28～29、rows 19～20 的小區，Lv.7～10、8%；飛鼠 20 / 100，其餘種類相同。一般 HUD 仍只稱森林深處，不提示秘密。
- Runtime pureCuteMissCount：符合 PURE_CUTE 池的實際正常遭遇，抽到其他生物累加；>=20 後 PURE_CUTE weight ×3，正常遇到後歸零。不是每 frame / 每個未遇敵步數累加。
- 無 PURE_CUTE 的池不更新；debug forced 不使用加權提升，也不修改 counter。原始 Encounter Table 不被改寫。

## 新增檔案

- src/battle/CuteEventSystem.ts
- src/data/evolutions.ts
- src/systems/EvolutionSystem.ts
- src/systems/BossSystem.ts
- tests/milestone5.test.ts
- e2e/milestone5.spec.ts
- MILESTONE_5_REPORT.md
- artifacts/milestone-5-cute-sleep.png、cute-charm.png、cute-fart.png、cute-cutePose.png（皆以 milestone-5- 為前綴）
- artifacts/milestone-5-evolution-CUTE_001.png、milestone-5-evolution-CUTE_005.png
- artifacts/milestone-5-completion.png、milestone-5-camp-upgrade.png

## 修改檔案

- src/entities/BattleEntity.ts、CreatureInstance.ts：正式 evolution / attribute 與 Boss payload。
- src/data/creatures.ts、monsters.ts、encounters.ts、world.ts：進化來源、registry、森林 / 特殊草叢資料與 Boss 空地 / 路徑。
- src/state/RuntimeGameState.ts：Boss、camp completion、pity、收集種類與待進化資料；dev starter 參數。
- src/systems/PartySystem.ts：attribute 初始化與保留原始收集種類。
- src/systems/EncounterSystem.ts：可注入、可測的 pity 加權與 counter。
- src/battle/BattleManager.ts：Cute Event 成功傷害流程、有效 Attack / Speed、一次睡眠及 Boss 逃跑 guard。
- src/battle/CaptureSystem.ts：抽出無 RNG 的拒絕檢查，讓無效捕捉不消耗睡眠。
- src/battle/PartyBattleSession.ts：本場 debuff、睡眠行動、進化 queue / migration、Boss 結算 flag。
- src/scenes/WorldScene.ts、BattleScene.ts：新 UI / trigger / decoration / debug，維持 Prototype config 中央設定。
- src/ui/WorldPartyUI.ts：Boss intro 與完成訊息 modal，保留 Party / Heal。
- index.html、README.md：Milestone 05 與操作文件。
- tests/progression.test.ts：跨級學招後須先完成新增進化阶段，再返回；原測試目的保留。
- e2e/progression.spec.ts：學招放棄文字於進化前驗證，再驗證新進化後狀態，不再期待旧文字永久留在 log。
- 既有 Milestone 1～4 截圖由原 tests 重新產生為目前版本。

## 最終驗證

| 項目 | 結果 |
| --- | --- |
| npm test | 170 / 170 PASS：原 131 + 新 39 |
| npm run test:e2e | 24 / 24 PASS：原 13 + 新 11 |
| npm run typecheck / build 內 tsc | 0 errors |
| npm run build | 成功，dist 產物已更新 |
| 視覺檢查 | Cute Event / 狀態標記、進化輪廓、通關訊息與營地木屋已檢查 |

單元測試涵蓋 30% 邊界、四事件等權、Miss / Power 0 / KO / 普通屬性不 trigger、一次睡眠及其他 action、Charm / Fart 不疊加與同場換人保留、25% 回復封頂、全屬中立；進化門檻 / 跨級 / 全欄位遷移 / HP 比例 / faint / 合法非法屬性 / 不重複 / 學招順序；Boss 池外、trigger、精確 stats、不可捕捉逃跑、EXP、勝敗 flag / camp / retry、森林等級與 pool、特殊草叢、pity 增加 / reset / 提升 / debug bypass。

新 Edge 流程全部走真實世界移動 / UI 點擊：

- F（四個 tests）：已擁有飛鼠後再次 Encounter 飛鼠仍有固定提示；玩家飛鼠用傷害技能，分別觸發 sleep / charm / fart / pose，驗證一次跳過、HP 與 multiplier。
- G（兩個）：吉伊卡哇升到 15、飛鼠升到 18，實際進化畫面、HP 比例、knownSkills、同一 instance 與回 World 狀態保留。
- H：走入 Boss 空地 → intro 確認 → 完整 80 HP Boss → 拒絕逃跑 / 捕捉 → 三回合勝利 → 660 EXP → 返回旗標 → 營地完成 / 木屋 → 再進 Boss 區不重生。
- I：Boss 全隊敗北 → 營地恢復 → 走回空地再次確認挑戰。
- 兩個森林 traversals：FOREST_DEPTHS / SPECIAL_CUTE_GRASS 的 Lv.10 飛鼠提示、zone payload、debug forced 不改 pity。
- 新 debug query / F8～F11 無明確 flag 時不影響正常 starter、EXP、Boss / pity。

新測試使用 DI RNG / 明確 debug fixture 重現事件；Boss H 沒有削低 Boss HP，完整處理 80 HP（固定 RNG 使敵方攻擊 miss）。F/G 使用預設合法 instance 建立測試同伴，沒有直接替換進化結果或跳 Scene 來假造成功。所有新增流程 pageerror 檢查通過。

Build 主 JS 約 1.247 MB、gzip 335 kB，仍有 Phaser bundle 超過 500 kB 提示；是警告，不影響本機執行。

## 最短人工 Debug 路徑

所有網址以 http://127.0.0.1:5187/ 為基底，重新整理會開始新 runtime。

1. 四種事件：`?debugEncounters=1&partySpecies=CUTE_005&partyLevel=15&entity=CUTE_001&forceCuteEvent=1&cuteEvent=sleep`。走到草原草叢前按 F2，跨格遭遇，選「偷偷打一下」避免擊倒目標。將 cuteEvent 改為 charm / fart / cutePose 分別重開驗證；同場 F3 可重新強制。Pose 滿血時仍有文字，先用非傷害技能承受一次攻擊後再強制，可看實際回復。
2. 進化：`?debugEncounters=1&partyLevel=14&entity=CUTE_001&capture=success&forceEvolution=1`。F2 草叢遇敵 → 收容球成功 → EXP / 升級 / 進化 → 返回；飛鼠用 partySpecies=CUTE_005&partyLevel=17，同樣流程。
3. Boss：`?debugEncounters=1&partyLevel=15&bossHp=1`。F9 到入口，向右走 → 確認 → 驗證不可逃跑 / 捕捉 → 選傷害招勝利。去掉 bossHp 即為正常 80 HP Boss。
4. Camp Upgrade：Boss 勝利按返回，再 F7 回營地，確認一次完成訊息與木屋；關閉訊息後 F9 再走進空地，不應再次觸發。

正常探索路線：營地 → 草原蒐集 / 培養 → 主路往東 → column 34 南向路徑旁高等草叢 → row 21～22 巨木空地 → 勝利 → 沿路回營地。地圖沒有第二區。

## Debug 指令

保留 F2 / F4 / F5 / F6 / F7、capture、partyLevel、expTarget。新增：

- partySpecies：dev 新遊戲同伴，限定原五隻；正常 config starter 不變。
- forceCuteEvent=1、cuteEvent=sleep / charm / fart / cutePose：強制一次 eligible 事件；F3 可再次排入，未指定種類時循環四種。
- forceEvolution=1 或 World F8：準備進化門檻 EXP，下一場成功結算仍依正常升級 / 學招 / 進化順序。
- World F9：到 Boss 入口，仍需自行踏入及確認。
- bossHp=1～80：只改 debug Boss 剩餘 HP，不改 maxHp / stats / capture eligibility。
- World F10：重置 Boss flag 與營地完成提示。
- World F11：pity counter 20 / 0 切換。

所有 debug 同時要求 import.meta.env.DEV 與 debugEncounters=1。production build / preview 不啟用，強制被動仍不能繞過 Miss / 非傷害 / KO 條件。

## 已知限制

- 所有進度含 Party、進化、Boss / pity 皆只保存在 runtime；重新整理重置，沒有 localStorage 或 Save / Load。
- Reserve 無管理 UI，沒有正式圖鑑 / Starter 選擇 / NPC 對話 / 金錢 / 商店 / 庫存量 / 裝備 / Defense / 暴擊 / PP / 完整狀態異常 / 第二區 / 第二 Boss / exe。
- 進化只有兩條，沒有進化即學專招、分支、取消或正式動畫；輪廓與木屋都是簡單程式色塊。
- HP 先結算後逐行播文字，log 最近五行；Boss 仍是基本 AI，沒有第二階段或高階策略。
- Boss 傷害依原公式，正常挑戰需培養隊伍與善用換人；debug bossHp / fixture RNG 只是驗證工具。
- 工作目錄仍未提交 Git。

## 建議 Milestone 6

建議最小 Save / Load：版本化可序列化 schema、Party / Reserve / position / Boss / collection / pity 的保存與恢復、格式驗證與損毀資料回復測試。細節由使用者另行指定；本次未開始。
