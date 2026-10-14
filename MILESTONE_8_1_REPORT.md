# Post-M8 / Milestone 8.1 — Overworld Party Management & Creature Status

日期：2026-10-14。狀態：Milestone 8.1 完成，實作、自動驗證與逐步 UI QA 全部完成。只完成8.1，不開始Milestone9；沒有151species、Starter修改、商店、Reserve管理或GitHub操作。

## M8 baseline

開始前重新檢查Git status：master尚無commits，整個既有專案為untracked。沒有AGENTS.md。未新增依賴、安裝套件或修改lockfile。

實際重新驗證：Unit **383／383 PASS**、Edge **57／57 PASS**、TypeScript **0 errors**、Build成功。M8 baseline Build為51modules，JS1,287.53kB／gzip347.89kB；schemaVersion1，M6／M7存檔相容。

M8傷害係數、HP／Attack／Speed成長、14skills、30% PURE_CUTE、Encounter／pity、三種邀請道具／庫存／動畫、EXP／學招／進化、Boss balance及world collision／camera均未改動。

## Implementation summary／Leader model

**Party slot0＝Overworld Leader**，沿用既有Party陣列順序，不新增leaderId。`activeInstanceId`仍是戰鬥內出場者。

- PartySystem新增leader getter、setLeader、prepareLeader。
- 設C為隊首：A B C D E → C A B D E。splice／unshift同一個instance，其他成員相對順序不變；HP／stats／skills／EXP／identity不變。
- 已是隊首回傳CURRENT，不變更dirty／pendingAutoSave；UI顯示「目前隊首」、淡化，點擊或Enter皆no-op。
- HP0／FAINTED不能設隊首，顯示「牠現在沒辦法帶頭出戰。」；不重排、不換active、不寫Save，仍可查看狀態。
- unknown／Reserve不在Party，不可設隊首；Battle／pending learning／evolution阻止setLeader。
- 健康slot0維持隊首。若slot0昏倒，prepareLeader穩定選第一位存活者並移至slot0，其他相對順序保留；不隨機選。
- 全隊昏倒沿用World返回營地／heal，恢復後slot0可出戰；空隊伍World安全回Title，不嘗試啟動Battle。Party model和空列表本身也能安全處理。

## Party UI behavior

沿用WorldPartyUI的單一`world-panel`，不新增Scene或keyboard listener。深綠面板、淡綠／米色border、既有字體、pixel portraits、gold focus一致。

最多5格，空位保留。每格portrait／species／Lv／Attribute／CurrentHP／MaxHP／HPbar／昏倒dim與文字／LEAD隊首。Reserve只顯示數量，沒有交換或點進Box。

- 非戰鬥World按P，或遊戲選單選隊伍。
- ↑↓（也支援←→）循環選人；Enter／Space或1～5開member action menu。
- Mouse hover改gold border，click開「設為隊首／查看狀態／返回」；action menu支援上下／Enter／Space／數字／mouse。
- Esc在action menu回Party；Party Esc／P關閉。Status Esc回Party，P關閉整個Party modal。
- Battle、Encounter transition、Evolution presentation不能開這個World Party。World保持sleep／battlePending防護；Battle自己的Party Switch UI仍由BattleScene管理。
- 其他modal開著時P不疊開Party；面板間導航採銷毀舊panel後建立一個新panel。
- 面板存在時暫停世界移動／Encounter與原遊玩時計；關閉後恢復。

## Battle integration

普通、Monster、Boss共用PartyBattleSession，建立Battle前prepareLeader，初始active選slot0。World prepareParty也先關閉modal、確認可出戰同伴，避免transition残留UI。

Battle switch仍只改activeInstanceId，原回合消耗、forced switch、HP同步、特殊效果、最後出戰EXP都保留；不重排Party。finishReturn先完成原結算／heal／Boss flags，再清Battle並prepareLeader：健康Overworld隊首回到active，下一場仍派它。若隊首已昏倒則使用上述fallback；全隊戰敗治療後保留原slot0。

因此「臨時換人」不永久改健康隊首，而「原隊首不能出戰」才提升first alive。

## Creature Status Page

新增純資料view model `src/presentation/CreatureStatusView.ts`；讀取既有instance及definition，不重新擲能力、改stats或觸發學招／進化。

顯示：portrait、species／Lv／隊首標記、Attribute／icon、currentHP／MaxHP、Attack、Speed、OK／Fainted、累積currentEXP、next-level neededEXP、當前level segment EXPbar、最多4個known skills、既有Evolution資訊。

- EXP使用現有expForLevel：needed=max(0,next threshold−currentExp)，ratio=(currentExp−level threshold)／level segment，clamp0～1。Lv50顯示已達最高等級、needed0／fullbar，不除0。
- Skills顯示名稱及Category；普通技能顯示Power／Accuracy。Special Power0顯示現有Effect description，例如受到傷害−50%、回復MaxHP20%，不顯示P0。
- Evolution直接用現有data：Lv15→大吉伊、Lv18→超級飛鼠；final stage或無資料顯示「無」。不新增或觸發evolution。
- PURE_CUTE用原heart icon、PURE_CUTE字樣及小字「這是什麼？上網查一下！」。只是flavor，不建立阻斷對话。
- ←→直接在Party members wrap-around；有可點的前一位／下一位／返回隊伍。單人仍安全停同一位。Enter無額外動作；Esc回Party并保留目前selection。
- 左側保留未來身分列空間；本次不加入isStarterPartner、不從creature-1／species／slot推測初始夥伴，也不改四Starter。

