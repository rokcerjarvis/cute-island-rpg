import { describe, expect, it, vi } from 'vitest';
import { createRuntimeGameState } from '../src/state/RuntimeGameState';
import { PartySystem, createCreatureInstance } from '../src/systems/PartySystem';
import { CaptureSystem } from '../src/battle/CaptureSystem';
import { awardExperience, battleExperience, expForLevel, expLevelModifier } from '../src/systems/ExperienceSystem';
import { SkillLearningSystem, skillsAtLevel } from '../src/systems/SkillLearningSystem';
import { PartyBattleSession } from '../src/battle/PartyBattleSession';
import { creatures } from '../src/data/creatures';
import { monsters } from '../src/data/monsters';
import { entityDefinitions } from '../src/data/encounters';
import { skills } from '../src/data/skills';
import { createBattleEntry, createBattleEntity, type CuteCreatureDefinition } from '../src/entities/BattleEntity';

const camp = { x: 240, y: 400 };
const world = { x: 353, y: 522, zoneId: 'GRASSLAND', stepId: 7 };
function setup(enemyId = 'CUTE_001', captureRng = () => 0) {
  const state = createRuntimeGameState(camp);
  const party = new PartySystem(state);
  const session = new PartyBattleSession(state, createBattleEntry(entityDefinitions[enemyId], 5, world), () => 0, new CaptureSystem(captureRng));
  // Forced-switch cases deliberately begin injured; battle length no longer implies a one-hit KO.
  if (enemyId === 'CUTE_004') session.manager.player.hp = 1;
  return { state, party, session };
}

describe('party instances and persistent state', () => {
  it('starts with exactly one independent Lv.5 Chiikawa at full HP and cumulative EXP', () => {
    const { state, party } = setup();
    expect(state.party).toHaveLength(1);
    expect(party.active).toMatchObject({ creatureId: 'CUTE_001', level: 5, currentHp: 52, maxHp: 52, currentExp: expForLevel(5), knownSkills: ['SKILL_001', 'SKILL_003'], status: 'OK' });
    expect(state.reserveStorage).toEqual([]);
  });
  it('caps party at five and keeps sixth and seventh instances in reserve', () => {
    const { state, party } = setup();
    for (let index = 0; index < 6; index++) party.acquire(creatures[1], 3, 9);
    expect(state.party).toHaveLength(5);
    expect(state.reserveStorage).toHaveLength(2);
    expect(new Set([...state.party, ...state.reserveStorage].map(member => member.instanceId)).size).toBe(7);
  });
  it('preserves caught level, remaining HP, EXP floor and level-derived skills', () => {
    const { party } = setup();
    const caught = party.acquire(creatures[4], 4, 6).instance;
    expect(caught).toMatchObject({ level: 4, currentHp: 6, currentExp: expForLevel(4), knownSkills: ['SKILL_002', 'SKILL_008'] });
  });
  it('rejects monsters at compile-time and runtime without losing storage or IDs', () => {
    const { state, party } = setup();
    if (false) {
      // @ts-expect-error Monster definitions are not accepted by the party boundary.
      party.acquire(monsters[0], 5, 10);
    }
    expect(() => party.acquire(monsters[0] as CuteCreatureDefinition, 5, 10)).toThrow();
    expect(state.party).toHaveLength(1); expect(state.reserveStorage).toHaveLength(0); expect(state.nextInstanceNumber).toBe(2);
  });
  it('rejects invalid levels', () => {
    expect(() => createCreatureInstance(creatures[0], 0, 'invalid')).toThrow();
    expect(() => createCreatureInstance(creatures[0], 51, 'invalid')).toThrow();
  });
  it('rejects a monster species ID even if an external caller spoofs cute flags', () => {
    const { party } = setup();
    const spoofed = { ...creatures[0], id: 'MON_001' };
    expect(() => party.acquire(spoofed, 5, 10)).toThrow();
  });
  it('party HP survives escape and the next battle', () => {
    const { state, party, session } = setup();
    session.attack('SKILL_001');
    expect(party.active.currentHp).toBe(40);
    session.finishReturn();
    const next = new PartyBattleSession(state, createBattleEntry(creatures[0], 5, world), () => 0);
    expect(next.manager.player.hp).toBe(40);
    expect(party.active.currentHp).toBe(40);
  });
  it('victory preserves injured HP and updates runtime battle state', () => {
    const { session, state, party } = setup();
    session.manager.player.hp = 20; session.manager.enemy.hp = 1; session.attack('SKILL_001');
    expect(state.battle?.outcome).toBe('VICTORY'); expect(party.active.currentHp).toBe(20);
    session.finishReturn(); expect(state.battle).toBeUndefined(); expect(party.active.currentHp).toBe(20);
  });
  it('heal point operation restores all party members and fainted status', () => {
    const { state, party } = setup();
    const extra = party.acquire(creatures[1], 5, 0).instance;
    party.active.currentHp = 1;
    party.healAll();
    expect(state.party.every(member => member.currentHp === member.maxHp && member.status === 'OK')).toBe(true);
    expect(extra.currentHp).toBe(46);
  });
  it('will not switch to an active, fainted, unknown or reserve member', () => {
    const { party } = setup();
    const fainted = party.acquire(creatures[1], 5, 0).instance;
    expect(party.canSwitch(party.active.instanceId)).toBe(false);
    expect(() => party.switchTo(fainted.instanceId)).toThrow();
    expect(() => party.switchTo('missing')).toThrow();
    while (party.state.party.length < 5) party.acquire(creatures[1], 5, 10);
    const reserve = party.acquire(creatures[1], 5, 10).instance;
    expect(party.canSwitch(reserve.instanceId)).toBe(false);
  });
  it('can automatically choose a living member when active is fainted', () => {
    const { party } = setup();
    const extra = party.acquire(creatures[1], 5, 10).instance;
    party.active.currentHp = 0; party.active.status = 'FAINTED';
    expect(party.ensureActive().instanceId).toBe(extra.instanceId);
  });
  it('game state is serializable without definitions, scene objects or functions', () => {
    const { state, session } = setup(); session.attack('SKILL_001');
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(state.party[0]).not.toHaveProperty('definition');
  });
});

