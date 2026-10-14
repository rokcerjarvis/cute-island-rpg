import { describe, expect, it, vi } from 'vitest';
import { attributeMultiplier } from '../src/battle/AttributeMultiplier';
import { calculateDamage, checkAccuracy, rollDamageFactor } from '../src/battle/DamageCalculator';
import { determineTurnOrder } from '../src/battle/TurnOrder';
import { chooseEnemySkill } from '../src/battle/EnemyAI';
import { BattleManager, battleReturnState } from '../src/battle/BattleManager';
import { calculateStats } from '../src/battle/StatCalculator';
import { createBattleEntity, type Attribute, type BattleEntity } from '../src/entities/BattleEntity';
import { skills } from '../src/data/skills';
import { entityDefinitions } from '../src/data/encounters';

const attributes: Attribute[] = ['WATER', 'FIRE', 'EARTH', 'WIND', 'PURE_CUTE'];
function entity(ids: string[], speed = 20): BattleEntity {
  const definition = { ...entityDefinitions.CUTE_001, skills: ids, learnset: ids.map(skillId => ({ level: 1, skillId })), baseStats: { hp: 200, attack: 10, speed } };
  return createBattleEntity(definition, 5);
}
function battle(playerIds: string[], enemyIds: string[], playerSpeed = 20, enemySpeed = 10, rng = () => 0.5) {
  return new BattleManager(entity(playerIds, playerSpeed), entity(enemyIds, enemySpeed), skills, rng);
}

describe('attribute damage and stats', () => {
  it.each([['WATER', 'FIRE'], ['FIRE', 'WIND'], ['WIND', 'EARTH'], ['EARTH', 'WATER']] as const)('%s beats %s and reverse is weak', (a, b) => {
    expect(attributeMultiplier(a, b)).toBe(1.5);
    expect(attributeMultiplier(b, a)).toBe(0.75);
  });
  it.each(attributes)('PURE_CUTE and %s are neutral in both directions', attribute => {
    expect(attributeMultiplier('PURE_CUTE', attribute)).toBe(1);
    expect(attributeMultiplier(attribute, 'PURE_CUTE')).toBe(1);
  });
  it('same and unrelated elements are neutral', () => {
    for (const attribute of attributes) expect(attributeMultiplier(attribute, attribute)).toBe(1);
    expect(attributeMultiplier('FIRE', 'EARTH')).toBe(1);
  });
  it('uses injected random factor from 0.9 up to 1.1', () => {
    expect(rollDamageFactor(() => 0)).toBe(0.9);
    expect(rollDamageFactor(() => 0.999999)).toBeLessThanOrEqual(1.1);
    expect(rollDamageFactor(() => 0.5)).toBe(1);
    expect(calculateDamage(20, 10, 'WATER', 'FIRE', () => 0.5)).toBe(20);
    expect(calculateDamage(20, 10, 'WATER', 'EARTH', () => 0.5)).toBe(10);
  });
  it('floors damage, enforces minimum one, and excludes zero power', () => {
    expect(calculateDamage(1, 0, 'WATER', 'EARTH', () => 0)).toBe(1);
    expect(calculateDamage(0, 100, 'WATER', 'FIRE', () => 0.5)).toBe(0);
  });
  it('tests accuracy including hit, miss and endpoints', () => {
    expect(checkAccuracy(80, () => 0.79999)).toBe(true);
    expect(checkAccuracy(80, () => 0.8)).toBe(false);
    expect(checkAccuracy(100, () => 0.9999)).toBe(true);
    expect(checkAccuracy(0, () => 0)).toBe(false);
  });
  it('preserves Lv.5 bases, floors linear growth, clamps positive stats', () => {
    expect(calculateStats(entityDefinitions.CUTE_001, 5)).toEqual({ hp: 52, attack: 10, speed: 10 });
    expect(calculateStats(entityDefinitions.CUTE_002, 2)).toEqual({ hp: 38, attack: 8, speed: 11 });
    expect(calculateStats(entityDefinitions.CUTE_003, 6)).toEqual({ hp: 46, attack: 16, speed: 13 });
    expect(calculateStats({ ...entityDefinitions.CUTE_001, baseStats: { hp: 1, attack: 1, speed: 1 } }, 1)).toEqual({ hp: 1, attack: 1, speed: 1 });
  });
  it('has all 14 skills and all entity loadouts resolve to at most four valid skills', () => {
    expect(Object.keys(skills)).toHaveLength(14);
    for (const definition of Object.values(entityDefinitions)) {
      expect(definition.skills.length).toBeLessThanOrEqual(4);
      expect(definition.skills.every(id => skills[id])).toBe(true);
    }
    expect(skills.SKILL_014.priority).toBe(1);
  });
});

