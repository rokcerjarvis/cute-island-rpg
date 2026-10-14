import { describe, expect, it, vi } from 'vitest';
import { CuteEventSystem, type CuteEvent } from '../src/battle/CuteEventSystem';
import { BattleManager, type SuccessfulAttackEvent } from '../src/battle/BattleManager';
import { PartyBattleSession } from '../src/battle/PartyBattleSession';
import { CaptureSystem } from '../src/battle/CaptureSystem';
import { attributeMultiplier } from '../src/battle/AttributeMultiplier';
import { EvolutionSystem, validateEvolution } from '../src/systems/EvolutionSystem';
import { createCreatureInstance, PartySystem } from '../src/systems/PartySystem';
import { BossSystem, BOSS_ZONE, inBossZone, shouldUpgradeCamp, completionSummary } from '../src/systems/BossSystem';
import { EncounterSystem } from '../src/systems/EncounterSystem';
import { createRuntimeGameState } from '../src/state/RuntimeGameState';
import { createBattleEntity, createBattleEntry } from '../src/entities/BattleEntity';
import { creatures } from '../src/data/creatures';
import { entityDefinitions, encounterTables } from '../src/data/encounters';
import { skills } from '../src/data/skills';
import { expForLevel } from '../src/systems/ExperienceSystem';

const camp = { x: 240, y: 400 };
const world = { x: 353, y: 522, zoneId: 'GRASSLAND', stepId: 7 };
function manager(passive = new CuteEventSystem(() => 0.99)) {
  const actor = createBattleEntity({ ...creatures[4], baseStats: { hp: 200, attack: 7, speed: 20 }, learnset: [{ level: 1, skillId: 'SKILL_002' }, { level: 1, skillId: 'SKILL_011' }, { level: 1, skillId: 'SKILL_010' }] }, 5);
  const target = createBattleEntity({ ...creatures[0], baseStats: { hp: 200, attack: 10, speed: 10 }, learnset: [{ level: 1, skillId: 'SKILL_001' }] }, 5);
  return new BattleManager(actor, target, skills, () => 0, undefined, undefined, passive);
}
function hit(engine = manager()): SuccessfulAttackEvent { return { actor: engine.player, target: engine.enemy, skill: skills.SKILL_002, damage: 10 }; }

