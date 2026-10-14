import type { CreatureDefinition } from '../entities/BattleEntity';
import type { CreatureInstance } from '../entities/CreatureInstance';
export const MAX_KNOWN_SKILLS = 4;
export function skillsAtLevel(definition: CreatureDefinition, level: number): string[] {
  const available = definition.learnset.filter(entry => entry.level <= level).sort((a, b) => a.level - b.level);
  return [...new Set(available.map(entry => entry.skillId).reverse())].slice(0, MAX_KNOWN_SKILLS).reverse();
}
export function skillsBetweenLevels(definition: CreatureDefinition, before: number, after: number): string[] {
  return definition.learnset.filter(entry => entry.level > before && entry.level <= after).sort((a, b) => a.level - b.level).map(entry => entry.skillId);
}
/** Processes one at a time, so later skills see earlier replacement/decline decisions. */
export class SkillLearningSystem {
  readonly pending: string[];
  constructor(readonly creature: CreatureInstance, skillIds: string[]) { this.pending = [...skillIds]; }
  advance(): string[] {
    const learned: string[] = [];
    while (this.pending.length) {
      const id = this.pending[0];
      if (this.creature.knownSkills.includes(id)) { this.pending.shift(); continue; }
      if (this.creature.knownSkills.length >= MAX_KNOWN_SKILLS) break;
      this.creature.knownSkills.push(id); learned.push(id); this.pending.shift();
    }
    return learned;
  }
  decide(forgetIndex?: number): { learned: string; forgotten?: string; declined: boolean } {
    if (!this.pending.length) throw new Error('No pending skill');
    if (forgetIndex !== undefined && (!Number.isInteger(forgetIndex) || forgetIndex < 0 || forgetIndex >= this.creature.knownSkills.length)) throw new Error('Invalid replacement index');
    const learned = this.pending.shift()!;
    if (forgetIndex === undefined) return { learned, declined: true };
    const forgotten = this.creature.knownSkills[forgetIndex];
    this.creature.knownSkills[forgetIndex] = learned;
    return { learned, forgotten, declined: false };
  }
}
