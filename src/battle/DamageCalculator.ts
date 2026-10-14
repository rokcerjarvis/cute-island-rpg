import { BATTLE_CONFIG } from '../config/prototype';
import { attributeMultiplier } from './AttributeMultiplier';
import type { Attribute } from '../entities/BattleEntity';
import type { RandomSource } from '../systems/EncounterSystem';
export function rollDamageFactor(rng: RandomSource): number {
  return BATTLE_CONFIG.randomMin + rng() * (BATTLE_CONFIG.randomMax - BATTLE_CONFIG.randomMin);
}
export function calculateDamage(power: number, attack: number, attacker: Attribute, defender: Attribute, rng: RandomSource, level: number = BATTLE_CONFIG.referenceLevel): number {
  if (power <= 0) return 0;
  return Math.max(1, Math.floor((attack * BATTLE_CONFIG.attackCoefficient + power * BATTLE_CONFIG.powerCoefficient + level * BATTLE_CONFIG.levelCoefficient) * attributeMultiplier(attacker, defender) * rollDamageFactor(rng)));
}
export function checkAccuracy(accuracy: number, rng: RandomSource): boolean { return rng() * 100 < accuracy; }
