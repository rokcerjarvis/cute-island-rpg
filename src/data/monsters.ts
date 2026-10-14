import type { CreatureDefinition } from '../entities/BattleEntity';
import { learnsets, baseExperience } from './learnsets';
import { creatureVisual } from '../presentation/AssetManifest';
const definitions: Omit<CreatureDefinition, 'learnset' | 'baseExp' | 'evolution'>[] = [
  { id: 'MON_001', name: '黑團蟲', kind: 'MONSTER', attribute: 'EARTH', baseStats: { hp: 44, attack: 8, speed: 7 }, hpGrowth: 2.5, attackGrowth: 0.7, speedGrowth: 0.6, baseCaptureRate: 0, capturable: false, skills: ['SKILL_001', 'SKILL_003'] },
  { id: 'MON_002', name: '暴躁大嘴怪', kind: 'MONSTER', attribute: 'FIRE', baseStats: { hp: 62, attack: 16, speed: 9 }, hpGrowth: 3.2, attackGrowth: 0.9, speedGrowth: 0.7, baseCaptureRate: 0, capturable: false, skills: ['SKILL_004', 'SKILL_005', 'SKILL_006'] },
  { id: 'MON_003', name: '巨型森林怪', kind: 'MONSTER', attribute: 'WIND', baseStats: { hp: 128, attack: 14, speed: 11 }, hpGrowth: 0, attackGrowth: 0, speedGrowth: 0, baseCaptureRate: 0, capturable: false, skills: ['SKILL_001', 'SKILL_003', 'SKILL_005', 'SKILL_010'], boss: true },
];
export const monsters: CreatureDefinition[] = definitions.map(definition => ({ ...definition, ...creatureVisual(definition.id), learnset: learnsets[definition.id], baseExp: baseExperience[definition.id], evolution: null }));
