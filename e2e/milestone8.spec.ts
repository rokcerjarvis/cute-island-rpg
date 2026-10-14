import {test,expect,type Page} from '@playwright/test';
import {clickScene,startLegacyGame,acknowledgeIntro,titleReady} from './helpers';
import {readFileSync,writeFileSync} from 'node:fs';
test.setTimeout(120000);
async function state(page:Page){return page.evaluate(async path=>{const{game}=await import(path);const b=game.scene.getScene('BattleScene'),w=game.scene.getScene('WorldScene');return{battle:game.scene.isActive('BattleScene'),world:game.scene.isActive('WorldScene'),runtime:game.registry.get('game-state'),hp:b.manager?.enemy.hp,maxHp:b.manager?.enemy.maxHp,playerHp:b.manager?.player.hp,turn:b.manager?.turn,outcome:b.manager?.result?.outcome,trace:b.presentation?.trace,resolving:b.resolving,log:b.children.getByName('battle-log')?.text,history:b.queue?.history,bar:b.children.getByName('enemy-hp-bar')?.width,offers:b.children.list.filter((o:{name:string})=>o.name==='invitation-offer').length,panel:w.children.getByName('world-panel')?.list.filter((o:{type:string})=>o.type==='Text').map((o:{text:string})=>o.text).join('\n')};},'/src/main.ts');}
async function open(page:Page,query=''){await page.goto(`http://127.0.0.1:5191/?debugEncounters=1&${query}`);await startLegacyGame(page);}
async function encounter(page:Page){await page.keyboard.press('F1');await clickScene(page,'WorldScene','debug-encounter');await expect.poll(async()=>(await state(page)).battle).toBe(true);await acknowledgeIntro(page);}
async function settle(page:Page){await expect.poll(async()=>(await state(page)).resolving,{timeout:30000}).toBe(false);}
async function attack(page:Page,id='SKILL_001'){await clickScene(page,'BattleScene','battle-option-0');await clickScene(page,'BattleScene',`skill-${id}`);await settle(page);}
async function invite(page:Page,item='capture-item'){await clickScene(page,'BattleScene','battle-option-1');await clickScene(page,'BattleScene',item);await settle(page);}
async function back(page:Page){await clickScene(page,'BattleScene','battle-return');await expect.poll(async()=>(await state(page)).world).toBe(true);}
async function deterministic(page:Page){await page.evaluate(async path=>{const{game}=await import(path);game.scene.getScene('BattleScene').manager.rng=()=>.5;},'/src/main.ts');}
test('M8 A: Lv5 neutral battle lasts >2 turns with damage and HP bar',async({page})=>{
  await open(page,'entity=CUTE_001&encounterLevel=5');await encounter(page);await deterministic(page);await attack(page);expect((await state(page)).hp).toBe(39);await expect.poll(async()=>(await state(page)).bar).toBeCloseTo(126*39/52,1);await attack(page);expect((await state(page)).outcome).toBeUndefined();expect((await state(page)).trace).toContain('HIT');
  while(!(await state(page)).outcome)await attack(page,'SKILL_003');expect((await state(page)).turn).toBeGreaterThanOrEqual(3);await back(page);
});
test('M8 B: advantage heavy damages heavily without one-shot',async({page})=>{
  await open(page,'partySpecies=CUTE_003&partyLevel=12&entity=CUTE_002&encounterLevel=12');await encounter(page);await deterministic(page);const max=(await state(page)).maxHp;await attack(page,'SKILL_007');const after=await state(page);expect(after.hp).toBeGreaterThan(0);expect(max-after.hp).toBeGreaterThan(max*.5);expect(after.outcome).toBeUndefined();
});
for(const [name,item,query,success]of[
  ['C small snack success','capture-item','invite=success',true],['D small snack failure','capture-item','invite=fail',false],['E luxury','invite-luxury','invite=success&item=luxury',true],['F money bypasses forced failure','invite-bribe','invite=fail&item=bribe',true],
]as const)test(`M8 ${name}`,async({page})=>{
  await open(page,`entity=CUTE_001&encounterLevel=5&${query}`);await encounter(page);await deterministic(page);const before=await state(page);await invite(page,item);const after=await state(page);expect(after.trace).not.toContain('CAPTURE_SHAKE_1');expect(after.offers).toBe(0);
  const id=item==='invite-bribe'?'INVITE_BRIBE':item==='invite-luxury'?'INVITE_LUXURY':'CAPTURE_ITEM_001';expect(after.runtime.inventory[id]).toBe(before.runtime.inventory[id]-1);
  if(success){expect(after.outcome).toBe('CAPTURED');expect(after.playerHp).toBe(before.playerHp);expect(after.trace).toContain('INVITE_JOIN');expect(after.runtime.party).toHaveLength(2);if(item==='invite-bribe'){expect(after.trace).toContain('BRIBE_MONEY');expect(after.trace).toContain('BRIBE_LOOK');expect(after.log).toContain('金錢建立了深厚的友情。');}await back(page);}
  else{expect(after.turn).toBe(1);expect(after.trace.indexOf('INVITE_DECLINE')).toBeLessThan(after.trace.indexOf('ACTION'));expect(after.playerHp).toBeLessThan(before.playerHp);expect(after.runtime.party).toHaveLength(1);}
  await page.screenshot({path:`artifacts/milestone-8-${id}-${success?'success':'failure'}.png`});
});
test('M8 G: Monster rejects every invitation without consumption or animations',async({page})=>{
  await open(page,'entity=MON_001&encounterLevel=5&item=bribe');await encounter(page);const before=(await state(page)).runtime.inventory;
  for(const item of ['capture-item','invite-luxury','invite-bribe']){await invite(page,item);expect((await state(page)).log).toContain('這個傢伙根本不是來交朋友的！');expect((await state(page)).turn).toBe(0);}
  expect((await state(page)).runtime.inventory).toEqual(before);expect((await state(page)).trace).not.toContain('CAPTURE');
});
test('M8 H: full Boss rejects every invitation without consumption',async({page})=>{
  await open(page,'item=bribe');await page.keyboard.press('F1');await clickScene(page,'WorldScene','debug-boss');await page.keyboard.press('Enter');await expect.poll(async()=>(await state(page)).battle).toBe(true);await acknowledgeIntro(page);expect((await state(page)).hp).toBe(128);const before=(await state(page)).runtime.inventory;
  for(const item of ['capture-item','invite-luxury','invite-bribe']){await invite(page,item);expect((await state(page)).log).toContain('現在不是交朋友的時候！');expect((await state(page)).turn).toBe(0);}
  expect((await state(page)).runtime.inventory).toEqual(before);expect((await state(page)).trace).not.toContain('CAPTURE');
});
test('M8 I: full Party joins Reserve and saves stock across Continue',async({page})=>{
  await open(page,'entity=CUTE_002&encounterLevel=5&item=bribe&invite=fail');await page.keyboard.press('F6');await encounter(page);await invite(page,'invite-bribe');expect((await state(page)).runtime.party).toHaveLength(5);expect((await state(page)).runtime.reserveStorage).toHaveLength(1);expect((await state(page)).log).toContain('加入 Reserve');await back(page);await page.reload();await titleReady(page);await clickScene(page,'TitleScene','title-continue');await expect.poll(async()=>(await state(page)).world).toBe(true);expect((await state(page)).runtime.reserveStorage).toHaveLength(1);expect((await state(page)).runtime.inventory.INVITE_BRIBE).toBe(0);
});
test('M8 J: PURE_CUTE prompt repeats and invitation UI does not accumulate',async({page})=>{
  await open(page,'entity=CUTE_005&encounterLevel=5&invite=success');for(let i=0;i<2;i++){await encounter(page);await invite(page);expect((await state(page)).runtime.party).toHaveLength(i+2);expect((await state(page)).offers).toBe(0);expect((await state(page)).trace.filter((t:string)=>t==='INVITE_OFFER')).toHaveLength(1);await back(page);}expect((await state(page)).runtime.pureCuteMissCount).toBe(0);
});
test('M8 K: unforced full Boss with heal, defend and switch; no RNG injection',async({page})=>{
  await open(page,'partyLevel=12');
  // Fixture adds a legitimate Lv12 companion; neither Boss HP nor combat RNG changes.
  await page.evaluate(async paths=>{const{game}=await import(paths.main),{PartySystem}=await import(paths.party),{creatures}=await import(paths.creatures);const party=new PartySystem(game.registry.get('game-state'));party.acquire(creatures[2],12,999);party.acquire(creatures[4],12,999);},{main:'/src/main.ts',party:'/src/systems/PartySystem.ts',creatures:'/src/data/creatures.ts'});
  await page.keyboard.press('F1');await clickScene(page,'WorldScene','debug-boss');await page.keyboard.press('Enter');await expect.poll(async()=>(await state(page)).battle).toBe(true);await acknowledgeIntro(page);expect((await state(page)).hp).toBe(128);
  const snapshots=[];for(const skill of ['SKILL_003','SKILL_003','SKILL_011','SKILL_010']){await attack(page,skill);snapshots.push(await state(page));if((await state(page)).outcome)break;}
  await clickScene(page,'BattleScene','battle-option-2');await clickScene(page,'BattleScene','party-creature-2');await settle(page);snapshots.push(await state(page));
  let attempts=0;while(!(await state(page)).outcome&&attempts++<20){
    const current=await state(page);
    if(current.runtime.battle.needsSwitch){const next=current.runtime.party.find((c:{instanceId:string;currentHp:number})=>c.currentHp>0&&c.instanceId!==current.runtime.activeInstanceId);expect(next).toBeDefined();await clickScene(page,'BattleScene',`party-${next.instanceId}`);await settle(page);}
    else {const active=current.runtime.party.find((c:{instanceId:string})=>c.instanceId===current.runtime.activeInstanceId);await attack(page,active.creatureId==='CUTE_003'?'SKILL_007':'SKILL_003');}
    snapshots.push(await state(page));
  }
  const result=await state(page);expect(result.outcome).toBe('VICTORY');expect(result.trace).toContain('HEAL');expect(result.trace).toContain('DEFEND');expect(result.turn).toBeGreaterThanOrEqual(6);expect(result.runtime.inventory.CAPTURE_ITEM_001).toBe(10);writeFileSync('artifacts/milestone-8-unforced-boss-edge.json',JSON.stringify({rng:'natural Math.random; no injection',initialHP:128,commands:result.turn,snapshots},null,2));await page.screenshot({path:'artifacts/milestone-8-boss.png'});await back(page);expect((await state(page)).runtime.bossDefeated).toBe(true);
});
test('M8 M7 v1 fixture Continue retains evolved Reserve, Dex, camp and supplies defaults',async({page})=>{
  const data=JSON.parse(readFileSync('tests/fixtures/milestone7-save-v1.json','utf8'));await page.addInitScript(data=>localStorage.setItem('pan-james.save.v1',JSON.stringify(data)),data);await page.goto('http://127.0.0.1:5191/');await titleReady(page);await clickScene(page,'TitleScene','title-continue');await expect.poll(async()=>(await state(page)).world).toBe(true);const s=(await state(page)).runtime;expect(s.schemaVersion).toBe(1);expect(s.bossDefeated).toBe(true);expect(s.reserveStorage[0].creatureId).toBe('EVO_001');expect(s.reserveStorage[1].creatureId).toBe('EVO_002');expect(s.dex).toEqual(data.dex);expect(s.inventory).toEqual({CAPTURE_ITEM_001:10,INVITE_LUXURY:3,INVITE_BRIBE:0});
});
