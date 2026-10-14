import type { Attribute } from './BattleEntity';
export interface CreatureInstance {
  instanceId: string;
  creatureId: string;
  attribute: Attribute;
  level: number;
  /** Cumulative, integer EXP. */
  currentExp: number;
  currentHp: number;
  maxHp: number;
  attack: number;
  speed: number;
  knownSkills: string[];
  status: 'OK' | 'FAINTED';
}
