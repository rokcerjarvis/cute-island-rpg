import Phaser from 'phaser';
import type { Direction } from '../systems/movement';
import { AssetManifest, PLAYER_ASSET, TEXTURES, playerFrame } from '../presentation/AssetManifest';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  preload(): void {
    for (const asset of AssetManifest) if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.path);
    if (!this.textures.exists(PLAYER_ASSET.key)) this.load.spritesheet(PLAYER_ASSET.key, PLAYER_ASSET.path, PLAYER_ASSET);
  }
  create(): void {
    this.input.keyboard?.addCapture('UP,DOWN,LEFT,RIGHT,ENTER,SPACE,ESC');
    const g = this.make.graphics({ x: 0, y: 0 });
    const rect = (color: number, x: number, y: number, w: number, h: number) => { g.fillStyle(color); g.fillRect(x, y, w, h); };
    const finish = (key: string, size = 32) => { g.generateTexture(key, size, size); g.clear(); };
    for (const asset of AssetManifest) if (!this.textures.exists(asset.key)) {
      rect(0x33493d, 4, 8, 24, 24); rect(0xfff0cf, 8, 12, 16, 16); rect(0x33493d, 11, 17, 3, 3); rect(0x33493d, 20, 17, 3, 3); finish(asset.key, 40);
    }
    rect(0x86ac68, 0, 0, 32, 32); rect(0x93b776, 3, 4, 3, 2); rect(0x779c5a, 22, 23, 4, 2); finish('ground');
    rect(0xd0b67b, 0, 0, 32, 32); rect(0xc1a369, 4, 8, 3, 2); rect(0xe0c48c, 22, 20, 5, 2); finish('path');
    rect(0x739a58, 0, 0, 32, 32);
    for (let y = 4; y < 32; y += 10) for (let x = 3; x < 32; x += 8) { rect(0x426f42, x, y, 2, 6); rect(0xa5bd72, x + 2, y + 2, 2, 3); }
    finish('grass');
    rect(0x5b9d9f, 0, 0, 32, 32); rect(0x8bc1b5, 3, 8, 12, 2); rect(0x72b3af, 17, 23, 11, 2); finish('water');
    rect(0x86ac68, 0, 0, 32, 32); rect(0x665d3d, 13, 20, 7, 12); rect(0x345942, 3, 10, 26, 14); rect(0x46754c, 6, 4, 20, 16); rect(0x618953, 10, 2, 12, 8); finish('tree');
    rect(0x86ac68, 0, 0, 32, 32); rect(0x667264, 5, 14, 23, 14); rect(0x9ca18a, 7, 10, 19, 14); rect(0xbfc0a1, 10, 10, 10, 4); finish('rock');
    rect(0x86ac68, 0, 0, 32, 32); rect(0x785e43, 2, 26, 28, 3); rect(0xe9d2a0, 4, 10, 24, 17); rect(0xf2dfb6, 9, 4, 14, 6); rect(0x514f3b, 13, 14, 7, 13); finish('tent');

    const directions: Direction[] = ['down', 'up', 'left', 'right'];
    for (const direction of directions) {
      for (let frame = 0; frame < 3; frame++) {
        if (!this.textures.exists(TEXTURES.player)) {
        // Large head, little arms and short legs: a toddler explorer placeholder.
        rect(0x476346, 5, 22, 15, 2);
        rect(0x765d45, 8, 23 - (frame === 1 ? 1 : 0), 4, 3);
        rect(0x765d45, 15, 23 - (frame === 2 ? 1 : 0), 4, 3);
        rect(0xe9bb91, 5, 16, 3, 5); rect(0xe9bb91, 20, 16, 3, 5);
        rect(0xd88559, 8, 15, 12, 9); rect(0xf2d2ac, 9, 2, 10, 2);
        rect(0xf2d2ac, 6, 4, 16, 11); rect(0xe6b78d, 8, 15, 12, 2);
        rect(0x735138, 9, 1, 8, 2); rect(0x735138, 7, 3, 3, 2);
        if (direction === 'up') { rect(0x735138, 6, 4, 16, 7); rect(0x937f53, 10, 16, 8, 6); }
        else {
          if (direction !== 'right') rect(0x423c36, 10, 8, 2, 2);
          if (direction !== 'left') rect(0x423c36, 17, 8, 2, 2);
          rect(0xd49879, 12, 12, 4, 1);
        }
        finish(playerFrame(direction, frame), 28);
        }
      }
      if (!this.anims.exists(`walk-${direction}`)) this.anims.create({ key: `walk-${direction}`, frames: [0, 1, 0, 2].map(frame => this.textures.exists(TEXTURES.player) ? { key: TEXTURES.player, frame: directions.indexOf(direction) * 3 + frame } : { key: playerFrame(direction, frame) }), frameRate: 8, repeat: -1 });
    }
    g.destroy();
    this.scene.start('TitleScene');
  }
}
