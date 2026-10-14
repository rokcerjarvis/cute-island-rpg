import { test, expect, type Page } from '@playwright/test';
import { clickScene, titleReady, startLegacyGame, acknowledgeIntro } from './helpers';
test.setTimeout(60000);
async function state(page: Page) {
  return page.evaluate(async path => {
    const { game } = await import(path); const world = game.scene.getScene('WorldScene'), battle = game.scene.getScene('BattleScene'), title = game.scene.getScene('TitleScene');
    return { runtime: game.registry.get('game-state'), world: game.scene.isActive('WorldScene'), battle: game.scene.isActive('BattleScene'), title: game.scene.isActive('TitleScene'), resolving: battle.resolving,
      outcome: battle.manager?.result?.outcome, heading: title.children.getByName('title-heading')?.text, summary: title.children.getByName('title-summary')?.text,
      feedback: world.children.getByName('world-feedback')?.text,
      panel: world.children.getByName('world-panel')?.list.filter((c: { type: string }) => c.type === 'Text').map((c: { text: string }) => c.text).join('\n'),
      camp: world.children.getByName('camp-upgrade')?.visible, boss: world.children.getByName('boss-marker')?.visible,
    };
  }, '/src/main.ts');
}
async function open(page: Page, query = '') { await page.goto(`http://127.0.0.1:5191/${query}`); await titleReady(page); }
async function encounter(page: Page) {
  await page.evaluate(async input => {
    const { game } = await import(input.main); const { EncounterSystem } = await import(input.system); const world = game.scene.getScene('WorldScene');
    world.encounters = new EncounterSystem(() => 0.99999, game.registry.get('game-state')); world.children.getByName('player').body.reset(340, 522);
  }, { main: '/src/main.ts', system: '/src/systems/EncounterSystem.ts' });
  await page.waitForTimeout(100); await page.keyboard.press('F2'); await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).battle).toBe(true); await acknowledgeIntro(page); await page.keyboard.up('d');
}
async function capture(page: Page) {
  await clickScene(page, 'BattleScene', 'battle-option-1'); await clickScene(page, 'BattleScene', 'capture-item');
  await expect.poll(async () => (await state(page)).resolving, { timeout: 15000 }).toBe(false);
  await clickScene(page, 'BattleScene', 'battle-return'); await expect.poll(async () => (await state(page)).world).toBe(true);
}
async function continueGame(page: Page) {
  await page.reload(); await titleReady(page); await clickScene(page, 'TitleScene', 'title-continue');
  await expect.poll(async () => (await state(page)).world).toBe(true);
}
async function menuSave(page: Page) { await page.keyboard.press('Escape'); await clickScene(page, 'WorldScene', 'menu-save'); await expect.poll(async () => (await state(page)).feedback).toBe('冒險紀錄已保存。'); }
async function dex(page: Page) { await page.keyboard.press('Escape'); await clickScene(page, 'WorldScene', 'menu-dex'); }

