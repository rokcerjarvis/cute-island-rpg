import { test, expect, type Page } from '@playwright/test';
import { clickScene, startLegacyGame, acknowledgeIntro, titleReady } from './helpers';
import { readFileSync } from 'node:fs';
test.setTimeout(90000);
async function view(page: Page) {
  return page.evaluate(async path => {
    const { game } = await import(path), world = game.scene.getScene('WorldScene'), battle = game.scene.getScene('BattleScene');
    return { world:game.scene.isActive('WorldScene'), battle:game.scene.isActive('BattleScene'), pending:world.battlePending, runtime:game.registry.get('game-state'), resolving:battle.resolving,
      intro:battle.introReady, pure:Boolean(battle.children.getByName('pure-confirm')), trace:battle.presentation?.trace,
      playerTexture:battle.children.getByName('player-sprite')?.texture.key, enemyTexture:battle.children.getByName('enemy-sprite')?.texture.key,
      playerHP:battle.manager?.player.hp, enemyHP:battle.manager?.enemy.hp, turn:battle.manager?.turn, outcome:battle.manager?.result?.outcome,
      enemyBar:battle.children.getByName('enemy-hp-bar')?.width, log:battle.children.getByName('battle-log')?.text, detail:battle.children.getByName('dialogue-text')?.text,
      shape:Boolean(battle.children.getByName('evolution-silhouette')), ball:Boolean(battle.children.getByName('invitation-offer')),
      panel:world.children.getByName('world-panel')?.list.filter((c:{type:string})=>c.type==='Text').map((c:{text:string})=>c.text).join('\n'),
      portraits:world.children.getByName('world-panel')?.list.filter((c:{name:string})=>c.name.startsWith('party-portrait')).map((c:{texture:{key:string}})=>c.texture.key),
      slots:world.children.getByName('world-panel')?.list.filter((c:{name:string})=>c.name.startsWith('party-slot')).length,
      camp:world.children.getByName('camp-upgrade')?.visible, boss:world.children.getByName('boss-marker')?.visible,
      x:world.children.getByName('player')?.x, feedback:world.children.getByName('world-feedback')?.text,
      saved:world.children.getByName('autosave-indicator')?.text,
    };
  },'/src/main.ts');
}
async function open(page:Page,query:string){await page.goto(`http://127.0.0.1:5191/?debugEncounters=1&${query}`);await startLegacyGame(page);}
async function force(page:Page,ack=true){await page.keyboard.press('F1');await clickScene(page,'WorldScene','debug-encounter');expect((await view(page)).pending).toBe(true);await expect.poll(async()=>(await view(page)).battle).toBe(true);if(ack)await acknowledgeIntro(page);}
async function seed(page:Page,value=0){await page.evaluate(async input=>{const{game}=await import(input.main),{BattleManager}=await import(input.battle),{skills}=await import(input.skills),{CuteEventSystem}=await import(input.cute);const b=game.scene.getScene('BattleScene');const events=new CuteEventSystem(()=>0.99);if(b.manager.cuteEvents.forcedNext)events.forceNext(b.manager.cuteEvents.forcedNext);if(b.entry.isBoss)b.manager.enemy.definition.skills=['SKILL_005'];b.manager=new BattleManager(b.manager.player,b.manager.enemy,skills,()=>input.value,undefined,()=>b.session.party.hasReplacement(),events,Boolean(b.entry.isBoss));},{main:'/src/main.ts',battle:'/src/battle/BattleManager.ts',skills:'/src/data/skills.ts',cute:'/src/battle/CuteEventSystem.ts',value});}
async function settled(page:Page){await expect.poll(async()=>(await view(page)).resolving,{timeout:30000}).toBe(false);}
async function attack(page:Page,id='SKILL_001'){await clickScene(page,'BattleScene','battle-option-0');await clickScene(page,'BattleScene',`skill-${id}`);await settled(page);}
async function returned(page:Page){await clickScene(page,'BattleScene','battle-return');await expect.poll(async()=>(await view(page)).world).toBe(true);}
async function capture(page:Page){await clickScene(page,'BattleScene','battle-option-1');await clickScene(page,'BattleScene','capture-item');}

