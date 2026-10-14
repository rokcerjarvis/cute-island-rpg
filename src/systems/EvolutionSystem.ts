import type { CreatureDefinition } from '../entities/BattleEntity';
import type { CreatureInstance } from '../entities/CreatureInstance';
import { calculateStats } from '../battle/StatCalculator';
export function validateEvolution(source: CreatureDefinition, target: CreatureDefinition): void {
  if (source.kind !== 'CUTE_CREATURE' || target.kind !== 'CUTE_CREATURE' || !target.capturable) throw new Error('Evolution requires cute species');
  if (source.id === target.id) throw new Error('Evolution cannot target itself');
  if (source.attribute !== target.attribute && !(source.attribute !== 'PURE_CUTE' && target.attribute === 'PURE_CUTE')) throw new Error('Illegal evolution attribute change');
}
export class EvolutionSystem {
  constructor(private readonly definitions: Record<string, CreatureDefinition>) {}
  target(instance: CreatureInstance): CreatureDefinition | undefined {
    const source = this.definitions[instance.creatureId];
    if (!source?.evolution || instance.level < source.evolution.level) return undefined;
    const target = this.definitions[source.evolution.targetCreatureId];
    if (!target) throw new Error('Unknown evolution target');
    validateEvolution(source, target); return target;
  }
  evolve(instance: CreatureInstance): { before: string; after: string } {
    const source = this.definitions[instance.creatureId]; const target = this.target(instance);
    if (!target) throw new Error('Creature is not ready to evolve');
    const stats = calculateStats(target, instance.level);
    const ratio = instance.currentHp / instance.maxHp;
    instance.currentHp = instance.currentHp > 0 ? Math.max(1, Math.min(stats.hp, Math.floor(stats.hp * ratio))) : 0;
    instance.creatureId = target.id; instance.attribute = target.attribute;
    instance.maxHp = stats.hp; instance.attack = stats.attack; instance.speed = stats.speed;
    instance.status = instance.currentHp > 0 ? 'OK' : 'FAINTED';
    return { before: source.name, after: target.name };
  }
}
