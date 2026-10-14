# Pixel Asset Guide

素材根目錄為 `public/assets/`，瀏覽器路徑為 `/assets/`。Milestone 7 使用原創程序像素 placeholder PNG，不依賴外部下載或 image service。正式素材可沿用 key 替換，無須修改戰鬥計算或 Save。

## Pipeline

- 集中 manifest：`src/presentation/AssetManifest.ts`。
- 產生來源：`scripts/generate-pixel-assets.mjs`，`node scripts/generate-pixel-assets.mjs` 重建本次 29 張 PNG。
- BootScene preload 一次；存在的 texture 不重載、已存在的 animation 不重建。
- PNG 載入失敗：Boot 建立有臉部 silhouette 的 fallback；未知 species / texture key 使用 `asset-fallback`。
- 不將 sprite key 保存到 CreatureInstance 或 SaveData，按 creatureId 查 Definition / manifest。schema 維持 v1。

## Structure / Naming

| 目錄 | 內容／慣例 |
| --- | --- |
| characters/player | player-overworld.png，3 columns × 4 rows |
| creatures/cute | cute_001.png～cute_005.png |
| creatures/evolutions | evo_001.png、evo_002.png |
| creatures/monsters | mon_001.png～mon_003.png |
| world/tiles | forest-ground、forest-grass、forest-tree、special-grass |
| world/objects | campfire、crate、cabin、stall |
| battle/backgrounds | battle-background、title-background |
| battle/effects | 保留給未來特效；目前以短暫 tween / pixel shape 表現 |
| ui/icons | asset-fallback、pixel-sparkle；capture-ball 保留為未使用的 legacy asset |
| ui/attributes | water、fire、earth、wind、pure_cute |
| ui/frames | 預留；本次 UI frame 使用 Scene rectangles |
| audio/sfx、audio/music | 預留，沒有大型音訊資產 |

Species 的 battleSpriteKey / worldSpriteKey / portraitKey 目前共用 `creature-<lowercase id>`。每種 silhouette 不同：圓耳／藍貓耳／長兔耳／栗子外殼／大尾巴；進化追加體型／識別，三種怪物與 Boss 分別使用獨立 PNG。

## Recommended Dimensions

| 類型 | 原始像素尺寸 |
| --- | --- |
| Player frame | 28×28，3 walk frames / direction |
| Player sheet | 84×112；Down、Up、Left、Right 依列排列 |
| Cute / Evolution / small Monster | 40×40 |
| Boss | 64×64 |
| World tile | 32×32 |
| Camp object | 32×32；cabin 64×64 |
| Attribute / item icon | 16×16 |
| Background | 320×180，對應 640×360 的 2 倍顯示 |

玩家動畫以 0→1→0→2，8 fps 播放；idle 保留最後 facing 的第一 frame。不得為替換圖片修改 Player 的 12×10 foot body、offset 8/16、速度或四方向 input resolver。

## Pixel Scale / Origin

- Phaser pixelArt=true、roundPixels=true，CSS image-rendering=pixelated。
- World camera zoom 維持 1；UI 的 fixed scroll factor 與 world camera 分離。Phaser FIT / CENTER_BOTH 保留 Desktop 比例。
- Battle actor origin=(0.5,1)，圖像底部為腳部定位；world / portrait origin=(0.5,0.5)。
- 常規 Battle sprite 顯示 2 倍；64 px Boss 為 1.5 倍以適合場景。UI 小頭像會按 slot 尺寸 fit，全部 nearest-neighbor，無平滑濾鏡。
- 正式素材建議相同畫布大小、透明 padding 與底部腳點；不應用修改邏輯能力值或 collider 來修圖片。

## Transparent PNG Rules

- RGBA PNG，背景 alpha=0，角色輪廓不放純白底。
- 避免半透明抗鋸齒輪廓、jpeg 壓縮、模糊縮放與高解析圖片自動 downsample。
- 角色臉／耳／尾／物種輪廓需在縮成 24～30 px portrait 時仍可辨識。
- 各屬性使用獨立 UI icon。PURE_CUTE 為粉色 heart，不能當作另一種自然元素。
- 程式 tween 可以 tint / flash / scale sprite；hit 不能以換 texture 冒充受傷 frame。

## Audio Hook Keys

AudioManager 提供 playSfx / playMusic / stopMusic / setVolume，缺少 cache audio 時為 no-op。

SFX：UI_CONFIRM、UI_CANCEL、FOOTSTEP_GRASS、FOOTSTEP_GROUND、ENCOUNTER、BATTLE_ATTACK、BATTLE_HIT、CAPTURE_THROW、CAPTURE_SUCCESS、CAPTURE_FAIL、LEVEL_UP、EVOLUTION、PURE_CUTE、BOSS_INTRO、HEAL。

Music：TITLE_THEME、WORLD_THEME、BATTLE_THEME、BOSS_THEME。未提供真實音檔；沒有音量設定 UI 或新的 persistent settings，沒有因此升版 Save。