describe('turn order and AI', () => {
  it('prioritizes priority over speed', () => expect(determineTurnOrder(skills.SKILL_008, skills.SKILL_001, 1, 99, () => 0.5)).toEqual(['player', 'enemy']));
  it('uses speed when priorities match', () => expect(determineTurnOrder(skills.SKILL_001, skills.SKILL_001, 10, 20, () => 0)).toEqual(['enemy', 'player']));
  it('uses 50/50 RNG for speed ties', () => {
    expect(determineTurnOrder(skills.SKILL_001, skills.SKILL_001, 10, 10, () => 0.49)).toEqual(['player', 'enemy']);
    expect(determineTurnOrder(skills.SKILL_001, skills.SKILL_001, 10, 10, () => 0.5)).toEqual(['enemy', 'player']);
  });
  it('selects legal skills with mock RNG', () => {
    const enemy = entity(['SKILL_001', 'SKILL_003']);
    expect(chooseEnemySkill(enemy, skills, () => 0).id).toBe('SKILL_001');
    expect(chooseEnemySkill(enemy, skills, () => 0.9999).id).toBe('SKILL_003');
  });
  it('avoids heal at 90 percent or above, but allows low HP and heal-only loadout', () => {
    const enemy = entity(['SKILL_001', 'SKILL_011']);
    enemy.hp = 180;
    expect(chooseEnemySkill(enemy, skills, () => 0.99).id).toBe('SKILL_001');
    enemy.hp = 179;
    expect(chooseEnemySkill(enemy, skills, () => 0.99).id).toBe('SKILL_011');
    expect(chooseEnemySkill(entity(['SKILL_011']), skills, () => 0).id).toBe('SKILL_011');
  });
});

