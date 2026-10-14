import type { SkillDefinition } from '../data/skills';
import type { RandomSource } from '../systems/EncounterSystem';
export type BattleSide = 'player' | 'enemy';
export function determineTurnOrder(playerSkill: SkillDefinition, enemySkill: SkillDefinition, playerSpeed: number, enemySpeed: number, rng: RandomSource): BattleSide[] {
  const difference = playerSkill.priority - enemySkill.priority || playerSpeed - enemySpeed;
  const playerFirst = difference === 0 ? rng() < 0.5 : difference > 0;
  return playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];
}
