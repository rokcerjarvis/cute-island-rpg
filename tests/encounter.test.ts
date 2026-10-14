import { describe, expect, it, vi } from 'vitest';
import { encounterTables, entityDefinitions } from '../src/data/encounters';
import { creatures } from '../src/data/creatures';
import { monsters } from '../src/data/monsters';
import { EncounterSystem } from '../src/systems/EncounterSystem';
import { createBattleEntry, encounterMessages } from '../src/entities/BattleEntity';
const table = encounterTables.GRASSLAND;
const step = (stepId: number, encounterEligible = true, moved = true) => ({ stepId, encounterEligible, moved });

describe('step encounter guard', () => {
  it('never rolls on roads, even when forced', () => {
    const rng = vi.fn(() => 0);
    const system = new EncounterSystem(rng);
    expect(system.shouldEncounter(step(1, false), 1, true)).toBe(false);
    expect(rng).not.toHaveBeenCalled();
  });
  it('does not roll while stationary', () => {
    const rng = vi.fn(() => 0);
    expect(new EncounterSystem(rng).shouldEncounter(step(1, true, false), 1)).toBe(false);
    expect(rng).not.toHaveBeenCalled();
  });
  it('allows grass movement at 8 percent and rejects its upper boundary', () => {
    expect(new EncounterSystem(() => 0.07999).shouldEncounter(step(1), table.encounterChance)).toBe(true);
    expect(new EncounterSystem(() => 0.08).shouldEncounter(step(1), table.encounterChance)).toBe(false);
  });
  it('honors zero and full chance', () => {
    expect(new EncounterSystem(() => 0).shouldEncounter(step(1), 0)).toBe(false);
    expect(new EncounterSystem(() => 0.9999).shouldEncounter(step(1), 1)).toBe(true);
  });
  it('never rolls the same step twice or an older step', () => {
    const rng = vi.fn(() => 0);
    const system = new EncounterSystem(rng);
    expect(system.shouldEncounter(step(5), 1)).toBe(true);
    expect(system.shouldEncounter(step(5), 1)).toBe(false);
    expect(system.shouldEncounter(step(4), 1)).toBe(false);
    expect(rng).toHaveBeenCalledTimes(1);
  });
  it('guards the return tile and next two grass steps, including debug force', () => {
    const rng = vi.fn(() => 0);
    const system = new EncounterSystem(rng);
    system.onBattleReturn(5);
    expect(system.shouldEncounter(step(5), 1, true)).toBe(false);
    expect(system.shouldEncounter(step(6, false), 1)).toBe(false);
    expect(system.shouldEncounter(step(7), 1, true)).toBe(false);
    expect(system.shouldEncounter(step(7), 1, true)).toBe(false);
    expect(system.shouldEncounter(step(8), 1, true)).toBe(false);
    expect(rng).not.toHaveBeenCalled();
    expect(system.shouldEncounter(step(9), 1)).toBe(true);
  });
});

describe('encounter data and payload', () => {
  it.each([[0, 'CUTE_002'], [0.32, 'CUTE_004'], [0.64, 'CUTE_001'], [0.80, 'CUTE_003'], [0.90, 'CUTE_005'], [0.95, 'MON_001'], [0.9999, 'MON_001']] as const)('weighted roll %s selects %s', (rng, id) => {
    expect(new EncounterSystem(() => rng).rollEncounter(table, entityDefinitions).id).toBe(id);
  });
  it('normalizes weights without requiring a total of 100', () => {
    const scaled = { ...table, entries: table.entries.map(entry => ({ ...entry, weight: entry.weight * 3 })) };
    expect(new EncounterSystem(() => 0.92).rollEncounter(scaled, entityDefinitions).id).toBe('CUTE_005');
  });
  it('rolls every integer level from 2 through 5', () => {
    expect([0, 0.25, 0.5, 0.99999].map(rng => new EncounterSystem(() => rng).rollLevel(table))).toEqual([2, 3, 4, 5]);
  });
  it('has five capturable cute creatures and three noncapturable monsters', () => {
    expect(creatures).toHaveLength(5);
    expect(monsters).toHaveLength(3);
    expect(creatures.every(entity => entity.kind === 'CUTE_CREATURE' && entity.capturable)).toBe(true);
    expect(monsters.every(entity => entity.kind === 'MONSTER' && !entity.capturable && entity.baseCaptureRate === 0)).toBe(true);
    expect(entityDefinitions.MON_003.boss).toBe(true);
    expect(table.entries.some(entry => entry.entityId === 'MON_003')).toBe(false);
    expect(table.entries.every(entry => entityDefinitions[entry.entityId])).toBe(true);
  });
  it('returns PURE_CUTE special prompt for every encounter', () => {
    for (let index = 0; index < 3; index++) expect(encounterMessages(entityDefinitions.CUTE_005)).toEqual(['這是什麼？上網查一下！', '野生的 飛鼠 出現了！']);
    expect(encounterMessages(entityDefinitions.CUTE_002)).toEqual(['野生的 小八 出現了！']);
    expect(encounterMessages(entityDefinitions.MON_001)).toEqual(['怪物 黑團蟲 出現了！']);
  });
  it('preserves correct entity and independent world position/zone payload', () => {
    const world = { x: 352, y: 505, zoneId: 'GRASSLAND', stepId: 16 };
    const payload = createBattleEntry(entityDefinitions.CUTE_005, 3, world);
    expect(payload.enemy).toEqual({ definition: { ...entityDefinitions.CUTE_005, skills: ['SKILL_002'] }, level: 3, stats: { hp: 44, attack: 6, speed: 9 }, hp: 44, maxHp: 44 });
    expect(payload.world).toEqual(world);
    world.x = 0;
    expect(payload.world.x).toBe(352);
  });
});