describe('battle resolution and temporary effects', () => {
  it('resolves both actions in a normal complete turn', () => {
    const manager = battle(['SKILL_001'], ['SKILL_001']);
    const turn = manager.resolveTurn('SKILL_001');
    expect(turn.order).toEqual(['player', 'enemy']);
    expect(manager.player.hp).toBe(187);
    expect(manager.enemy.hp).toBe(187);
    expect(manager.turn).toBe(1);
    expect(turn.result).toBeUndefined();
  });
  it('stops the second action on KO and produces victory with bounded HP', () => {
    const manager = battle(['SKILL_001'], ['SKILL_001']);
    manager.enemy.hp = 1;
    const turn = manager.resolveTurn('SKILL_001');
    expect(manager.player.hp).toBe(200);
    expect(manager.enemy.hp).toBe(0);
    expect(turn.messages.filter(line => line.includes('使出了'))).toHaveLength(1);
    expect(turn.messages.join('\n')).toContain('昏倒了！');
    expect(turn.result).toEqual({ outcome: 'VICTORY', returnTo: 'ENCOUNTER' });
    expect(() => manager.resolveTurn('SKILL_001')).toThrow();
  });
  it('produces defeat when faster enemy knocks player out first', () => {
    const manager = battle(['SKILL_001'], ['SKILL_001'], 10, 20);
    manager.player.hp = 1;
    const turn = manager.resolveTurn('SKILL_001');
    expect(manager.enemy.hp).toBe(200);
    expect(turn.result).toEqual({ outcome: 'DEFEAT', returnTo: 'CAMP' });
    expect(turn.messages).toContain('你被送回營地了。');
  });
  it('a missed special skill applies no effect or damage', () => {
    const manager = battle(['SKILL_012'], ['SKILL_001'], 20, 10, () => 0.99);
    const turn = manager.resolveTurn('SKILL_012');
    expect(turn.messages).toContain('但是沒有打中！');
    expect(manager.enemy.hp).toBe(200);
    expect(manager.player.hp).toBe(186); // no 20 percent reduction, factor near 1.1
    expect(manager.enemy.effects.nextAttackMultiplier).toBe(1);
  });
  it('a missed damaging attack neither hurts nor consumes next attack reduction', () => {
    const manager = battle(['SKILL_007'], ['SKILL_010'], 20, 10, () => 0.99);
    manager.player.effects.nextAttackMultiplier = 0.8;
    expect(manager.resolveTurn('SKILL_007').messages).toContain('但是沒有打中！');
    expect(manager.enemy.hp).toBe(200);
    expect(manager.player.effects.nextAttackMultiplier).toBe(0.8);
  });
  it('heals 20 percent and cannot exceed Max HP', () => {
    const manager = battle(['SKILL_011'], ['SKILL_010']);
    manager.player.hp = 100;
    manager.resolveTurn('SKILL_011');
    expect(manager.player.hp).toBe(140);
    manager.player.hp = 195;
    manager.resolveTurn('SKILL_011');
    expect(manager.player.hp).toBe(200);
  });
  it('brace halves damage only after activation and expires this turn', () => {
    const manager = battle(['SKILL_010', 'SKILL_001'], ['SKILL_001']);
    manager.resolveTurn('SKILL_010');
    expect(manager.player.hp).toBe(194);
    expect(manager.player.effects.turnDamageMultiplier).toBe(1);
    manager.resolveTurn('SKILL_001');
    expect(manager.player.hp).toBe(181);
    const slower = battle(['SKILL_010'], ['SKILL_001'], 5, 10);
    slower.resolveTurn('SKILL_010');
    expect(slower.player.hp).toBe(187); // cannot retroactively reduce an earlier hit
  });
  it('feign uses priority and reduces damage by 70 percent for this turn', () => {
    const manager = battle(['SKILL_014'], ['SKILL_001'], 1, 99);
    expect(manager.resolveTurn('SKILL_014').order[0]).toBe('player');
    expect(manager.player.hp).toBe(197);
    expect(manager.player.effects.turnDamageMultiplier).toBe(1);
  });
  it('gaze persists through special skills and reduces exactly one damaging hit', () => {
    const manager = battle(['SKILL_012', 'SKILL_010'], ['SKILL_010']);
    manager.resolveTurn('SKILL_012');
    expect(manager.enemy.effects.nextAttackMultiplier).toBe(0.8);
    manager.enemy.definition = { ...manager.enemy.definition, skills: ['SKILL_001'] };
    manager.resolveTurn('SKILL_010');
    expect(manager.player.hp).toBe(195); // floor(13 * .8 * .5)
    expect(manager.enemy.effects.nextAttackMultiplier).toBe(1);
    manager.resolveTurn('SKILL_010');
    expect(manager.player.hp).toBe(189); // floor(13 * .5)
  });
  it('noise affects the next order exactly once, not the already decided order', () => {
    const manager = battle(['SKILL_001'], ['SKILL_013'], 20, 15);
    expect(manager.resolveTurn('SKILL_001').order[0]).toBe('player');
    expect(manager.player.effects.nextOrderSpeedMultiplier).toBe(0.7);
    manager.enemy.definition = { ...manager.enemy.definition, skills: ['SKILL_010'] };
    expect(manager.resolveTurn('SKILL_001').order[0]).toBe('enemy');
    expect(manager.player.effects.nextOrderSpeedMultiplier).toBe(1);
    expect(manager.resolveTurn('SKILL_001').order[0]).toBe('player');
  });
  it('escape and victory restore encounter position; defeat restores camp', () => {
    const world = { x: 370, y: 522, stepId: 5, zoneId: 'GRASSLAND' };
    const camp = { x: 240, y: 400 };
    expect(battleReturnState(world, battle(['SKILL_001'], ['SKILL_001']).escape(), camp)).toEqual(world);
    expect(battleReturnState(world, { outcome: 'VICTORY', returnTo: 'ENCOUNTER' }, camp)).toEqual(world);
    expect(battleReturnState(world, { outcome: 'DEFEAT', returnTo: 'CAMP' }, camp)).toEqual({ ...world, ...camp, zoneId: 'camp' });
  });
  it('exposes a successful damaging attack hook without running PURE_CUTE passive', () => {
    const hook = vi.fn();
    const manager = new BattleManager(entity(['SKILL_001']), entity(['SKILL_010'], 10), skills, () => 0.5, hook);
    manager.resolveTurn('SKILL_001');
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][0].damage).toBe(13);
  });
  it('rejects skills outside player loadout', () => expect(() => battle(['SKILL_001'], ['SKILL_001']).resolveTurn('SKILL_007')).toThrow());
  it('each new battle starts with full HP and independent temporary effects', () => {
    const source = entity(['SKILL_001']);
    const one = new BattleManager(source, entity(['SKILL_001']), skills, () => 0.5);
    one.resolveTurn('SKILL_001');
    const two = new BattleManager(source, entity(['SKILL_001']), skills, () => 0.5);
    expect(source.hp).toBe(200);
    expect(two.player.hp).toBe(200);
    expect(two.player.effects).not.toBe(one.player.effects);
  });
});
