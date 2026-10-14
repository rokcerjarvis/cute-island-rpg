import type Phaser from 'phaser';
export const SFX_KEYS = ['UI_CONFIRM','UI_CANCEL','FOOTSTEP_GRASS','FOOTSTEP_GROUND','ENCOUNTER','BATTLE_ATTACK','BATTLE_HIT','CAPTURE_THROW','CAPTURE_SUCCESS','CAPTURE_FAIL','LEVEL_UP','EVOLUTION','PURE_CUTE','BOSS_INTRO','HEAL'] as const;
export const MUSIC_KEYS = ['TITLE_THEME','WORLD_THEME','BATTLE_THEME','BOSS_THEME'] as const;
export class AudioManager {
  private volume = 0.5;
  private music?: Phaser.Sound.BaseSound;
  constructor(private readonly scene?: Phaser.Scene) {}
  playSfx(key: string): void { if (this.scene?.cache.audio.exists(key)) this.scene.sound.play(key, { volume: this.volume }); }
  playMusic(key: string): void { this.stopMusic(); if (this.scene?.cache.audio.exists(key)) { this.music = this.scene.sound.add(key, { loop: true, volume: this.volume }); this.music.play(); } }
  stopMusic(): void { this.music?.stop(); this.music?.destroy(); this.music = undefined; }
  setVolume(value: number): void { this.volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : this.volume; if (this.music && 'setVolume' in this.music) (this.music as Phaser.Sound.WebAudioSound).setVolume(this.volume); }
  destroy(): void { this.stopMusic(); }
}
