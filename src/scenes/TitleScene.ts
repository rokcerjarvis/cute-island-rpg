import Phaser from 'phaser';
import { SaveSystem, formatPlayTime } from '../systems/SaveSystem';
import { BrowserLocalStorageAdapter } from '../systems/StorageAdapter';
import { createNewGameState, confirmStarter, createRuntimeGameState, STARTER_IDS, type RuntimeGameState } from '../state/RuntimeGameState';
import { createWorldMap } from '../data/world';
import { creatures } from '../data/creatures';
import { creatureRoles, DexSystem } from '../systems/DexSystem';
import { TEXTURES, creatureVisual, ATTRIBUTE_KEYS } from '../presentation/AssetManifest';
import { AudioManager } from '../presentation/AudioManager';
export class TitleScene extends Phaser.Scene {
  private saves = new SaveSystem(new BrowserLocalStorageAdapter());
  private draft?: RuntimeGameState;
  private controls: { item: Phaser.GameObjects.Text; action: () => void }[] = [];
  private selection = 0;
  private transitioning = false;
  private audio!: AudioManager;
  private back: () => void = () => this.title();
  constructor() { super('TitleScene'); }
  create(): void {
    this.registry.remove('game-state'); this.draft = undefined;
    this.transitioning = false; this.audio = new AudioManager(this); this.audio.playMusic('TITLE_THEME');
    this.cameras.main.setBackgroundColor('#213d35'); this.title();
    const params = new URLSearchParams(location.search);
    if (import.meta.env.DEV && params.get('debugEncounters') === '1' && STARTER_IDS.some(id => id === params.get('quickStarter')) && this.saves.inspect().status === 'EMPTY') {
      this.starters(); this.choose(params.get('quickStarter')!);
    }
    const handledKeys = new WeakSet<KeyboardEvent>();
    const key = (e: KeyboardEvent) => {
      if (this.transitioning || e.repeat || handledKeys.has(e)) return;
      handledKeys.add(e);
      if (e.key === 'Escape') this.back();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') this.focus(this.selection + 1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') this.focus(this.selection - 1);
      else if (e.key === 'Enter' || e.code === 'Space') this.controls[this.selection]?.action();
      else if (/^[1-4]$/.test(e.key)) this.controls[Number(e.key) - 1]?.action();
    };
    this.input.keyboard!.on('keydown', key);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.input.keyboard?.off('keydown', key); this.time.removeAllEvents(); this.tweens.killAll(); this.audio.destroy(); });
  }
  private page(title: string, lines: string[] = []): void {
    this.children.removeAll(true); this.controls = []; this.selection = 0;
    this.add.image(320, 180, TEXTURES.title).setScale(2).setDepth(-10);
    this.add.image(544, 153, TEXTURES.cabin).setScale(1.5).setDepth(-8);
    this.add.rectangle(320, 173, 612, 318, 0x213d35).setAlpha(0.8).setDepth(-5).setStrokeStyle(2, 0xa0ae85);
    this.add.text(28, 20, title, { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '24px', color: '#fff0d0' }).setName('title-heading');
    this.add.text(28, 60, lines.join('\n'), { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '15px', color: '#fff0d0', lineSpacing: 6 }).setName('title-summary');
    this.add.text(28, 337, '方向鍵選擇 · Enter / Space 確認 · Esc 返回 · 滑鼠可點擊', { fontSize: '12px', color: '#ddd9af' });
  }
  private button(name: string, label: string, x: number, y: number, action: () => void, enabled = true): void {
    const item = this.add.text(x, y, label, { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '17px', color: enabled ? '#fff0d0' : '#79877a', backgroundColor: '#476957', padding: { x: 12, y: 6 } }).setName(name);
    const guarded = () => { if (!this.transitioning) { this.audio.playSfx('UI_CONFIRM'); action(); } };
    if (enabled) { item.setInteractive({ useHandCursor: true }); item.on('pointerdown', guarded); item.on('pointerover', () => this.focus(this.controls.findIndex(c => c.item === item))); this.controls.push({ item, action: guarded }); }
    this.focus(0);
  }
  private focus(index: number): void { if (!this.controls.length) return; this.selection = (index + this.controls.length) % this.controls.length; this.controls.forEach((c, i) => c.item.setColor(i === this.selection ? '#ffe08d' : '#fff0d0')); }
  private title(): void {
    const inspection = this.saves.inspect();
    this.page('Pan & James · 狗狗猩猩大冒險', inspection.status === 'VALID' ? inspection.summary : inspection.status === 'INVALID' ? [inspection.error] : ['從營地出發，與小可愛一起開拓！']);
    this.back = () => this.title();
    this.button('title-new', '新遊戲', 28, 183, () => this.newGame());
    this.button('title-continue', '繼續遊戲', 190, 183, () => {
      const loaded = this.saves.load(); if (!loaded) { this.title(); return; }
      this.registry.set('game-state', loaded.state); this.fade(() => this.scene.start('WorldScene'));
    }, inspection.status === 'VALID');
    if (inspection.status === 'VALID') {
      const leader = inspection.data.party.find(c => c.currentHp > 0)!;
      this.add.image(548, 106, creatureVisual(leader.creatureId).portraitKey).setScale(2).setName('title-leader-portrait');
    }
    if (inspection.status === 'INVALID') {
      this.button('title-back', '返回', 28, 232, () => this.title());
      this.button('title-delete', '刪除紀錄', 190, 232, () => this.confirmDelete());
    }
    const params = new URLSearchParams(location.search);
    if (import.meta.env.DEV && params.get('debugEncounters') === '1') {
      this.button('debug-clear-save', 'DEBUG 清除 Save', 28, 280, () => this.confirmDelete());
      this.button('debug-test-save', 'DEBUG 測試 Save', 220, 280, () => {
        const state = createRuntimeGameState(createWorldMap().spawn); state.bossDefeated = state.firstAreaComplete = state.campUpgradeSeen = state.campCompletionShown = true;
        state.playTimeSeconds = 2538; const dex = new DexSystem(state.dex); dex.seen('CUTE_002'); dex.captured('CUTE_005');
        this.saves.save(state); this.title();
      });
      this.button('debug-corrupt-save', 'DEBUG 壞 JSON', 430, 280, () => { try { this.saves.adapter.write('{broken'); } catch { /* Title reports storage failure safely. */ } this.title(); });
    }
  }
  private confirmDelete(): void {
    this.page('刪除冒險紀錄？', ['刪除後無法恢復。']); this.back = () => this.title();
    this.button('delete-confirm', '確定刪除', 28, 190, () => { if (this.saves.delete()) this.title(); else this.page('刪除失敗。'); });
    this.button('delete-cancel', '取消', 230, 190, () => this.title());
  }
  private newGame(): void {
    if (this.saves.inspect().status !== 'EMPTY') {
      this.page('開始新遊戲？', ['已經有冒險紀錄，開始新遊戲會覆蓋原本進度。']); this.back = () => this.title();
      this.button('new-confirm', '確定', 28, 185, () => this.fade(() => this.starters()));
      this.button('new-cancel', '取消', 230, 185, () => this.title());
    } else this.fade(() => this.starters());
  }
  private starters(): void {
    this.draft = createNewGameState(createWorldMap().spawn);
    this.page('選擇初始小可愛'); this.back = () => { this.draft = undefined; this.title(); };
    creatures.slice(0, 4).forEach((d, i) => {
      const x = 28 + (i % 2) * 305, y = 86 + Math.floor(i / 2) * 108;
      this.add.image(x + 31, y + 27, creatureVisual(d.id).portraitKey).setScale(1.5);
      this.button(`starter-${d.id}`, `${d.name}`, x + 70, y, () => this.choose(d.id));
      this.add.image(x + 78, y + 51, ATTRIBUTE_KEYS[d.attribute]);
      this.add.text(x + 92, y + 43, `${d.attribute} · ${creatureRoles[d.id]}`, { fontSize: '12px', color: '#fff0d0' });
      this.add.text(x + 8, y + 75, `HP ${d.baseStats.hp} · ATK ${d.baseStats.attack} · SPD ${d.baseStats.speed}`, { fontSize: '12px', color: '#fff0d0' });
    });
  }
  private choose(id: string): void {
    if (!STARTER_IDS.some(s => s === id) || !this.draft) return;
    const d = creatures.find(c => c.id === id)!;
    this.page('確認同伴', [`要和 ${d.name} 一起開始開拓嗎？`, `${d.attribute} · ${creatureRoles[id]} · Lv.5`]); this.back = () => this.starters();
    this.add.image(530, 146, creatureVisual(id).portraitKey).setScale(2.4);
    this.button('starter-confirm', '確定', 28, 190, () => {
      confirmStarter(this.draft!, id);
      const params = new URLSearchParams(location.search); const debug = import.meta.env.DEV && params.get('debugEncounters') === '1';
      if (debug && (params.has('partyLevel') || params.has('partySpecies'))) {
        const level = Number(params.get('partyLevel') ?? 5); const species = params.get('partySpecies') ?? id;
        if (Number.isInteger(level) && level >= 1 && level <= 50 && creatures.some(d => d.id === species)) this.draft = createRuntimeGameState(createWorldMap().spawn, level, species);
      }
      this.registry.set('game-state', this.draft); this.fade(() => this.scene.start('WorldScene'));
    });
    this.button('starter-back', '返回', 230, 190, () => this.starters());
  }
  private fade(action: () => void): void {
    if (this.transitioning) return; this.transitioning = true; this.cameras.main.fadeOut(260, 24, 49, 39);
    this.time.delayedCall(260, () => { this.cameras.main.resetFX(); this.transitioning = false; action(); });
  }
}
