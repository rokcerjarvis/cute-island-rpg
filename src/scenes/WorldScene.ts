import Phaser from 'phaser';
import { createWorldMap, isSolid, TILE_SIZE } from '../data/world';
import { Player } from '../entities/Player';
import { ExplorationTracker } from '../systems/ExplorationTracker';
import { EncounterSystem } from '../systems/EncounterSystem';
import { encounterTables, entityDefinitions, regionEncounterZones } from '../data/encounters';
import { createBattleEntry, type WorldReturnState } from '../entities/BattleEntity';
import type { RuntimeGameState } from '../state/RuntimeGameState';
import { PartySystem } from '../systems/PartySystem';
import { expForLevel } from '../systems/ExperienceSystem';
import { creatures } from '../data/creatures';
import { WorldPartyUI } from '../ui/WorldPartyUI';
import { BossSystem, BOSS_ZONE, inBossZone, completionSummary, shouldUpgradeCamp } from '../systems/BossSystem';
import { advancePlayTime } from '../systems/PlayTimeSystem';
import { SaveSystem, requestAutoSave } from '../systems/SaveSystem';
import { BrowserLocalStorageAdapter } from '../systems/StorageAdapter';
import { DexSystem, dexDefinitions } from '../systems/DexSystem';
import { WorldPresentation, tileTexture } from '../presentation/WorldPresentation';