test('Flow O: transition, intro, keyboard skill, lock, damage, faint and return',async({page})=>{
  await open(page,'entity=CUTE_001&encounterLevel=5');await force(page);await seed(page);
  expect((await view(page)).enemyTexture).toBe('creature-cute_001');expect((await view(page)).trace).toContain('INTRO');
  await page.keyboard.press('Enter');expect((await view(page)).detail).toContain('威力 20');await page.keyboard.press('Space');
  expect((await view(page)).resolving).toBe(true);await page.keyboard.press('1');expect((await view(page)).turn).toBe(1);await settled(page);
  await expect.poll(async()=>(await view(page)).enemyBar).toBeCloseTo(126*40/52,1);
  while (!(await view(page)).outcome) await attack(page);expect((await view(page)).outcome).toBe('VICTORY');expect((await view(page)).trace.slice(-3)).toEqual(['ACTION','HIT','FAINT']);
  await page.screenshot({path:'artifacts/milestone-7-battle.png'});await returned(page);expect((await view(page)).world).toBe(true);
});
for(const event of ['sleep','charm','fart','cutePose'])test(`Flow P: PURE_CUTE confirmation and ordered ${event} animation`,async({page})=>{
  await open(page,`entity=CUTE_005&partySpecies=CUTE_005&partyLevel=15&encounterLevel=10&forceCuteEvent=1&cuteEvent=${event}`);await force(page,false);
  expect((await view(page)).pure).toBe(true);await page.waitForTimeout(650);expect((await view(page)).intro).toBe(false);await page.keyboard.press('Escape');expect((await view(page)).pure).toBe(true);
  await page.keyboard.press('Space');await acknowledgeIntro(page);await seed(page);await attack(page,'SKILL_002');
  const trace=(await view(page)).trace;const tag={sleep:'SLEEP',charm:'CHARM',fart:'FART',cutePose:'CUTE_POSE'}[event]!;expect(trace.indexOf(tag)).toBeGreaterThan(trace.indexOf('HIT'));
  await page.screenshot({path:`artifacts/milestone-7-cute-${event}.png`});
});
test('Flow Q: damage, snack offer, observation, success, party and world feedback',async({page})=>{
  await open(page,'entity=CUTE_001&encounterLevel=5&capture=success');await force(page);await seed(page);await attack(page);await capture(page);
  await expect.poll(async()=>(await view(page)).ball).toBe(true);await page.screenshot({path:'artifacts/milestone-7-capture.png'});await settled(page);
  const trace=(await view(page)).trace;expect(trace).toContain('INVITE_OFFER');expect(trace).toContain('INVITE_OBSERVE');expect(trace.at(-1)).toBe('INVITE_JOIN');await returned(page);expect((await view(page)).runtime.party).toHaveLength(2);
});
test('Flow Q: failed capture releases enemy before its attack',async({page})=>{
  await open(page,'entity=CUTE_001&encounterLevel=5&capture=failure');await force(page);await seed(page);await capture(page);await settled(page);
  const trace=(await view(page)).trace;expect(trace.indexOf('CAPTURE_FAIL')).toBeLessThan(trace.indexOf('ACTION'));expect((await view(page)).enemyTexture).toBe('creature-cute_001');
});
test('monster rejection skips capture animation and keeps turn',async({page})=>{
  await open(page,'entity=MON_001&encounterLevel=5');await force(page);await capture(page);await settled(page);expect((await view(page)).trace).not.toContain('CAPTURE');expect((await view(page)).turn).toBe(0);expect((await view(page)).log).toContain('根本不是來交朋友的');
});
for(const [source,target,level]of[['CUTE_001','EVO_001',14],['CUTE_005','EVO_002',17]]as const)test(`Flow R: ${source} evolves with Battle Party Dex portraits swapped`,async({page})=>{
  await open(page,`entity=CUTE_001&partySpecies=${source}&partyLevel=${level}&encounterLevel=5&capture=success`);await page.keyboard.press('F8');await force(page);await capture(page);
  await expect.poll(async()=>(await view(page)).shape,{timeout:15000}).toBe(true);await page.keyboard.press('Escape');expect((await view(page)).battle).toBe(true);await page.screenshot({path:`artifacts/milestone-7-evolution-${source}.png`});await settled(page);
  expect((await view(page)).playerTexture).toBe(`creature-${target.toLowerCase()}`);await returned(page);await page.keyboard.press('p');expect((await view(page)).portraits).toContain(`creature-${target.toLowerCase()}`);await page.keyboard.press('Escape');await page.keyboard.press('Escape');await clickScene(page,'WorldScene','menu-dex');expect((await view(page)).runtime.dex[target]).toBe('CAPTURED');
});
test('Flow S: full 128HP Boss intro, sprites, victory, upgraded camp save reload',async({page})=>{
  await open(page,'');await page.keyboard.press('F1');await clickScene(page,'WorldScene','debug-boss');await expect.poll(async()=>(await view(page)).panel).toContain('巨型森林怪');await page.keyboard.press('Enter');await expect.poll(async()=>(await view(page)).battle).toBe(true);await acknowledgeIntro(page);await seed(page,0.99);
  expect((await view(page)).enemyHP).toBe(128);expect((await view(page)).enemyTexture).toBe('creature-mon_003');while (!(await view(page)).outcome) await attack(page);await returned(page);
  await page.keyboard.press('F7');await expect.poll(async()=>(await view(page)).panel).toContain('第一區開拓完成');await page.keyboard.press('Enter');await page.screenshot({path:'artifacts/milestone-7-camp.png'});await page.reload();await titleReady(page);await clickScene(page,'TitleScene','title-continue');await expect.poll(async()=>(await view(page)).world).toBe(true);expect((await view(page)).camp).toBe(true);expect((await view(page)).boss).toBe(false);
});
test('Flow T: five slots, Party Dex modal exclusivity, save and movement restored',async({page})=>{
  await open(page,'');await page.keyboard.press('p');expect((await view(page)).slots).toBe(5);const start=(await view(page)).x;await page.keyboard.down('d');await page.waitForTimeout(180);await page.keyboard.up('d');expect((await view(page)).x).toBe(start);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await clickScene(page,'WorldScene','menu-dex');expect((await view(page)).panel).toContain('小可愛圖鑑');expect((await view(page)).slots).toBe(0);await page.keyboard.press('Escape');await page.keyboard.press('Escape');await clickScene(page,'WorldScene','menu-save');await page.keyboard.down('d');await page.waitForTimeout(200);await page.keyboard.up('d');expect((await view(page)).x).toBeGreaterThan(start+8);
});
test('M6 fixture Continue restores evolved portraits and camp without schema upgrade',async({page})=>{
  const fixture=JSON.parse(readFileSync('tests/fixtures/milestone6-save-v1.json','utf8'));await page.addInitScript(data=>localStorage.setItem('pan-james.save.v1',JSON.stringify(data)),fixture);await page.goto('http://127.0.0.1:5191/');await titleReady(page);await clickScene(page,'TitleScene','title-continue');await expect.poll(async()=>(await view(page)).world).toBe(true);expect((await view(page)).runtime.schemaVersion).toBe(1);expect((await view(page)).camp).toBe(true);await page.keyboard.press('p');expect((await view(page)).portraits).toContain('creature-cute_001');expect((await view(page)).runtime.reserveStorage[0].creatureId).toBe('EVO_001');
});
test('all fainted party safely returns to camp and debug requires explicit flag',async({page})=>{
  await open(page,'entity=CUTE_001');await page.evaluate(async path=>{const{game}=await import(path);const state=game.registry.get('game-state');state.party.forEach((m:{currentHp:number;status:string})=>{m.currentHp=0;m.status='FAINTED';});},'/src/main.ts');await page.keyboard.press('F1');await clickScene(page,'WorldScene','debug-encounter');expect((await view(page)).battle).toBe(false);expect((await view(page)).runtime.party[0].currentHp).toBe(52);
  await page.goto('http://127.0.0.1:5191/');await startLegacyGame(page);await page.keyboard.press('F1');expect((await view(page)).panel).toBeUndefined();
});
