# Milestone 7 — Visual Integration, World Presentation & Gameplay Polish

狀態：完成。停止於 Milestone 7，未開始 Milestone 8。

## Baseline

- Git status 已檢查；原專案全部 untracked，沒有現成 commit，branch 為 master。保留工作與分支，未 reset、merge、tag 或 push。
- 原 unit tests：264 / 264 PASS。
- 原 Edge：31 / 31 PASS（46.6秒），含 Save / Continue / Boss persistence / corrupt save。
- 原 TypeScript 0 errors，Build 成功。
- schemaVersion=1，本 Milestone 沒有 persistent data 變更，不升版；SaveSystem / migration / storage adapter 不重寫。
- 沒有新增依賴或下載正式美術／大型音訊。

## Final Verification

| 項目 | 結果 |
| --- | --- |
| npm test | 319 / 319 PASS，原264 + 新55，7個 test files |
| Edge | 45 / 45 PASS，原31 + 新14；完整回歸約1.7分鐘 |
| TypeScript | 0 errors（npm run typecheck，亦包含於 build） |
| Build | 成功，50 modules，主 JS 1,284.73 kB / gzip 346.88 kB |
| Save compatibility | M6 v1 fixture unit / Edge PASS；schema 保持1 |
| Asset files | 29張 PNG，共9,678 bytes；所有 manifest path 存在 |

Build 保留原 Phaser bundle >500kB 提示，未因本次範圍做大型 code splitting / 引擎 rewrite。原 unit 與 Edge 的 gameplay / Save 断言完整保留。原 Edge 只調整真實新 UI 的選單位置、PURE_CUTE 確認與動畫等待。

## Asset Integration — 7A / 7B

AssetManifest 集中 key / path / fallback / player sheet，Boot preload 一次。Creature Definition 連結 battleSpriteKey / worldSpriteKey / portraitKey，目前允許三者共用同一 PNG。

| 類別 | 完成內容 |
| --- | --- |
| Player | 28×28、4方向×3 walk frames，小頭身短手腳／簡單背包；idle 保持最後 facing |
| Cute Creatures | 五張40×40：圓耳／藍貓／長兔耳／栗子外殼／大尾巴 silhouette，非纯色矩形 |
| Monsters | 黑團蟲／紅色大嘴／獨立64×64森林Boss |
| Evolutions | 大吉伊與超級飛鼠有獨立體型／冠飾與 portrait |
| Attributes | 水滴、火焰、土石、風線、粉色 heart PURE_CUTE |
| Fallback | 未知 key 使用 fallback；載入失敗建立可辨識程序 face silhouette，不 crash |

PNG 由 scripts/generate-pixel-assets.mjs 原創程序繪製，不聲稱正式授權角色美術。public/assets 結構涵蓋 characters / creatures / battle / world / ui / audio；音效與 frame/effect 後續替換目錄預留。

pixelArt / roundPixels / nearest、FIT / CENTER_BOTH 保留，camera zoom=1。玩家原12×10腳部 body、offset8/16、速度96、WASD／Arrow四方向、邊界／障礙與Camera follow不改。footstep presentation hook 依step回報草叢／地面SFX key。

## World — 7C / 7N

- Camp：原帳篷保留，加入營火、箱子；通關增加小木屋、攤位、木箱與短道路裝飾，無 builder / NPC / 資源功能。
- Grassland：原一般地面、路與遇敵草叢辨識清楚；少量 flower decorations 不增加 collider。
- Forest Depths：深處地面／草叢色調更暗、密集樹冠與原單格窄路；淺森林保持較亮，區別高等區。地圖 topology / collider / Encounter Table 不改。
- Special Cute Grass：小白點／粉花的 subtle grass texture，使用原小範圍區域，不標示稀有草。
- Boss Arena：原開闊 path 空地顯示巨型森林怪 world sprite；shake / Boss transition 突出入場。
- 治療提示僅距離72px內且無modal時出現；zone banner 1.5秒；低HP / 昏倒出戰者文字提示，不持續閃爍。
- 全隊昏倒時不進普通 battle：安全回營地治療；有活著同伴時沿用 ensureActive 選第一隻活著的。
- Auto save 右上短暫「已儲存」1600ms，無modal。原手動成功／失敗提示保留。

## Encounter — 7D