Same species＋same level＝same stats仍成立；沒有IV、EV、Nature、hidden variance或personality modifier。

## Save／Continue compatibility

schemaVersion **1**，沒有新增Save欄位。Party order已在v1序列化，slot0就是保存的隊首。

Legacy沒有leader欄位：採Party第0位健康者；若第0位昏倒，採第一位存活者。舊active若指向Battle臨時換人，載入World時不將其當永久隊首，改回slot0。這是明確的8.1語義；原active欄位仍保留供Battle。

Continue summary／portrait也使用Party第一位存活者，與實際World／Battle lead一致。deserialize只對新runtime做fallback，不修改輸入Save object。Boss／camp flags、Dex、evolved species、EXP／known skills、Reserve及M8有限庫存全部保留。

成功setLeader requestAutoSave一次；Party modal開著時沿用World暫停行為，關閉回World後寫一個安全checkpoint。current-leader no-op及單純查看Status不mark dirty、不requestSave。可手動遊戲選單Save，再refresh／Continue。Battle／未完成學招／進化仍不能寫Save。

M6／M7 fixture維持原檔；新增代表性M8v1 fixture，在相同Save形狀加入非預設庫存7／2／1，保留Boss已完成、Dex、EVO_001／EVO_002 Reserve與HP。不是讀取使用者私人存檔。

原M8 validator對empty／all-fainted raw Save仍視為不合法，Title維持既有壞檔處理；不放寬保存不變量。合法legacy檔slot0 fainted但Party有alive可正常載入並fallback。Runtime all-fainted則走營地治療。

## Automated verification

|Check|Result|
|---|---|
|npm test|**425／425 PASS**，9files（原383＋新42）|
|full npm run test:e2e|**72／72 PASS**，約2.5分鐘（原57＋新15）|
|npm run typecheck|**0 errors**|
|npm run build|成功，52modules；JS1,294.02kB／gzip349.67kB|
|M6／M7／M8 fixture|Unit load／roundtrip＋Edge Continue全部PASS；schema1|

原383Unit檔案／用例均保留，未刪斷言。原57Edge也保留。兩項fixture修正：M5飛鼠測試從直接改active改成正式setLeader，以配合新的Overworld語義；M8普通邀請失敗案例固定Battle RNG命中，避免原本合法95%accuracy Miss讓「HP減少」断言隨機失敗，保留原斷言。正常Boss Flow K仍自然RNG，未改Boss或戰鬥計算。

新42Unit覆蓋：設隊首／stable reorder／identity、current no-op、fainted／unknown／Reserve拒絕、empty／single／5人／all-fainted／mixed safety、pending battle／learning／evolution限制、三種Battle初始lead、temporary switch／return／下一場、fainted fallback、邀請append、Save／load／legacy active／三種fixtures／一次checkpoint、所有Status欄位／EXP／max50／skills／Special／Evolution／PURE／不推測starter／navigation。

新15Edge覆蓋：

1. 五格Party、keyboard／mouse、重复P、移動暫停。
2. 第二位setLeader、stable order、實際F2 grass encounter先出場。
3. Battle臨時換人、逃跑、再次Encounter仍原隊首。
4. Fainted拒絕 exact message，仍可查看Status。
5. Stats／EXP／skills／evolution、←→wrap／mouse箭頭、PURE marker。
6. Leader autosave→refresh→Continue。
7～9. M6／M7／M8 fixtures Continue、Reserve／Boss／Dex／inventory。
10～11. 新隊首先出場Monster／Boss（確認實際enemy IDs）。
12. 12次Party／Status循环後Scene object及keyboard listener數不增加，Save字串未改；other modal不疊開。
13. 單人EVO_002／Lv50／Special／PURE／無Starter身分。
14. Legacy fainted slot0 promotion與empty World回Title。
15. Encounter fade阻擋P，runtime all-fainted回camp／heal。

## Manual UI QA

方式：代理在獨立Edge profile及5193本機origin，依截圖逐步滑鼠／鍵盤操作；不是宣稱使用者本人驗收。沒有QA寫入使用者5187的localStorage，也没有以test assertions代替這一段畫面檢視。

已實際檢視：

