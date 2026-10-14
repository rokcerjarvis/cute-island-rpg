import { startLegacyGame, acknowledgeIntro } from './helpers';
import { test, expect, type Page } from '@playwright/test';
test.setTimeout(60000);
async function state(page: Page) {
  return page.evaluate(async path => {
    const { game } = await import(path); const scene = game.scene.getScene('BattleScene'); const world = game.scene.getScene('WorldScene');
    const manager = scene.manager;
    return { runtime: game.registry.get('game-state'), battle: game.scene.isActive('BattleScene'), world: game.scene.isActive('WorldScene'),
      resolving: scene.resolving, outcome: manager?.result?.outcome, turn: manager?.turn,
      enemyHp: manager?.enemy.hp, playerHp: manager?.player.hp, playerEffects: manager?.player.effects, enemyEffects: manager?.enemy.effects,
      log: scene.children.getByName('battle-log')?.text, message: scene.children.getByName('encounter-message')?.text,
      status: scene.children.getByName('battle-status')?.text, isBoss: scene.entry?.isBoss,
      level: manager?.enemy.level, zone: scene.entry?.world.zoneId,
      shape: Boolean(scene.children.getByName('evolution-silhouette')),
      campUpgrade: world.children.getByName('camp-upgrade')?.visible, bossMarker: world.children.getByName('boss-marker')?.visible,
      worldPanel: world.children.getByName('world-panel')?.list.filter((child: { type: string }) => child.type === 'Text').map((child: { text: string }) => child.text).join('\n'),
    };
  }, '/src/main.ts');
}
async function click(page: Page, name: string) {
  const point = await page.evaluate(async input => {
    const { game } = await import(input.path); const object = game.scene.getScene('BattleScene').children.getByName(input.name);
    if (!object?.visible) return null; const bounds = object.getBounds(); return { x: bounds.centerX, y: bounds.centerY };
  }, { path: '/src/main.ts', name }); expect(point).not.toBeNull();
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box!.x + point!.x / 640 * box!.width, box!.y + point!.y / 360 * box!.height);
}
async function open(page: Page, query: string) {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5191/?debugEncounters=1&${query}`);
  await startLegacyGame(page);
  await expect.poll(async () => (await state(page)).world).toBe(true); return errors;
}
async function seedBattle(page: Page, rngValue = 0) {
  await page.evaluate(async input => {
    const { game } = await import(input.main); const { BattleManager } = await import(input.battle); const { skills } = await import(input.skills); const { CuteEventSystem } = await import(input.cute);
    const scene = game.scene.getScene('BattleScene'); const passive = new CuteEventSystem(() => 0.99);
    if (scene.manager.cuteEvents.forcedNext) passive.forceNext(scene.manager.cuteEvents.forcedNext);
    if (scene.entry.isBoss) scene.manager.enemy.definition.skills=['SKILL_005'];
    scene.manager = new BattleManager(scene.manager.player, scene.manager.enemy, skills, () => input.rngValue, undefined, () => scene.session.party.hasReplacement(), passive, Boolean(scene.entry.isBoss));
  }, { main: '/src/main.ts', battle: '/src/battle/BattleManager.ts', skills: '/src/data/skills.ts', cute: '/src/battle/CuteEventSystem.ts', rngValue });
}
async function encounter(page: Page, x = 340, y = 522) {
  await page.evaluate(async input => {
    const { game } = await import(input.main); const { EncounterSystem } = await import(input.encounter);
    const world = game.scene.getScene('WorldScene'); world.encounters = new EncounterSystem(() => 0.99999, game.registry.get('game-state'));
    world.children.getByName('player').body.reset(input.x, input.y);
  }, { main: '/src/main.ts', encounter: '/src/systems/EncounterSystem.ts', x, y });
  await page.waitForTimeout(80); await page.keyboard.press('F2'); await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).battle).toBe(true); await acknowledgeIntro(page); await page.keyboard.up('d'); await seedBattle(page);
}
async function settled(page: Page) { await expect.poll(async () => (await state(page)).resolving, { timeout: 25000 }).toBe(false); }
async function attack(page: Page, id = 'SKILL_001') { await click(page, 'battle-option-0'); await click(page, `skill-${id}`); await settled(page); }
async function returnWorld(page: Page) { await click(page, 'battle-return'); await expect.poll(async () => (await state(page)).world).toBe(true); }
async function enterBoss(page: Page) {
  await page.keyboard.press('F9'); await page.waitForTimeout(100); await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).worldPanel).toContain('巨型森林怪'); await page.keyboard.up('d');
  expect((await state(page)).battle).toBe(false);
  await page.keyboard.press('Enter'); await expect.poll(async () => (await state(page)).battle).toBe(true); await acknowledgeIntro(page);
}

for (const event of ['sleep', 'charm', 'fart', 'cutePose']) test(`Flow F: owned flying squirrel encounters and triggers ${event}`, async ({ page }) => {
  const errors = await open(page, `entity=CUTE_005&forceCuteEvent=1&cuteEvent=${event}`);
  await page.evaluate(async input => {
    const { game } = await import(input.main); const { PartySystem } = await import(input.party); const { creatures } = await import(input.creatures);
    const state = game.registry.get('game-state'); const party = new PartySystem(state); const member = party.acquire(creatures[4], 15, input.hp).instance; party.setLeader(member.instanceId);
  }, { main: '/src/main.ts', party: '/src/systems/PartySystem.ts', creatures: '/src/data/creatures.ts', hp: event === 'cutePose' ? 30 : 54 });
  await encounter(page); expect((await state(page)).message).toBe('這是什麼？上網查一下！\n野生的 飛鼠 出現了！');
  await attack(page, 'SKILL_002'); const result = await state(page);
  if (event === 'sleep') {
    expect(result.playerEffects.skipNextAction).toBe(true); const enemyHp = result.enemyHp;
    await attack(page, 'SKILL_002'); expect((await state(page)).log).toContain('還在睡覺');
    expect((await state(page)).enemyHp).toBe(enemyHp); expect((await state(page)).playerEffects.skipNextAction).toBe(false);
  } else if (event === 'charm') { expect(result.enemyEffects.attackMultiplier).toBe(0.8); expect(result.playerHp).toBe(44); expect(result.log).toContain('撒嬌'); }
  else if (event === 'fart') { expect(result.enemyEffects.speedMultiplier).toBe(0.8); expect(result.log).toContain('屁'); }
  else { expect(result.playerHp).toBe(38); expect(result.log).toContain('裝可愛'); }
  await page.screenshot({ path: `artifacts/milestone-5-cute-${event}.png` }); expect(errors).toEqual([]);
});

for (const source of ['CUTE_001', 'CUTE_005']) test(`Flow G: ${source} levels and evolves with its instance preserved`, async ({ page }) => {
  const errors = await open(page, 'entity=CUTE_001&capture=success&partyLevel=14');
  if (source === 'CUTE_005') await page.evaluate(async input => {
    const { game } = await import(input.main); const { PartySystem } = await import(input.party); const { creatures } = await import(input.creatures);
    const runtime = game.registry.get('game-state'); const party = new PartySystem(runtime); const member = party.acquire(creatures[4], 17, 10).instance; party.setLeader(member.instanceId);
  }, { main: '/src/main.ts', party: '/src/systems/PartySystem.ts', creatures: '/src/data/creatures.ts' });
  else await page.evaluate(async path => { const { game } = await import(path); game.registry.get('game-state').party[0].currentHp = 20; }, '/src/main.ts');
  const before = (await state(page)).runtime; const activeId = before.activeInstanceId; const known = before.party.find((member: { instanceId: string }) => member.instanceId === activeId).knownSkills;
  await page.keyboard.press('F8'); await encounter(page); await click(page, 'battle-option-1'); await click(page, 'capture-item');
  await expect.poll(async () => (await state(page)).shape, { timeout: 10000 }).toBe(true);
  expect((await state(page)).log).toContain('樣子好像怪怪的'); await page.screenshot({ path: `artifacts/milestone-5-evolution-${source}.png` });
  await settled(page); const after = (await state(page)).runtime.party.find((member: { instanceId: string }) => member.instanceId === activeId);
  expect(after.instanceId).toBe(activeId); expect(after.knownSkills).toEqual(known);
  expect(after).toMatchObject(source === 'CUTE_001' ? { creatureId: 'EVO_001', level: 15, currentHp: 28, maxHp: 100, attribute: 'WATER' } : { creatureId: 'EVO_002', level: 18, currentHp: 15, maxHp: 104, attribute: 'PURE_CUTE' });
  expect((await state(page)).log).toContain('進化成了'); await returnWorld(page);
  expect((await state(page)).runtime.party.find((member: { instanceId: string }) => member.instanceId === activeId).creatureId).toBe(after.creatureId); expect(errors).toEqual([]);
});

test('Flow H: full HP Boss victory, EXP, no escape/capture, camp upgrade and no respawn', async ({ page }) => {
  const errors = await open(page, 'capture=success'); await enterBoss(page); await seedBattle(page, 0.99);
  expect((await state(page)).isBoss).toBe(true); expect((await state(page)).enemyHp).toBe(128); expect((await state(page)).level).toBe(11);
  await click(page, 'battle-option-3'); expect((await state(page)).status).toBe('現在好像不是逃跑的時候！'); expect((await state(page)).battle).toBe(true);
  await click(page, 'battle-option-1'); await click(page, 'capture-item'); await settled(page);
  expect((await state(page)).turn).toBe(0); expect((await state(page)).log).toContain('現在不是交朋友的時候');
  while (!(await state(page)).outcome) await attack(page);
  expect((await state(page)).log).toContain('巨型森林怪倒下了！'); expect((await state(page)).log).toContain('森林好像安靜下來了。');
  expect((await state(page)).outcome).toBe('VICTORY'); expect((await state(page)).runtime.party[0].currentExp).toBe(803);
  await returnWorld(page); expect((await state(page)).runtime.bossDefeated).toBe(true); expect((await state(page)).bossMarker).toBe(false);
  await page.keyboard.press('F7'); await expect.poll(async () => (await state(page)).worldPanel).toContain('第一區開拓完成！');
  expect((await state(page)).campUpgrade).toBe(true); expect((await state(page)).worldPanel).toContain('已同行種類');
  await page.screenshot({ path: 'artifacts/milestone-5-completion.png' }); await page.keyboard.press('Enter');
  await page.screenshot({ path: 'artifacts/milestone-5-camp-upgrade.png' });
  await page.keyboard.press('F9'); await page.waitForTimeout(100); await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d');
  expect((await state(page)).world).toBe(true); expect((await state(page)).worldPanel).toBeUndefined(); expect(errors).toEqual([]);
});

test('new debug species, forced evolution and Boss shortcuts require the explicit flag', async ({ page }) => {
  await page.goto('http://127.0.0.1:5191/?partySpecies=CUTE_005&partyLevel=25&forceEvolution=1&forceCuteEvent=1&bossHp=1');
  await startLegacyGame(page);
  await expect.poll(async () => (await state(page)).world).toBe(true);
  for (const key of ['F8', 'F9', 'F10', 'F11']) await page.keyboard.press(key);
  expect((await state(page)).runtime.party[0]).toMatchObject({ creatureId: 'CUTE_001', level: 5, currentExp: 143, currentHp: 52 });
  expect((await state(page)).runtime.bossDefeated).toBe(false); expect((await state(page)).runtime.pureCuteMissCount).toBe(0);
});

test('Flow I: Boss defeat heals camp and allows a real retry', async ({ page }) => {
  const errors = await open(page, ''); await page.keyboard.press('F5'); await enterBoss(page); await seedBattle(page, 0);
  await attack(page); expect((await state(page)).outcome).toBe('DEFEAT'); await returnWorld(page);
  expect((await state(page)).runtime.bossDefeated).toBe(false); expect((await state(page)).runtime.party[0].currentHp).toBe(52);
  await enterBoss(page); expect((await state(page)).isBoss).toBe(true); expect((await state(page)).enemyHp).toBe(128); expect(errors).toEqual([]);
});

for (const zone of ['FOREST_DEPTHS', 'SPECIAL_CUTE_GRASS']) test(`forest traversal encounters Lv.10 PURE_CUTE in ${zone} without changing debug pity`, async ({ page }) => {
  const errors = await open(page, 'entity=CUTE_005'); await page.keyboard.press('F11');
  await encounter(page, zone === 'FOREST_DEPTHS' ? 786 : 882, zone === 'FOREST_DEPTHS' ? 554 : 618);
  expect((await state(page)).zone).toBe(zone); expect((await state(page)).level).toBe(10); expect((await state(page)).message).toContain('這是什麼？上網查一下！');
  expect((await state(page)).runtime.pureCuteMissCount).toBe(20); expect(errors).toEqual([]);
});
