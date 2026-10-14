import { startLegacyGame, acknowledgeIntro } from './helpers';
import { test, expect, type Page } from '@playwright/test';

async function state(page: Page) {
  return page.evaluate(async path => {
    const { game } = await import(path);
    const scene = game.scene.getScene('BattleScene');
    const world = game.scene.getScene('WorldScene');
    const player = world.children.getByName('player');
    return { active: game.scene.isActive('BattleScene'), worldActive: game.scene.isActive('WorldScene'),
      turn: scene.manager?.turn, playerHp: scene.manager?.player.hp, enemyHp: scene.manager?.enemy.hp,
      result: scene.manager?.result?.outcome, resolving: scene.resolving,
      saved: scene.entry?.world, x: player?.x, y: player?.y,
      log: scene.children.getByName('battle-log')?.text,
      playerHpText: scene.children.getByName('player-hp')?.text,
      enemyHpText: scene.children.getByName('enemy-hp')?.text,
    };
  }, '/src/main.ts');
}
async function click(page: Page, name: string, twice = false) {
  const position = await page.evaluate(async data => {
    const { game } = await import(data.path);
    const object = game.scene.getScene('BattleScene').children.getByName(data.name);
    const bounds = object.getBounds();
    return { x: bounds.centerX, y: bounds.centerY, visible: object.visible };
  }, { path: '/src/main.ts', name });
  expect(position.visible).toBe(true);
  const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.click(canvas!.x + position.x / 640 * canvas!.width, canvas!.y + position.y / 360 * canvas!.height, { clickCount: twice ? 2 : 1 });
}
async function encounter(page: Page, id: string) {
  await page.goto(`http://127.0.0.1:5191/?debugEncounters=1&entity=${id}`);
  await startLegacyGame(page);
  await expect.poll(async () => (await state(page)).worldActive).toBe(true);
  await page.evaluate(async paths => {
    const { game } = await import(paths.main);
    const { EncounterSystem } = await import(paths.encounter);
    const world = game.scene.getScene('WorldScene');
    world.encounters = new EncounterSystem(() => 0.99999); // force flag handles chance; level is 5
    world.children.getByName('player').body.reset(340, 522);
  }, { main: '/src/main.ts', encounter: '/src/systems/EncounterSystem.ts' });
  await page.waitForTimeout(80);
  await page.keyboard.press('F2');
  await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).active).toBe(true); await acknowledgeIntro(page);
  await page.keyboard.up('d');
  await page.evaluate(async paths => {
    const { game } = await import(paths.main);
    const { BattleManager } = await import(paths.battle);
    const { skills } = await import(paths.skills);
    const scene = game.scene.getScene('BattleScene');
    // Inject predictable AI / tie / hit / damage rolls without changing combatants or HP.
    scene.manager = new BattleManager(scene.manager.player, scene.manager.enemy, skills, () => 0);
  }, { main: '/src/main.ts', battle: '/src/battle/BattleManager.ts', skills: '/src/data/skills.ts' });
}
async function settled(page: Page) { await expect.poll(async () => (await state(page)).resolving, { timeout: 20000 }).toBe(false); }

test('real skill clicks resolve a full turn, lock input, win and return to encounter', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await encounter(page, 'CUTE_001');
  const saved = (await state(page)).saved;
  await click(page, 'battle-option-0');
  await page.screenshot({ path: 'artifacts/milestone-3-skills.png' });
  await click(page, 'skill-SKILL_001', true);
  await page.keyboard.press('Escape'); // must be ignored while turn is presenting
  expect((await state(page)).active).toBe(true);
  await settled(page);
  const first = await state(page);
  expect(first.turn).toBe(1);
  expect(first.playerHp).toBe(40);
  expect(first.enemyHp).toBe(40);
  expect(first.playerHpText).toBe('HP 40 / 52');
  expect(first.enemyHpText).toBe('HP 40 / 52');
  expect(first.log.match(/使出了/g)).toHaveLength(2);
  await click(page, 'battle-option-0');
  await click(page, 'skill-SKILL_001');
  await settled(page);
  for (let i=0; i<3; i++) { await click(page, 'battle-option-0'); await click(page, 'skill-SKILL_001'); await settled(page); }
  const victory = await state(page);
  expect(victory.turn).toBe(5);
  expect(victory.result).toBe('VICTORY');
  expect(victory.playerHp).toBe(4); // knocked-out enemy never acts
  expect(victory.enemyHpText).toBe('HP 0 / 52');
  expect(victory.log).toContain('昏倒了！');
  expect(victory.log).toContain('戰鬥勝利！');
  await page.screenshot({ path: 'artifacts/milestone-3-victory.png' });
  await click(page, 'battle-return');
  await expect.poll(async () => (await state(page)).worldActive).toBe(true);
  expect((await state(page)).x).toBeCloseTo(saved.x, 1);
  expect((await state(page)).y).toBeCloseTo(saved.y, 1);
  await page.waitForTimeout(250);
  expect((await state(page)).active).toBe(false);
  expect(errors).toEqual([]);
});

test('defeat returns to camp and next encounter starts at full player HP', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await encounter(page, 'CUTE_004');
  await page.evaluate(async path=>{const{game}=await import(path);game.scene.getScene('BattleScene').manager.player.hp=1;},'/src/main.ts');
  await click(page, 'battle-option-0');
  await click(page, 'skill-SKILL_001'); // attack first; Earth enemy knocks Water player out
  await settled(page);
  const defeat = await state(page);
  expect(defeat.result).toBe('DEFEAT');
  expect(defeat.playerHpText).toBe('HP 0 / 52');
  expect(defeat.log).toContain('吉伊卡哇昏倒了！');
  expect(defeat.log).toContain('你被送回營地了。');
  await page.screenshot({ path: 'artifacts/milestone-3-defeat.png' });
  await click(page, 'battle-return');
  await expect.poll(async () => (await state(page)).worldActive).toBe(true);
  expect((await state(page)).x).toBe(240);
  expect((await state(page)).y).toBe(400);
  await page.evaluate(async path => {
    const { game } = await import(path);
    game.scene.getScene('WorldScene').children.getByName('player').body.reset(340, 522);
  }, '/src/main.ts');
  await page.waitForTimeout(80);
  await page.keyboard.press('F2');
  await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).active).toBe(true); await acknowledgeIntro(page);
  await page.keyboard.up('d');
  expect((await state(page)).playerHpText).toBe('HP 52 / 52');
  await click(page, 'battle-option-3');
  await expect.poll(async () => (await state(page)).worldActive).toBe(true);
  expect(errors).toEqual([]);
});
