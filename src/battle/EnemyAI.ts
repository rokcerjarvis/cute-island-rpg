import type { BattleEntity } from '../entities/BattleEntity';
import type { SkillDefinition } from '../data/skills';
import type { RandomSource } from '../systems/EncounterSystem';
import { BATTLE_CONFIG } from '../config/prototype';
export function chooseEnemySkill(enemy: BattleEntity, skillData: Record<string, SkillDefinition>, rng: RandomSource): SkillDefinition {
  const available = enemy.definition.skills.map(id => skillData[id]).filter((skill): skill is SkillDefinition => Boolean(skill));
  if (!available.length) throw new Error('Enemy has no valid skills');
  if (enemy.definition.boss) {
    const ids = enemy.hp / enemy.maxHp < 0.35 ? ['SKILL_003', 'SKILL_005', 'SKILL_001', 'SKILL_010'] : ['SKILL_001', 'SKILL_003', 'SKILL_005', 'SKILL_010'];
    const roll = rng(); const index = roll < 0.4 ? 0 : roll < 0.7 ? 1 : roll < 0.9 ? 2 : 3;
    return available.find(s => s.id === ids[index]) ?? available[0];
  }
  const alternatives = available.filter(skill => skill.effect !== 'HEAL_20_PERCENT');
  const pool = enemy.hp / enemy.maxHp >= BATTLE_CONFIG.aiHealThreshold && alternatives.length ? alternatives : available;
  return pool[Math.floor(rng() * pool.length)];
}
