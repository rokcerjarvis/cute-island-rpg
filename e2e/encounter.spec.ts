import { startLegacyGame, acknowledgeIntro, clickScene } from './helpers';
import { expect, test, type Page } from '@playwright/test';

async function state(page: Page) {
  return page.evaluate(async path => {
    const { game } = await import(path);
    const world = game.scene.getScene('WorldScene');
    const battle = game.scene.getScene('BattleScene');
    const player = world.children.getByName('player');
    return {
      worldActive: game.scene.isActive('WorldScene'), battleActive: game.scene.isActive('BattleScene'),
      x: player?.x, y: player?.y, count: world.children.length,
      enemyId: battle.entry?.enemy.definition.id,
      level: battle.entry?.enemy.level, saved: battle.entry?.world,
      message: battle.children.getByName('encounter-message')?.text,
      status: battle.children.getByName('battle-status')?.text,
    };
  }, '/src/main.ts');
}
async function ready(page: Page, query = '') {
  await page.goto(`http://127.0.0.1:5191/${query}`);
  await startLegacyGame(page);
  await expect.poll(async () => (await state(page)).worldActive).toBe(true);
}
async function place(page: Page, x: number, y: number) {
  await page.evaluate(async data => {
    const { game } = await import(data.path);
    const world = game.scene.getScene('WorldScene');
    world.children.getByName('player').body.reset(data.x, data.y);
  }, { path: '/src/main.ts', x, y });
  await page.waitForTimeout(80);
}
async function clickOption(page: Page, index: number) {
  // Real pointer click on the canvas, transforming game coordinates to CSS pixels.
  await clickScene(page, 'BattleScene', `battle-option-${index}`);
}

test('PURE_CUTE repeats its prompt; flee restores the same world and guards return steps', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page, '?debugEncounters=1&entity=CUTE_005');
  const originalCount = (await state(page)).count;
  // On normal road, even F2 cannot create an encounter.
  await page.keyboard.press('F2');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');
  expect((await state(page)).battleActive).toBe(false);
  await place(page, 340, 522); // foot center row 16, immediately left of meadow grass
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await state(page)).battleActive).toBe(true); await acknowledgeIntro(page);
  await page.keyboard.up('ArrowRight');
  const first = await state(page);
  expect(first.enemyId).toBe('CUTE_005');
  expect(first.message).toBe('這是什麼？上網查一下！\n野生的 飛鼠 出現了！');
  expect(first.saved.zoneId).toBe('GRASSLAND');
  expect(first.level).toBeGreaterThanOrEqual(2);
  expect(first.level).toBeLessThanOrEqual(5);
  await clickOption(page, 0);
  await expect.poll(async () => (await state(page)).status).toBe('請選擇技能。');
  await page.keyboard.press('Escape');
  await clickOption(page, 1);
  await expect.poll(async () => (await state(page)).status).toContain('選擇道具');
  await page.keyboard.press('Escape');
  await clickOption(page, 2);
  await expect.poll(async () => (await state(page)).status).toContain('換人消耗一回合');
  await page.screenshot({ path: 'artifacts/milestone-2-battle.png' });
  await page.keyboard.press('Escape');
  await clickOption(page, 3);
  await expect.poll(async () => (await state(page)).worldActive).toBe(true);
  const returned = await state(page);
  expect(returned.x).toBeCloseTo(first.saved.x, 1);
  expect(returned.y).toBeCloseTo(first.saved.y, 1);
  expect(returned.count).toBe(originalCount);
  await page.waitForTimeout(300);
  expect((await state(page)).battleActive).toBe(false);
  await page.keyboard.press('F2');
  // Two more grass entries must be skipped, even with forced encounter pending.
  await page.evaluate(async path => {
    const { game } = await import(path);
    const world = game.scene.getScene('WorldScene');
    world.registry.set('e2e-grass-steps', 0);
    const count = (event: { encounterEligible: boolean }) => {
      if (!event.encounterEligible) return;
      const steps = world.registry.get('e2e-grass-steps') + 1;
      world.registry.set('e2e-grass-steps', steps);
      if (steps === 2) {
        world.input.keyboard.resetKeys();
        world.events.off('exploration:tile-entered', count);
      }
    };
    world.events.on('exploration:tile-entered', count);
  }, '/src/main.ts');
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(async path => {
    const { game } = await import(path);
    return game.registry.get('e2e-grass-steps');
  }, '/src/main.ts')).toBe(2);
  await page.keyboard.up('ArrowRight');
  expect((await state(page)).battleActive).toBe(false);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await state(page)).battleActive).toBe(true); await acknowledgeIntro(page);
  await page.keyboard.up('ArrowRight');
  expect((await state(page)).message).toBe(first.message);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).worldActive).toBe(true);
  await page.screenshot({ path: 'artifacts/milestone-2-world.png' });
  expect(errors).toEqual([]);
});

test('unforced random path selects monster through injected system RNG', async ({ page }) => {
  await ready(page);
  await page.evaluate(async paths => {
    const { game } = await import(paths.main);
    const { EncounterSystem } = await import(paths.system);
    const rolls = [0.01, 0.97, 0.99]; // chance succeeds, monster weight, Lv.5
    game.scene.getScene('WorldScene').encounters = new EncounterSystem(() => rolls.shift() ?? 0.99);
  }, { main: '/src/main.ts', system: '/src/systems/EncounterSystem.ts' });
  await place(page, 340, 522);
  await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).battleActive).toBe(true); await acknowledgeIntro(page);
  await page.keyboard.up('d');
  expect((await state(page)).enemyId).toBe('MON_001');
  expect((await state(page)).message).toBe('怪物 黑團蟲 出現了！');
  expect((await state(page)).level).toBe(5);
  await clickOption(page, 3);
  await expect.poll(async () => (await state(page)).worldActive).toBe(true);
});
