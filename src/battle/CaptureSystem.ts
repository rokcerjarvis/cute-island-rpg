import type { BattleEntity } from '../entities/BattleEntity';
import type { RandomSource } from '../systems/EncounterSystem';
import { invitationItem, type InvitationItemId } from '../data/invitationItems';
export const CAPTURE_ITEM = invitationItem('CAPTURE_ITEM_001');
export const CAPTURE_CONFIG = {
  minChance: 0.01, maxChance: 0.95,
  hpBands: [{ min: 0.8, multiplier: 0.6 }, { min: 0.5, multiplier: 0.85 }, { min: 0.25, multiplier: 1.15 }, { min: 0.1, multiplier: 1.5 }, { min: 0, multiplier: 1.8 }],
  levelBands: [{ min: 11, multiplier: 1.6 }, { min: 6, multiplier: 1.4 }, { min: 3, multiplier: 1.2 }, { min: -2, multiplier: 1 }, { min: -5, multiplier: 0.7 }, { min: -Infinity, multiplier: 0.55 }],
} as const;
export type CaptureResult = { outcome: 'SUCCESS' | 'FAILURE'; chance: number } | { outcome: 'REJECTED'; reason: 'MONSTER' | 'BOSS' | 'STORY' | 'FAINTED' };
export class CaptureSystem {
  constructor(private readonly rng: RandomSource = Math.random) {}
  chance(enemy: BattleEntity, playerLevel: number, itemModifier: number = CAPTURE_ITEM.modifier): number {
    if (this.rejection(enemy)) return 0;
    const hpModifier = CAPTURE_CONFIG.hpBands.find(band => enemy.hp / enemy.maxHp >= band.min)!.multiplier;
    const levelModifier = CAPTURE_CONFIG.levelBands.find(band => playerLevel - enemy.level >= band.min)!.multiplier;
    return Math.min(CAPTURE_CONFIG.maxChance, Math.max(CAPTURE_CONFIG.minChance, enemy.definition.baseCaptureRate / 100 * hpModifier * levelModifier * itemModifier));
  }
  rejection(enemy: BattleEntity): Extract<CaptureResult, { outcome: 'REJECTED' }> | undefined {
    if (enemy.definition.boss) return { outcome: 'REJECTED', reason: 'BOSS' };
    if (enemy.definition.invitationBlocked) return { outcome: 'REJECTED', reason: 'STORY' };
    if (enemy.definition.kind !== 'CUTE_CREATURE' || !enemy.definition.capturable) return { outcome: 'REJECTED', reason: 'MONSTER' };
    if (enemy.hp <= 0) return { outcome: 'REJECTED', reason: 'FAINTED' };
    return undefined;
  }
  attempt(enemy: BattleEntity, playerLevel: number, itemId: InvitationItemId = CAPTURE_ITEM.id): CaptureResult {
    const rejected = this.rejection(enemy); if (rejected) return rejected;
    const item = invitationItem(itemId);
    if (item.guaranteed) return { outcome: 'SUCCESS', chance: 1 };
    const chance = this.chance(enemy, playerLevel, item.modifier);
    return { outcome: this.rng() < chance ? 'SUCCESS' : 'FAILURE', chance };
  }
}
