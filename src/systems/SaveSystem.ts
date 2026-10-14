import { createNewGameState, type RuntimeGameState } from '../state/RuntimeGameState';
import { createCreatureInstance } from './PartySystem';
import { entityDefinitions } from '../data/encounters';
import { isCuteDefinition } from '../entities/BattleEntity';
import { skills } from '../data/skills';
import { expForLevel } from './ExperienceSystem';
import { DexSystem, dexDefinitions, type DexData } from './DexSystem';
import { createWorldMap, tileAt, isSolid } from '../data/world';
import type { StorageAdapter } from './StorageAdapter';
import { PartySystem } from './PartySystem';
import { defaultInvitationInventory, invitationItems, type InvitationInventory } from '../data/invitationItems';
export interface SavedCreature { instanceId: string; creatureId: string; level: number; currentExp: number; currentHp: number; knownSkills: string[]; status: 'OK' | 'FAINTED' }
export interface SaveData {
  schemaVersion: 1;
  inventory?: InvitationInventory;
  metadata: { createdAt: string; updatedAt: string; playTimeSeconds: number };
  player: { worldPosition: { x: number; y: number }; currentZone: string };
  party: SavedCreature[]; reserveStorage: SavedCreature[]; activeInstanceId: string; nextInstanceNumber: number;
  progress: { bossDefeated: boolean; firstAreaComplete: boolean; campUpgradeSeen: boolean; pureCuteMissCount: number };
  dex: DexData; worldFlags: Record<string, boolean>; settings: Record<string, unknown>;
}
const object = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateSaveData(value: unknown): value is SaveData {
  if (!object(value) || value.schemaVersion !== 1 || !object(value.metadata) || !object(value.player) || !object(value.player.worldPosition) || !object(value.progress)) return false;
  if (value.inventory !== undefined && (!object(value.inventory) || Object.keys(value.inventory).length !== invitationItems.length || !invitationItems.every(i => integer(value.inventory[i.id], 0)))) return false;
  const { metadata: m, player: p, progress: g } = value;
  if (![m.createdAt, m.updatedAt].every(d => typeof d === 'string' && Number.isFinite(Date.parse(d))) || !Number.isFinite(m.playTimeSeconds) || m.playTimeSeconds < 0) return false;
  if (![p.worldPosition.x, p.worldPosition.y].every(n => typeof n === 'number' && Number.isFinite(n)) || typeof p.currentZone !== 'string' || !p.currentZone.length) return false;
  if (!['bossDefeated', 'firstAreaComplete', 'campUpgradeSeen'].every(k => typeof g[k] === 'boolean') || !integer(g.pureCuteMissCount, 0)) return false;
  if (g.firstAreaComplete !== g.bossDefeated || (g.campUpgradeSeen && !g.bossDefeated)) return false;
  if (!Array.isArray(value.party) || value.party.length < 1 || value.party.length > 5 || !Array.isArray(value.reserveStorage) || !integer(value.nextInstanceNumber, 2)) return false;
  const ids = new Set<string>();
  for (const c of [...value.party, ...value.reserveStorage]) {
    if (!object(c) || typeof c.instanceId !== 'string' || !/^creature-[1-9]\d*$/.test(c.instanceId) || ids.has(c.instanceId) || Number(c.instanceId.slice(9)) >= value.nextInstanceNumber) return false;
    ids.add(c.instanceId);
    const d = entityDefinitions[c.creatureId];
    if (!d || !isCuteDefinition(d) || !integer(c.level, 1, 50) || !integer(c.currentExp, expForLevel(c.level), c.level === 50 ? expForLevel(50) : expForLevel(c.level + 1) - 1)) return false;
    const instance = createCreatureInstance(d, c.level, c.instanceId);
    if (!integer(c.currentHp, 0, instance.maxHp) || c.status !== (c.currentHp > 0 ? 'OK' : 'FAINTED')) return false;
    if (!Array.isArray(c.knownSkills) || !c.knownSkills.length || c.knownSkills.length > 4 || new Set(c.knownSkills).size !== c.knownSkills.length || !c.knownSkills.every((s: unknown) => typeof s === 'string' && skills[s] && d.learnset.some(l => l.skillId === s && l.level <= c.level))) return false;
  }
  if (!value.party.some((c: SavedCreature) => c.instanceId === value.activeInstanceId) || !value.party.some((c: SavedCreature) => c.currentHp > 0)) return false;
  if (!object(value.dex) || Object.keys(value.dex).length !== dexDefinitions.length || !dexDefinitions.every(d => ['UNKNOWN', 'SEEN', 'CAPTURED'].includes(value.dex[d.id]))) return false;
  if (![...value.party, ...value.reserveStorage].every(c => value.dex[c.creatureId] === 'CAPTURED')) return false;
  return object(value.worldFlags) && Object.values(value.worldFlags).every(v => typeof v === 'boolean') && object(value.settings);
}
export function migrateSaveData(input: unknown): SaveData {
  if (!validateSaveData(input)) throw new Error('Invalid or unsupported save schema');
  const data = JSON.parse(JSON.stringify(input)) as SaveData;
  data.inventory ??= defaultInvitationInventory();
  return data;
}
export function serializeGameState(state: RuntimeGameState, now = new Date().toISOString()): SaveData {
  if (state.battle || state.pendingLearning || state.pendingEvolution) throw new Error('Cannot save unresolved battle');
  const creature = (c: SavedCreature): SavedCreature => ({ instanceId: c.instanceId, creatureId: c.creatureId, level: c.level, currentExp: c.currentExp, currentHp: c.currentHp, knownSkills: [...c.knownSkills], status: c.status });
  return { schemaVersion: 1, inventory: { ...state.inventory }, metadata: { createdAt: state.saveMetadata.createdAt, updatedAt: now, playTimeSeconds: state.playTimeSeconds }, player: { worldPosition: { x: state.playerWorldPosition.x, y: state.playerWorldPosition.y }, currentZone: state.playerWorldPosition.zoneId }, party: state.party.map(creature), reserveStorage: state.reserveStorage.map(creature), activeInstanceId: state.activeInstanceId, nextInstanceNumber: state.nextInstanceNumber, progress: { bossDefeated: state.bossDefeated, firstAreaComplete: state.firstAreaComplete, campUpgradeSeen: state.campUpgradeSeen, pureCuteMissCount: state.pureCuteMissCount }, dex: { ...state.dex }, worldFlags: { ...state.worldFlags }, settings: structuredClone(state.settings) };
}
export function safeWorldPosition(position: { x: number; y: number }): { position: { x: number; y: number }; warning?: string } {
  const map = createWorldMap();
  // Same foot rectangle as Player (28x28 sprite, body offset 8,16, size 12x10).
  const points = [[position.x - 6, position.y + 2], [position.x + 5.999, position.y + 2], [position.x - 6, position.y + 11.999], [position.x + 5.999, position.y + 11.999]];
  const safe = points.every(([x, y]) => { const tile = tileAt(map, x, y); return tile && !isSolid(tile.kind); });
  return safe ? { position: { ...position } } : { position: { ...map.spawn }, warning: '存檔位置無法通行，已返回營地。' };
}
export function deserializeGameState(input: unknown): { state: RuntimeGameState; warning?: string } {
  const data = migrateSaveData(input); const safety = safeWorldPosition(data.player.worldPosition);
  const state = createNewGameState(safety.position, data.metadata.createdAt);
  const creature = (c: SavedCreature) => {
    const definition = entityDefinitions[c.creatureId]; if (!isCuteDefinition(definition)) throw new Error('Invalid species');
    return { ...createCreatureInstance(definition, c.level, c.instanceId, c.currentHp), currentExp: c.currentExp, knownSkills: [...c.knownSkills] };
  };
  Object.assign(state, data.progress, { inventory: { ...data.inventory! }, party: data.party.map(creature), reserveStorage: data.reserveStorage.map(creature), activeInstanceId: data.activeInstanceId, nextInstanceNumber: data.nextInstanceNumber, dex: data.dex, worldFlags: data.worldFlags, settings: data.settings, playTimeSeconds: data.metadata.playTimeSeconds, saveMetadata: { createdAt: data.metadata.createdAt, updatedAt: data.metadata.updatedAt }, campCompletionShown: data.progress.campUpgradeSeen, capturedSpeciesIds: dexDefinitions.filter(d => d.id.startsWith('CUTE_') && data.dex[d.id] === 'CAPTURED').map(d => d.id), isDirty: Boolean(safety.warning) });
  state.playerWorldPosition = { ...safety.position, zoneId: safety.warning ? 'camp' : data.player.currentZone };
  state.worldFeedback = safety.warning;
  new PartySystem(state).prepareLeader();
  return { state, warning: safety.warning };
}
export type SaveInspection = { status: 'EMPTY' } | { status: 'INVALID'; error: string } | { status: 'VALID'; data: SaveData; summary: string[] };
export function formatPlayTime(seconds: number): string { const n = Math.floor(seconds); return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60].map(v => String(v).padStart(2, '0')).join(':'); }
export class SaveSystem {
  constructor(readonly adapter: StorageAdapter) {}
  inspect(): SaveInspection {
    try {
      const text = this.adapter.read(); if (text === null) return { status: 'EMPTY' };
      const data = migrateSaveData(JSON.parse(text)); const leader = data.party.find(c => c.currentHp > 0)!;
      return { status: 'VALID', data, summary: [`Lv.${leader.level} ${entityDefinitions[leader.creatureId].name}`, `最高 Lv.${Math.max(...[...data.party, ...data.reserveStorage].map(c => c.level))} · 圖鑑 ${new DexSystem(data.dex).countSeen()} / 7`, `遊玩時間 ${formatPlayTime(data.metadata.playTimeSeconds)}`, `第一區：${data.progress.firstAreaComplete ? '已完成' : '開拓中'}`] };
    } catch { return { status: 'INVALID', error: '冒險紀錄似乎壞掉了。' }; }
  }
  save(state: RuntimeGameState): boolean {
    try { const data = serializeGameState(state); if (!validateSaveData(data)) throw new Error('Invalid state'); this.adapter.write(JSON.stringify(data)); state.saveMetadata.updatedAt = data.metadata.updatedAt; state.isDirty = false; state.pendingAutoSave = false; return true; }
    catch { state.isDirty = true; state.pendingAutoSave = false; return false; }
  }
  load(): { state: RuntimeGameState; warning?: string } | undefined { const inspection = this.inspect(); return inspection.status === 'VALID' ? deserializeGameState(inspection.data) : undefined; }
  delete(): boolean { try { this.adapter.remove(); return true; } catch { return false; } }
  checkpoint(state: RuntimeGameState): boolean | undefined { return state.pendingAutoSave && !state.battle && !state.pendingEvolution && !state.pendingLearning ? this.save(state) : undefined; }
}
export { requestAutoSave } from '../state/StateChanges';
