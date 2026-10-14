import { describe, it, expect } from 'vitest';
import { createNewGameState, createRuntimeGameState, confirmStarter, STARTER_IDS } from '../src/state/RuntimeGameState';
import { SaveSystem, serializeGameState, deserializeGameState, validateSaveData, migrateSaveData, safeWorldPosition, formatPlayTime, requestAutoSave } from '../src/systems/SaveSystem';
import type { StorageAdapter } from '../src/systems/StorageAdapter';
import { DexSystem, createDex, dexDefinitions } from '../src/systems/DexSystem';
import { PartySystem } from '../src/systems/PartySystem';
import { PartyBattleSession } from '../src/battle/PartyBattleSession';
import { CaptureSystem } from '../src/battle/CaptureSystem';
import { BossSystem } from '../src/systems/BossSystem';
import { entityDefinitions } from '../src/data/encounters';
import { creatures } from '../src/data/creatures';
import { createBattleEntry } from '../src/entities/BattleEntity';
import { expForLevel } from '../src/systems/ExperienceSystem';
import { skillsAtLevel } from '../src/systems/SkillLearningSystem';
import { advancePlayTime } from '../src/systems/PlayTimeSystem';
const spawn = { x: 240, y: 400 };
const world = { ...spawn, zoneId: 'GRASSLAND', stepId: 4 };
class MemoryStorage implements StorageAdapter {
  value: string | null = null; writes = 0; fail = false;
  read() { return this.value; }
  write(v: string) { if (this.fail) throw new Error('Quota'); this.value = v; this.writes++; }
  remove() { this.value = null; }
}
const fresh = () => createRuntimeGameState(spawn);
const saved = () => serializeGameState(fresh());
function richState() {
  const state = createRuntimeGameState(spawn, 16); const party = new PartySystem(state);
  state.party[0].currentHp = 17; state.party[0].currentExp = expForLevel(16) + 21;
  for (let i = 0; i < 5; i++) party.acquire(creatures[i], 5, 12);
  state.bossDefeated = state.firstAreaComplete = state.campUpgradeSeen = state.campCompletionShown = true;
  state.pureCuteMissCount = 23; state.playerWorldPosition = { x: 700, y: 430, zoneId: 'meadow' }; state.playTimeSeconds = 4395;
  state.worldFlags = { introSeen: true }; return state;
}
describe('M6 starter', () => {
  it('empty until confirmation', () => expect(createNewGameState(spawn).party).toEqual([]));
  for (const [i, id] of STARTER_IDS.entries()) it(`starter ${id} selects attribute and full HP`, () => {
    const state = createNewGameState(spawn); confirmStarter(state, id);
    expect(state.party).toHaveLength(1); expect(state.party[0]).toMatchObject({ creatureId: id, attribute: creatures[i].attribute, level: 5, currentHp: creatures[i].baseStats.hp });
    expect(state.dex[id]).toBe('CAPTURED');
  });
  it('PURE_CUTE rejected', () => expect(() => confirmStarter(createNewGameState(spawn), 'CUTE_005')).toThrow());
  it('unknown rejected', () => expect(() => confirmStarter(createNewGameState(spawn), 'missing')).toThrow());
  it('Lv5 learnset', () => { const state = createNewGameState(spawn); confirmStarter(state, 'CUTE_003'); expect(state.party[0].knownSkills).toEqual(skillsAtLevel(creatures[2], 5)); });
  it('cancelling a selection creates no member', () => { const draft = createNewGameState(spawn); expect(draft.party).toEqual([]); expect(draft.nextInstanceNumber).toBe(1); });
  it('duplicate confirmation rejected', () => { const state = fresh(); expect(() => confirmStarter(state, 'CUTE_002')).toThrow(); });
  it('all new-game flags reset', () => expect(createNewGameState(spawn)).toMatchObject({ schemaVersion: 1, reserveStorage: [], bossDefeated: false, firstAreaComplete: false, campUpgradeSeen: false, pureCuteMissCount: 0, worldFlags: {}, playTimeSeconds: 0, isDirty: true }));
});
describe('M6 save roundtrip and validation', () => {
  it('plain serialization excludes derived stats and runtime data', () => { const data = serializeGameState(fresh()); expect(data.party[0]).not.toHaveProperty('maxHp'); expect(data).not.toHaveProperty('battle'); expect(data).not.toHaveProperty('isDirty'); });
  for (const key of ['party', 'reserveStorage', 'bossDefeated', 'firstAreaComplete', 'campUpgradeSeen', 'pureCuteMissCount', 'playerWorldPosition', 'dex', 'playTimeSeconds', 'schemaVersion', 'worldFlags', 'activeInstanceId', 'nextInstanceNumber'] as const) it(`restores ${key}`, () => {
    const state = richState(); expect(deserializeGameState(serializeGameState(state)).state[key]).toEqual(state[key]);
  });
  for (const key of ['currentHp', 'level', 'currentExp', 'knownSkills', 'status', 'instanceId', 'creatureId', 'maxHp', 'attack', 'speed'] as const) it(`instance restores ${key}`, () => {
    const state = richState(); expect(deserializeGameState(serializeGameState(state)).state.party[0][key]).toEqual(state.party[0][key]);
  });
  it('valid adapter save loads', () => { const save = new SaveSystem(new MemoryStorage()); expect(save.save(fresh())).toBe(true); expect(save.load()?.state.party[0].creatureId).toBe('CUTE_001'); });
  it('empty adapter cannot continue', () => expect(new SaveSystem(new MemoryStorage()).inspect().status).toBe('EMPTY'));
  it('malformed JSON rejected and retained', () => { const adapter = new MemoryStorage(); adapter.value = '{bad'; const save = new SaveSystem(adapter); expect(save.load()).toBeUndefined(); expect(save.inspect().status).toBe('INVALID'); expect(adapter.value).toBe('{bad'); });
  for (const [label, mutate] of [
    ['unknown species', (d: any) => d.party[0].creatureId = 'missing'],
    ['monster', (d: any) => d.party[0].creatureId = 'MON_001'],
    ['low level', (d: any) => d.party[0].level = 0], ['high level', (d: any) => d.party[0].level = 51],
    ['fractional level', (d: any) => d.party[0].level = 5.5],
    ['invalid skill', (d: any) => d.party[0].knownSkills = ['missing']],
    ['unlearnable skill', (d: any) => d.party[0].knownSkills = ['SKILL_014']],
    ['duplicate skills', (d: any) => d.party[0].knownSkills = ['SKILL_001', 'SKILL_001']],
    ['too much HP', (d: any) => d.party[0].currentHp = 1000], ['negative HP', (d: any) => d.party[0].currentHp = -1],
    ['bad status', (d: any) => d.party[0].status = 'FAINTED'],
    ['bad flags', (d: any) => d.progress.bossDefeated = 'true'], ['bad pity', (d: any) => d.progress.pureCuteMissCount = -1],
    ['future schema', (d: any) => d.schemaVersion = 2], ['empty party', (d: any) => d.party = []],
    ['bad active id', (d: any) => d.activeInstanceId = 'missing'], ['bad EXP', (d: any) => d.party[0].currentExp = 0],
    ['bad dex', (d: any) => d.dex.CUTE_005 = 'KNOWN'], ['missing dex', (d: any) => delete d.dex.EVO_002],
    ['duplicate instances', (d: any) => d.reserveStorage = [d.party[0]]],
  ] as const) it(`rejects ${label}`, () => { const data = saved(); mutate(data); expect(validateSaveData(data)).toBe(false); });
  it('schema v1 migration entry works', () => expect(migrateSaveData(saved()).schemaVersion).toBe(1));
  it('migration does not mutate or alias input', () => { const data = saved(); const before = JSON.stringify(data); const migrated = migrateSaveData(data); migrated.party[0].knownSkills.pop(); expect(JSON.stringify(data)).toBe(before); });
  it('successful write clears dirty', () => { const state = fresh(); expect(new SaveSystem(new MemoryStorage()).save(state)).toBe(true); expect(state.isDirty).toBe(false); });
  it('failed write keeps dirty and game intact', () => { const state = fresh(); const adapter = new MemoryStorage(); adapter.fail = true; expect(new SaveSystem(adapter).save(state)).toBe(false); expect(state.isDirty).toBe(true); expect(state.party).toHaveLength(1); });
  it('failed auto save is not repeated each frame', () => { const state = fresh(); const adapter = new MemoryStorage(); adapter.fail = true; const save = new SaveSystem(adapter); requestAutoSave(state); expect(save.checkpoint(state)).toBe(false); expect(save.checkpoint(state)).toBeUndefined(); expect(state.isDirty).toBe(true); });
  it('read failures are safe', () => { const adapter = new MemoryStorage(); adapter.read = () => { throw new Error('blocked'); }; expect(new SaveSystem(adapter).inspect().status).toBe('INVALID'); });
  it('delete is explicit', () => { const adapter = new MemoryStorage(); adapter.value = '{bad'; expect(new SaveSystem(adapter).delete()).toBe(true); expect(adapter.value).toBeNull(); });
  it('preview uses stored summary without runtime load', () => { const adapter = new MemoryStorage(); const save = new SaveSystem(adapter); save.save(richState()); const preview = save.inspect(); expect(preview.status).toBe('VALID'); if (preview.status === 'VALID') expect(preview.summary.join('\n')).toContain('01:13:15'); });
  it('map boundary fallback', () => expect(safeWorldPosition({ x: -20, y: 30 })).toMatchObject({ position: spawn, warning: expect.any(String) }));
  it('wall fallback', () => expect(safeWorldPosition({ x: 144, y: 304 })).toMatchObject({ position: spawn, warning: expect.any(String) }));
  it('foot overlapping wall fallback', () => expect(safeWorldPosition({ x: 126, y: 295 }).warning).toBeDefined());
  it('load position fallback sets dirty and warning', () => { const data = saved(); data.player.worldPosition = { x: 99999, y: 99999 }; const loaded = deserializeGameState(data); expect(loaded.state.playerWorldPosition).toEqual({ ...spawn, zoneId: 'camp' }); expect(loaded.state.isDirty).toBe(true); expect(loaded.warning).toBeDefined(); });
  it('HH MM SS including more than 24 hours', () => { expect(formatPlayTime(2538)).toBe('00:42:18'); expect(formatPlayTime(90061)).toBe('25:01:01'); });
  it('playtime counts actual gameplay, excludes paused/title', () => { const state = fresh(); advancePlayTime(state, 200, true); advancePlayTime(state, 1000, false); expect(state.playTimeSeconds).toBe(0.2); });
  it('focus resume cannot count a long hidden gap', () => { const state = fresh(); advancePlayTime(state, 120000, true); expect(state.playTimeSeconds).toBe(0.25); });
});
describe('M6 dex and safe event checkpoints', () => {
  it('all seven start UNKNOWN', () => expect(Object.values(createDex())).toEqual(Array(7).fill('UNKNOWN')));
  it('unknown UI hides species', () => expect(new DexSystem(createDex()).lines().every(s => s === '？？？ · UNKNOWN')).toBe(true));
  it('monsters excluded', () => { const data = createDex(); new DexSystem(data).seen('MON_001'); expect(Object.keys(data)).toHaveLength(7); });
  it('encounter registers SEEN', () => { const state = fresh(); new PartyBattleSession(state, createBattleEntry(creatures[1], 5, world)); expect(state.dex.CUTE_002).toBe('SEEN'); });
  it('escape keeps SEEN', () => { const state = fresh(); const session = new PartyBattleSession(state, createBattleEntry(creatures[1], 5, world)); session.finishReturn(); expect(state.dex.CUTE_002).toBe('SEEN'); });
  it('defeating target never captures', () => { const state = fresh(); const session = new PartyBattleSession(state, createBattleEntry(creatures[1], 5, world), () => 0.99); session.manager.enemy.hp = 1; session.attack('SKILL_001'); session.finishReturn(); expect(state.dex.CUTE_002).toBe('SEEN'); });
  it('capture updates CAPTURED', () => { const state = fresh(); new PartySystem(state).acquire(creatures[1], 5, 12); expect(state.dex.CUTE_002).toBe('CAPTURED'); });
  it('CAPTURED cannot downgrade', () => { const data = createDex(); const dex = new DexSystem(data); dex.captured('CUTE_002'); dex.seen('CUTE_002'); expect(data.CUTE_002).toBe('CAPTURED'); });
  it('PURE_CUTE Seen keeps flavor', () => { const data = createDex(); new DexSystem(data).seen('CUTE_005'); expect(data.CUTE_005).toBe('SEEN'); expect(new DexSystem(data).lines()[4]).toContain('這是什麼？上網查一下！'); });
  it('PURE_CUTE captured keeps flavor', () => { const data = createDex(); new DexSystem(data).captured('CUTE_005'); expect(new DexSystem(data).lines()[4]).toContain('這是什麼？上網查一下！'); });
  it('countSeen includes captured; countCaptured distinct species', () => { const data = createDex(); const dex = new DexSystem(data); dex.seen('CUTE_002'); dex.captured('CUTE_003'); dex.captured('CUTE_003'); expect(dex.countSeen()).toBe(2); expect(dex.countCaptured()).toBe(1); });
  it('dex persists seen and captured', () => { const state = fresh(); new DexSystem(state.dex).seen('CUTE_005'); expect(deserializeGameState(serializeGameState(state)).state.dex).toEqual(state.dex); });
  it('capture defers autosave until world return', () => {
    const state = fresh(), adapter = new MemoryStorage(), save = new SaveSystem(adapter);
    const session = new PartyBattleSession(state, createBattleEntry(creatures[1], 5, world), () => 0.99, new CaptureSystem(() => 0)); session.capture();
    expect(save.checkpoint(state)).toBeUndefined(); expect(adapter.writes).toBe(0); session.finishReturn(); expect(save.checkpoint(state)).toBe(true); expect(save.load()?.state.dex.CUTE_002).toBe('CAPTURED');
  });
  it('level up autosaves final EXP and HP', () => {
    const state = fresh(), save = new SaveSystem(new MemoryStorage()); state.party[0].currentExp = expForLevel(6) - 1;
    const session = new PartyBattleSession(state, createBattleEntry(entityDefinitions.MON_001, 5, world), () => 0.99); session.manager.enemy.hp = 1; session.attack('SKILL_001'); session.finishReturn();
    expect(save.checkpoint(state)).toBe(true); expect(save.load()?.state.party[0].level).toBe(6);
  });
  it('evolution captures target, keeps source, autosaves only after choices', () => {
    const state = createRuntimeGameState(spawn, 14), save = new SaveSystem(new MemoryStorage()); state.party[0].currentExp = expForLevel(15) - 1;
    const session = new PartyBattleSession(state, createBattleEntry(creatures[1], 5, world), () => 0.99, new CaptureSystem(() => 0)); session.capture();
    expect(save.checkpoint(state)).toBeUndefined(); session.applyEvolution(); session.finishReturn(); expect(save.checkpoint(state)).toBe(true);
    const loaded = save.load()!.state; expect(loaded.dex.EVO_001).toBe('CAPTURED'); expect(loaded.dex.CUTE_001).toBe('CAPTURED'); expect(loaded.party[0].creatureId).toBe('EVO_001');
  });
  it('boss victory autosaves completion', () => {
    const state = fresh(), save = new SaveSystem(new MemoryStorage()); const session = new PartyBattleSession(state, new BossSystem().entry(world, 1), () => 0.99);
    session.attack('SKILL_001'); session.finishReturn(); expect(save.checkpoint(state)).toBe(true); expect(save.load()?.state.firstAreaComplete).toBe(true);
  });
  it('heal autosaves full HP and status', () => { const state = fresh(), save = new SaveSystem(new MemoryStorage()); state.party[0].currentHp = 0; state.party[0].status = 'FAINTED'; new PartySystem(state).healAll(); expect(save.checkpoint(state)).toBe(true); expect(save.load()?.state.party[0].currentHp).toBe(52); });
  it('camp checkpoint writes once', () => { const state = fresh(), adapter = new MemoryStorage(), save = new SaveSystem(adapter); requestAutoSave(state); expect(save.checkpoint(state)).toBe(true); expect(save.checkpoint(state)).toBeUndefined(); expect(adapter.writes).toBe(1); });
  it('save blocks pending learning', () => { const state = fresh(); state.pendingLearning = { instanceId: 'creature-1', skillIds: ['SKILL_010'] }; expect(new SaveSystem(new MemoryStorage()).save(state)).toBe(false); });
  it('save blocks pending evolution', () => { const state = fresh(); state.pendingEvolution = { instanceId: 'creature-1', beforeId: 'CUTE_001', targetId: 'EVO_001' }; expect(new SaveSystem(new MemoryStorage()).save(state)).toBe(false); });
  it('all dex records are cute definitions', () => expect(dexDefinitions.every(d => d.kind === 'CUTE_CREATURE')).toBe(true));
});
