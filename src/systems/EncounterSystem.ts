import type { EncounterTable } from '../data/encounters';
import type { CreatureDefinition } from '../entities/BattleEntity';
export type RandomSource = () => number;
export interface EncounterStep { stepId: number; encounterEligible: boolean; moved: boolean }
export const RETURN_GRACE_STEPS = 2;
export const PITY_CONFIG = { threshold: 20, weightMultiplier: 3 } as const;
export class EncounterSystem {
  private lastStepId = -1;
  private cooldownSteps = 0;
  constructor(private readonly rng: RandomSource = Math.random, readonly pity: { pureCuteMissCount: number } = { pureCuteMissCount: 0 }) {}
  shouldEncounter(step: EncounterStep, chance: number, force = false): boolean {
    if (!step.moved || step.stepId <= this.lastStepId) return false;
    this.lastStepId = step.stepId;
    if (!step.encounterEligible) return false;
    if (this.cooldownSteps > 0) { this.cooldownSteps--; return false; }
    return force || this.rng() < chance;
  }
  effectiveEntries(table: EncounterTable, definitions: Record<string, CreatureDefinition>, debugForced = false): EncounterTable['entries'] {
    return table.entries.filter(entry => entry.weight > 0).map(entry => ({ ...entry, weight: entry.weight * (!debugForced && this.pity.pureCuteMissCount >= PITY_CONFIG.threshold && definitions[entry.entityId]?.attribute === 'PURE_CUTE' ? PITY_CONFIG.weightMultiplier : 1) }));
  }
  rollEncounter(table: EncounterTable, definitions: Record<string, CreatureDefinition>, debugForced = false): CreatureDefinition {
    const entries = this.effectiveEntries(table, definitions, debugForced);
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) throw new Error(`Encounter table ${table.zoneId} has no positive weights`);
    let roll = this.rng() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll < 0) {
        const entity = definitions[entry.entityId];
        if (!entity) throw new Error(`Unknown encounter entity: ${entry.entityId}`);
        if (!debugForced && entries.some(entry => definitions[entry.entityId]?.attribute === 'PURE_CUTE')) this.pity.pureCuteMissCount = entity.attribute === 'PURE_CUTE' ? 0 : this.pity.pureCuteMissCount + 1;
        return entity;
      }
    }
    throw new Error('RNG must return a value in [0, 1)');
  }
  rollLevel(table: EncounterTable): number {
    return table.minLevel + Math.floor(this.rng() * (table.maxLevel - table.minLevel + 1));
  }
  onBattleReturn(stepId: number): void {
    this.lastStepId = Math.max(this.lastStepId, stepId);
    this.cooldownSteps = RETURN_GRACE_STEPS;
  }
}
