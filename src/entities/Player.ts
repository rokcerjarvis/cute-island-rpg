import Phaser from 'phaser';
import { resolveMovement, type Direction } from '../systems/movement';
import { TEXTURES, playerFrame } from '../presentation/AssetManifest';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: Direction = 'down';
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, scene.textures.exists(TEXTURES.player) ? TEXTURES.player : playerFrame('down', 0), 0);
    scene.add.existing(this);
    this.setName('player');
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.body!.setSize(12, 10);
    this.body!.setOffset(8, 16);
    this.keys = scene.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
  }
  update(): void {
    const input = (a: string, b: string) => this.keys[a].isDown || this.keys[b].isDown;
    const movement = resolveMovement({ up: input('W', 'UP'), down: input('S', 'DOWN'), left: input('A', 'LEFT'), right: input('D', 'RIGHT') });
    this.setVelocity(movement.x, movement.y);
    if (movement.facing) { this.facing = movement.facing; this.play(`walk-${this.facing}`, true); }
    else { this.anims.stop(); this.setTexture(this.scene.textures.exists(TEXTURES.player) ? TEXTURES.player : playerFrame(this.facing, 0), this.scene.textures.exists(TEXTURES.player) ? ['down', 'up', 'left', 'right'].indexOf(this.facing) * 3 : undefined); }
    this.setDepth(this.y);
  }
}