describe('PURE_CUTE eligibility and four events', () => {
  it('uses an exact 30 percent chance boundary', () => {
    expect(new CuteEventSystem(() => 0.29999).shouldTriggerCuteEvent(hit())).toBe(true);
    expect(new CuteEventSystem(() => 0.3).shouldTriggerCuteEvent(hit())).toBe(false);
  });
  it.each([[0, 'SLEEP'], [0.25, 'CHARM'], [0.5, 'FART'], [0.75, 'CUTE_POSE'], [0.99999, 'CUTE_POSE']] as const)('equal-weight roll %s returns %s', (rng, event) => expect(new CuteEventSystem(() => rng).rollCuteEvent()).toBe(event));
  it('non-damage, zero damage, KO and ordinary attributes consume no passive RNG', () => {
    const rng = vi.fn(() => 0); const system = new CuteEventSystem(rng); const event = hit();
    expect(system.shouldTriggerCuteEvent({ ...event, damage: 0 })).toBe(false);
    expect(system.shouldTriggerCuteEvent({ ...event, skill: skills.SKILL_011 })).toBe(false);
    event.target.hp = 0; expect(system.shouldTriggerCuteEvent(event)).toBe(false);
    event.target.hp = 200; event.actor.definition = { ...event.actor.definition, attribute: 'WATER' };
    expect(system.shouldTriggerCuteEvent(event)).toBe(false); expect(rng).not.toHaveBeenCalled();
  });
  it('miss never calls the passive, and retains a queued forced event', () => {
    const rng = vi.fn(() => 0); const passive = new CuteEventSystem(rng); passive.forceNext('CHARM');
    const engine = manager(passive);
    engine.player.definition = { ...engine.player.definition, skills: ['SKILL_007'] };
    const missed = new BattleManager(engine.player, engine.enemy, skills, () => 0.99, undefined, undefined, passive);
    missed.resolveTurn('SKILL_007'); expect(rng).not.toHaveBeenCalled();
    expect(passive.shouldTriggerCuteEvent(hit())).toBe(true); expect(passive.rollCuteEvent()).toBe('CHARM');
  });
  it('heal and defense do not trigger even while forced', () => {
    const rng = vi.fn(() => 0); const passive = new CuteEventSystem(rng); passive.forceNext('FART');
    const engine = manager(passive); engine.resolveTurn('SKILL_011'); engine.resolveTurn('SKILL_010');
    expect(engine.enemy.effects.speedMultiplier).toBe(1); expect(rng).not.toHaveBeenCalled();
  });
  it('a killing attack performs no event RNG or forced event', () => {
    const rng = vi.fn(() => 0); const passive = new CuteEventSystem(rng); passive.forceNext('SLEEP');
    const engine = manager(passive); engine.enemy.hp = 1; engine.resolveTurn('SKILL_002');
    expect(engine.player.effects.skipNextAction).toBe(false); expect(rng).not.toHaveBeenCalled();
  });
  it('sleep skips exactly one action and then clears', () => {
    const passive = new CuteEventSystem(() => 0.99); passive.forceNext('SLEEP'); const engine = manager(passive);
    engine.resolveTurn('SKILL_002'); expect(engine.player.effects.skipNextAction).toBe(true);
    const before = engine.enemy.hp; const skipped = engine.resolveTurn('SKILL_002');
    expect(skipped.messages.join('\n')).toContain('還在睡覺'); expect(engine.enemy.hp).toBe(before); expect(engine.player.effects.skipNextAction).toBe(false);
    engine.resolveTurn('SKILL_002'); expect(engine.enemy.hp).toBeLessThan(before);
  });
  it('sleep also consumes a legal capture action instead of capturing', () => {
    const state = createRuntimeGameState(camp); const capture = new CaptureSystem(() => 0);
    const session = new PartyBattleSession(state, createBattleEntry(creatures[0], 5, world), () => 0, capture);
    session.manager.player.effects.skipNextAction = true;
    expect(session.capture().messages[0]).toContain('還在睡覺'); expect(state.party).toHaveLength(1); expect(session.manager.turn).toBe(1);
  });
  it('sleep consumes voluntary switch but not an invalid monster capture', () => {
    const state = createRuntimeGameState(camp); const party = new PartySystem(state); const extra = party.acquire(creatures[1], 5, 30).instance;
    const session = new PartyBattleSession(state, createBattleEntry(entityDefinitions.MON_001, 5, world), () => 0);
    session.manager.player.effects.skipNextAction = true; session.capture(); expect(session.manager.player.effects.skipNextAction).toBe(true);
    session.switchTo(extra.instanceId); expect(state.activeInstanceId).toBe('creature-1'); expect(session.manager.player.effects.skipNextAction).toBe(false);
  });
  it('sleep consumes one attempted escape action', () => {
    const state = createRuntimeGameState(camp); const session = new PartyBattleSession(state, createBattleEntry(creatures[0], 5, world), () => 0);
    session.manager.player.effects.skipNextAction = true; expect(() => session.manager.escape()).toThrow();
    expect(session.skipEscapeIfAsleep()?.messages[0]).toContain('還在睡覺'); expect(session.manager.result).toBeUndefined();
    session.finishReturn(); expect(session.manager.result?.outcome).toBe('ESCAPED');
  });
  it('charm affects Attack, not the whole skill damage, and never stacks', () => {
    const passive = new CuteEventSystem(() => 0.99); const engine = manager(passive);
    passive.applyCuteEvent('CHARM', engine.player, engine.enemy); passive.applyCuteEvent('CHARM', engine.player, engine.enemy);
    expect(engine.enemy.effects.attackMultiplier).toBe(0.8); expect(engine.enemy.stats.attack).toBe(10);
    engine.resolveTurn('SKILL_002'); expect(engine.player.hp).toBe(190); // floor((20 + 10*.8*.6)*.9)=22
  });
  it('fart reduces Speed without stacking and alters next order', () => {
    const passive = new CuteEventSystem(() => 0.99); const engine = manager(passive);
    engine.player.stats.speed = 9; engine.enemy.stats.speed = 10;
    passive.applyCuteEvent('FART', engine.player, engine.enemy); passive.applyCuteEvent('FART', engine.player, engine.enemy);
    expect(engine.enemy.effects.speedMultiplier).toBe(0.8); expect(engine.resolveTurn('SKILL_002').order[0]).toBe('player');
  });
  it('charm and fart persist on party members across switches within this battle', () => {
    const state = createRuntimeGameState(camp); const party = new PartySystem(state); const extra = party.acquire(creatures[3], 5, 44).instance;
    const session = new PartyBattleSession(state, createBattleEntry(creatures[0], 5, world), () => 0);
    session.manager.player.effects.attackMultiplier = session.manager.player.effects.speedMultiplier = 0.8;
    session.switchTo(extra.instanceId); session.switchTo('creature-1');
    expect(session.manager.player.effects.attackMultiplier).toBe(0.8); expect(session.manager.player.effects.speedMultiplier).toBe(0.8);
  });
  it('cute pose heals 25 percent, caps HP, and has full-HP feedback', () => {
    const passive = new CuteEventSystem(); const engine = manager(); engine.player.hp = 100;
    passive.applyCuteEvent('CUTE_POSE', engine.player, engine.enemy); expect(engine.player.hp).toBe(150);
    engine.player.hp = 199; passive.applyCuteEvent('CUTE_POSE', engine.player, engine.enemy); expect(engine.player.hp).toBe(200);
    expect(passive.applyCuteEvent('CUTE_POSE', engine.player, engine.enemy).join('\n')).toContain('精神得不得了');
  });
  it('PURE_CUTE remains neutral in both directions against every attribute', () => {
    for (const attribute of ['WATER', 'FIRE', 'EARTH', 'WIND', 'PURE_CUTE'] as const) { expect(attributeMultiplier('PURE_CUTE', attribute)).toBe(1); expect(attributeMultiplier(attribute, 'PURE_CUTE')).toBe(1); }
  });
  it('forced event is consumed exactly once', () => {
    const passive = new CuteEventSystem(() => 0.99); passive.forceNext('FART'); const event = hit();
    const logs: string[] = []; passive.process(event, logs); expect(logs.join('\n')).toContain('屁'); expect(passive.shouldTriggerCuteEvent(event)).toBe(false);
  });
});

