# Milestone 8 — Battle Balance & Companion Invitation

日期：2026-10-14。工作目錄：此 repository 的專案根目錄。

狀態：Milestone 8 完成。核心、邀請、simulation、逐步 UI QA 與最後一次完整 Edge 驗證全部完成。只實作 Milestone 8，未開始 Milestone 9。

## Baseline 與範圍

開始前檢查 Git status，master 尚無 commits，整個 M1～7 專案為 untracked；沒有 AGENTS.md。沒有 reset、remote setup、push、merge、tag 或 release。沒有新增套件或修改 lockfile。Local commits 為本規格可選事項，未把全部既有 untracked 專案混成 M8 commit。

實際重新驗證 M7 baseline：Unit 319／319、Edge 45／45、TypeScript 0 errors、Build 成功；原 Build 50 modules、JS1,284.73kB／gzip346.88kB。存檔 schema1。既有四方向、WASD／arrow、碰撞、camera follow、Encounter、Party、EXP／學招／進化、PURE_CUTE、Boss progression、Title／Continue、Dex 與世界 UI 均保留。

## 傷害與能力值

Before：max(1, floor((SkillPower + Attack ×0.6) × Attribute × random(0.9,1.1)))。

After：max(1, floor((Attack ×0.7 + SkillPower ×0.25 + AttackerLevel ×0.3) × Attribute × random(0.9,1.1)))。

Power0 仍為0 damage，繼續執行原特殊效果。實際 attacker level 由 BattleManager 傳入，不再用單一參考等級代替。最後floor、minimum1；Advantage1.5、Disadvantage0.75、Neutral1.0、PURE_CUTE對所有屬性1.0。技能屬性仍來自使用者species；沒有Defense。

Level coefficient 從建議0.5微調成0.3，減輕高等級傷害成長；其餘兩係數採建議值。HP成長增加，Attack成長下降，Speed及成長不變。

|Species|Lv5 HP before→after|Attack|Speed|HP growth before→after|Attack growth before→after|
|---|---|---:|---:|---|---|
|吉伊卡哇|35→52|10|10|2→2.8|0.8→0.65|
|小八|30→46|10|15|1.8→2.5|0.8→0.65|
|兔兔|28→44|16|12|1.7→2.4|1.3→0.9|
|栗子饅頭|44→64|11|6|2.5→3.3|0.9→0.7|
|飛鼠|34→50|7|11|2→2.7|0.6→0.45|

相關生物一起重平衡，避免進化HP倒退／普通怪物仍過短：

|Definition|HP before→after|HP growth before→after|Attack growth before→after|
|---|---|---|---|
|EVO_001|44→66|2.4→3.4|1→0.8|
|EVO_002|42→62|2.4→3.3|0.65→0.55|
|MON_001|26→44|1.8→2.5|0.7不變|
|MON_002|38→62|2.4→3.2|1.2→0.9|

14 skills保留，Power／Accuracy／Priority不改。Stable為穩定基準；Heavy命中傷害較高但有miss風險；Quick傷害較低且保留priority。縮成一團、嗚啦、瞪著看、原地亂叫、裝死與30% PURE_CUTE Sleep／Charm／Fart／Cute Pose均保留。Same species + same level = same maxHP／Attack／Speed，沒有IV、EV、Nature或隱藏隨機能力。

## Simulation

正式模組 BalanceSimulation + `npm run simulate:balance`。Seeded LCG、每案例1,000次；4等級×10 matchup×3技能＝120,000次。涵蓋Lv5／10／20／30，neutral、advantage、disadvantage、Stable／Heavy／Quick、PURE_CUTE、高Attack、高HP與Starter代表。另5species×1,000場＝5,000場Boss真實engine試驗。