const REGION_NAMES: Record<string, string> = { camp: '營地', meadow: '草原', pond: '小水池', forest: '森林', 'deep-forest': '森林深處', 'special-cute-grass': '森林深處', 'boss-area': '巨木空地' };

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private exploration!: ExplorationTracker;
  private encounters!: EncounterSystem;
  private battlePending = false;
  private runtime!: RuntimeGameState;
  private partyUI!: WorldPartyUI;
  private readonly boss = new BossSystem();
  private bossEntryHandled = false;
  private lastStepId = 0;
  private campDecoration!: Phaser.GameObjects.Container;
  private bossMarker!: Phaser.GameObjects.Image;
  private presentation!: WorldPresentation;
  private saves = new SaveSystem(new BrowserLocalStorageAdapter());
  private wasInCamp = true;
  constructor() { super('WorldScene'); }
  create(): void {
    this.battlePending = false;
    this.bossEntryHandled = false; this.lastStepId = 0;
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = import.meta.env.DEV && params.get('debugEncounters') === '1';
    const debugKeys = 'F1,F2,F3,F4,F5,F6,F7,F8,F9,F10,F11,F12';
    let forceNext = false;
    let debugEntity = params.get('entity') ?? 'CUTE_005';
    let debugLevel = Math.max(1, Math.min(50, Math.floor(Number(params.get('encounterLevel')) || 10)));
    const forceEncounter = () => { forceNext = true; };
    const map = createWorldMap();
    this.runtime = this.registry.get('game-state');
    if (!this.runtime?.party.length) { this.scene.start('TitleScene'); return; }
    if (debugEnabled) { this.input.keyboard?.addCapture(debugKeys); this.input.keyboard!.on('keydown-F2', forceEncounter); }
    this.registry.set('game-state', this.runtime);
    this.wasInCamp = this.runtime.playerWorldPosition.x < 320;
    this.encounters = new EncounterSystem(undefined, this.runtime);
    const party = new PartySystem(this.runtime);
    if (!this.runtime.party.some(m => m.currentHp > 0)) { party.healAll(); this.runtime.playerWorldPosition = { ...map.spawn, zoneId: 'camp' }; }
    party.prepareLeader();
    const prepareEvolution = () => {
      const evolution = entityDefinitions[party.active.creatureId].evolution;
      if (!evolution || party.active.level >= 50) return;
      const level = Math.max(party.active.level + 1, evolution.level);
      party.active.currentExp = expForLevel(level) - 1;
      this.partyUI?.notify(`DEBUG：下一次成功結算後進入 Lv.${level} 進化流程。`);
    };
    if (debugEnabled && params.get('forceEvolution') === '1') prepareEvolution();
    this.physics.world.setBounds(0, 0, map.width, map.height);
    const obstacles = this.physics.add.staticGroup();
    for (const tile of map.tiles) {
      const x = (tile.column + 0.5) * TILE_SIZE;
      const y = (tile.row + 0.5) * TILE_SIZE;
      if (isSolid(tile.kind)) obstacles.create(x, y, tileTexture(tile));
      else this.add.image(x, y, tileTexture(tile));
    }
    for (const [name, x, y] of [['CAMP', 160, 245], ['MEADOW', 470, 470], ['POND', 475, 145], ['FOREST', 930, 90], ['DEEP WOODS', 920, 795]] as const) {
      this.add.text(x, y, name, { fontFamily: 'monospace', fontSize: '12px', color: '#eae9bc', backgroundColor: '#3c6047', padding: { x: 6, y: 4 } }).setOrigin(0.5);
    }
    this.player = new Player(this, this.runtime.playerWorldPosition.x, this.runtime.playerWorldPosition.y);
    this.presentation = new WorldPresentation(this, { x: BOSS_ZONE.left + 48, y: BOSS_ZONE.top + 25 });
    this.bossMarker = this.presentation.boss; this.campDecoration = this.presentation.camp.setVisible(this.runtime.bossDefeated);
    this.physics.add.collider(this.player, obstacles);
    const camera = this.cameras.main;
    camera.setBounds(0, 0, map.width, map.height);
    camera.startFollow(this.player, true, 1, 1);
    const regionText = this.add.text(14, 12, '', { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '14px', color: '#fff4d7', backgroundColor: '#253e31', padding: { x: 10, y: 7 } }).setScrollFactor(0).setDepth(10000);
    this.add.text(626, 14, debugEnabled ? 'DEBUG · F2 遭遇 / F4 EXP / F5 HP / F6 隊伍 / F7 營地' : 'P 查看隊伍 / 營地 E 休息', { fontSize: '10px', color: '#fff4d7', backgroundColor: '#253e31', padding: { x: 8, y: 6 } }).setOrigin(1, 0).setScrollFactor(0).setDepth(10000);
    this.exploration = new ExplorationTracker(map, event => {
      this.presentation.step(event.tile, event.stepId);
      regionText.setText(`${REGION_NAMES[event.tile.regionId]}${event.encounterEligible ? ' · 草叢' : ''}`);
      this.events.emit('exploration:tile-entered', event);
      this.lastStepId = event.stepId;
      if (event.stepId > 0) this.runtime.isDirty = true;
      this.runtime.playerWorldPosition.zoneId = regionEncounterZones[event.tile.regionId] ?? event.tile.regionId;
      const zoneId = regionEncounterZones[event.tile.regionId];
      const table = encounterTables[zoneId];
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      if (!table || this.battlePending || !this.encounters.shouldEncounter({ ...event, moved: event.stepId > 0 && body.velocity.lengthSq() > 0 }, table.encounterChance, forceNext)) return;
      const enemy = forceNext && entityDefinitions[debugEntity] && table.entries.some(entry => entry.entityId === debugEntity)
        ? entityDefinitions[debugEntity] : this.encounters.rollEncounter(table, entityDefinitions, forceNext);
      forceNext = false;
      const world: WorldReturnState = { x: this.player.x, y: this.player.y, zoneId, stepId: event.stepId };
      const entry = createBattleEntry(enemy, this.encounters.rollLevel(table), world);
      this.battlePending = true;
      clearInput();
      if (!this.prepareParty(party, map.spawn)) return;
      this.presentation.transition(enemy.kind, () => { this.scene.launch('BattleScene', entry); this.scene.sleep(); });
    });
    // Prevent stuck movement after switching away from the browser.
    const clearInput = () => {
      this.input.keyboard?.resetKeys(); if (this.player.body) this.player.setVelocity(0, 0);
      // Physics may have advanced since the last scene update; checkpoint the visible position.
      this.runtime.playerWorldPosition.x = this.player.x; this.runtime.playerWorldPosition.y = this.player.y;
    };
    const save = () => { const success = this.saves.save(this.runtime); this.partyUI.notify(success ? '冒險紀錄已保存。' : '儲存失敗。'); this.presentation.savedIndicator(success); return success; };
    const checkpoint = () => { const result = this.saves.checkpoint(this.runtime); if (result !== undefined) { this.partyUI.notify(result ? '冒險紀錄已保存。' : '儲存失敗。'); this.presentation.savedIndicator(result); } };
    this.partyUI = new WorldPartyUI(this, party, clearInput, { save, title: () => { clearInput(); this.scene.start('TitleScene'); }, healed: checkpoint, debug: debugEnabled });
    const openDebug = () => {
      const actions = [
        { label: '立即測試遭遇', name: 'debug-encounter', action: () => {
          const definition = entityDefinitions[debugEntity]; if (!definition || definition.boss) return;
          clearInput(); if (!this.prepareParty(party, map.spawn)) return;
          const entry = createBattleEntry(definition, debugLevel, { x: this.player.x, y: this.player.y, zoneId: this.runtime.playerWorldPosition.zoneId, stepId: this.lastStepId });
          this.battlePending = true; this.presentation.transition(definition.kind, () => { this.scene.launch('BattleScene', entry); this.scene.sleep(); });
        } },
        { label: `切換生物：${entityDefinitions[debugEntity]?.name}`, name: 'debug-entity', action: () => { const ids = ['CUTE_001','CUTE_002','CUTE_003','CUTE_004','CUTE_005','MON_001','MON_002']; debugEntity = ids[(ids.indexOf(debugEntity) + 1) % ids.length]; openDebug(); } },
        { label: `遭遇等級 Lv.${debugLevel}（+1）`, name: 'debug-level', action: () => { debugLevel = debugLevel % 50 + 1; openDebug(); } },
        { label: '下場邀請成功', name: 'debug-capture-success', action: () => this.registry.set('debug-capture', 'success') },
        { label: '下場邀請失敗', name: 'debug-capture-failure', action: () => this.registry.set('debug-capture', 'failure') },
        { label: '下場可愛事件（循環）', name: 'debug-cute', action: () => { const events = ['SLEEP','CHARM','FART','CUTE_POSE']; const i = this.registry.get('debug-event-index') ?? 0; this.registry.set('debug-cute-event', events[i]); this.registry.set('debug-event-index', (i + 1) % 4); this.partyUI.notify(`下場可愛事件：${events[i]}`); } },
        { label: '下一場結算升級', name: 'debug-exp', action: () => { if (party.active.level < 50) party.active.currentExp = expForLevel(party.active.level + 1) - 1; this.runtime.isDirty = true; } },
        { label: '準備進化', name: 'debug-evolution', action: prepareEvolution },
        { label: '前往完整 Boss', name: 'debug-boss', action: () => { this.registry.set('debug-full-boss', true); (this.player.body as Phaser.Physics.Arcade.Body).reset(BOSS_ZONE.left + 20, BOSS_ZONE.top + 32); clearInput(); } },
        { label: '重置 Boss', name: 'debug-reset-boss', action: () => { this.runtime.bossDefeated = this.runtime.firstAreaComplete = this.runtime.campUpgradeSeen = this.runtime.campCompletionShown = false; this.bossEntryHandled = false; this.runtime.isDirty = true; } },
        { label: '恢復隊伍', name: 'debug-heal', action: () => { party.healAll(); checkpoint(); } },
        { label: '填滿隊伍', name: 'debug-fill-party', action: () => { while (this.runtime.party.length < 5) party.acquire(creatures[this.runtime.party.length % creatures.length], 5, 999); } },
        { label: '圖鑑', name: 'debug-dex', action: () => this.partyUI.showDex() },
        { label: '儲存', name: 'debug-save', action: () => { save(); } },
        { label: '清除 Save（先確認）', name: 'debug-clear', action: () => this.partyUI.confirmClearSave(() => { this.partyUI.notify(this.saves.delete() ? '紀錄已刪除。' : '刪除失敗。'); this.runtime.isDirty = true; }) },
        { label: '回營地', name: 'debug-camp', action: () => { (this.player.body as Phaser.Physics.Arcade.Body).reset(map.spawn.x, map.spawn.y); clearInput(); } },
        { label: '補充邀請道具', name: 'debug-invite-stock', action: () => { this.runtime.inventory = { CAPTURE_ITEM_001: 10, INVITE_LUXURY: 3, INVITE_BRIBE: 2 }; this.runtime.isDirty = true; this.partyUI.notify('DEBUG：點心與友情資金已補充。'); } },
        { label: '同級 Boss QA 同伴', name: 'debug-boss-companions', action: () => { for (const index of [2, 4]) if (this.runtime.party.length < 5) party.acquire(creatures[index], party.active.level, 999); this.partyUI.notify('DEBUG：同級兔兔、飛鼠加入隊伍。'); } },
      ]; this.partyUI.debug('DEBUG · F1 / Esc 關閉', actions);
    };
    if (this.runtime.worldFeedback) { this.partyUI.notify(this.runtime.worldFeedback); this.runtime.worldFeedback = undefined; }
    const handledMenuKeys = new WeakSet<KeyboardEvent>();
    const menuKey = (event: KeyboardEvent) => {
      if (event.repeat || handledMenuKeys.has(event)) return;
      handledMenuKeys.add(event);
      if (this.battlePending) return;
      if (debugEnabled && event.key === 'F1' && !this.partyUI.isOpen) { openDebug(); return; }
      this.partyUI.key(event, this.player.x, this.player.y);
      if (!debugEnabled || event.repeat || this.partyUI.isOpen) return;
      if (/^F\d+$/.test(event.key) || (event.code === 'KeyB' && event.shiftKey)) this.runtime.isDirty = true;
      if (event.key === 'F4' && party.active.level < 50) {
        const requestedTarget = Number(params.get('expTarget') ?? party.active.level + 1);
        const target = Math.max(party.active.level + 1, Math.min(50, Number.isFinite(requestedTarget) ? Math.floor(requestedTarget) : party.active.level + 1));
        party.active.currentExp = expForLevel(target) - 1;
        this.partyUI.notify(`DEBUG：下一次結算會升到至少 Lv.${target}。`);
      } else if (event.key === 'F5') { party.active.currentHp = 1; party.active.status = 'OK'; this.partyUI.notify('DEBUG：出戰小可愛 HP 設為 1。'); }
      else if (event.key === 'F6') { while (this.runtime.party.length < 5) party.acquire(creatures[this.runtime.party.length % creatures.length], 5, 999); this.partyUI.notify('DEBUG：隊伍已填滿 5 / 5。'); }
      else if (event.key === 'F7') { (this.player.body as Phaser.Physics.Arcade.Body).reset(map.spawn.x, map.spawn.y); clearInput(); this.partyUI.notify('DEBUG：回到營地，可按 E 休息。'); }
      else if (event.key === 'F8') prepareEvolution();
      else if (event.key === 'F9') { (this.player.body as Phaser.Physics.Arcade.Body).reset(BOSS_ZONE.left - 14, BOSS_ZONE.top + 32); clearInput(); this.partyUI.notify('DEBUG：向右走入巨大身影所在空地。'); }
      else if (event.key === 'F10') { this.runtime.bossDefeated = this.runtime.firstAreaComplete = this.runtime.campUpgradeSeen = false; this.runtime.campCompletionShown = false; this.bossEntryHandled = false; this.partyUI.notify('DEBUG：Boss 已重置。'); }
      else if (event.key === 'F11') { this.runtime.pureCuteMissCount = this.runtime.pureCuteMissCount >= 20 ? 0 : 20; this.partyUI.notify('DEBUG：PURE_CUTE pity 已切換提高 / 重置。'); }
      else if (event.key === 'F12') { const dex = new DexSystem(this.runtime.dex); for (const definition of dexDefinitions) { if (this.runtime.dex[definition.id] === 'UNKNOWN') dex.seen(definition.id); else dex.captured(definition.id); } this.partyUI.notify('DEBUG：圖鑑 UNKNOWN→SEEN→CAPTURED。'); }
      else if (event.code === 'KeyB' && event.shiftKey) { this.runtime.bossDefeated = this.runtime.firstAreaComplete = true; requestAutoSave(this.runtime); checkpoint(); this.partyUI.notify('DEBUG：Boss 已完成。'); }
    };
    this.input.keyboard!.on('keydown', menuKey);
    const wake = (_sys: Phaser.Scenes.Systems, state: WorldReturnState) => {
      (this.player.body as Phaser.Physics.Arcade.Body).reset(state.x, state.y);
      clearInput();
      this.encounters.onBattleReturn(state.stepId);
      this.battlePending = false;
      this.presentation.returned();
      this.runtime.playerWorldPosition = { x: state.x, y: state.y, zoneId: state.zoneId };
      if (this.runtime.worldFeedback) { this.partyUI.notify(this.runtime.worldFeedback); this.runtime.worldFeedback = undefined; }
      checkpoint();
    };
    // Sleeping preserves the map, camera, tracker and static collision bodies.
    this.events.on(Phaser.Scenes.Events.WAKE, wake);
    this.game.events.on(Phaser.Core.Events.BLUR, clearInput);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (debugEnabled) this.input.keyboard?.removeCapture(debugKeys);
      this.presentation.destroy(); this.time.removeAllEvents(); this.tweens.killAll();
      this.game.events.off(Phaser.Core.Events.BLUR, clearInput);
      this.events.off(Phaser.Scenes.Events.WAKE, wake);
      this.input.keyboard?.off('keydown-F2', forceEncounter);
      this.input.keyboard?.off('keydown', menuKey);
    });
  }
  update(_time: number, delta: number): void {
    if (!this.runtime.party.length) { this.partyUI.close(); this.scene.start('TitleScene'); return; }
    if (this.battlePending) { this.player.setVelocity(0, 0); return; }
    this.partyUI.update(this.player.x, this.player.y);
    const member = this.runtime.party[0]; if (member) this.presentation.leader(member.currentHp, member.maxHp);
    if (this.partyUI.isOpen) { this.player.setVelocity(0, 0); return; }
    advancePlayTime(this.runtime, delta, !document.hidden);
    this.player.update();
    this.runtime.playerWorldPosition.x = this.player.x;
    this.runtime.playerWorldPosition.y = this.player.y;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.exploration.update(body.center.x, body.center.y);
    if (this.battlePending) return;
    this.campDecoration.setVisible(shouldUpgradeCamp(this.runtime)); this.bossMarker.setVisible(!this.runtime.bossDefeated);
    if (!inBossZone(body.center.x, body.center.y)) this.bossEntryHandled = false;
    if (!this.bossEntryHandled && this.boss.shouldTrigger(this.runtime, body.center.x, body.center.y)) {
      this.bossEntryHandled = true;
      this.partyUI.prompt('前面好像有什麼很大的東西……', ['巨型森林怪擋在空地前方。', '準備好後，確認挑戰。'], () => {
        const params = new URLSearchParams(window.location.search);
        const debug = import.meta.env.DEV && params.get('debugEncounters') === '1';
        const debugHp = debug && !this.registry.get('debug-full-boss') && params.has('bossHp') ? Number(params.get('bossHp')) : undefined;
        this.registry.remove('debug-full-boss');
        const entry = this.boss.entry({ x: this.player.x, y: this.player.y, zoneId: 'BOSS_AREA', stepId: this.lastStepId }, debugHp);
        this.battlePending = true; this.input.keyboard?.resetKeys(); this.player.setVelocity(0, 0);
        if (!this.prepareParty(new PartySystem(this.runtime), createWorldMap().spawn)) return;
        this.presentation.transition('BOSS', () => { this.scene.launch('BattleScene', entry); this.scene.sleep(); });
      });
    } else if (this.runtime.bossDefeated && !this.runtime.campCompletionShown && this.player.x < 10 * TILE_SIZE) {
      this.runtime.campCompletionShown = true;
      this.runtime.campUpgradeSeen = true; requestAutoSave(this.runtime);
      this.partyUI.prompt('第一區開拓完成！', completionSummary(this.runtime).filter(line => line !== '第一區開拓完成！'));
    }
    const inCamp = this.player.x < 320;
    if (inCamp && !this.wasInCamp) requestAutoSave(this.runtime);
    this.wasInCamp = inCamp;
    const saved = this.saves.checkpoint(this.runtime);
    if (saved !== undefined) { this.partyUI.notify(saved ? '冒險紀錄已保存。' : '儲存失敗。'); this.presentation.savedIndicator(saved); }
  }
  private prepareParty(party: PartySystem, spawn: { x: number; y: number }): boolean {
    this.partyUI.close();
    if (!this.runtime.party.length) { this.battlePending = false; this.scene.start('TitleScene'); return false; }
    if (this.runtime.party.some(m => m.currentHp > 0)) { party.prepareLeader(); return true; }
    party.healAll(); party.ensureActive(); (this.player.body as Phaser.Physics.Arcade.Body).reset(spawn.x, spawn.y);
    this.runtime.playerWorldPosition = { ...spawn, zoneId: 'camp' }; this.battlePending = false;
    this.partyUI.notify('同伴們都昏倒了，先回營地休息。'); return false;
  }
}