test('Flow J: Title, cancelled selection and rabbit starter via real UI', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  expect((await state(page)).world).toBe(false);
  await clickScene(page, 'TitleScene', 'title-new'); await clickScene(page, 'TitleScene', 'starter-CUTE_003');
  await clickScene(page, 'TitleScene', 'starter-back'); expect((await state(page)).runtime).toBeUndefined();
  await clickScene(page, 'TitleScene', 'starter-CUTE_003'); await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).world).toBe(true);
  expect((await state(page)).runtime.party[0]).toMatchObject({ creatureId: 'CUTE_003', level: 5, currentHp: 44, knownSkills: ['SKILL_004', 'SKILL_009'] });
  await page.screenshot({ path: 'artifacts/milestone-6-rabbit.png' }); expect(errors).toEqual([]);
});
test('Flow K: capture, level, reserve, manual save and reload Continue restore core data', async ({ page }) => {
  await open(page, '?debugEncounters=1&entity=CUTE_002&capture=success'); await startLegacyGame(page);
  await page.keyboard.press('F5'); await page.keyboard.press('F4'); await encounter(page); await capture(page);
  expect((await state(page)).runtime.party[0].level).toBe(6); expect((await state(page)).runtime.party[0].currentHp).toBeLessThan(10);
  await page.keyboard.press('F6'); await encounter(page); await capture(page);
  expect((await state(page)).runtime.reserveStorage).toHaveLength(1);
  await page.keyboard.down('d'); await page.waitForTimeout(100); await page.keyboard.up('d'); await menuSave(page);
  const before = (await state(page)).runtime; await page.reload(); await titleReady(page);
  expect((await state(page)).summary).toContain('Lv.6 吉伊卡哇'); await clickScene(page, 'TitleScene', 'title-continue');
  await expect.poll(async () => (await state(page)).world).toBe(true); const after = (await state(page)).runtime;
  for (const key of ['party', 'reserveStorage', 'dex', 'playerWorldPosition', 'pureCuteMissCount', 'bossDefeated']) expect(after[key]).toEqual(before[key]);
  await page.screenshot({ path: 'artifacts/milestone-6-continue.png' });
});
test('Flow L: encounter, escape Seen, capture Captured, Dex save/load', async ({ page }) => {
  await open(page, '?debugEncounters=1&entity=CUTE_005&capture=success'); await startLegacyGame(page);
  await encounter(page); await clickScene(page, 'BattleScene', 'battle-option-3'); await expect.poll(async () => (await state(page)).world).toBe(true);
  await dex(page); expect((await state(page)).panel).toContain('飛鼠 · 單純可愛 · SEEN'); expect((await state(page)).panel).toContain('這是什麼？上網查一下！');
  await page.keyboard.press('Escape'); await encounter(page); await capture(page); await dex(page);
  expect((await state(page)).panel).toContain('飛鼠 · 單純可愛 · 已同行'); await page.screenshot({ path: 'artifacts/milestone-6-dex.png' });
  await page.keyboard.press('Escape'); await menuSave(page); await continueGame(page); expect((await state(page)).runtime.dex.CUTE_005).toBe('CAPTURED');
});
test('Flow M: Boss victory autosave, camp upgrade, reload and no respawn', async ({ page }) => {
  await open(page, '?debugEncounters=1&bossHp=1'); await startLegacyGame(page);
  await page.keyboard.press('F9'); await page.waitForTimeout(100); await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).panel).toContain('巨型森林怪'); await page.keyboard.up('d'); await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).battle).toBe(true); await acknowledgeIntro(page);
  await page.evaluate(async input => {
    const { game } = await import(input.main), { BattleManager } = await import(input.battle), { skills } = await import(input.skills);
    const scene = game.scene.getScene('BattleScene'); scene.manager = new BattleManager(scene.manager.player, scene.manager.enemy, skills, () => 0.99, undefined, undefined, undefined, true);
  }, { main: '/src/main.ts', battle: '/src/battle/BattleManager.ts', skills: '/src/data/skills.ts' });
  await clickScene(page, 'BattleScene', 'battle-option-0'); await clickScene(page, 'BattleScene', 'skill-SKILL_001');
  await expect.poll(async () => (await state(page)).resolving, { timeout: 20000 }).toBe(false); expect((await state(page)).outcome).toBe('VICTORY');
  await clickScene(page, 'BattleScene', 'battle-return'); await expect.poll(async () => (await state(page)).world).toBe(true);
  // No manual save: Boss autosave itself must survive runtime recreation.
  await continueGame(page); expect((await state(page)).runtime.firstAreaComplete).toBe(true); expect((await state(page)).camp).toBe(true); expect((await state(page)).boss).toBe(false);
  await page.keyboard.press('F7'); await expect.poll(async () => (await state(page)).panel).toContain('小可愛圖鑑'); await page.keyboard.press('Enter');
  await continueGame(page); expect((await state(page)).runtime.campUpgradeSeen).toBe(true); expect((await state(page)).panel).toBeUndefined();
  await page.keyboard.press('F9'); await page.waitForTimeout(100); await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d');
  expect((await state(page)).battle).toBe(false); expect((await state(page)).panel).toBeUndefined();
});
test('Flow N: corrupt save stays intact, Continue disabled, explicit delete recovers', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await open(page, '?debugEncounters=1');
  await clickScene(page, 'TitleScene', 'debug-corrupt-save'); expect((await state(page)).summary).toContain('冒險紀錄似乎壞掉了。');
  const available = await page.evaluate(async path => { const { game } = await import(path); return Boolean(game.scene.getScene('TitleScene').children.getByName('title-continue').input?.enabled); }, '/src/main.ts');
  expect(available).toBe(false); await page.reload(); await titleReady(page); expect((await state(page)).summary).toContain('冒險紀錄似乎壞掉了。');
  await clickScene(page, 'TitleScene', 'title-delete'); await clickScene(page, 'TitleScene', 'delete-cancel'); expect((await state(page)).summary).toContain('冒險紀錄似乎壞掉了。');
  await clickScene(page, 'TitleScene', 'title-delete'); await clickScene(page, 'TitleScene', 'delete-confirm'); expect((await state(page)).summary).toContain('從營地出發');
  await page.screenshot({ path: 'artifacts/milestone-6-title.png' }); expect(errors).toEqual([]);
});
test('overwrite warning, dirty return choices and paused playtime work with keyboard', async ({ page }) => {
  await open(page); await startLegacyGame(page); await menuSave(page);
  await page.keyboard.down('d'); await page.waitForTimeout(500); await page.keyboard.up('d');
  await page.keyboard.press('Escape'); const before = (await state(page)).runtime.playTimeSeconds; await page.waitForTimeout(300);
  expect((await state(page)).runtime.playTimeSeconds).toBe(before);
  await clickScene(page, 'WorldScene', 'menu-title'); expect((await state(page)).panel).toContain('尚有未儲存的進度。');
  await clickScene(page, 'WorldScene', 'return-cancel'); await clickScene(page, 'WorldScene', 'menu-title'); await clickScene(page, 'WorldScene', 'return-save');
  await titleReady(page); await clickScene(page, 'TitleScene', 'title-new'); expect((await state(page)).summary).toContain('覆蓋原本進度');
  await clickScene(page, 'TitleScene', 'new-cancel'); expect((await state(page)).summary).toContain('Lv.5 吉伊卡哇');
  await clickScene(page, 'TitleScene', 'title-new'); await clickScene(page, 'TitleScene', 'new-confirm'); await clickScene(page, 'TitleScene', 'starter-CUTE_004'); await page.keyboard.press('Escape');
  expect((await state(page)).heading).toBe('選擇初始小可愛');
});
test('storage quota failure feedback keeps playing and dirty; debug save controls require flag', async ({ page }) => {
  await open(page, '?quickStarter=CUTE_003&debugSave=corrupt'); expect((await state(page)).title).toBe(true);
  const debug = await page.evaluate(async path => { const { game } = await import(path); return Boolean(game.scene.getScene('TitleScene').children.getByName('debug-corrupt-save')); }, '/src/main.ts'); expect(debug).toBe(false);
  await startLegacyGame(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); }; });
  await page.keyboard.press('Escape'); await clickScene(page, 'WorldScene', 'menu-save'); expect((await state(page)).feedback).toBe('儲存失敗。');
  expect((await state(page)).runtime.isDirty).toBe(true); expect((await state(page)).world).toBe(true);
});
