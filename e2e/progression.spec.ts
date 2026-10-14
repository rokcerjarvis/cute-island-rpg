import { startLegacyGame, acknowledgeIntro } from './helpers';
import { expect, test, type Page } from '@playwright/test';
test.setTimeout(60000);
async function state(page: Page) {
  return page.evaluate(async path => {
    const { game } = await import(path);
    const world = game.scene.getScene('WorldScene'); const battle = game.scene.getScene('BattleScene');
    const runtime = game.registry.get('game-state'); const manager = battle.manager;
    return { runtime, world: game.scene.isActive('WorldScene'), battle: game.scene.isActive('BattleScene'),
      x: world.children.getByName('player')?.x, y: world.children.getByName('player')?.y,
      turn: manager?.turn, enemyHp: manager?.enemy.hp, playerHp: manager?.player.hp,
      resolving: battle.resolving, outcome: manager?.result?.outcome, needsSwitch: manager?.needsSwitch,
      panel: battle.panel, log: battle.children.getByName('battle-log')?.text,
      worldPanel: world.children.getByName('world-panel')?.list.filter((child: { type: string }) => child.type === 'Text').map((child: { text: string }) => child.text).join('\n'),
    };
  }, '/src/main.ts');
}
async function click(page: Page, name: string) {
  const position = await page.evaluate(async data => {
    const { game } = await import(data.path); const object = game.scene.getScene('BattleScene').children.getByName(data.name);
    if (!object || !object.visible) return null;
    const bounds = object.getBounds(); return { x: bounds.centerX, y: bounds.centerY };
  }, { path: '/src/main.ts', name });
  expect(position).not.toBeNull();
  const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.click(canvas!.x + position!.x / 640 * canvas!.width, canvas!.y + position!.y / 360 * canvas!.height);
}
async function open(page: Page, query = '?debugEncounters=1&capture=success&entity=CUTE_001') {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5191/${query}`);
  await startLegacyGame(page);
  await expect.poll(async () => (await state(page)).world).toBe(true);
  return errors;
}
async function encounter(page: Page) {
  await page.evaluate(async paths => {
    const { game } = await import(paths.main); const { EncounterSystem } = await import(paths.encounter);
    const world = game.scene.getScene('WorldScene'); world.encounters = new EncounterSystem(() => 0.99999);
    world.children.getByName('player').body.reset(340, 522);
  }, { main: '/src/main.ts', encounter: '/src/systems/EncounterSystem.ts' });
  await page.waitForTimeout(80); await page.keyboard.press('F2'); await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).battle).toBe(true); await acknowledgeIntro(page); await page.keyboard.up('d');
  await page.evaluate(async paths => {
    const { game } = await import(paths.main); const { BattleManager } = await import(paths.battle); const { skills } = await import(paths.skills);
    const scene = game.scene.getScene('BattleScene');
    scene.manager = new BattleManager(scene.manager.player, scene.manager.enemy, skills, () => 0, undefined, () => scene.session.party.hasReplacement());
  }, { main: '/src/main.ts', battle: '/src/battle/BattleManager.ts', skills: '/src/data/skills.ts' });
}
async function settled(page: Page) { await expect.poll(async () => (await state(page)).resolving, { timeout: 20000 }).toBe(false); }
async function attack(page: Page) { await click(page, 'battle-option-0'); await click(page, 'skill-SKILL_001'); await settled(page); }
async function capture(page: Page) { await click(page, 'battle-option-1'); await click(page, 'capture-item'); await settled(page); }
async function returnWorld(page: Page) { await click(page, 'battle-return'); await expect.poll(async () => (await state(page)).world).toBe(true); }

test('Flow A: damage, capture, preserve caught HP and party in world', async ({ page }) => {
  const errors = await open(page); await encounter(page); await attack(page);
  expect((await state(page)).enemyHp).toBe(40); await capture(page);
  const result = await state(page); expect(result.outcome).toBe('CAPTURED'); expect(result.playerHp).toBe(40);
  expect(result.runtime.party).toHaveLength(2); expect(result.runtime.party[1]).toMatchObject({ level: 5, currentHp: 40, knownSkills: ['SKILL_001', 'SKILL_003'] });
  expect(result.runtime.party[0].currentExp).toBe(168); expect(result.log).toContain('願意跟你走了！');
  await page.screenshot({ path: 'artifacts/milestone-4-capture.png' }); await returnWorld(page);
  expect((await state(page)).runtime.party).toHaveLength(2); await page.keyboard.press('p');
  expect((await state(page)).worldPanel).toContain('隊伍 2 / 5'); expect((await state(page)).worldPanel).toContain('HP 40/52');
  await page.screenshot({ path: 'artifacts/milestone-4-world-party.png' }); await page.keyboard.press('Escape'); expect(errors).toEqual([]);
});

test('Flow B: victory gains EXP, levels up and preserves HP growth difference', async ({ page }) => {
  const errors = await open(page); await page.keyboard.press('F4'); await encounter(page);
  for (let i=0;i<5;i++) await attack(page); const result = await state(page);
  expect(result.outcome).toBe('VICTORY'); expect(result.runtime.party[0]).toMatchObject({ level: 6, currentHp: 6, maxHp: 54, attack: 10, speed: 10, currentExp: 297 });
  expect(result.log).toContain('升到了 Lv.6'); await returnWorld(page);
  expect((await state(page)).runtime.party[0].currentHp).toBe(6); expect(errors).toEqual([]);
});

test('Flow C: normal switch costs turn, faint forces a free replacement and battle continues', async ({ page }) => {
  const errors = await open(page, '?debugEncounters=1&entity=CUTE_004');
  await page.evaluate(async paths => {
    const { game } = await import(paths.main); const { PartySystem } = await import(paths.party); const { creatures } = await import(paths.creatures);
    new PartySystem(game.registry.get('game-state')).acquire(creatures[1], 5, 1);
  }, { main: '/src/main.ts', party: '/src/systems/PartySystem.ts', creatures: '/src/data/creatures.ts' });
  await encounter(page); await click(page, 'battle-option-2'); await click(page, 'party-creature-2'); await settled(page);
  const fainted = await state(page); expect(fainted.turn).toBe(1); expect(fainted.needsSwitch).toBe(true); expect(fainted.outcome).toBeUndefined();
  expect(fainted.runtime.party[1].status).toBe('FAINTED'); expect(fainted.panel).toBe('PARTY');
  await page.screenshot({ path: 'artifacts/milestone-4-forced-switch.png' });
  await page.keyboard.press('Escape'); expect((await state(page)).battle).toBe(true);
  await click(page, 'party-creature-1'); await settled(page);
  expect((await state(page)).turn).toBe(1); expect((await state(page)).playerHp).toBe(52);
  await page.evaluate(async path=>{const{game}=await import(path);game.scene.getScene('BattleScene').manager.player.hp=1;},'/src/main.ts'); await attack(page); expect((await state(page)).turn).toBe(2); expect((await state(page)).outcome).toBe('DEFEAT');
  await returnWorld(page); expect((await state(page)).x).toBe(240);
  expect((await state(page)).runtime.party.every((member: { currentHp: number; maxHp: number; status: string }) => member.currentHp === member.maxHp && member.status === 'OK')).toBe(true);
  expect(errors).toEqual([]);
});

test('Flow D: full party capture goes to reserve and remains in runtime state', async ({ page }) => {
  const errors = await open(page); await page.keyboard.press('F6'); expect((await state(page)).runtime.party).toHaveLength(5);
  await encounter(page); await capture(page); const caught = await state(page);
  expect(caught.runtime.party).toHaveLength(5); expect(caught.runtime.reserveStorage).toHaveLength(1); expect(caught.log).toContain('隊伍滿了');
  await returnWorld(page); expect((await state(page)).runtime.reserveStorage[0].creatureId).toBe('CUTE_001');
  await page.keyboard.press('p'); expect((await state(page)).worldPanel).toContain('Reserve 1'); expect(errors).toEqual([]);
});

test('Flow E: injured HP persists into next battle, then camp heal requires confirmation', async ({ page }) => {
  const errors = await open(page); await encounter(page); await attack(page);
  await click(page, 'battle-option-3'); await expect.poll(async () => (await state(page)).world).toBe(true);
  expect((await state(page)).runtime.party[0].currentHp).toBe(40);
  await encounter(page); expect((await state(page)).playerHp).toBe(40); await click(page, 'battle-option-3');
  await expect.poll(async () => (await state(page)).world).toBe(true); await page.keyboard.press('F7'); await page.keyboard.press('e');
  expect((await state(page)).worldPanel).toContain('休息一下？'); await page.keyboard.press('Escape');
  expect((await state(page)).runtime.party[0].currentHp).toBe(40); await page.keyboard.press('Space');
  await page.screenshot({ path: 'artifacts/milestone-4-heal.png' }); await page.keyboard.press('Enter');
  expect((await state(page)).runtime.party[0].currentHp).toBe(52); await page.keyboard.press('p');
  const before = await state(page); await page.keyboard.down('d'); await page.waitForTimeout(200); await page.keyboard.up('d');
  expect((await state(page)).x).toBe(before.x); await page.keyboard.press('Escape'); expect(errors).toEqual([]);
});

test('multi-level fifth-skill UI replaces then declines, blocking early return', async ({ page }) => {
  const errors = await open(page, '?debugEncounters=1&entity=CUTE_001&expTarget=22');
  await page.keyboard.press('F4'); await encounter(page); for(let i=0;i<5;i++) await attack(page);
  expect((await state(page)).runtime.party[0].level).toBe(22); expect((await state(page)).panel).toBe('LEARN');
  await page.keyboard.press('Escape'); expect((await state(page)).battle).toBe(true);
  await click(page, 'learn-forget'); await page.keyboard.press('Escape'); expect((await state(page)).panel).toBe('LEARN');
  await click(page, 'learn-forget'); await click(page, 'forget-0'); await settled(page);
  expect((await state(page)).runtime.pendingLearning.skillIds).toEqual(['SKILL_012']);
  await page.screenshot({ path: 'artifacts/milestone-4-learn.png' }); await click(page, 'learn-decline');
  await expect.poll(async () => (await state(page)).log).toContain('放棄學習'); await settled(page);
  expect((await state(page)).runtime.party[0].knownSkills).toEqual(['SKILL_002', 'SKILL_003', 'SKILL_010', 'SKILL_011']);
  expect((await state(page)).runtime.party[0].creatureId).toBe('EVO_001');
  expect((await state(page)).log).toContain('進化成了'); await returnWorld(page); expect(errors).toEqual([]);
});

test('failed capture executes enemy action and monster rejection executes no turn', async ({ page }) => {
  const errors = await open(page, '?debugEncounters=1&entity=CUTE_001&capture=failure'); await encounter(page); await capture(page);
  expect((await state(page)).turn).toBe(1); expect((await state(page)).playerHp).toBe(40); expect((await state(page)).runtime.party).toHaveLength(1);
  expect((await state(page)).log).toContain('還不願意同行');
  await click(page, 'battle-option-3'); await open(page, '?debugEncounters=1&entity=MON_001&capture=success'); await encounter(page); await capture(page);
  expect((await state(page)).turn).toBe(0); expect((await state(page)).playerHp).toBe(52); expect((await state(page)).log).toContain('這個傢伙根本不是來交朋友的！');
  expect((await state(page)).runtime.party).toHaveLength(1); expect(errors).toEqual([]);
});

test('debug hotkeys do not affect gameplay without explicit flag; Esc goes back one menu', async ({ page }) => {
  await open(page, '?capture=success&partyLevel=22');
  for (const key of ['F4', 'F5', 'F6']) await page.keyboard.press(key);
  expect((await state(page)).runtime.party).toHaveLength(1); expect((await state(page)).runtime.party[0]).toMatchObject({ level: 5, currentHp: 52, currentExp: 143 });
  await open(page); await encounter(page); await click(page, 'battle-option-0'); await page.keyboard.press('Escape');
  expect((await state(page)).battle).toBe(true); expect((await state(page)).panel).toBe('MAIN');
  await page.keyboard.press('Escape'); await expect.poll(async () => (await state(page)).world).toBe(true);
});