describe('level evolution and migration', () => {
  const system = new EvolutionSystem(entityDefinitions);
  it('waits until threshold, supports level jumps, and stops after evolving', () => {
    const member = createCreatureInstance(creatures[0], 14, 'evo'); expect(system.target(member)).toBeUndefined();
    member.level = 15; expect(system.target(member)?.id).toBe('EVO_001'); member.level = 22; system.evolve(member);
    expect(member.creatureId).toBe('EVO_001'); expect(system.target(member)).toBeUndefined(); expect(() => system.evolve(member)).toThrow();
  });
  it('preserves identity, level, EXP and skills while updating stats, attribute and species', () => {
    const member = createCreatureInstance(creatures[0], 15, 'stable', 20); const known = [...member.knownSkills]; const exp = member.currentExp;
    system.evolve(member);
    expect(member).toMatchObject({ instanceId: 'stable', creatureId: 'EVO_001', level: 15, currentExp: exp, knownSkills: known, attribute: 'WATER', maxHp: 100, attack: 21, speed: 21, currentHp: Math.floor(100 * 20 / 80) });
  });
  it('preserves exact HP percentage where possible', () => {
    const source = { ...creatures[0], baseStats: { hp: 40, attack: 10, speed: 10 }, hpGrowth: 0 };
    const target = { ...entityDefinitions.EVO_001, baseStats: { hp: 60, attack: 15, speed: 15 }, hpGrowth: 0 };
    const member = createCreatureInstance(source, 15, 'ratio', 20); new EvolutionSystem({ ...entityDefinitions, CUTE_001: source, EVO_001: target }).evolve(member);
    expect(member.currentHp).toBe(30); expect(member.maxHp).toBe(60);
  });
  it('live minimum HP is one and fainted creatures stay at zero', () => {
    const live = createCreatureInstance(creatures[0], 15, 'live', 1); system.evolve(live); expect(live.currentHp).toBeGreaterThanOrEqual(1);
    const fainted = createCreatureInstance(creatures[0], 15, 'fainted', 0); system.evolve(fainted); expect(fainted.currentHp).toBe(0); expect(fainted.status).toBe('FAINTED');
  });
  it('flying squirrel evolves at 18 and retains low Attack PURE_CUTE identity', () => {
    const member = createCreatureInstance(creatures[4], 17, 'flying'); expect(system.target(member)).toBeUndefined();
    member.level = 18; system.evolve(member); expect(member.creatureId).toBe('EVO_002'); expect(member.attribute).toBe('PURE_CUTE'); expect(member.attack).toBe(15); expect(member.maxHp).toBe(104);
  });
  it('validates same-element and rare PURE_CUTE changes, rejects other changes', () => {
    expect(() => validateEvolution(creatures[0], entityDefinitions.EVO_001)).not.toThrow();
    expect(() => validateEvolution(creatures[0], entityDefinitions.EVO_002)).not.toThrow();
    expect(() => validateEvolution(creatures[0], { ...entityDefinitions.EVO_001, attribute: 'FIRE' })).toThrow();
    expect(() => validateEvolution(creatures[4], entityDefinitions.EVO_001)).toThrow();
  });
  it('invalid/self/monster target validation is explicit', () => {
    expect(() => validateEvolution(creatures[0], creatures[0])).toThrow(); expect(() => validateEvolution(creatures[0], entityDefinitions.MON_003)).toThrow();
    const broken = { ...creatures[0], evolution: { type: 'LEVEL' as const, level: 15, targetCreatureId: 'missing' } };
    expect(() => new EvolutionSystem({ CUTE_001: broken }).target(createCreatureInstance(creatures[0], 15, 'missing'))).toThrow();
  });
  it('queues evolution after learning, blocks premature return, and keeps completion idempotent', () => {
    const state = createRuntimeGameState(camp); state.party[0].currentExp = expForLevel(16) - 1;
    const session = new PartyBattleSession(state, createBattleEntry(creatures[0], 5, world), () => 0); session.manager.enemy.hp = 1; session.attack('SKILL_001');
    expect(state.pendingEvolution).toBeUndefined(); expect(state.pendingLearning?.skillIds).toEqual(['SKILL_002']);
    session.decideLearning(); expect(state.pendingEvolution?.targetId).toBe('EVO_001'); expect(() => session.finishReturn()).toThrow();
    session.applyEvolution(); expect(state.party[0].creatureId).toBe('EVO_001'); expect(() => session.applyEvolution()).toThrow(); session.finishReturn();
  });
});