- Normal：240ms fade，草叢有效step／chance／weights／Lv／cooldown全部沿用。
- Monster：fade + 短輕 shake。
- PURE_CUTE：每次240ms transition後顯示固定對話「這是什麼？上網查一下！」，待 Enter / Space 或滑鼠確認才播放 Intro；Esc不能略過，不是 only-first flag。
- Boss：既有World確認 → 獨立較強shake / Boss SFX hook → battle；Intro顯示「巨型森林怪擋住了去路！」。
- Intro：敵從右、玩家從左下滑入，260ms。transition／intro期間鎖住行動，World sleep / wake 保留位置與世界狀態。

## Battle UI — 7E

Enemy右上、Player左下、底部對話＋2×2command panel，使用一致青綠／米白frame。

- HUD：名稱、Lv、Attribute icon、HP值／bar；normal >50%、warning20～50%、danger<20%。0 / overheal ratio clamp。
- 野生可收容標記、Monster不顯示capture、Boss顯示BOSS；Enemy sprite完整可見，Player HUD不遮蓋。
- Skill Menu最多4，名稱／Power／Accuracy／Category，高亮顯示effect；無Skill Attribute。
- Keyboard方向鍵焦點，Enter / Space確認，原1～5保留；Esc back。Mouse點擊與hover焦點可用。
- 固定reusable dialogue與history，400ms queue；Enter / Space加快但不產生新turn，不永久建立每句Text。
- learning / forced switch / evolution lock與原engine rules保留。

## Animations — 7F

- Idle：1px bob。
- Attack：向對手lunge後回位，Quick更快、Heavy幅度較大。
- Hit：短horizontal shake與tint，clearTint；HP bar平滑更新。
- Miss：仍attack，defender dodge，原「但是沒有打中！」文字。
- Heal：jump / sparkle，HP bar平滑回復。
- Defend：縮成一團scaleY；裝死scale / tilt，再復位。
- Faint：下沉／fade，KO後不播放另一方action。

BattleManager僅追加純資料 VisualEvent（actor、skill、hit、HP before/after、Cute）；沒有Scene／sprite／timing，原傷害、AI、亂數調用、捕捉、EXP、進化不重寫。renderer不重新擲RNG或計算傷害。

## PURE_CUTE — 7G

- Sleep：稍下沉、floating Z、HUD Zzz；下次睡眠action事件仍可播Z。
- Charm：sway / heart，ATK↓；既有0.8倍率與作用對象保留。
- Fart：灰綠pixel puff、原放屁台詞，增加「還假裝什麼都沒發生。」；SPD↓，無噁心寫實。
- Cute Pose：1→1.1→1 pulse、heart / sparkle與原HP回復。
- Cute event必須在damaging hit animation完成後才播放，順序有unit與Edge trace驗證。

## Capture — 7H

- Throw：獨立球icon沿弧線從Player側飛向Wild，wild flash / shrink。
- Sequence：收進去 → shake1 → shake2 →結果，保持快節奏。
- Success：不播放敵人action，加入Party或Reserve、原HP／EXP資料保留。
- Failure：恢复wild sprite後才播放enemy action。
- Monster reject：原文字、沒有完整capture animation、不消耗turn。

## Evolution — 7I

- 吉伊卡哇→大吉伊、飛鼠→超級飛鼠均完成。
- 深色背景、舊sprite silhouette / flash / scale、新sprite、結果文字。
- 先完成原EXP／學招、再套用原進化邏輯；Esc不略過，Enter / Space可加快結果文字。
- Battle sprite、Party portrait、Dex portrait由新creatureId同步更新；source Dex保留Captured、target Captured。

## UI — 7J / 7K / 7L

- Party：五固定slots與空框、portrait、Lv／HP／attribute、HP bar，首slot LEAD、出戰★，FAINTED dim，Reserve數量。無新排序／交換功能。
- Dex：Unknown ? 空框、Seen dim silhouette、Captured完整portrait／可點detail，七species與PURE flavor完整保留。
- Title：營地／森林遠景，保留既有遊戲名，Continue leader portrait + summary，260ms fade，無Save仍disabled。
- Starter：四個portrait與屬性／定位／HP／Attack／Speed，確認／返回；一般Starter沒有飛鼠。
- 可快速load，無多餘loading modal；Title transition提供等待與input lock。

## Audio — 7M