原始資料：artifacts/milestone-8-balance.json。完整120組average／median／minimum／maximum KO turns、one／two-shot rate、平均damage及HP%、屬性實際影響見 BATTLE_BALANCE_REPORT.md。單方KO表計算攻擊嘗試數，包含miss，沒有對手反擊；damage平均是成功命中值、未截斷過量傷害。技能類別模擬刻意允許該等級尚未學會的Heavy。Boss模擬使用真正學到的技能、AI及被動。

|Neutral Stable 等級|Average attempts to KO|
|---|---:|
|5|4.371|
|10|4.312|
|20|4.276|
|30|4.085|

所有120個同級案例 one-shot rate **0%**；不將此結果視為所有等級差都不可能秒殺。Water→Fire Advantage Stable約2.98～3.00，Heavy約2.84～2.91次；Heavy exactly-two-shot rate46.1%～50.7%。PURE_CUTE Stable約5.00～5.03，Quick5.33～6.00，仍有輸出價值。Neutral Stable Lv5→30平均下降約6.5%，未縮短至1～2回合。高HP＋屬性劣勢可超過5次，Heavy可能因miss比Stable更慢；這些取捨在完整表中保留。

## Boss before／after 與正常 QA

|項目|M7|M8|
|---|---|---|
|Level／Attribute|11／WIND|11／WIND|
|HP|80|128|
|Attack|15|14|
|Speed|13|11|
|Skills|Heavy一招|Stable／頭頂／Heavy／Defend|
|正常技能分布|Heavy-only|40%／30%／20%／10%|
|低於35%HP|Heavy-only|頭頂40%、Heavy30%、Stable20%、Defend10%|

沒有只翻倍HP；增加60%HP，同時降低Attack／Speed，改成有風險節奏的混合AI。不能逃跑、邀請或進Reserve，金錢也不能繞過。

Lv12 Water單種最多三位同伴策略：1000場全勝，平均9.34個選擇、8.985次成功玩家ACTION、1.987次Heal、0.975次forced switch。Wind平均7.077次有效行動，PURE_CUTE9.918。Fire Heavy＋advantage仍可約3次成功攻擊擊倒；Earth同種三人策略勝率43.3%。Boss的6～10目標以一般中性／混合隊伍衡量，不聲稱每個 matchup都相同；換人、屬性及priority的差異仍有價值。

**逐步 UI QA 正常 Boss**：獨立Edge、5193 origin，dev New Game提供Lv12吉伊卡哇，F1加入同級兔兔／飛鼠後挑戰完整Boss。沒有bossHp參數、enemy HP修改、RNG replacement／seed或強制Cute Event。代理逐步滑鼠／鍵盤操作，檢視每一步截圖；這不是宣稱使用者親自完成驗收。

|指令|玩家行動|Boss HP|出戰者 HP|
|---:|---|---:|---|
|開始|—|128／128|Water71／71|
|1|頭頂|108|Water51／71|
|2|頭頂|88|Water33／71|
|3|嗚啦，回14HP|88|Water27／71（之後遭敵攻擊）|
|4|縮成一團|88|Water27／71（Boss也Defend）|
|5|換兔兔|88|Rabbit42／60（敵方18damage）|
|6|Heavy呀哈飛踢|41|Rabbit29／60（敵方13damage）|
|7|Heavy呀哈飛踢|0|Rabbit29／60，獲得440EXP|

結果：**7個玩家指令＝6次成功技能ACTION＋1次換人**，正常Boss獲勝。返回營地、upgrade、刷新、Continue保持升級及Boss不重生。證據 artifacts/milestone-8-unforced-boss-manual.json、m8-manual-boss-start.png、m8-manual-boss-action-1～7*.png、m8-manual-boss-continue.png。

M8 Edge Flow K另以自然RNG跑完整128HP Boss，多次完整suite觀察到7～8個指令獲勝；最後一場raw evidence在 artifacts/milestone-8-unforced-boss-edge.json。此數據不是固定seed或強制成功。M5／M7既有Boss回歸仍採deterministic Heavy-only測試AI以隔離progression／UI，M8 Flow K和逐步QA才驗證新完整AI。

