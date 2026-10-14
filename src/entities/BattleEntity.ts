import { calculateStats } from '../battle/StatCalculator';
import { skillsAtLevel } from '../systems/SkillLearningSystem';
export type Attribute = 'WATER' | 'FIRE' | 'EARTH' | 'WIND' | 'PURE_CUTE';
export type EntityKind = 'CUTE_CREATURE' | 'MONSTER';
export interface Stats { hp: number; attack: number; speed: number }
export interface CreatureDefinition {
  battleSpriteKey?: string;
  worldSpriteKey?: string;
  portraitKey?: string;
  id: string;
  name: string;
  kind: EntityKind;
  attribute: Attribute;
  /** Reference stats: Lv.5, or Lv.11 for Boss. */
  baseStats: Stats;
  hpGrowth: number;
  attackGrowth: number;
  speedGrowth: number;
  baseExp: number;
  learnset: { level: number; skillId: string }[];
  evolutionTarget?: string;
  evolutionLevel?: number;
  evolution: { type: 'LEVEL'; level: number; targetCreatureId: string } | null;
  /** Percentage, 0–100. */
  baseCaptureRate: number;
  capturable: boolean;
  skills: string[];
  boss?: boolean;
  /** Story characters may reject every invitation item, including money. */
  invitationBlocked?: boolean;
}
export interface CuteCreatureDefinition extends CreatureDefinition { kind: 'CUTE_CREATURE'; capturable: true }
export function isCuteDefinition(definition: CreatureDefinition): definition is CuteCreatureDefinition { return definition.kind === 'CUTE_CREATURE' && definition.capturable; }
export interface BattleEntity { definition: CreatureDefinition; level: number; stats: Stats; hp: number; maxHp: number }
export interface WorldReturnState { x: number; y: number; zoneId: string; stepId: number }
export interface BattleEntryPayload { enemy: BattleEntity; messages: string[]; world: WorldReturnState; isBoss?: boolean }
export function encounterMessages(entity: CreatureDefinition): string[] {
  const messages: string[] = [];
  if (entity.kind === 'CUTE_CREATURE' && entity.attribute === 'PURE_CUTE') messages.push('這是什麼？上網查一下！');
  messages.push(entity.kind === 'MONSTER' ? `怪物 ${entity.name} 出現了！` : `野生的 ${entity.name} 出現了！`);
  return messages;
}
export function createBattleEntry(definition: CreatureDefinition, level: number, world: WorldReturnState): BattleEntryPayload {
  return { enemy: createBattleEntity(definition, level), messages: encounterMessages(definition), world: { ...world } };
}
export function createBattleEntity(definition: CreatureDefinition, level: number): BattleEntity {
  const stats = calculateStats(definition, level);
  return { definition: { ...definition, skills: skillsAtLevel(definition, level) }, level, stats, hp: stats.hp, maxHp: stats.hp };
}
