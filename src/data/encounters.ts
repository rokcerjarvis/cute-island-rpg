import { creatures } from './creatures';
import { monsters } from './monsters';
import { evolutionTargets } from './evolutions';
import type { CreatureDefinition } from '../entities/BattleEntity';
export interface EncounterTable {
  zoneId: string; encounterChance: number; minLevel: number; maxLevel: number;
  entries: { entityId: string; weight: number }[];
}
export const entityDefinitions: Record<string, CreatureDefinition> = Object.fromEntries([...creatures, ...monsters, ...evolutionTargets].map(entity => [entity.id, entity]));
export const encounterTables: Record<string, EncounterTable> = {
  GRASSLAND: {
    zoneId: 'GRASSLAND', encounterChance: 0.08, minLevel: 2, maxLevel: 5,
    entries: [
      { entityId: 'CUTE_002', weight: 32 }, { entityId: 'CUTE_004', weight: 32 },
      { entityId: 'CUTE_001', weight: 16 }, { entityId: 'CUTE_003', weight: 10 },
      { entityId: 'CUTE_005', weight: 5 }, { entityId: 'MON_001', weight: 5 },
    ],
  },
  FOREST_DEPTHS: { zoneId: 'FOREST_DEPTHS', encounterChance: 0.08, minLevel: 7, maxLevel: 10, entries: [
    { entityId: 'CUTE_003', weight: 22 }, { entityId: 'CUTE_002', weight: 18 }, { entityId: 'CUTE_004', weight: 15 }, { entityId: 'CUTE_001', weight: 10 }, { entityId: 'CUTE_005', weight: 10 }, { entityId: 'MON_001', weight: 10 }, { entityId: 'MON_002', weight: 15 },
  ] },
  SPECIAL_CUTE_GRASS: { zoneId: 'SPECIAL_CUTE_GRASS', encounterChance: 0.08, minLevel: 7, maxLevel: 10, entries: [
    { entityId: 'CUTE_003', weight: 20 }, { entityId: 'CUTE_002', weight: 16 }, { entityId: 'CUTE_004', weight: 13 }, { entityId: 'CUTE_001', weight: 9 }, { entityId: 'CUTE_005', weight: 20 }, { entityId: 'MON_001', weight: 9 }, { entityId: 'MON_002', weight: 13 },
  ] },
};
export const regionEncounterZones: Record<string, string> = { meadow: 'GRASSLAND', 'deep-forest': 'FOREST_DEPTHS', 'special-cute-grass': 'SPECIAL_CUTE_GRASS' };
