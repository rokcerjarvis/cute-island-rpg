import type { CreatureInstance } from '../entities/CreatureInstance';
import type { WorldReturnState } from '../entities/BattleEntity';
import { createCreatureInstance } from '../systems/PartySystem';
import { creatures } from '../data/creatures';
import { PROTOTYPE_PLAYER } from '../config/prototype';
import { createDex, type DexData } from '../systems/DexSystem';
import { defaultInvitationInventory, type InvitationInventory } from '../data/invitationItems';
export interface RuntimeGameState {
  schemaVersion: 1;
  inventory: InvitationInventory;
  dex: DexData;
  firstAreaComplete: boolean;
  campUpgradeSeen: boolean;
  worldFlags: Record<string, boolean>;
  playTimeSeconds: number;
  saveMetadata: { createdAt: string; updatedAt: string };
  settings: Record<string, unknown>;
  isDirty: boolean;
  pendingAutoSave: boolean;
  party: CreatureInstance[];
  reserveStorage: CreatureInstance[];
  activeInstanceId: string;
  nextInstanceNumber: number;
  playerWorldPosition: { x: number; y: number; zoneId: string };
  bossDefeated: boolean;
  campCompletionShown: boolean;
  pureCuteMissCount: number;
  capturedSpeciesIds: string[];
  pendingEvolution?: { instanceId: string; beforeId: string; targetId: string };
  battle?: { activeInstanceId: string; enemyId: string; enemyLevel: number; enemyHp: number; enemyMaxHp: number; enemySkills: string[]; turn: number; outcome?: string; needsSwitch: boolean; isBoss: boolean; world: WorldReturnState };
  pendingLearning?: { instanceId: string; skillIds: string[] };
  worldFeedback?: string;
}
export function createRuntimeGameState(spawn: { x: number; y: number }, starterLevel: number = PROTOTYPE_PLAYER.level, starterCreatureId: string = PROTOTYPE_PLAYER.entityId): RuntimeGameState {
  const starter = createCreatureInstance(creatures.find(creature => creature.id === starterCreatureId) ?? creatures[0], starterLevel, 'creature-1');
  const state = createNewGameState(spawn);
  state.party = [starter]; state.activeInstanceId = starter.instanceId; state.nextInstanceNumber = 2;
  state.capturedSpeciesIds = [starter.creatureId]; state.dex[starter.creatureId] = 'CAPTURED';
  return state;
}
export function createNewGameState(spawn: { x: number; y: number }, now = new Date().toISOString()): RuntimeGameState {
  return { schemaVersion: 1, inventory: defaultInvitationInventory(), party: [], reserveStorage: [], activeInstanceId: '', nextInstanceNumber: 1, playerWorldPosition: { ...spawn, zoneId: 'camp' }, bossDefeated: false, campCompletionShown: false, campUpgradeSeen: false, firstAreaComplete: false, pureCuteMissCount: 0, capturedSpeciesIds: [], dex: createDex(), worldFlags: {}, playTimeSeconds: 0, saveMetadata: { createdAt: now, updatedAt: now }, settings: {}, isDirty: true, pendingAutoSave: false };
}
export const STARTER_IDS = ['CUTE_001', 'CUTE_002', 'CUTE_003', 'CUTE_004'] as const;
export function confirmStarter(state: RuntimeGameState, creatureId: string): void {
  if (state.party.length || !STARTER_IDS.some(id => id === creatureId)) throw new Error('Invalid starter');
  const definition = creatures.find(d => d.id === creatureId)!;
  const member = createCreatureInstance(definition, 5, 'creature-1');
  state.party.push(member); state.activeInstanceId = member.instanceId; state.nextInstanceNumber = 2;
  state.dex[creatureId] = 'CAPTURED'; state.capturedSpeciesIds.push(creatureId); state.isDirty = true;
}
