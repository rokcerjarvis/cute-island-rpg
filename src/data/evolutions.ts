import type { CuteCreatureDefinition } from '../entities/BattleEntity';
import { learnsets } from './learnsets';
import { creatureVisual } from '../presentation/AssetManifest';
export const evolutionTargets: CuteCreatureDefinition[] = [
  { id: 'EVO_001', name: '大吉伊', kind: 'CUTE_CREATURE', attribute: 'WATER', baseStats: { hp: 66, attack: 13, speed: 12 }, hpGrowth: 3.4, attackGrowth: 0.8, speedGrowth: 0.9, baseExp: 14, baseCaptureRate: 70, capturable: true, skills: ['SKILL_001', 'SKILL_003', 'SKILL_010', 'SKILL_011'], learnset: learnsets.CUTE_001, evolution: null },
  { id: 'EVO_002', name: '超級飛鼠', kind: 'CUTE_CREATURE', attribute: 'PURE_CUTE', baseStats: { hp: 62, attack: 8, speed: 14 }, hpGrowth: 3.3, attackGrowth: 0.55, speedGrowth: 1.1, baseExp: 20, baseCaptureRate: 30, capturable: true, skills: ['SKILL_002', 'SKILL_008', 'SKILL_011', 'SKILL_003'], learnset: learnsets.CUTE_005, evolution: null },
];
for (const definition of evolutionTargets) Object.assign(definition, creatureVisual(definition.id));