AudioManager提供playSfx、playMusic、stopMusic、setVolume。14個要求的SFX與FOOTSTEP_GROUND、四個music key定義／hook完成。缺音檔全部no-op，沒有生成或下載大型音訊。

沒有音量設定UI／新的persistent settings，不升版Save。World轉場停止自己的music，返回恢復；Scene shutdown清理music。素材對應詳ASSET_GUIDE。

## Save Compatibility — 7O

- Existing Save：Milestone 6 schema1繼續有效，fixture正確load／roundtrip，未serialize視覺資料。
- Continue：Party、HP／Lv／EXP／skills、Reserve、position、pity、Dex都保留。
- Boss / Camp：旗標決定Boss world sprite是否存在、木屋／攤位可見、完成提示是否已看過；reload不重生。
- Evolution：載入EVO_001 / 002解析正確portrait／battle key。
- M6的壞檔／quota／dirty return／position safety／checkpoint仍由原tests驗證。

## Performance / Cleanup — 7P

- Boot統一preload，不重載已存在texture／animation。
- World shutdown卸除WAKE／BLUR／keyboard；UI不在body銷毀後再setVelocity。
- Battle shutdown取消queue timer、keyboard、idle／effect／scene tweens與music。
- 暫時sparkle、puff、ball、evolution物件會destroy；dialogue物件reuse。
- 原fixed Desktop scale保留。Enter / Space／arrow prevent default；debug flag下function keys capture，避免F1 Help／F5 Refresh妨礙工具，退出World移除debug capture。

## New Tests — 7Q / 7R

55 unit：十species mapping、manifest唯一／檔案、player sheet、fallback、HUD ratio／color、skills、Boss／capture／PURE icon、focus／animation lock、action／miss／heal／defend／faint event、Cute順序、capture成功／失敗／拒絕、M6 fixture、Audio no-op、MessageQueue advance / cleanup。

14新Edge：

- O：transition／intro、keyboardskill、lock、damage、faint、victoryreturn。
- P ×4：PURE確認不能自動／Esc略過、Sleep／Charm／Fart／Pose在HIT之後。
- Q ×3：傷害後throw／兩shake／成功、失敗後enemy、Monster拒絕無動畫。
- R ×2：兩條進化、Esc lock、sprite swap／Party／Dex。
- S：完整80HP Boss、sprite／胜利／Camp／Save／Reload。
- T：五slots、World移動lock、Party／Dex不重疊、Save後恢復移動。
- M6 fixture Continue：schema1、Reserve進化species、Camp旗標。
- 全隊faint安全恢復、normal網址F1無Debug。

原31項Edge断言保留，未刪除測試湊數。

## Manual QA — 7S

除test suite外，代理使用獨立Edge context與5193 QA origin，逐步鍵盤／滑鼠與截圖檢查；沒有操作使用者5187的Save，也沒有為人工Boss注入RNG。Windows computer-use helper等待Chrome授權逾時、IAB canvas key API不可用，因此使用隔離Edge頁面完成逐畫面UI操作，方法與自動assert suite分開。

| QA | 實際操作／觀察 |
| --- | --- |
| New Game | Title背景 → New → 四個Starter portraits →确认 → World；既有紀錄覆蓋確認 |
| Normal Battle | 戳鼻子／hit／faint／勝利；縮成一團與嗚啦；兔兔裝死tilt、玩家heavy skill；Boss natural Miss與重擊 |
| Capture | F1下場failure／success，弧線球／收進／shake／释放／加入Reserve，查看五格Party與收容1隻 |
| PURE_CUTE | 每次固定確認；Z／heart／puff／pose sparkle，HP／ATK↓／SPD↓；另實際操作owned Sleep的下一次行動，顯示還在睡覺／跳過後遭敵人擊倒；分別保存motion與結果截圖 |
| Evolution | 吉伊卡哇Lv14→15→大吉伊；飛鼠Lv17→18→超級飛鼠；深色silhouette、新圖、Party／Dex、Source與Target狀態 |
| Full Boss | 正常Lv11 / 80HP Boss；玩家吉伊卡哇Lv25（dev setup）、Party5、滿75HP；未降BossHP、未注入RNG，三回合HP80→44→5→0，Boss首回合Miss、次回合造成53傷害，玩家剩22HP，胜利 |
| Save / Continue | Boss勝利auto save →首次Camp upgrade →Refresh →Title summary已完成→Continue，木屋／攤位仍在；进化后Party／Dex可見 |
| Existing Save | 獨立M6格式fixtureunit + Edge Continue驗證；沒有覆蓋使用者舊檔 |
| World visual | Camp前／後、森林密樹／窄路／Boss空地／微白草點，以及固定UI與Camera分離 |