describe('capture formula and turn outcomes', () => {
  it('low HP is substantially easier than high HP', () => {
    const system = new CaptureSystem(); const enemy = createBattleEntity(creatures[0], 5);
    const high = system.chance(enemy, 5); enemy.hp = 1;
    expect(system.chance(enemy, 5)).toBeGreaterThan(high); expect(high).toBeCloseTo(0.42);
  });
  it.each([[1, 0.7], [2, 0.7], [3, 1], [5, 1], [8, 1.2], [11, 1.4], [16, 1.6]])('player Lv.%s uses level multiplier %s against Lv.5', (level, multiplier) => {
    const chance = new CaptureSystem().chance(createBattleEntity(creatures[0], 5), level);
    expect(chance).toBeCloseTo(0.7 * 0.6 * multiplier);
  });
  it('six level deficit uses .55', () => expect(new CaptureSystem().chance(createBattleEntity(creatures[0], 10), 4)).toBeCloseTo(0.7 * 0.6 * 0.55));
  it('item modifier participates in the formula before clamping', () => {
    const enemy = createBattleEntity(creatures[0], 5);
    expect(new CaptureSystem().chance(enemy, 5, 0.5)).toBeCloseTo(0.21);
    expect(new CaptureSystem().chance(enemy, 5, 3)).toBe(0.95);
  });
  it('caps at 95 percent and enforces one percent minimum', () => {
    const enemy = createBattleEntity(creatures[0], 5); enemy.hp = 1;
    expect(new CaptureSystem().chance(enemy, 50)).toBe(0.95);
    enemy.definition = { ...enemy.definition, baseCaptureRate: 0 };
    expect(new CaptureSystem().chance(enemy, 1)).toBe(0.01);
  });
  it.each([[0.8, 0.6], [0.5, 0.85], [0.25, 1.15], [0.1, 1.5], [0.09, 1.8]])('HP ratio %s uses modifier %s', (ratio, multiplier) => {
    const enemy = createBattleEntity(creatures[4], 5); enemy.maxHp = 100; enemy.hp = ratio * 100;
    expect(new CaptureSystem().chance(enemy, 5)).toBeCloseTo(0.3 * multiplier);
  });
  it('rejects monster and fainted creature before RNG', () => {
    const rng = vi.fn(() => 0); const system = new CaptureSystem(rng);
    expect(system.attempt(createBattleEntity(monsters[0], 5), 5)).toEqual({ outcome: 'REJECTED', reason: 'MONSTER' });
    const fainted = createBattleEntity(creatures[0], 5); fainted.hp = 0;
    expect(system.attempt(fainted, 5)).toEqual({ outcome: 'REJECTED', reason: 'FAINTED' });
    expect(system.chance(fainted, 5)).toBe(0); expect(rng).not.toHaveBeenCalled();
  });
  it('uses exact probability boundary', () => {
    const enemy = createBattleEntity(creatures[0], 5);
    expect(new CaptureSystem(() => 0.41999).attempt(enemy, 5).outcome).toBe('SUCCESS');
    expect(new CaptureSystem(() => 0.42).attempt(enemy, 5).outcome).toBe('FAILURE');
  });
  it('failure grants an enemy action and creates no instance or EXP', () => {
    const { session, party, state } = setup('CUTE_001', () => 0.99);
    const result = session.capture();
    expect(result.order).toEqual(['enemy']); expect(session.manager.turn).toBe(1);
    expect(party.active.currentHp).toBe(40); expect(party.active.currentExp).toBe(expForLevel(5)); expect(state.party).toHaveLength(1);
  });
  it('success gives no enemy action, saves instance and awards half EXP exactly once', () => {
    const { session, party, state } = setup();
    session.attack('SKILL_001'); const hp = party.active.currentHp;
    const result = session.capture();
    expect(result.result?.outcome).toBe('CAPTURED'); expect(result.order).toEqual([]);
    expect(party.active.currentHp).toBe(hp); expect(party.active.currentExp).toBe(expForLevel(5) + 25);
    expect(state.party[1].currentHp).toBe(40);
    expect(() => session.capture()).toThrow(); expect(() => session.attack('SKILL_001')).toThrow();
    session.finishReturn(); expect(state.party).toHaveLength(2); expect(state.worldFeedback).toContain('加入隊伍');
  });
  it('capture when full is preserved in reserve with feedback', () => {
    const { session, party, state } = setup();
    while (state.party.length < 5) party.acquire(creatures[1], 5, 10);
    session.capture();
    expect(state.party).toHaveLength(5); expect(state.reserveStorage).toHaveLength(1); expect(state.worldFeedback).toContain('隊伍滿了');
  });
  it('a monster rejection consumes neither RNG nor a turn', () => {
    const { session, state } = setup('MON_001');
    expect(session.capture().messages).toEqual(['這個傢伙根本不是來交朋友的！']);
    expect(session.manager.turn).toBe(0); expect(state.reserveStorage).toHaveLength(0); expect(state.party).toHaveLength(1);
  });
  it('PURE_CUTE is capturable and retains prompt, level, skills and HP', () => {
    const { session, state } = setup('CUTE_005');
    expect(session.entry.messages[0]).toBe('這是什麼？上網查一下！');
    session.capture();
    expect(state.party[1]).toMatchObject({ creatureId: 'CUTE_005', level: 5, currentHp: 50, knownSkills: ['SKILL_002', 'SKILL_008'] });
  });
});