describe('Boss progression and forest encounters', () => {
  const boss = new BossSystem();
  it('Boss is never in any random pool and has exact Lv.11 stats', () => {
    for (const table of Object.values(encounterTables)) expect(table.entries.some(entry => entry.entityId === 'MON_003')).toBe(false);
    expect(boss.entry(world)).toMatchObject({ isBoss: true, enemy: { level: 11, hp: 128, maxHp: 128, stats: { hp: 128, attack: 14, speed: 11 }, definition: { capturable: false, baseExp: 40 } } });
  });
  it('trigger only occurs inside the zone, before victory and outside a battle', () => {
    const state = createRuntimeGameState(camp);
    expect(boss.shouldTrigger(state, 0, 0)).toBe(false); expect(boss.shouldTrigger(state, BOSS_ZONE.left, BOSS_ZONE.top)).toBe(true);
    expect(inBossZone(BOSS_ZONE.left + BOSS_ZONE.width, BOSS_ZONE.top)).toBe(false);
    state.bossDefeated = true; expect(boss.shouldTrigger(state, BOSS_ZONE.left, BOSS_ZONE.top)).toBe(false);
  });
  it('Boss cannot escape or capture, even with capture success RNG', () => {
    const state = createRuntimeGameState(camp); const session = new PartyBattleSession(state, boss.entry(world), () => 0, new CaptureSystem(() => 0));
    expect(() => session.manager.escape()).toThrow('現在好像不是逃跑的時候！'); expect(() => session.finishReturn()).toThrow();
    expect(session.capture().messages[0]).toBe('現在不是交朋友的時候！'); expect(session.manager.turn).toBe(0);
  });
  it('Boss victory awards proper EXP, returns and persists completion without respawn', () => {
    const state = createRuntimeGameState(camp); const session = new PartyBattleSession(state, boss.entry(world), () => 0.99);
    session.manager.enemy.hp = 1; const turn = session.attack('SKILL_001'); expect(turn.messages).toContain('巨型森林怪倒下了！');
    expect(turn.messages).toContain('森林好像安靜下來了。'); expect(state.party[0].currentExp).toBe(expForLevel(5) + 660);
    expect(state.bossDefeated).toBe(false); session.finishReturn(); expect(state.bossDefeated).toBe(true);
    expect(JSON.parse(JSON.stringify(state)).bossDefeated).toBe(true); expect(shouldUpgradeCamp(state)).toBe(true); expect(completionSummary(state)).toContain('第一區開拓完成！');
  });
  it('Boss defeat heals camp party and keeps retry available', () => {
    const state = createRuntimeGameState(camp); const session = new PartyBattleSession(state, boss.entry(world), () => 0);
    session.manager.player.hp = 1; session.attack('SKILL_001'); expect(session.manager.result?.outcome).toBe('DEFEAT'); session.finishReturn();
    expect(state.bossDefeated).toBe(false); expect(state.party[0].currentHp).toBe(52); expect(shouldUpgradeCamp(state)).toBe(false);
    expect(boss.shouldTrigger(state, BOSS_ZONE.left, BOSS_ZONE.top)).toBe(true);
  });
  it('debug Boss HP only changes remaining HP, never max/stat/capture eligibility', () => expect(boss.entry(world, 1).enemy).toMatchObject({ hp: 1, maxHp: 128, stats: { hp: 128, attack: 14, speed: 11 }, definition: { capturable: false } }));
  it('forest depth levels cover 7 through 10 and exact weighted pool', () => {
    const table = encounterTables.FOREST_DEPTHS;
    expect([0, 0.25, 0.5, 0.999].map(rng => new EncounterSystem(() => rng).rollLevel(table))).toEqual([7, 8, 9, 10]);
    expect(table.entries.map(entry => [entry.entityId, entry.weight])).toEqual([['CUTE_003', 22], ['CUTE_002', 18], ['CUTE_004', 15], ['CUTE_001', 10], ['CUTE_005', 10], ['MON_001', 10], ['MON_002', 15]]);
    expect(encounterTables.SPECIAL_CUTE_GRASS.entries.find(entry => entry.entityId === 'CUTE_005')!.weight).toBe(20);
  });
  it('pity increments only on actual qualifying normal encounters and resets on PURE_CUTE', () => {
    const state = { pureCuteMissCount: 0 }; const system = new EncounterSystem(() => 0, state);
    for (let index = 0; index < 20; index++) system.rollEncounter(encounterTables.GRASSLAND, entityDefinitions);
    expect(state.pureCuteMissCount).toBe(20);
    new EncounterSystem(() => 0.85, state).rollEncounter(encounterTables.GRASSLAND, entityDefinitions); expect(state.pureCuteMissCount).toBe(0);
  });
  it('threshold boosts actual PURE_CUTE chance without mutating the table', () => {
    const table = encounterTables.GRASSLAND; const normal = new EncounterSystem(() => 0.85); const boosted = new EncounterSystem(() => 0.85, { pureCuteMissCount: 20 });
    expect(normal.rollEncounter(table, entityDefinitions).id).toBe('CUTE_003'); expect(boosted.rollEncounter(table, entityDefinitions).id).toBe('CUTE_005');
    expect(table.entries.find(entry => entry.entityId === 'CUTE_005')!.weight).toBe(5);
  });
  it('debug forced rolls bypass both pity weights and counter updates', () => {
    const state = { pureCuteMissCount: 20 }; const system = new EncounterSystem(() => 0.85, state);
    expect(system.rollEncounter(encounterTables.GRASSLAND, entityDefinitions, true).id).toBe('CUTE_003'); expect(state.pureCuteMissCount).toBe(20);
    expect(new EncounterSystem(() => 0.91, state).rollEncounter(encounterTables.GRASSLAND, entityDefinitions, true).id).toBe('CUTE_005'); expect(state.pureCuteMissCount).toBe(20);
  });
  it('tables without PURE_CUTE do not change pity', () => {
    const state = { pureCuteMissCount: 8 }; const table = { ...encounterTables.GRASSLAND, entries: [{ entityId: 'MON_001', weight: 1 }] };
    new EncounterSystem(() => 0, state).rollEncounter(table, entityDefinitions); expect(state.pureCuteMissCount).toBe(8);
  });
});
