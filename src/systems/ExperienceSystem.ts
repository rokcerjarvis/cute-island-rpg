import type { CreatureDefinition } from '../entities/BattleEntity';
import type { CreatureInstance } from '../entities/CreatureInstance';
import { calculateStats } from '../battle/StatCalculator';
import { skillsBetweenLevels } from './SkillLearningSystem';
export const EXPERIENCE_CONFIG = { curve: 1.15, maxLevel: 50, captureFraction: 0.5 } as const;
export function expForLevel(level: number): number {
  return Math.floor(EXPERIENCE_CONFIG.curve * Math.max(1, Math.min(50, Math.floor(level))) ** 3);
}
export function expLevelModifier(playerLevel: number, enemyLevel: number): number {
  const difference = enemyLevel - playerLevel;
  if (difference <= -6) return 0.5;
  if (difference <= -3) return 0.75;
  if (difference >= 6) return 1.5;
  if (difference >= 3) return 1.25;
  return 1;
}
export function battleExperience(baseExp: number, enemyLevel: number, playerLevel: number, captured = false): number {
  const defeatExp = Math.max(1, Math.floor(baseExp * enemyLevel * expLevelModifier(playerLevel, enemyLevel)));
  return captured ? Math.floor(defeatExp * EXPERIENCE_CONFIG.captureFraction) : defeatExp;
}
export function awardExperience(instance: CreatureInstance, definition: CreatureDefinition, amount: number): { gained: number; levels: number[]; newSkills: string[] } {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid EXP');
  const beforeLevel = instance.level;
  const beforeExp = instance.currentExp;
  instance.currentExp = Math.min(expForLevel(50), instance.currentExp + Math.floor(amount));
  const levels: number[] = [];
  while (instance.level < 50 && instance.currentExp >= expForLevel(instance.level + 1)) {
    instance.level++;
    const stats = calculateStats(definition, instance.level);
    if (instance.currentHp > 0) instance.currentHp = Math.min(stats.hp, instance.currentHp + stats.hp - instance.maxHp);
    instance.maxHp = stats.hp; instance.attack = stats.attack; instance.speed = stats.speed;
    levels.push(instance.level);
  }
  return { gained: instance.currentExp - beforeExp, levels, newSkills: skillsBetweenLevels(definition, beforeLevel, instance.level) };
}