describe('integer EXP and level progression', () => {
  it('expForLevel is cubic, integer and strictly increasing through 50', () => {
    expect(expForLevel(5)).toBe(143); expect(expForLevel(6)).toBe(248);
    for (let level = 1; level < 50; level++) { expect(Number.isInteger(expForLevel(level))).toBe(true); expect(expForLevel(level + 1)).toBeGreaterThan(expForLevel(level)); }
  });
  it.each([[-6, 0.5], [-3, 0.75], [-2, 1], [2, 1], [3, 1.25], [6, 1.5]])('level delta %s awards modifier %s', (delta, multiplier) => expect(expLevelModifier(10, 10 + delta)).toBe(multiplier));
  it('EXP floors and has minimum one; capture is half floored defeat EXP', () => {
    expect(battleExperience(0, 1, 50)).toBe(1);
    expect(battleExperience(11, 5, 5)).toBe(55);
    expect(battleExperience(11, 5, 5, true)).toBe(27);
  });
  it('can gain a single level and update HP by delta, not full heal', () => {
    const creature = createCreatureInstance(creatures[0], 5, 'test', 20);
    const result = awardExperience(creature, creatures[0], 105);
    expect(result.levels).toEqual([6]); expect(creature).toMatchObject({ level: 6, maxHp: 54, currentHp: 22, attack: 10, speed: 10 });
  });
  it('multi-level progression updates stats and yields each crossed learnset entry', () => {
    const creature = createCreatureInstance(creatures[0], 5, 'test', 20);
    const result = awardExperience(creature, creatures[0], expForLevel(16) - creature.currentExp);
    expect(result.levels).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(result.newSkills).toEqual(['SKILL_010', 'SKILL_011', 'SKILL_002']);
    expect(creature.maxHp).toBe(82); expect(creature.currentHp).toBe(50); expect(creature.attack).toBe(17); expect(creature.speed).toBe(18);
  });
  it('Lv.50 never levels or receives overflow EXP', () => {
    const creature = createCreatureInstance(creatures[0], 50, 'max');
    expect(awardExperience(creature, creatures[0], 999999).levels).toEqual([]);
    expect(creature.level).toBe(50); expect(creature.currentExp).toBe(expForLevel(50));
  });
  it('can reach but never exceed max level from below', () => {
    const creature = createCreatureInstance(creatures[0], 49, 'max');
    awardExperience(creature, creatures[0], 999999); expect(creature.level).toBe(50); expect(creature.currentExp).toBe(expForLevel(50));
  });
  it('ignores fractional EXP and rejects negative or nonfinite awards', () => {
    const creature = createCreatureInstance(creatures[0], 5, 'fraction');
    awardExperience(creature, creatures[0], 1.9); expect(creature.currentExp).toBe(144);
    expect(() => awardExperience(creature, creatures[0], -1)).toThrow(); expect(() => awardExperience(creature, creatures[0], NaN)).toThrow();
  });
  it('victory gives full EXP to only the last active member', () => {
    const { party, session, state } = setup();
    const member = party.acquire(creatures[3], 5, 44).instance;
    session.switchTo(member.instanceId); session.manager.enemy.hp = 1;
    session.attack('SKILL_001');
    expect(state.party[0].currentExp).toBe(expForLevel(5)); expect(member.currentExp).toBe(expForLevel(5) + 50);
  });
  it('monster victory also gives EXP', () => {
    const { session, party } = setup('MON_001'); session.manager.enemy.hp = 1;
    session.attack('SKILL_001'); expect(party.active.currentExp).toBe(expForLevel(5) + 60);
  });
});