- World P五格、gold選中、portrait／HP／attribute／LEAD。F6只用於準備五人fixture，沒有修改Battle RNG。
- 吉伊卡哇Lv12 Status：HP71／71、Attack14、Speed15、currentEXP1987、升級還需539、4技能含Defend／Heal effect、Lv15→大吉伊，無P0。
- ←由第一位wrap到飛鼠Lv5：heart／PURE_CUTE、非阻斷flavor、HP50／50、Attack7／Speed11、EXP143／還需105、Lv18→超級飛鼠；→回第一位。
- Keyboard選第二位小八，action menu設隊首；順序由吉伊／小八／兔兔／栗子／飛鼠改為小八／吉伊／兔兔／栗子／飛鼠，其他資料一致。
- 關閉Party、autosave、refresh／Continue，再P：小八仍LEAD、Lv5 HP46／46，吉伊仍Lv12 HP71／71。
- 真實方向鍵由營地走入草叢，F2 encounter：初始玩家小八Lv5 HP46／46，敵方小八Lv3 HP41／41。
- Battle臨時換吉伊Lv12，敵方造成12damage，吉伊71→59／71；逃跑回World，Party隊首仍小八、吉伊保留59HP。
- 下一場F2與P隔離檢查：再次F2草叢Encounter仍由小八Lv5 HP46／46先出場；Battle按P沒有疊開Overworld Party。

證據：artifacts/m8-1-manual-party.png、status-chiikawa.png、status-pure.png、leader-action.png、new-leader.png、leader-continue.png、initial-leader.png、temporary-battle-switch.png、leader-after-battle.png、next-battle-leader.png。Edge有milestone-8-1-party／status.png。

## Cleanup／performance

没有新增input listener，沿用World一個keydown dispatcher與UI WeakSet native-event去重。P只切換／關閉一個panel；Party／Action／Status導航先destroy舊container及其child mouse listeners。Scene shutdown清toast timer、panel、actions／row references、mode／prompt及audio；不在Physics已destroy後呼叫stopMovement。

頁面只建立static text／rectangle／portrait，没有永久tween／額外asset load。12輪open／status左右／Esc／close的自動測試驗證Root object count與keydown listener count保持相同。查看不Save；setLeader pending是boolean checkpoint，no-op不重复request。Battle transition會close modal；原Encounter cooldown保留。

## Files added

- src/presentation/CreatureStatusView.ts。
- tests/milestone8_1.test.ts。
- e2e/milestone8_1.spec.ts。
- tests/fixtures/milestone8-save-v1.json。
- MILESTONE_8_1_REPORT.md。
- artifacts/m8-1-manual-*.png與milestone-8-1-*.png。

## Files modified

- src/systems/PartySystem.ts：Leader／stable reorder／fallback。
- src/battle/PartyBattleSession.ts：每場初始Leader及回World恢復Leader；Battle switch規則不變。
- src/systems/SaveSystem.ts：deserialize fallback及Continue summary。
- src/scenes/TitleScene.ts：Continue portrait對齊Leader。
- src/scenes/WorldScene.ts：World入口／empty／all-fainted安全、prepareParty modal cleanup、Leader HP hint。
- src/ui/WorldPartyUI.ts：正式Party selection／actions／Status及single-modal cleanup。
- e2e/milestone5.spec.ts、e2e/milestone8.spec.ts：上述fixture精化，用例／断言保留。
- index.html、README.md、UI_GUIDE.md：08.1進度、操作及架構說明。

未修改package／lockfile、CreatureInstance欄位、Starter IDs／選擇畫面、battle formula、HPgrowth、skills／evolution data、地圖、EncounterTable或Reserve功能。

## Known issues／limits

- 沒有Reserve管理，Status只看Party，最多5人。
- 設隊首的autosave在關閉modal回World後發生；若仍開著Party就直接reload，尚未checkpoint的選擇可能未保存。正常Save→refresh／Continue已驗證。
- slot0昏倒時自動提升first alive，因此失去出戰能力的原隊首不會保持永久置頂；治療後不自動撤銷這次fallback，使用者可再明確setLeader。
- 沒有isStarterPartner旗標或身分顯示，沒有改四Starter；留給Milestone9。
- Empty／all-fainted raw Save仍沿用M8 invalid-save policy，不改validator；runtime recovery安全。
- Placeholder美術／缺正式音效、Phaser大chunk提示仍為既有狀態。沒有為本階段進行engine rewrite或UI redesign。
- Git尚無commit，不能以Git diff區分全部歷史untracked檔案；本报告明列本次修改。沒有GitHub／remote／merge／tag／release。

## Recommendation for first GitHub snapshot

目前不要執行GitHub操作。建議未來首次snapshot以完整M1～8.1專案為baseline，清楚註明425Unit／72Edge、schema1及三種save fixtures，附M8 balance report與8.1手動QA紀錄。

收錄src／public assets／tests／e2e／fixtures／scripts／package.json／lockfile／configs／README／guides／Milestone reports，挑選代表性QA截圖。沿用.gitignore排除node_modules、dist、test-results、playwright-report、logs；不要把私人localStorage紀錄當fixture。

可先建立local baseline commit，建議名稱 `m8.1 overworld party management and creature status`；因目前全部untracked，該首次commit會包含既有完整專案，而非只宣稱8.1差異。只有使用者日後明確授權GitHub工作階段，才建立remote或push。這些都是建議，本次未執行。

本階段完成後停止，不開始Milestone9。
