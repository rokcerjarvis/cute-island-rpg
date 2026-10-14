import { calculateDamage, checkAccuracy } from './DamageCalculator';
import { attributeMultiplier } from './AttributeMultiplier';
import { calculateStats } from './StatCalculator';
import { entityDefinitions } from '../data/encounters';
import { skills } from '../data/skills';
import { BattleManager } from './BattleManager';
import { createBattleEntity } from '../entities/BattleEntity';
import { CuteEventSystem } from './CuteEventSystem';
import { BossSystem } from '../systems/BossSystem';
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
export interface BalanceSummary { label: string; level: number; attacker: string; defender: string; skill: string; samples: number; averageTurns: number; medianTurns: number; minimumTurns: number; maximumTurns: number; oneShotRate: number; twoShotRate: number; averageDamage: number; damagePercent: number; multiplier: number; multiplierImpact: number }
export function simulateMatchup(attackerId: string, defenderId: string, level: number, skillId: string, samples = 1000, seed = 8, label = ''): BalanceSummary {
  const attacker = entityDefinitions[attackerId], defender = entityDefinitions[defenderId], skill = skills[skillId];
  if (!attacker || !defender || !skill || skill.power <= 0 || samples < 1) throw new Error('Invalid simulation case');
  const a = calculateStats(attacker, level), d = calculateStats(defender, level), rng = seededRandom(seed);
  const turns: number[] = []; let totalDamage = 0, hits = 0, neutralDamage = 0;
  for (let trial = 0; trial < samples; trial++) {
    let hp = d.hp, turn = 0;
    while (hp > 0) {
      if (++turn > 500) throw new Error('Simulation did not finish');
      if (!checkAccuracy(skill.accuracy, rng)) continue;
      const factor = rng();
      const damage = calculateDamage(skill.power, a.attack, attacker.attribute, defender.attribute, () => factor, level);
      neutralDamage += calculateDamage(skill.power, a.attack, attacker.attribute, attacker.attribute, () => factor, level);
      totalDamage += damage; hits++; hp -= damage;
    }
    turns.push(turn);
  }
  turns.sort((a,b) => a-b);
  const averageDamage = totalDamage / hits;
  return { label, level, attacker: attackerId, defender: defenderId, skill: skillId, samples, averageTurns: turns.reduce((a,b)=>a+b,0)/samples, medianTurns: (turns[Math.floor((samples-1)/2)]+turns[Math.floor(samples/2)])/2, minimumTurns: turns[0], maximumTurns: turns.at(-1)!, oneShotRate: turns.filter(t=>t===1).length/samples, twoShotRate: turns.filter(t=>t===2).length/samples, averageDamage, damagePercent: averageDamage/d.hp*100, multiplier: attributeMultiplier(attacker.attribute, defender.attribute), multiplierImpact: totalDamage / neutralDamage };
}
export function runBalanceSimulation(samples = 1000): BalanceSummary[] {
  const cases = [
    ['neutral', 'CUTE_001','CUTE_001'], ['advantage','CUTE_001','CUTE_003'], ['disadvantage','CUTE_001','CUTE_004'],
    ['PURE_CUTE','CUTE_005','CUTE_001'], ['high Attack neutral','CUTE_003','CUTE_003'], ['high Attack advantage','CUTE_003','CUTE_002'],
    ['high HP neutral','CUTE_003','CUTE_004'], ['starter wind/water','CUTE_002','CUTE_001'], ['starter earth/wind','CUTE_004','CUTE_002'], ['starter earth/water','CUTE_004','CUTE_001'],
  ];
  return [5,10,20,30].flatMap(level => cases.flatMap(([label,a,d], index) => ['SKILL_001','SKILL_007','SKILL_008'].map((skill,i) => simulateMatchup(a,d,level,skill,samples,level*100+index*3+i,label))));
}
export function simulateBoss(species = 'CUTE_001', level = 12, seed = 8): { outcome?: string; commands: number; effectiveActions: number; heals: number; switches: number } {
  const boss = new BossSystem().entry({ x: 1120, y: 704, zoneId: 'BOSS_AREA', stepId: 1 }).enemy;
  const manager = new BattleManager(createBattleEntity(entityDefinitions[species],level),boss,skills,seededRandom(seed),undefined,()=>true,new CuteEventSystem(seededRandom(seed+1)),true);
  let commands=0,effectiveActions=0,heals=0,switches=0;
  while (!manager.result && commands < 40) {
    let result;
    if (manager.needsSwitch) { if (switches >= 2) break; switches++; result = manager.replacePlayer(createBattleEntity(entityDefinitions[species],level),true); }
    else {
      const heal = heals < 2 && manager.player.definition.skills.includes('SKILL_011') && manager.player.hp < manager.player.maxHp*0.45;
      const attack = manager.player.definition.skills.map(id=>skills[id]).filter(s=>s.power>0).sort((a,b)=>b.power*b.accuracy-a.power*a.accuracy)[0];
      commands++; if (heal) heals++;
      result = manager.resolveTurn(heal ? 'SKILL_011' : attack.id);
    }
    effectiveActions += (result.events ?? []).filter(e => e.type==='ACTION' && e.side==='player' && e.hit).length;
  }
  return {outcome:manager.result?.outcome,commands,effectiveActions,heals,switches};
}