describe('learnsets and fifth skill choices', () => {
  it.each(creatures.map(creature => [creature.id, creature] as const))('%s initializes legal skills at all prototype levels', (_id, creature) => {
    for (let level = 1; level <= 50; level++) {
      const known = skillsAtLevel(creature, level); expect(known.length).toBeGreaterThan(0); expect(known.length).toBeLessThanOrEqual(4); expect(known.every(id => skills[id])).toBe(true);
    }
  });
  it('wild Lv.2–5 creatures and monsters use level-derived skills', () => {
    for (const definition of [...creatures, ...monsters]) for (let level = 2; level <= 5; level++) expect(createBattleEntity(definition, level).definition.skills).toEqual(skillsAtLevel(definition, level));
  });
  it('initialization retains the latest four instead of first four', () => expect(skillsAtLevel(creatures[0], 22)).toEqual(['SKILL_010', 'SKILL_011', 'SKILL_002', 'SKILL_012']));
  it('learns automatically when there is room', () => {
    const member = createCreatureInstance(creatures[0], 5, 'test'); const learning = new SkillLearningSystem(member, ['SKILL_010']);
    expect(learning.advance()).toEqual(['SKILL_010']); expect(member.knownSkills).toHaveLength(3); expect(learning.pending).toEqual([]);
  });
  it('full skill set requires explicit replacement and remains at four', () => {
    const member = createCreatureInstance(creatures[0], 12, 'test'); const learning = new SkillLearningSystem(member, ['SKILL_002']);
    expect(learning.advance()).toEqual([]); expect(learning.pending).toEqual(['SKILL_002']);
    expect(learning.decide(0)).toMatchObject({ learned: 'SKILL_002', forgotten: 'SKILL_001', declined: false });
    expect(member.knownSkills).toHaveLength(4); expect(member.knownSkills[0]).toBe('SKILL_002');
  });
  it('decline preserves old skills, including multiple consecutive decisions', () => {
    const member = createCreatureInstance(creatures[0], 12, 'test'); const before = [...member.knownSkills];
    const learning = new SkillLearningSystem(member, ['SKILL_002', 'SKILL_012']); learning.advance();
    expect(learning.decide().declined).toBe(true); learning.advance(); expect(learning.pending).toEqual(['SKILL_012']); learning.decide();
    expect(member.knownSkills).toEqual(before);
  });
  it('multi-level settlement auto learns first, queues fifth, blocks return until resolved', () => {
    const { session, party, state } = setup();
    party.active.currentExp = expForLevel(22) - 1; session.manager.enemy.hp = 1;
    const result = session.attack('SKILL_001');
    expect(party.active.level).toBe(22); expect(party.active.knownSkills).toHaveLength(4);
    expect(state.pendingLearning?.skillIds).toEqual(['SKILL_002', 'SKILL_012']);
    expect(() => session.finishReturn()).toThrow(); expect(result.messages).not.toContain('戰鬥勝利！');
    session.decideLearning(0); expect(state.pendingLearning?.skillIds).toEqual(['SKILL_012']);
    expect(session.decideLearning()).not.toContain('戰鬥勝利！'); expect(state.pendingLearning).toBeUndefined();
    expect(state.pendingEvolution?.targetId).toBe('EVO_001'); expect(session.applyEvolution()).toContain('戰鬥勝利！');
    session.finishReturn(); expect(state.party[0].knownSkills).toHaveLength(4);
  });
  it('does not duplicate known skills and rejects invalid replacement without dropping queue', () => {
    const member = createCreatureInstance(creatures[0], 12, 'test'); const learning = new SkillLearningSystem(member, ['SKILL_001', 'SKILL_002']); learning.advance();
    expect(learning.pending).toEqual(['SKILL_002']); expect(() => learning.decide(10)).toThrow(); expect(learning.pending).toEqual(['SKILL_002']);
  });
});

