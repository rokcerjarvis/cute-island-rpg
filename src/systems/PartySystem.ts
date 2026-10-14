import type { BattleEntity, CuteCreatureDefinition } from '../entities/BattleEntity';
import type { CreatureInstance } from '../entities/CreatureInstance';
import type { RuntimeGameState } from '../state/RuntimeGameState';
import { entityDefinitions } from '../data/encounters';
import { calculateStats } from '../battle/StatCalculator';
import { skillsAtLevel } from './SkillLearningSystem';
import { expForLevel } from './ExperienceSystem';
import { DexSystem } from './DexSystem';
import { requestAutoSave } from '../state/StateChanges';
export const PARTY_CAPACITY = 5;
export function createCreatureInstance(definition: CuteCreatureDefinition, level: number, instanceId: string, hp?: number): CreatureInstance {
  if (definition.kind !== 'CUTE_CREATURE' || !definition.capturable) throw new Error('Monsters cannot become party instances');
  const registered = entityDefinitions[definition.id];
  if (!registered || registered.kind !== 'CUTE_CREATURE' || !registered.capturable) throw new Error('Species cannot join the party');
  if (!Number.isInteger(level) || level < 1 || level > 50) throw new Error('Invalid level');
  const stats = calculateStats(definition, level);
  const currentHp = Math.max(0, Math.min(stats.hp, Math.floor(hp ?? stats.hp)));
  return { instanceId, creatureId: definition.id, attribute: definition.attribute, level, currentExp: expForLevel(level), currentHp, maxHp: stats.hp, attack: stats.attack, speed: stats.speed, knownSkills: skillsAtLevel(definition, level), status: currentHp > 0 ? 'OK' : 'FAINTED' };
}
export class PartySystem {
  constructor(readonly state: RuntimeGameState) {}
  get active(): CreatureInstance { return this.state.party.find(member => member.instanceId === this.state.activeInstanceId)!; }
  /** Slot zero is the persistent overworld leader; battle active is independent. */
  get leader(): CreatureInstance | undefined { return this.state.party[0]; }
  setLeader(instanceId: string): 'CHANGED' | 'CURRENT' | 'FAINTED' | 'MISSING' | 'BLOCKED' {
    if (this.state.battle || this.state.pendingEvolution || this.state.pendingLearning) return 'BLOCKED';
    const index = this.state.party.findIndex(member => member.instanceId === instanceId);
    if (index < 0) return 'MISSING';
    const member = this.state.party[index];
    if (member.currentHp <= 0 || member.status === 'FAINTED') return 'FAINTED';
    if (index === 0) return 'CURRENT';
    this.state.party.splice(index, 1); this.state.party.unshift(member);
    this.state.activeInstanceId = member.instanceId; requestAutoSave(this.state);
    return 'CHANGED';
  }
  /** Deterministic legacy/fainted fallback. Never changes healthy leader during battle. */
  prepareLeader(): CreatureInstance | undefined {
    if (this.state.battle) return this.leader;
    const index = this.state.party.findIndex(member => member.currentHp > 0 && member.status !== 'FAINTED');
    if (index < 0) return undefined;
    if (index > 0) { const [member] = this.state.party.splice(index, 1); this.state.party.unshift(member); requestAutoSave(this.state); }
    if (this.state.activeInstanceId !== this.leader!.instanceId) { this.state.activeInstanceId = this.leader!.instanceId; this.state.isDirty = true; }
    return this.leader;
  }
  acquire(definition: CuteCreatureDefinition, level: number, hp: number): { instance: CreatureInstance; destination: 'PARTY' | 'RESERVE' } {
    const instance = createCreatureInstance(definition, level, `creature-${this.state.nextInstanceNumber}`, hp);
    this.state.nextInstanceNumber++;
    const destination = this.state.party.length < PARTY_CAPACITY ? 'PARTY' : 'RESERVE';
    this.state[destination === 'PARTY' ? 'party' : 'reserveStorage'].push(instance);
    if (definition.id.startsWith('CUTE_') && !this.state.capturedSpeciesIds.includes(definition.id)) this.state.capturedSpeciesIds.push(definition.id);
    new DexSystem(this.state.dex).captured(definition.id); requestAutoSave(this.state);
    return { instance, destination };
  }
  canSwitch(instanceId: string): boolean { return this.state.party.some(member => member.instanceId === instanceId && member.currentHp > 0 && member.status !== 'FAINTED' && member.instanceId !== this.state.activeInstanceId); }
  switchTo(instanceId: string): CreatureInstance {
    if (!this.canSwitch(instanceId)) throw new Error('Member cannot switch in');
    this.state.activeInstanceId = instanceId; this.state.isDirty = true; return this.active;
  }
  hasReplacement(): boolean { return this.state.party.some(member => member.instanceId !== this.state.activeInstanceId && member.currentHp > 0); }
  ensureActive(): CreatureInstance {
    if (!this.active || this.active.currentHp <= 0) {
      const alive = this.state.party.find(member => member.currentHp > 0);
      if (!alive) throw new Error('Party has no conscious members');
      this.state.activeInstanceId = alive.instanceId;
    }
    return this.active;
  }
  toBattleEntity(member = this.active): BattleEntity {
    const definition = entityDefinitions[member.creatureId];
    if (definition.kind !== 'CUTE_CREATURE') throw new Error('Invalid party species');
    return { definition: { ...definition, skills: [...member.knownSkills] }, level: member.level, hp: member.currentHp, maxHp: member.maxHp, stats: { hp: member.maxHp, attack: member.attack, speed: member.speed } };
  }
  syncActive(entity: BattleEntity): void {
    if (this.active.currentHp !== entity.hp) this.state.isDirty = true;
    this.active.currentHp = Math.max(0, Math.min(this.active.maxHp, entity.hp));
    this.active.status = this.active.currentHp <= 0 ? 'FAINTED' : 'OK';
  }
  healAll(): void { for (const member of this.state.party) { member.currentHp = member.maxHp; member.status = 'OK'; } requestAutoSave(this.state); }
}
