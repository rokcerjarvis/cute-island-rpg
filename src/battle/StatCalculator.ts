import type { CreatureDefinition, Stats } from '../entities/BattleEntity';
import { BATTLE_CONFIG } from '../config/prototype';
export function calculateStats(entity: CreatureDefinition, level: number): Stats {
  const delta = Math.max(BATTLE_CONFIG.minLevel, Math.min(BATTLE_CONFIG.maxLevel, Math.floor(level))) - BATTLE_CONFIG.referenceLevel;
  const stat = (base: number, growth: number) => Math.max(BATTLE_CONFIG.minStat, Math.floor(base + growth * delta));
  return { hp: stat(entity.baseStats.hp, entity.hpGrowth), attack: stat(entity.baseStats.attack, entity.attackGrowth), speed: stat(entity.baseStats.speed, entity.speedGrowth) };
}
