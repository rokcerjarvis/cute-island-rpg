import type { CuteCreatureDefinition } from '../entities/BattleEntity';
import { learnsets, baseExperience } from './learnsets';
import { creatureVisual } from '../presentation/AssetManifest';
const definitions: Omit<CuteCreatureDefinition, 'learnset' | 'baseExp' | 'evolution'>[] = [
  { id: 'CUTE_001', name: '吉伊卡哇', kind: 'CUTE_CREATURE', attribute: 'WATER', baseStats: { hp: 52, attack: 10, speed: 10 }, hpGrowth: 2.8, attackGrowth: 0.65, speedGrowth: 0.8, baseCaptureRate: 70, capturable: true, skills: ['SKILL_001', 'SKILL_003', 'SKILL_010', 'SKILL_011'] },
  { id: 'CUTE_002', name: '小八', kind: 'CUTE_CREATURE', attribute: 'WIND', baseStats: { hp: 46, attack: 10, speed: 15 }, hpGrowth: 2.5, attackGrowth: 0.65, speedGrowth: 1.2, baseCaptureRate: 65, capturable: true, skills: ['SKILL_002', 'SKILL_008', 'SKILL_012', 'SKILL_013'] },
  { id: 'CUTE_003', name: '兔兔', kind: 'CUTE_CREATURE', attribute: 'FIRE', baseStats: { hp: 44, attack: 16, speed: 12 }, hpGrowth: 2.4, attackGrowth: 0.9, speedGrowth: 1, baseCaptureRate: 55, capturable: true, skills: ['SKILL_004', 'SKILL_007', 'SKILL_009', 'SKILL_014'] },
  { id: 'CUTE_004', name: '栗子饅頭', kind: 'CUTE_CREATURE', attribute: 'EARTH', baseStats: { hp: 64, attack: 11, speed: 6 }, hpGrowth: 3.3, attackGrowth: 0.7, speedGrowth: 0.5, baseCaptureRate: 60, capturable: true, skills: ['SKILL_001', 'SKILL_004', 'SKILL_006', 'SKILL_010'] },
  { id: 'CUTE_005', name: '飛鼠', kind: 'CUTE_CREATURE', attribute: 'PURE_CUTE', baseStats: { hp: 50, attack: 7, speed: 11 }, hpGrowth: 2.7, attackGrowth: 0.45, speedGrowth: 0.9, baseCaptureRate: 30, capturable: true, skills: ['SKILL_002', 'SKILL_003', 'SKILL_008', 'SKILL_011'] },
];
export const creatures: CuteCreatureDefinition[] = definitions.map(definition => ({ ...definition, ...creatureVisual(definition.id), learnset: learnsets[definition.id], baseExp: baseExperience[definition.id], evolution: definition.id === 'CUTE_001' ? { type: 'LEVEL', level: 15, targetCreatureId: 'EVO_001' } : definition.id === 'CUTE_005' ? { type: 'LEVEL', level: 18, targetCreatureId: 'EVO_002' } : null }));
