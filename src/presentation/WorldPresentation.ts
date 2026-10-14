import Phaser from 'phaser';
import type { WorldTile } from '../data/world';
import { TEXTURES, creatureVisual } from './AssetManifest';
import { AudioManager } from './AudioManager';
import { PRESENTATION_TIMING, THEME } from './ViewModels';
export const REGION_LABELS: Record<string, string> = { camp: '營地', meadow: '草原', pond: '小水池', forest: '森林', 'deep-forest': '森林深處', 'special-cute-grass': '森林深處', 'boss-area': '巨木空地' };
export function tileTexture(tile: WorldTile): string {
  if (tile.kind === 'grass') return tile.regionId === 'special-cute-grass' ? TEXTURES.specialGrass : tile.regionId === 'deep-forest' ? TEXTURES.forestGrass : TEXTURES.grass;
  if (tile.kind === 'ground' && tile.regionId === 'deep-forest') return TEXTURES.forestGround;
  if (tile.kind === 'tree') return TEXTURES.forestTree;
  return tile.kind;
}
export class WorldPresentation {
  readonly camp: Phaser.GameObjects.Container;
  readonly boss: Phaser.GameObjects.Image;
  private readonly zone: Phaser.GameObjects.Text;
  private readonly saved: Phaser.GameObjects.Text;
  private readonly partyHint: Phaser.GameObjects.Text;
  private zoneTimer?: Phaser.Time.TimerEvent;
  private saveTimer?: Phaser.Time.TimerEvent;
  private region = '';
  readonly audio: AudioManager;
  constructor(private readonly scene: Phaser.Scene, bossPosition: { x: number; y: number }) {
    this.audio = new AudioManager(scene); this.audio.playMusic('WORLD_THEME');
    scene.add.image(191, 354, TEXTURES.fire).setName('camp-fire').setDepth(354);
    scene.add.image(130, 370, TEXTURES.crate).setDepth(370); scene.add.image(165, 379, TEXTURES.crate).setDepth(379);
    for (const [x, y] of [[400,460],[645,482],[520,770],[848,575],[920,820]]) {
      scene.add.rectangle(x, y, 4, 4, 0xf0d5ac); scene.add.rectangle(x + 4, y + 2, 3, 3, 0xceaaac);
    }
    this.camp = scene.add.container(0, 0, [scene.add.image(272, 305, TEXTURES.cabin), scene.add.image(190, 331, TEXTURES.stall), scene.add.image(290, 366, TEXTURES.crate), scene.add.rectangle(273, 347, 27, 9, 0xc9b27c)]).setName('camp-upgrade');
    this.boss = scene.add.image(bossPosition.x, bossPosition.y, creatureVisual('MON_003').worldSpriteKey).setScale(0.85).setName('boss-marker').setDepth(bossPosition.y);
    this.zone = scene.add.text(320, 48, '', { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '20px', color: THEME.text, backgroundColor: '#29483e', padding: { x: 20, y: 8 } }).setOrigin(0.5).setScrollFactor(0).setDepth(10000).setName('zone-banner');
    this.saved = scene.add.text(624, 47, '', { fontSize: '12px', color: '#d4e5b4', backgroundColor: '#29483e', padding: { x: 8, y: 4 } }).setOrigin(1, 0).setScrollFactor(0).setDepth(10002).setName('autosave-indicator');
    this.partyHint = scene.add.text(14, 310, 'P · 隊伍', { fontSize: '12px', color: THEME.text, backgroundColor: '#29483e', padding: { x: 7, y: 4 } }).setScrollFactor(0).setDepth(10000).setName('party-shortcut');
    this.saved.setVisible(false);
  }
  step(tile: WorldTile, stepId: number): void {
    const label = REGION_LABELS[tile.regionId];
    if (this.region !== label) { this.region = label; this.zoneTimer?.remove(); this.zone.setText(label).setVisible(true); this.zoneTimer = this.scene.time.delayedCall(1500, () => this.zone.setVisible(false)); }
    if (stepId > 0) { const key = tile.kind === 'grass' ? 'FOOTSTEP_GRASS' : 'FOOTSTEP_GROUND'; this.audio.playSfx(key); this.scene.events.emit('presentation:footstep', { stepId, key }); }
  }
  leader(hp: number, max: number): void { this.partyHint.setText(hp <= 0 ? 'P · 出戰同伴昏倒' : hp / max < 0.25 ? 'P · 同伴 HP 偏低' : 'P · 隊伍').setColor(hp / max < 0.25 ? '#edba9c' : THEME.text); }
  savedIndicator(success: boolean): void { this.saveTimer?.remove(); this.saved.setText(success ? '已儲存' : '儲存失敗').setVisible(true); this.saveTimer = this.scene.time.delayedCall(1600, () => this.saved.setVisible(false)); }
  transition(kind: 'CUTE_CREATURE' | 'MONSTER' | 'BOSS', done: () => void): void {
    this.audio.playSfx(kind === 'BOSS' ? 'BOSS_INTRO' : 'ENCOUNTER');
    this.scene.events.emit('presentation:encounter', { kind, duration: PRESENTATION_TIMING.encounter });
    if (kind !== 'CUTE_CREATURE') this.scene.cameras.main.shake(100, kind === 'BOSS' ? 0.008 : 0.003);
    this.scene.cameras.main.fadeOut(PRESENTATION_TIMING.encounter, 24, 49, 39);
    this.scene.time.delayedCall(PRESENTATION_TIMING.encounter, () => { this.audio.stopMusic(); done(); });
  }
  returned(): void { this.scene.cameras.main.fadeIn(180, 24, 49, 39); this.audio.playMusic('WORLD_THEME'); }
  destroy(): void { this.zoneTimer?.remove(); this.saveTimer?.remove(); this.audio.destroy(); }
}