## Companion Invitation／道具

內部CaptureSystem／capture()／CAPTURED／baseCaptureRate保留；玩家看到的Items、battle成功／失敗、Reserve／Dex／營地統計與演出改為「邀請／同行」。沒有大幅重新命名架構或Save keys。

|Item ID|玩家名稱|規則|預設庫存|
|---|---|---|---:|
|CAPTURE_ITEM_001|小點心包|原formula，modifier1|10|
|INVITE_LUXURY|豪華點心包|modifier1.5，floor1%／cap95%|3|
|INVITE_BRIBE|拿錢收買小可愛|合法目標直接success，chance1，不呼叫RNG／formula|0|

原formula：baseCaptureRate／100 × hpModifier × levelDifferenceModifier × itemModifier；分段倍率不變。金錢道具不受HP、等級差或95%cap影響。Description：「有些友情需要時間培養。有些不用。」取得metadata支援SHOP／QUEST／CHEST／EVENT，shopPriceTier=HIGH；只建立資料意圖，沒有商店、貨幣或取得流程。Debug／fixture可驗證金錢道具。

合法使用消耗1個，成功立刻結束戰鬥、敵人不行動；Party＜5加入Party，滿隊加入Reserve，保留等級、剩餘HP、技能。EXP沿用擊敗50%。失敗敵人正常行動；非法或沒庫存不消耗道具與回合。睡眠跳過合法使用時不耗道具。definition.invitationBlocked讓劇情小可愛也能拒絕，包括金錢。

拒絕：Monster「這個傢伙根本不是來交朋友的！」；Boss「現在不是交朋友的時候！」。不播放邀請動畫，不擲邀請RNG。HP0也不能邀請。

## Presentation與玩家文字

普通：玩家側點心袋→靠近／觀察→短pause→成功朝玩家走＋heart／sparkle，或失敗搖頭退回→敵方action。豪華點心用紫色袋，普通用棕色袋；generic pixel shape，不需載新asset。

金錢：玩家側金色錢袋／$→「你拿出了錢。」→pause→「{speciesName} 盯著錢看。」→「{speciesName} 願意跟你走了！」→「金錢建立了深厚的友情。」→Party／Reserve feedback。PURE_CUTE使用同一流程，不破壞其每次遭遇提示。

沒有throw／shrink-to-ball演出。legacy capture-ball PNG和CAPTURE_THROW hook留在素材／音效manifest但不再使用，不影響舊mapping tests。Item UI顯示各庫存，滑鼠／鍵盤可選三項與description；動畫鎖、對話加速、learning／evolution gating、cleanup沿用M7。

新增dev flag：invite=success／fail，舊capture=success／failure相容；item=bribe僅明確dev模式缺庫存時補1個。F1新增「補充邀請道具」與「同級 Boss QA 同伴」，18項dynamic spacing在modal範圍內。F2／F7／F9原行為保留；沒有dev＋debugEncounters=1不啟用，production亦不啟用。強制遭遇不污染pity。

## Save schema／相容性

schemaVersion **1**。SaveData新增可選inventory，M6／M7缺欄位時clone並補10／3／0，不修改輸入；已存在庫存要求三個合法整數slot，不接受負數、分數、null、NaN／Infinity。runtime總有獨立庫存物件，序列化／載入clone，避免引用共用。

舊currentHP數值保留，新MaxHP／Attack／Speed按definition重算。舊滿HP檔可能呈現35／52，而非自動補滿；可在營地治療。Party／Reserve／knownSkills／EXP／Dex／Boss／camp flags保留。不儲存animation、sprite、RNG、debug或未結算Battle；消耗先mark dirty，成功取得同伴的原checkpoint待回世界結算後存一次。

