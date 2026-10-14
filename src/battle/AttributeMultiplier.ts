import type { Attribute } from '../entities/BattleEntity';
import { BATTLE_CONFIG } from '../config/prototype';
const ADVANTAGES: Partial<Record<Attribute, Attribute>> = { WATER: 'FIRE', FIRE: 'WIND', WIND: 'EARTH', EARTH: 'WATER' };
export function attributeMultiplier(attacker: Attribute, defender: Attribute): number {
  if (attacker === 'PURE_CUTE' || defender === 'PURE_CUTE') return 1;
  if (ADVANTAGES[attacker] === defender) return BATTLE_CONFIG.advantage;
  if (ADVANTAGES[defender] === attacker) return BATTLE_CONFIG.disadvantage;
  return 1;
}
