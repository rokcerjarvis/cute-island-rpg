import { describe, expect, it, vi } from 'vitest';
import { calculateDamage, rollDamageFactor } from '../src/battle/DamageCalculator';
import { calculateStats } from '../src/battle/StatCalculator';
import { CaptureSystem } from '../src/battle/CaptureSystem';
import { PartyBattleSession } from '../src/battle/PartyBattleSession';
import { createBattleEntry, createBattleEntity } from '../src/entities/BattleEntity';
import { entityDefinitions } from '../src/data/encounters';
import { creatures } from '../src/data/creatures';
import { skills } from '../src/data/skills';
import { invitationItems, defaultInvitationInventory, type InvitationItemId } from '../src/data/invitationItems';
import { createRuntimeGameState } from '../src/state/RuntimeGameState';
import { createCreatureInstance, PartySystem } from '../src/systems/PartySystem';
import { deserializeGameState, serializeGameState, validateSaveData, migrateSaveData } from '../src/systems/SaveSystem';
import { BossSystem } from '../src/systems/BossSystem';
import { seededRandom, simulateMatchup, simulateBoss } from '../src/battle/BalanceSimulation';
const fs = await vi.importActual<{readFileSync(path: string, encoding:string):string}>('node:fs');
const world={x:353,y:522,zoneId:'GRASSLAND',stepId:7};
function session(species='CUTE_002',rng=()=>0) {
  const state=createRuntimeGameState({x:240,y:400}); state.inventory.INVITE_BRIBE=2;
  return new PartyBattleSession(state,createBattleEntry(entityDefinitions[species],5,world),()=>0,new CaptureSystem(rng));
}
describe('M8 damage and deterministic stats',()=>{
  it('uses final coefficients and actual attacker level',()=>expect(calculateDamage(20,10,'WATER','WATER',()=>.5,10)).toBe(15));
  it('minimum one for damaging skills',()=>expect(calculateDamage(1,0,'WATER','EARTH',()=>0,1)).toBe(1));
  it('zero-power skills never cause damage',()=>expect(calculateDamage(0,100,'FIRE','WIND',()=>1,50)).toBe(0));
  it.each([0,.5,1])('RNG factor endpoint %s',r=>expect(rollDamageFactor(()=>r)).toBeCloseTo(.9+r*.2));
  it.each([['WATER',13],['FIRE',20],['EARTH',10],['PURE_CUTE',13]] as const)('neutral/advantage/disadvantage/PURE %s', (a,d)=>expect(calculateDamage(20,10,'WATER',a,()=>.5,5)).toBe(d));
  it.each([['SKILL_001',13],['SKILL_007',22],['SKILL_008',12]] as const)('category damage %s',(id,damage)=>expect(calculateDamage(skills[id].power,10,'WATER','WATER',()=>.5,5)).toBe(damage));
  it('low attack PURE_CUTE still damages',()=>expect(calculateDamage(24,7,'PURE_CUTE','FIRE',()=>.5,5)).toBe(12));
  it.each(creatures)('$id HP and Attack growth',d=>{
    const stats=calculateStats(d,30);expect(stats.hp).toBe(Math.floor(d.baseStats.hp+25*d.hpGrowth));expect(stats.attack).toBe(Math.floor(d.baseStats.attack+25*d.attackGrowth));
  });
  it.each(creatures)('$id same species same level same stats across 40 instances',d=>{
    const copies=Array.from({length:40},(_,i)=>createCreatureInstance(d,20,`test-${i}`));
    const first=copies[0];for(const c of copies)expect([c.maxHp,c.currentHp,c.attack,c.speed]).toEqual([first.maxHp,first.currentHp,first.attack,first.speed]);
  });
  it('seed produces identical sequences',()=>{const a=seededRandom(8),b=seededRandom(8);expect(Array.from({length:50},a)).toEqual(Array.from({length:50},b));});
  it.each([5,10,20,30])('Lv%s neutral stable remains 3–5 attempts',level=>{
    const result=simulateMatchup('CUTE_001','CUTE_001',level,'SKILL_001',500,8);expect(result.averageTurns).toBeGreaterThanOrEqual(3);expect(result.averageTurns).toBeLessThanOrEqual(5);expect(result.oneShotRate).toBe(0);
  });
  it('no major decline Lv5 to 30',()=>expect(simulateMatchup('CUTE_001','CUTE_001',30,'SKILL_001',1000).averageTurns).toBeGreaterThan(simulateMatchup('CUTE_001','CUTE_001',5,'SKILL_001',1000).averageTurns*.9));
  it('heavy advantage is strong but not a universal one-shot',()=>{const r=simulateMatchup('CUTE_003','CUTE_002',5,'SKILL_007',1000);expect(r.oneShotRate).toBe(0);expect(r.multiplierImpact).toBeGreaterThan(1.45);expect(r.averageDamage).toBeGreaterThan(35);});
  it('Boss has varied skills and full stats',()=>{const e=new BossSystem().entry(world).enemy;expect(e).toMatchObject({level:11,maxHp:128,stats:{hp:128,attack:14,speed:11}});expect(e.definition.skills).toHaveLength(4);});
  it('representative neutral Boss has 6–10 effective player actions',()=>{const results=Array.from({length:300},(_,i)=>simulateBoss('CUTE_001',12,i+8));expect(results.every(r=>r.outcome==='VICTORY')).toBe(true);const mean=results.reduce((a,r)=>a+r.effectiveActions,0)/results.length;expect(mean).toBeGreaterThanOrEqual(6);expect(mean).toBeLessThanOrEqual(10);expect(results.some(r=>r.heals>0&&r.switches>0)).toBe(true);});
});
describe('M8 invitation items and consumption',()=>{
  it('small snack success consumes exactly one and enemy never acts',()=>{const s=session();const hp=s.manager.player.hp;const r=s.capture();expect(r.result?.outcome).toBe('CAPTURED');expect(r.events).toEqual([{type:'CAPTURE',success:true,item:'SNACK'}]);expect(s.state.inventory.CAPTURE_ITEM_001).toBe(9);expect(s.manager.player.hp).toBe(hp);expect(s.state.party).toHaveLength(2);});
  it('small snack failure consumes and enemy acts',()=>{const s=session('CUTE_002',()=>.999);const r=s.capture();expect(r.order).toEqual(['enemy']);expect(s.manager.turn).toBe(1);expect(s.state.inventory.CAPTURE_ITEM_001).toBe(9);expect(s.state.party).toHaveLength(1);expect(s.manager.player.hp).toBeLessThan(s.manager.player.maxHp);});
  it('luxury modifier increases chance 1.5x',()=>{const e=createBattleEntity(creatures[0],5),c=new CaptureSystem(()=>.5);expect(c.chance(e,5,1.5)).toBeCloseTo(c.chance(e,5)*1.5);expect(c.attempt(e,5).outcome).toBe('FAILURE');expect(c.attempt(e,5,'INVITE_LUXURY').outcome).toBe('SUCCESS');});
  it('luxury success consumes its own slot',()=>{const s=session();expect(s.capture('INVITE_LUXURY').events?.[0]).toMatchObject({item:'LUXURY'});expect(s.state.inventory.INVITE_LUXURY).toBe(2);expect(s.state.inventory.CAPTURE_ITEM_001).toBe(10);});
  it('ordinary chance cap remains 95%',()=>{const e=createBattleEntity(creatures[0],5);e.hp=1;expect(new CaptureSystem().chance(e,50,1.5)).toBe(.95);});
  it('ordinary chance floor remains 1%',()=>{const e=createBattleEntity({...creatures[0],baseCaptureRate:0},50);expect(new CaptureSystem().chance(e,1)).toBe(.01);});
  it.each([1,50])('bribe ignores level and HP at enemy level %s',level=>{const rng=vi.fn(()=>.999999);const e=createBattleEntity(creatures[4],level);e.hp=1;expect(new CaptureSystem(rng).attempt(e,1,'INVITE_BRIBE')).toEqual({outcome:'SUCCESS',chance:1});expect(rng).not.toHaveBeenCalled();});
  it('bribe ignores 95% cap at full HP',()=>expect(new CaptureSystem(()=>1).attempt(createBattleEntity(creatures[0],50),1,'INVITE_BRIBE')).toEqual({outcome:'SUCCESS',chance:1}));
  it('bribe sequence has exact fixed text and consumes once',()=>{const s=session('CUTE_005',()=>.999);const r=s.capture('INVITE_BRIBE');expect(r.messages.slice(0,4)).toEqual(['你拿出了錢。','飛鼠 盯著錢看。','飛鼠 願意跟你走了！','金錢建立了深厚的友情。']);expect(s.state.inventory.INVITE_BRIBE).toBe(1);expect(r.order).toEqual([]);expect(()=>s.capture('INVITE_BRIBE')).toThrow();expect(s.state.inventory.INVITE_BRIBE).toBe(1);});
  it.each(invitationItems)('$id rejects Monster without RNG, consumption or animation',item=>{const rng=vi.fn(()=>0);const s=session('MON_001',rng),before={...s.state.inventory};const r=s.capture(item.id);expect(r.messages).toEqual(['這個傢伙根本不是來交朋友的！']);expect(r.events).toBeUndefined();expect(s.state.inventory).toEqual(before);expect(s.manager.turn).toBe(0);expect(rng).not.toHaveBeenCalled();});
  it.each(invitationItems)('$id rejects Boss without RNG, consumption or animation',item=>{const rng=vi.fn(()=>0);const state=createRuntimeGameState({x:240,y:400});state.inventory.INVITE_BRIBE=1;const s=new PartyBattleSession(state,new BossSystem().entry(world),()=>0,new CaptureSystem(rng));expect(s.capture(item.id).messages).toEqual(['現在不是交朋友的時候！']);expect(state.inventory[item.id]).toBe(item.id==='INVITE_BRIBE'?1:item.id==='INVITE_LUXURY'?3:10);expect(s.manager.turn).toBe(0);expect(rng).not.toHaveBeenCalled();});
  it('story flag rejects money',()=>{const e=createBattleEntity({...creatures[0],invitationBlocked:true},5);expect(new CaptureSystem(()=>0).attempt(e,5,'INVITE_BRIBE')).toEqual({outcome:'REJECTED',reason:'STORY'});});
  it('fainted creature cannot be invited even for money',()=>{const e=createBattleEntity(creatures[0],5);e.hp=0;expect(new CaptureSystem().attempt(e,5,'INVITE_BRIBE')).toEqual({outcome:'REJECTED',reason:'FAINTED'});});
  it('empty inventory consumes no action',()=>{const s=session();s.state.inventory.CAPTURE_ITEM_001=0;expect(s.capture().messages[0]).toContain('用完');expect(s.manager.turn).toBe(0);expect(s.state.party).toHaveLength(1);});
  it('sleep consumes a turn but no item',()=>{const s=session();s.manager.player.effects.skipNextAction=true;const r=s.capture('INVITE_BRIBE');expect(s.state.inventory.INVITE_BRIBE).toBe(2);expect(r.events?.[0]).toMatchObject({type:'SLEEP'});expect(s.manager.result).toBeUndefined();});
  it('full Party joins Reserve with preserved HP and EXP rule',()=>{const s=session();const party=new PartySystem(s.state);while(s.state.party.length<5)party.acquire(creatures[0],5,10);s.manager.enemy.hp=10;const exp=party.active.currentExp;const r=s.capture('INVITE_BRIBE');expect(s.state.reserveStorage[0]).toMatchObject({creatureId:'CUTE_002',currentHp:10,level:5});expect(r.messages.join('\n')).toContain('加入 Reserve');expect(party.active.currentExp-exp).toBe(25);});
  it('acquisition metadata supports all four future sources without a shop system',()=>{for(const item of invitationItems)expect(item.acquisition).toEqual(['SHOP','QUEST','CHEST','EVENT']);expect(invitationItems.find(i=>i.id==='INVITE_BRIBE')?.shopPriceTier).toBe('HIGH');});
});
describe('M8 schema v1 compatibility',()=>{
  it.each(['milestone6-save-v1.json','milestone7-save-v1.json'])('legacy %s preserves progression and defaults inventory',filename=>{const input=JSON.parse(fs.readFileSync(`tests/fixtures/${filename}`,'utf8'));expect(input.inventory).toBeUndefined();expect(validateSaveData(input)).toBe(true);const {state}=deserializeGameState(input);expect(state.inventory).toEqual(defaultInvitationInventory());expect(state.schemaVersion).toBe(1);expect(state.party[0].currentHp).toBe(input.party[0].currentHp);expect(state.reserveStorage.map(c=>c.creatureId)).toEqual(input.reserveStorage.map((c:{creatureId:string})=>c.creatureId));expect(state.bossDefeated).toBe(true);expect(state.dex).toEqual(input.dex);expect(validateSaveData(serializeGameState(state))).toBe(true);expect(input.inventory).toBeUndefined();});
  it('save/load preserves remaining stock and independent object',()=>{const state=createRuntimeGameState({x:240,y:400});state.inventory.INVITE_BRIBE=2;state.inventory.CAPTURE_ITEM_001=4;const data=serializeGameState(state),loaded=deserializeGameState(data).state;expect(loaded.inventory).toEqual(state.inventory);loaded.inventory.INVITE_BRIBE=0;expect(state.inventory.INVITE_BRIBE).toBe(2);expect(data.inventory?.INVITE_BRIBE).toBe(2);});
  it.each([-1,1.5,null,'3',Infinity])('rejects malformed stock %s',value=>{const data=serializeGameState(createRuntimeGameState({x:240,y:400}));(data.inventory as Record<InvitationItemId,unknown>).INVITE_BRIBE=value;expect(validateSaveData(data)).toBe(false);expect(()=>migrateSaveData(data)).toThrow();});
  it('old capture item id remains usable',()=>expect(invitationItems[0].id).toBe('CAPTURE_ITEM_001'));
});