M6fixture：原tests/fixtures/milestone6-save-v1.json未修改。M7fixture：新增tests/fixtures/milestone7-save-v1.json，依M7相同v1格式建立代表性資料，包含EVO_001／EVO_002 Reserve、Boss完成、Dex與受傷HP；不是讀取使用者私人存檔。兩者Unit載入／roundtrip、Edge Continue驗證。M7沒有額外Save欄位，因此可用相同schema驗證其相容性。

## Tests／TypeScript／Build

|Check|結果|
|---|---|
|npm test|383／383 PASS，8 files（原319＋新64）|
|npm run test:e2e|57／57 PASS（最終完整執行約2.2分鐘）（原45＋新12，共57）|
|npm run typecheck|0 errors|
|npm run build|成功，51 modules；JS1,287.53kB／gzip347.89kB|
|npm run simulate:balance|完成120,000攻擊試驗＋5,000 Boss engine試驗|
|schema／fixtures|v1；M6、M7 Unit與Continue PASS|

原319 Unit及45 Edge用例均保留。HP／damage／growth、玩家文字與舊throw／shake預期按新規格更新；KO／forced-switch用例明確設定低HP，不再依賴舊平衡的普遍one-shot。受傷Victory測試仍從20HP驗證不自動治療。無功能用例刪除。多次完整57 Edge已PASS；最末source metadata與fixture精化後再次執行完整suite，57／57 PASS。

新增64 Unit：公式、min／zero power、RNG range、Neutral／Advantage／Disadvantage／PURE、各技能類別、HP／Attack growth、200個同種同級instance、seed再現、Lv5～30 simulation、Boss stats／strategy、snack成功失敗／luxury／bribe bypass、非法目標／story／faint／empty／sleep、消耗／Party滿→Reserve／EXP、取得metadata、v1 fixtures／stock roundtrip／malformed inventory／legacyitemID。

新增12 Edge：A Neutral多回合及HPbar；B Advantage Heavy非秒殺；C Small success；D Small fail＋enemy action；E Luxury；F Money bypass forcedfail／固定台詞；G Monster三道具拒絕；H完整Boss三道具拒絕；I Party滿→Reserve／stock Continue；J重複PURE遭遇及無UI累積；K自然RNG Boss含Heal／Defend／Switch；M7fixture Continue。

逐步代理UI QA獨立於assertion suite，採隔離Edge profile及5193origin，鍵盤／滑鼠依畫面操作、截圖檢視。沒有宣稱真人驗收，也未透過QA寫入使用者5187的localStorage。已檢查新Starter數值、正常Boss七次指令、camp／Continue、PURE提示、普通棕色點心觀察與fail後enemy打10HP、豪華紫色袋成功、金錢$袋與固定友情台詞。Lv5自然Neutral兩回合後雙方仍存活，Player38→24／52、Enemy40→27／52；之後豪華邀請成功，Party新同伴保留27HP，玩家保留24HP，EXP25。

截圖：artifacts/m8-manual-*.png；代表m8-manual-money-look／friendship／success.png、m8-manual-snack-observe／failure.png、m8-manual-neutral-1／2.png、m8-manual-luxury-observe／success.png。完整Edge各flow截圖亦保留。

## 手動驗證方式

1. `npm run dev -- --port 5187`，開http://127.0.0.1:5187/；已有服務可刷新，Continue仍載v1。
2. 新遊戲選Lv5同伴，走進草叢隨機遭遇。選普通技能，觀察較長的HPbar／damage節奏。
3. 道具選小點心／豪華點心；查看數量減1、成功Party／Reserve、失敗enemy action。
4. 明確dev網址 `?debugEncounters=1&entity=CUTE_005&encounterLevel=5&invite=success`，F1立即測試遭遇，每場確認PURE提示，再邀請。
5. 改invite=fail測普通失敗；item=bribe可補1個金錢道具，選金錢仍100%成功。F1補充道具亦可取得2個。
6. F6填滿Party後邀請→Reserve；回世界保存，刷新Continue檢查stock／Reserve。
7. 指定MON_001測拒絕，F1完整Boss測拒絕，兩者均不減stock、不耗回合。
8. 正常Boss QA網址只需 `?debugEncounters=1&partyLevel=12`，F1同級QA同伴、F1完整Boss；不要bossHp或強制RNG。使用頭頂／Heal／Defend／換兔兔與Heavy，記錄實際指令、miss與HP。

