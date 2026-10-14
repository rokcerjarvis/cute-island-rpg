import type Phaser from 'phaser';
import { PRESENTATION_TIMING } from './ViewModels';
export class MessageQueue {
  private timer?: Phaser.Time.TimerEvent;
  private next?: () => void;
  constructor(private readonly scene: Phaser.Scene) {}
  play(messages: string[], show: (history: string[]) => void, done: () => void): void {
    this.destroy(); let index = 0; const shown: string[] = [];
    const advance = () => {
      this.timer?.remove(false);
      if (index >= messages.length) { this.next = undefined; done(); return; }
      shown.push(messages[index++]); show(shown.slice(-5)); this.next = advance;
      this.timer = this.scene.time.delayedCall(PRESENTATION_TIMING.message, advance);
    };
    this.next = advance; advance();
  }
  advance(): void { this.next?.(); }
  destroy(): void { this.timer?.remove(false); this.timer = undefined; this.next = undefined; }
}
