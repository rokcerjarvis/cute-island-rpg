# UI / Presentation Architecture

遊戲固定 640×360 邏輯畫布，以 FIT / CENTER_BOTH 適應 Desktop；所有視覺 timing 與座標在 presentation / Scene UI，計算系統不含動畫、sprite 座標或 tween。

## Layers

| 模組 | 責任 |
| --- | --- |
| AssetManifest | key / PNG path / creature mapping / fallback |
| ViewModels | HUD / HP ratio / color、技能資訊、焦點移動、presentation timing、input lock |
| BattleManager | 原有戰鬥規則與 HP 計算；額外回報純資料 action / cute events |
| BattlePresentation | Sprite / HUD / HP bar、intro、attack、hit、miss、heal、defend、cute、invitation、evolution |
| MessageQueue | 一個可繼續的對話 queue，定時或 Enter / Space 前進 |
| WorldPresentation | 純裝飾、zone banner、footstep hook、轉場、HP 提示、autosave indicator |
| WorldPartyUI | 單一世界 modal：menu / Party / member actions / Status / Dex / detail / Heal / Boss / completion / dirty return / Debug |
| CreatureStatusView | 唯讀stat／EXP threshold／技能category與既有進化view model、member navigation |
| AudioManager | 缺檔 no-op 的音效／音樂 hook |

## Battle Layout

- Enemy HUD 右上 (306,14)：名稱／Lv、屬性 icon、HP bar、HP 值、可邀請 / MONSTER / BOSS 標記。
- Enemy sprite 右側，脚點 (535,182)。Player sprite 左下，脚點 (112,216)；Player HUD 在其右方 (196,145)，避免遮到敵方 silhouette。
- Dialogue panel (16,218)～(624,279)，一個 visible Text 顯示最新訊息；一個 hidden reusable history Text 存最近五句供狀態檢查，沒有逐句永久物件。
- 底部 2×2 commands：戰鬥／道具／隊伍／逃跑。技能最多四格，沒有 Skill Attribute；選中技能時在對話框顯示 Power / Accuracy / Effect。
- Battle Party switch 保留正常／強制換人rules，僅改active，不重排健康Leader。World Party五格有portrait／attribute／HPbar、LEAD隊首、昏倒dim、Reserve數量；hover／鍵盤gold border，選同伴開設隊首／狀態／返回。
- Status維持同一608×300深綠面板：左portrait／HP／Attack／Speed／進化，右Attribute／PUREflavor／EXP／進度bar／最多4招。Power0显示特殊效果。底部前一位／下一位／返回，沒有額外input listener。

## Modal Priorities / Locks

1. 未確認 PURE_CUTE 對話，不能選 command，也不能 Esc 略過。
2. Intro / turn animation / queued text / evolution 期間鎖定行動；Enter / Space 僅加快文字，不執行新 turn。
3. pending learning / evolution / forced switch 必須完成，不能先返回或儲存。
4. World encounter transition 鎖住 movement / menu，完成後 sleep World、啟用 Battle。
5. 世界任何面板存在時停止 movement / encounters；Esc 只關閉目前面板。沒有面板才開 Game Menu。
6. 每個 native keyboard event 只處理一次，避免 Phaser event queue 導致重複開／關。

## Keyboard / Mouse

- Battle：方向鍵在 2×2 command／skill grid 移動；Party list 為單列。Enter / Space 確認；數字 1～5 保留；Esc 返回上一層，MAIN 時逃跑（Boss 除外）。
- 戰鬥結束 Enter / Space 或返回按鈕回 World。
- Title / Starter：方向鍵選擇，Enter / Space 或滑鼠確認；已有 Save 必須先确认 New Game 覆蓋。
- World：WASD / arrows 保留四方向；P管理隊伍，↑↓選同伴、Enter操作；Status←→循環，Enter無動作，Esc回Party，P關閉。E / Space僅治療點附近互動，Esc選單，S維持移動。
- World Menu 可用方向鍵／Enter／Space／數字／滑鼠。Dex Captured row 可點開 detail，detail Enter / Esc 回列表；列表 Enter / Esc 關閉。
- Dev + debugEncounters=1：F1 開 18 格 Debug Panel，方向鍵／Enter／滑鼠操作。新增邀請道具補充及同級 Boss QA 同伴。F10 保持原 reset Boss。

## Timing / Sequence

| 演出 | 時間／順序 |
| --- | --- |
| Encounter | 240ms fade；monster 輕 shake，Boss 更明確 shake + Boss SFX hook |
| Title transition | 260ms fade，期間避免重複操作 |
| Battle intro | 260ms；敵方從右、玩家從左下進入 |
| Text | 每句 400ms；Enter / Space 可立即前進一則 |
| Attack | Quick 80ms / Stable 110ms / Heavy 150ms 向前，再回位 |
| Hit | 45ms ×多次短 shake，tint 後清除；HP bar 180ms tween |
| Heal / Defend | 小幅 jump 或 scale / tilt，再回原位 |
| Cute | 必須在 damage animation 結束後；Z / heart / pixel puff / pose，約180～360ms |
| Invitation | 玩家側點心／錢袋 → 250ms 展示 → 220ms 靠近 → 280ms 觀察 → 成功向玩家走430ms／失敗搖頭退回；失敗後才播放敵方 action |
| Evolution | 深色背景、原 sprite silhouette 1600ms →套用原 evolution logic →新 sprite 500ms →結果文字 |

所有 gameplay action 仍由原引擎先完整結算。presentation event 保存各 action 的 HP 前／後數據，renderer 依順序顯示，不重算傷害或重新擲 RNG。對話加速不重算 turn，Esc 不跳過 evolution logic。

## Cleanup / Save

- Battle shutdown：卸下 keyboard、取消 queue timer、銷毀 audio／idle，清除 scene timers / tweens；下一場 create 新 view。
- World sleep 保留地圖／camera／collision；wake 清輸入、返回原位置、fade in、保留原 cooldown。
- World shutdown 卸下 WAKE / BLUR / keyboard handlers；UI 不在 physics body 已銷毀後呼叫移動操作。
- World UI 子物件自己設 scrollFactor=0，不能只依賴 parent container 的屬性。
- schemaVersion=1，M8 inventory 可選欄位補入 backward-compatible default；sprites 與 UI state 不持久化。重載時依 creatureId、Boss／營地 flag 決定畫面。
- 8.1 Leader=party[0]，沿用陣列Save；健康Leader不因戰鬥switch改變，fainted slot0才提升first alive。設定隊首request一次checkpoint，查看頁面不mark dirty、不request Save。
- 自動存檔顯示右上「已儲存」1600ms，無 modal；原底部存檔文字也保留。壞檔／quota failure 原處理保留。