## 檔案

新增：

- src/data/invitationItems.ts：三個道具、metadata及獨立預設庫存。
- src/battle/BalanceSimulation.ts：seed、matchup與Boss engine simulation。
- scripts/battle-balance.mjs：正式runner、JSON與Balance report輸出。
- tests/milestone8.test.ts、e2e/milestone8.spec.ts。
- tests/fixtures/milestone7-save-v1.json。
- BATTLE_BALANCE_REPORT.md、MILESTONE_8_REPORT.md。
- artifacts/milestone-8-balance.json、unforced Boss Edge／manual JSON、M8 screenshots。

修改：

- src/config/prototype.ts、battle/DamageCalculator.ts、BattleManager.ts、EnemyAI.ts。
- src/data/creatures.ts、evolutions.ts、monsters.ts、learnsets.ts、entities/BattleEntity.ts。
- src/battle/CaptureSystem.ts、PartyBattleSession.ts。
- src/state/RuntimeGameState.ts、systems/SaveSystem.ts、BossSystem.ts、DexSystem.ts。
- src/presentation/BattlePresentation.ts、ViewModels.ts。
- src/scenes/BattleScene.ts、WorldScene.ts、ui/WorldPartyUI.ts。
- tests/battle／encounter／progression／milestone5／milestone6／milestone7.test.ts（保留用例）。
- e2e/battle／encounter／progression／milestone5／milestone6／milestone7.spec.ts（保留用例）。
- package.json僅新增simulate:balance script；index.html顯示MILESTONE08；README.md、UI_GUIDE.md、ASSET_GUIDE.md。

沒有修改移动、地圖、Encounter權重／chance／pity、EXP curve、Skill data、Save schema version、Starter數量、依賴或lockfile。中途一次性修改腳本已刪除，不留不可重複使用的migration utility。

## Cleanup／限制與下一階段

Battle restart的offer／caption在完成時destroy；shutdown取消Scene timers／tweens／queue／listeners，原animation lock保留；每次item panel先清除controls，拒絕不產生邀請events。沒有新增重複asset load或永久對話物件。原回世界cooldown維持。自動Save仍在安全checkpoint，不逐frame寫入。

已知限制：

- 同級simulation涵蓋目前10個代表matchup，不代表所有等級差。Heavy有較高單擊與miss代價，部分平均KO較慢。
- Boss的6～10為一般中性／混合隊伍目標，Fire Heavy優勢可更快；Earth劣勢與過度連續Heal較難，使用換人可改善。沒有為湊所有matchup相同長度新增傷害上限或大型Boss技能。
- 庫存有限，新遊戲／舊檔10／3／0；尚無取得流程。金錢道具只可debug／fixture驗證，高價購買只留metadata。
- Reserve仍為數量與保存，沒有交換／排序。四Starter仍保留，M9才調整。
- 舊HP數字保留而MaxHP提高，可能需要在營地補血；不把此視為存檔損壞。
- 正式美術、聲音、經濟、Quest、第二Boss、151species、網路／cloud、.exe皆未實作。
- Build仍有既有Phaser大chunk提示（>500kB），未做與本里程碑無關的engine rewrite／code split。
- Git仍為全部untracked的原狀，沒有新增歷史追溯commit；本報告與測試證據記錄本次狀態。

建議Milestone9：依已提出方向將Starter改為吉伊卡哇／小八／兔兔三選一，保留栗子饅頭作遭遇同伴；先規劃小範圍點心補給／獎勵來源及混合隊伍Boss實際玩家回饋。維持v1相容、保留M8 balance fixtures／simulation，不擴到151species或完整商店／任務。以上僅建議，尚未開始。