describe('party switching and defeat', () => {
  it('normal switch spends a turn and enemy attacks the incoming member', () => {
    const { session, party } = setup(); const outgoingHp = party.active.currentHp;
    const member = party.acquire(creatures[1], 5, 30).instance;
    const turn = session.switchTo(member.instanceId);
    expect(session.manager.turn).toBe(1); expect(turn.order).toEqual(['enemy']); expect(member.currentHp).toBeLessThan(30); expect(party.state.party[0].currentHp).toBe(outgoingHp);
  });
  it('active faint with living ally demands forced switch instead of defeat', () => {
    const { session, party } = setup('CUTE_004'); party.acquire(creatures[1], 5, 30);
    session.attack('SKILL_001'); expect(session.manager.needsSwitch).toBe(true); expect(session.manager.result).toBeUndefined(); expect(party.state.party[0].status).toBe('FAINTED');
  });
  it('forced switch grants no extra enemy action or turn', () => {
    const { session, party } = setup('CUTE_004'); const member = party.acquire(creatures[1], 5, 30).instance;
    session.attack('SKILL_001'); const turnNumber = session.manager.turn;
    expect(session.switchTo(member.instanceId).order).toEqual([]); expect(member.currentHp).toBe(30); expect(session.manager.turn).toBe(turnNumber); expect(session.manager.needsSwitch).toBe(false);
  });
  it('cannot escape or attack while forced selection is pending', () => {
    const { session, party } = setup('CUTE_004'); party.acquire(creatures[1], 5, 30); session.attack('SKILL_001');
    expect(() => session.manager.escape()).toThrow(); expect(() => session.attack('SKILL_001')).toThrow(); expect(() => session.finishReturn()).toThrow();
  });
  it('all faint gives defeat, camp return heals the entire party', () => {
    const { session, state, party } = setup('CUTE_004'); const member = party.acquire(creatures[1], 5, 0).instance;
    session.attack('SKILL_001'); expect(session.manager.result?.outcome).toBe('DEFEAT'); expect(state.party.every(creature => creature.currentHp === 0)).toBe(true);
    session.finishReturn(); expect(state.party.every(creature => creature.currentHp === creature.maxHp && creature.status === 'OK')).toBe(true); expect(member.currentHp).toBe(46);
  });
  it('a failed capture can faint active and require replacement', () => {
    const { session, party } = setup('CUTE_004', () => 0.999); party.acquire(creatures[1], 5, 30);
    session.capture(); expect(session.manager.needsSwitch).toBe(true); expect(session.manager.result).toBeUndefined();
  });
  it('switching after battle end is rejected without changing active ID', () => {
    const { session, party, state } = setup(); const extra = party.acquire(creatures[1], 5, 30).instance;
    session.capture(); const before = state.activeInstanceId; expect(() => session.switchTo(extra.instanceId)).toThrow(); expect(state.activeInstanceId).toBe(before);
  });
});
