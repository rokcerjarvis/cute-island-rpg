import Phaser from 'phaser';
import type { BattleManager } from '../battle/BattleManager';
import { skills } from '../data/skills';
import { ATTRIBUTE_KEYS, creatureVisual, TEXTURES, availableTexture } from './AssetManifest';
import { AudioManager } from './AudioManager';
import { hpView, PRESENTATION_TIMING, THEME, type VisualEvent } from './ViewModels';
export class BattlePresentation {
  readonly sprites: Phaser.GameObjects.Image[];
  readonly hpTexts: Phaser.GameObjects.Text[] = [];
  readonly names: Phaser.GameObjects.Text[] = [];
  readonly attributes: Phaser.GameObjects.Text[] = [];
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private icons: Phaser.GameObjects.Image[] = [];
  private base = [{ x: 112, y: 216, scale: 2 }, { x: 535, y: 182, scale: 2 }];
  private idle: Phaser.Tweens.Tween[] = [];
  private effect?: Phaser.GameObjects.Text;
  private disposed = false;
  readonly trace: string[] = [];
  constructor(private readonly scene: Phaser.Scene, manager: BattleManager, private readonly audio = new AudioManager(scene)) {
    if (manager.isBoss) this.base[1].scale = 1.5;
    scene.add.image(320, 180, TEXTURES.background).setScale(2).setDepth(-20);
    scene.add.ellipse(112, 211, 138, 19, 0x55745c).setAlpha(0.7); scene.add.ellipse(535, 177, manager.isBoss ? 165 : 140, 22, 0x5b795d).setAlpha(0.7);
    this.sprites = [manager.player, manager.enemy].map((entity, i) => scene.add.image(this.base[i].x, this.base[i].y, this.key(entity.definition.id)).setOrigin(0.5, 1).setScale(this.base[i].scale).setName(i ? 'enemy-sprite' : 'player-sprite'));
    [manager.player, manager.enemy].forEach((entity, i) => {
      const x = i ? 306 : 196, y = i ? 14 : 145, width = i ? 308 : 284;
      scene.add.rectangle(x + width / 2, y + 33, width, 66, THEME.panel).setStrokeStyle(2, THEME.border).setAlpha(0.96).setDepth(5);
      this.names.push(scene.add.text(x + 12, y + 6, '', { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '17px', color: THEME.text }).setDepth(6));
      this.icons.push(scene.add.image(x + 17, y + 40, ATTRIBUTE_KEYS[entity.definition.attribute]).setDepth(6));
      this.attributes.push(scene.add.text(x + 31, y + 32, '', { fontSize: '10px', color: THEME.muted, wordWrap: { width: 72, useAdvancedWrap: true }, lineSpacing: -2 }).setDepth(6));
      scene.add.rectangle(x + 111, y + 44, 126, 7, 0x142b26).setOrigin(0, 0.5).setDepth(6);
      this.bars.push(scene.add.rectangle(x + 111, y + 44, 126, 7, THEME.normal).setOrigin(0, 0.5).setDepth(7).setName(i ? 'enemy-hp-bar' : 'player-hp-bar'));
      this.hpTexts.push(scene.add.text(x + 111, y + 49, '', { fontSize: '10px', color: THEME.text }).setDepth(7).setName(i ? 'enemy-hp' : 'player-hp'));
    });
    scene.add.text(602, 70, manager.isBoss ? 'BOSS' : manager.enemy.definition.kind === 'CUTE_CREATURE' ? '● 可邀請' : 'MONSTER', { fontSize: '10px', color: THEME.text }).setOrigin(1, 0).setDepth(8).setName('enemy-kind-marker');
    scene.add.rectangle(320, 248, 608, 61, THEME.panel).setStrokeStyle(2, THEME.border).setDepth(10);
    scene.add.rectangle(320, 311, 608, 61, 0x213d35).setStrokeStyle(2, THEME.border).setDepth(10);
    this.sync(manager); this.resumeIdle();
  }
  private key(id: string): string { return availableTexture(creatureVisual(id).battleSpriteKey, key => this.scene.textures.exists(key)); }
  sync(manager: BattleManager, updateHp = true): void {
    [manager.player, manager.enemy].forEach((entity, i) => {
      this.sprites[i].setTexture(this.key(entity.definition.id)); this.icons[i].setTexture(ATTRIBUTE_KEYS[entity.definition.attribute]);
      this.names[i].setText(`${entity.definition.name} Lv.${entity.level}`);
      this.attributes[i].setText(`${entity.definition.attribute}${entity.effects.attackMultiplier < 1 ? ' ATK↓' : ''}${entity.effects.speedMultiplier < 1 ? ' SPD↓' : ''}${entity.effects.skipNextAction ? ' Zzz' : ''}`);
      if (updateHp) this.hp(i, entity.hp, entity.maxHp);
    });
  }
  private hp(index: number, current: number, max: number): void {
    const view = hpView(current, max); this.hpTexts[index].setText(`HP ${Math.max(0, current)} / ${max}`); this.bars[index].setFillStyle(view.color);
    this.scene.tweens.add({ targets: this.bars[index], width: 126 * view.ratio, duration: 180 });
  }
  intro(done: () => void): void {
    this.pauseIdle(); this.trace.push('INTRO');
    this.sprites[0].setPosition(-50, this.base[0].y + 20); this.sprites[1].setX(710);
    this.scene.tweens.add({ targets: this.sprites[0], x: this.base[0].x, y: this.base[0].y, duration: PRESENTATION_TIMING.intro });
    this.scene.tweens.add({ targets: this.sprites[1], x: this.base[1].x, duration: PRESENTATION_TIMING.intro, onComplete: () => { this.resumeIdle(); done(); } });
  }
  play(events: VisualEvent[], manager: BattleManager, done: () => void): void {
    this.pauseIdle(); this.effect?.destroy();
    const next = (index: number) => {
      if (this.disposed) return;
      if (index >= events.length) { this.sync(manager); this.resumeIdle(); done(); return; }
      const event = events[index], callback = () => next(index + 1); this.trace.push(event.type === 'CUTE' ? event.event : event.type);
      if (event.type === 'CAPTURE') { this.capture(event.success, event.item ?? 'SNACK', manager.enemy.definition.name, callback); return; }
      const actor = event.side === 'player' ? 0 : 1, target = 1 - actor;
      if (event.type === 'SLEEP') { this.cute(actor, 'SLEEP', callback); return; }
      if (event.type === 'CUTE') { this.cute(actor, event.event, () => { if (event.event === 'CUTE_POSE') this.hp(actor, event.hp, actor ? manager.enemy.maxHp : manager.player.maxHp); callback(); }); return; }
      const skill = skills[event.skillId], sprite = this.sprites[actor];
      this.audio.playSfx('BATTLE_ATTACK');
      if (skill.power > 0) {
        const duration = skill.category === 'QUICK' ? 80 : skill.category === 'HEAVY' ? 150 : 110;
        this.scene.tweens.add({ targets: sprite, x: this.base[actor].x + (actor ? -1 : 1) * (skill.category === 'HEAVY' ? 18 : 10), duration, yoyo: true, onComplete: () => {
          if (!event.hit) { this.trace.push('MISS'); this.scene.tweens.add({ targets: this.sprites[target], x: this.base[target].x + 8, duration: 100, yoyo: true, onComplete: callback }); return; }
          this.trace.push('HIT'); this.audio.playSfx('BATTLE_HIT'); this.sprites[target].setTint(0xffd5bc);
          this.hp(target, event.targetAfterHp, target ? manager.enemy.maxHp : manager.player.maxHp);
          this.scene.tweens.add({ targets: this.sprites[target], x: this.base[target].x + 4, duration: 45, yoyo: true, repeat: 2, onComplete: () => {
            this.sprites[target].clearTint();
            if (event.targetAfterHp <= 0) { this.trace.push('FAINT'); this.scene.tweens.add({ targets: this.sprites[target], alpha: 0, y: this.base[target].y + 12, duration: 160, onComplete: callback }); } else callback();
          } });
        } });
      } else if (event.hit && skill.effect === 'HEAL_20_PERCENT') {
        this.trace.push('HEAL'); this.audio.playSfx('HEAL'); this.sparkle(actor, '✦');
        this.hp(actor, event.actorAfterHp, actor ? manager.enemy.maxHp : manager.player.maxHp);
        this.scene.tweens.add({ targets: sprite, y: this.base[actor].y - 6, duration: 160, yoyo: true, onComplete: callback });
      } else {
        this.trace.push(event.hit ? 'DEFEND' : 'MISS');
        this.scene.tweens.add({ targets: sprite, scaleY: this.base[actor].scale * (skill.effect === 'DAMAGE_REDUCTION_70' ? 0.5 : 0.7), angle: skill.effect === 'DAMAGE_REDUCTION_70' ? 16 : 0, duration: 140, yoyo: true, onComplete: callback });
      }
    };
    this.sync(manager, false); next(0);
  }
  private sparkle(actor: number, text: string): void {
    const p = this.base[actor]; const item = this.scene.add.text(p.x + 14, p.y - 70, text, { fontSize: '22px', color: '#f7d3ab' }).setDepth(9).setName('cute-effect');
    this.scene.tweens.add({ targets: item, y: item.y - 14, alpha: 0, duration: 480, onComplete: () => item.destroy() });
  }
  private cute(actor: number, event: string, done: () => void): void {
    this.audio.playSfx('PURE_CUTE'); const p = this.base[actor], sprite = this.sprites[actor];
    if (event === 'SLEEP') { this.sparkle(actor, 'Z'); this.scene.tweens.add({ targets: sprite, y: p.y + 3, duration: 180, yoyo: true, onComplete: done }); }
    else if (event === 'CHARM') { this.sparkle(actor, '♥'); this.scene.tweens.add({ targets: sprite, angle: 8, duration: 90, yoyo: true, repeat: 1, onComplete: done }); }
    else if (event === 'FART') {
      const puff = this.scene.add.container(p.x + 25, p.y - 18, [this.scene.add.rectangle(-4, 0, 9, 7, 0x99a48a), this.scene.add.rectangle(4, -4, 7, 10, 0xb5bc9c)]).setName('cute-puff');
      this.scene.tweens.add({ targets: puff, x: puff.x + 15, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 300, onComplete: () => { puff.destroy(); done(); } });
    } else { this.sparkle(actor, '♥ ✦'); this.scene.tweens.add({ targets: sprite, scaleX: p.scale * 1.1, scaleY: p.scale * 1.1, duration: 180, yoyo: true, onComplete: done }); }
  }
  private capture(success: boolean, item: 'SNACK' | 'LUXURY' | 'BRIBE', species: string, done: () => void): void {
    const money = item === 'BRIBE', enemy = this.sprites[1];
    this.trace.push(money ? 'BRIBE_MONEY' : 'INVITE_OFFER');
    // Generic bag stays at the player side; it never contains a creature.
    const bag = this.scene.add.container(185, 181, [this.scene.add.rectangle(0, 0, 26, 23, money ? 0xd8b756 : item === 'LUXURY' ? 0xac729c : 0xb58b60), this.scene.add.rectangle(0, -14, 20, 5, 0xf3dfa9), this.scene.add.text(0, 0, money ? '$' : '✦', { fontSize: '17px', color: '#fff0d0' }).setOrigin(0.5)]).setDepth(9).setName('invitation-offer');
    const caption = this.scene.add.text(320, 111, money ? '你拿出了錢。' : '你拿出了點心。', { fontSize: '16px', color: THEME.text, backgroundColor: '#213d35', padding: { x: 8, y: 5 } }).setOrigin(0.5).setDepth(9).setName('invitation-caption');
    this.scene.time.delayedCall(250, () => {
      caption.setText(money ? `${species} 盯著錢看。` : `${species} 靠近觀察。`);
      this.trace.push(money ? 'BRIBE_LOOK' : 'INVITE_OBSERVE');
      this.scene.tweens.add({ targets: enemy, x: 490, duration: 220, onComplete: () => this.scene.time.delayedCall(280, () => {
        this.trace.push(success ? 'CAPTURE_SUCCESS' : 'CAPTURE_FAIL'); this.audio.playSfx(success ? 'CAPTURE_SUCCESS' : 'CAPTURE_FAIL');
        caption.setText(success ? `${species} 願意跟你走了！` : `${species} 還不願意同行。`);
        if (success) {
          this.sparkle(1, '♥ ✦'); this.trace.push('INVITE_JOIN');
          this.scene.tweens.add({ targets: enemy, x: 215, y: 206, duration: 430, onComplete: () => { bag.destroy(); caption.destroy(); enemy.setAlpha(0); done(); } });
        } else {
          this.trace.push('INVITE_DECLINE');
          this.scene.tweens.add({ targets: enemy, angle: 8, duration: 70, yoyo: true, repeat: 1, onComplete: () => this.scene.tweens.add({ targets: enemy, x: this.base[1].x, duration: 200, onComplete: () => { bag.destroy(); caption.destroy(); done(); } }) });
        }
      }) });
    });
  }
  evolution(beforeId: string, targetId: string, swap: () => void, done: () => void): void {
    this.pauseIdle(); this.audio.playSfx('EVOLUTION'); this.trace.push('EVOLUTION');
    const bg = this.scene.add.rectangle(320, 180, 640, 360, 0x132820).setDepth(40).setName('evolution-background');
    const ghost = this.scene.add.image(320, 235, this.key(beforeId)).setOrigin(0.5, 1).setScale(3).setTint(0x10231b).setDepth(41).setName('evolution-silhouette');
    const label = this.scene.add.text(320, 80, '咦……？\n樣子好像怪怪的！', { fontSize: '22px', color: THEME.text, align: 'center' }).setOrigin(0.5).setDepth(42);
    this.scene.tweens.add({ targets: ghost, alpha: 0.4, scaleX: 3.4, scaleY: 3.4, duration: 200, yoyo: true, repeat: 3 });
    this.scene.time.delayedCall(PRESENTATION_TIMING.evolution, () => {
      swap(); ghost.setTexture(this.key(targetId)).clearTint().setScale(3).setAlpha(1); this.trace.push('SPRITE_SWAP'); label.setText('進化完成！');
      this.scene.time.delayedCall(500, () => { ghost.destroy(); bg.destroy(); label.destroy(); this.sprites[0].setAlpha(1); this.resumeIdle(); done(); });
    });
  }
  private pauseIdle(): void { this.idle.forEach(t => t.stop()); this.idle = []; this.sprites.forEach((s, i) => s.setPosition(this.base[i].x, this.base[i].y).setAngle(0)); }
  private resumeIdle(): void { if (!this.disposed) this.sprites.forEach((s, i) => { if (s.alpha > 0) this.idle.push(this.scene.tweens.add({ targets: s, y: this.base[i].y - 1, duration: 700 + i * 100, yoyo: true, repeat: -1 })); }); }
  destroy(): void { this.disposed = true; this.idle.forEach(t => t.stop()); this.effect?.destroy(); this.audio.destroy(); this.scene.tweens.killAll(); }
}