QA不是聲稱由真人操作者完成；上述為代理按畫面逐步操作／觀看。隨機setup以明確dev工具準備，Boss damage / miss / turn使用正常RNG。

截圖位於artifacts/：manual-title、manual-starters、manual-world、manual-battle-layout-final、manual-defend、manual-heal、manual-feign-animation、manual-heavy-animation、manual-heavy-result、manual-capture-shake／failure／success、manual-party、manual-pure-prompt、manual-cute-*-motion／結果、manual-evolution-screen／chiikawa／flying、manual-evolution-party、manual-super-flying-party、manual-dex、manual-boss-80hp／turn-1／turn-2／victory、manual-continue-title、manual-camp-continued、manual-forest等。

對話與效果瞬間短暫，結果截圖有時為敵人後續句子；motion截圖與完整unit／Edge順序断言一併驗證，未以結果畫面宣稱所有動畫瞬間都存在。

## Optional Reserve — 7T

Skipped。本次完成視覺／presentation與v1相容，Reserve保留數量與存讀；不新增Party移出／換入、active id調整及交換UI。避免把資料操作功能混入展示Milestone，留待下一次明確範圍。

## Debug — 7U

dev + debugEncounters=1才有F1面板：立即測試Encounter、species／Lv、下場capture成功／失敗、循環Cute Event、EXP、evolution、完整Boss（即使URL bossHp=1也覆蓋為完整）、reset、heal、fill、Dex、Save、先確認清檔、回Camp。

原F2～F12與query tools保留，F10仍resetBoss。F1直接Encounter為明確debugoverride；一般草叢規則完全不变。force Cute Event由下一個符合条件的PURE攻擊者（玩家或野生）消耗，不能强制非PURE或KO触发。

## Known Issues / Scope

- 全部是可替換placeholder，非正式美術。音樂／音效只有架構與hooks，現階段無聲音檔。
- Phaser大bundle提示保留；Desktop為主，較矮browser pane可能須捲動，沒有mobile port。
- Save為同profile／origin的單一localStorage槽，沒有云端／exe／file adapter；不保存未完成Battle／evolution。
- 只有原兩條等級進化、PURE事件與原技能；没有Defense、PP、Critical、新Status／經濟／第二區／第二Boss／新species／網路功能。
- Reserve swap未實作，摘要與資料保存完整。

## Files Added / Modified — 7V / 7W

新增：

- public/assets/：29 PNG與預留目錄。
- scripts/generate-pixel-assets.mjs。
- src/presentation/AssetManifest.ts、AudioManager.ts、ViewModels.ts、BattlePresentation.ts、MessageQueue.ts、WorldPresentation.ts。
- tests/milestone7.test.ts、tests/fixtures/milestone6-save-v1.json。
- e2e/milestone7.spec.ts。
- ASSET_GUIDE.md、UI_GUIDE.md、MILESTONE_7_REPORT.md。
- artifacts/：新visual integration與逐畫面QA截圖。

修改：

- CreatureDefinition與creatures / monsters / evolutions：visual mapping，stats／learnset不變。
- BootScene / Player：集中preload、spritesheet、falling back／keyboardcapture，原movement模型保留。
- BattleManager / CuteEventSystem / PartyBattleSession：純資料presentation events、Fart额外台詞；原運算／RNG／結果保留。
- BattleScene：原session與menu邏輯接presentation／intro／dialogue／keyboard焦點／cleanup。
- WorldScene：region texture／decoration／transition／safety／indicator／Debug hooks。
- WorldPartyUI：五slots／Dex portraits／detail／Heal prompt／Debug／shutdown safety。
- e2e/helpers.ts及原五個milestone spec files：新UI／确认／动画等待，断言保留；M6 spec亦更新。
- README.md、index.html。

Git原無commit且整個既有專案untracked，本次保留目前master工作，不把既有M1～6全部檔案冒充M7 commit。未merge / tag / push。

## Suggested Milestone 8

可聚焦最小Reserve管理與Party整理、對active／容量／存讀的明確測試；或正式sprite／音效替換與展示平衡。等待使用者指定，本次不開始。
