import type { SuccessfulAttackEvent, Combatant } from './BattleManager';
import type { RandomSource } from '../systems/EncounterSystem';
export type CuteEvent = 'SLEEP' | 'CHARM' | 'FART' | 'CUTE_POSE';
export const CUTE_EVENT_CONFIG = { chance: 0.3, debuffMultiplier: 0.8, healFraction: 0.25 } as const;
const EVENTS: CuteEvent[] = ['SLEEP', 'CHARM', 'FART', 'CUTE_POSE'];
export class CuteEventSystem {
  private forcedNext?: CuteEvent;
  constructor(private readonly rng: RandomSource = Math.random) {}
  forceNext(event: CuteEvent): void { this.forcedNext = event; }
  shouldTriggerCuteEvent(event: SuccessfulAttackEvent): boolean {
    if (event.actor.definition.attribute !== 'PURE_CUTE' || event.skill.power <= 0 || event.damage < 1 || event.target.hp <= 0) return false;
    return Boolean(this.forcedNext) || this.rng() < CUTE_EVENT_CONFIG.chance;
  }
  rollCuteEvent(): CuteEvent {
    if (this.forcedNext) { const event = this.forcedNext; this.forcedNext = undefined; return event; }
    return EVENTS[Math.floor(this.rng() * EVENTS.length)];
  }
  applyCuteEvent(event: CuteEvent, actor: Combatant, target: Combatant): string[] {
    const name = actor.definition.name;
    switch (event) {
      case 'SLEEP': actor.effects.skipNextAction = true; return [`${name}打完之後突然睡著了。`];
      case 'CHARM': target.effects.attackMultiplier = CUTE_EVENT_CONFIG.debuffMultiplier; return [`${name}突然開始撒嬌！`, '對手有點下不了重手……'];
      case 'FART': target.effects.speedMultiplier = CUTE_EVENT_CONFIG.debuffMultiplier; return [`${name}偷偷放了一個屁。`, `${name}還假裝什麼都沒發生。`, '對手的動作突然變慢了……'];
      case 'CUTE_POSE': {
        const full = actor.hp >= actor.maxHp;
        actor.hp = Math.min(actor.maxHp, actor.hp + Math.floor(actor.maxHp * CUTE_EVENT_CONFIG.healFraction));
        return [`${name}突然開始裝可愛。`, full ? '但是看起來已經精神得不得了。' : '不知道為什麼恢復了精神！'];
      }
    }
  }
  process(event: SuccessfulAttackEvent, messages: string[]): CuteEvent | undefined {
    if (!this.shouldTriggerCuteEvent(event)) return;
    const selected = this.rollCuteEvent(); messages.push(...this.applyCuteEvent(selected, event.actor, event.target)); return selected;
  }
}
export function debugCuteEvent(value: string | null): CuteEvent | undefined {
  return ({ sleep: 'SLEEP', charm: 'CHARM', fart: 'FART', cutePose: 'CUTE_POSE' } as Record<string, CuteEvent>)[value ?? ''];
}
