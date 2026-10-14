import { expect, type Page } from '@playwright/test';
export async function clickScene(page: Page, scene: string, name: string): Promise<void> {
  await expect.poll(async () => page.evaluate(async input => {
    const { game } = await import(input.path); const root = game.scene.getScene(input.scene);
    const item = root?.children.getByName(input.name) ?? root?.children.getByName('world-panel')?.getByName(input.name);
    return Boolean(item?.visible);
  }, { path: '/src/main.ts', scene, name })).toBe(true);
  const point = await page.evaluate(async input => {
    const { game } = await import(input.path); const root = game.scene.getScene(input.scene);
    const object = root.children.getByName(input.name) ?? root.children.getByName('world-panel')?.getByName(input.name);
    if (!object?.visible) return null;
    const bounds = object.getBounds(); return { x: bounds.centerX, y: bounds.centerY };
  }, { path: '/src/main.ts', scene, name });
  expect(point).not.toBeNull(); const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box!.x + point!.x / 640 * box!.width, box!.y + point!.y / 360 * box!.height);
  await page.waitForTimeout(50); // Phaser processes native pointer input on its next game frame.
}
export async function acknowledgeIntro(page: Page): Promise<void> {
  const pure = await page.evaluate(async path => { const { game } = await import(path); return Boolean(game.scene.getScene('BattleScene').children.getByName('pure-confirm')); }, '/src/main.ts');
  if (pure) await clickScene(page, 'BattleScene', 'pure-confirm');
  await expect.poll(async () => page.evaluate(async path => { const { game } = await import(path); return game.scene.getScene('BattleScene').introReady; }, '/src/main.ts')).toBe(true);
}
export async function titleReady(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(async path => { const { game } = await import(path); return game.scene.isActive('TitleScene'); }, '/src/main.ts')).toBe(true);
}
export async function startLegacyGame(page: Page): Promise<void> {
  await titleReady(page); await clickScene(page, 'TitleScene', 'title-new');
  const overwrite = await page.evaluate(async path => { const {game} = await import(path); return Boolean(game.scene.getScene('TitleScene').children.getByName('new-confirm')); }, '/src/main.ts');
  if (overwrite) await clickScene(page, 'TitleScene', 'new-confirm');
  await clickScene(page, 'TitleScene', 'starter-CUTE_001'); await clickScene(page, 'TitleScene', 'starter-confirm');
  await expect.poll(async () => page.evaluate(async path => { const { game } = await import(path); return game.scene.isActive('WorldScene'); }, '/src/main.ts')).toBe(true);
}
