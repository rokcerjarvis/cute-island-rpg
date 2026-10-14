import { startLegacyGame, acknowledgeIntro } from './helpers';
import { test, expect, type Page } from '@playwright/test';

async function snapshot(page: Page) {
  return page.evaluate(async (modulePath) => {
    const { game } = await import(modulePath);
    const scene = game.scene.getScene('WorldScene');
    const player = scene.children.list.find((child: { name: string }) => child.name === 'player');
    return { x: player.x, y: player.y, vx: player.body.velocity.x, vy: player.body.velocity.y,
      left: player.body.left, right: player.body.right, top: player.body.top,
      cameraX: scene.cameras.main.scrollX, cameraY: scene.cameras.main.scrollY };
  }, '/src/main.ts');
}
async function place(page: Page, x: number, y: number) {
  await page.evaluate(async ({ x, y, modulePath }) => {
    const { game } = await import(modulePath);
    const scene = game.scene.getScene('WorldScene');
    const player = scene.children.list.find((child: { name: string }) => child.name === 'player');
    player.body.reset(x, y);
  }, { x, y, modulePath: '/src/main.ts' });
}
async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await expect.poll(async () => (await snapshot(page)).vx === 0 && (await snapshot(page)).vy === 0).toBe(true);
}

test('boots, walks four ways, collides and follows the camera', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5191');
  await startLegacyGame(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(async () => {
    try { return (await snapshot(page)).x; } catch { return 0; }
  }).toBe(240);
  for (const [key, axis, sign] of [['ArrowRight', 'x', 1], ['ArrowLeft', 'x', -1], ['ArrowDown', 'y', 1], ['ArrowUp', 'y', -1]] as const) {
    await place(page, 240, 400);
    await hold(page, key, 250);
    expect(((await snapshot(page))[axis] - (axis === 'x' ? 240 : 400)) * sign).toBeGreaterThan(10);
  }
  await place(page, 100, 430);
  await hold(page, 'ArrowLeft', 1400);
  expect((await snapshot(page)).left).toBeGreaterThanOrEqual(0);
  await place(page, 160, 350);
  await hold(page, 'ArrowUp', 800);
  expect((await snapshot(page)).top).toBeGreaterThanOrEqual(320); // tent's lower edge
  await place(page, 700, 430);
  await hold(page, 'd', 500);
  const following = await snapshot(page);
  expect(following.x).toBeGreaterThan(720);
  expect(following.cameraX).toBeGreaterThan(300);
  expect(following.cameraY).toBeGreaterThan(0);
  const stopped = await snapshot(page);
  await page.waitForTimeout(150);
  expect((await snapshot(page)).x).toBeCloseTo(stopped.x, 1);
  await page.screenshot({ path: 'artifacts/milestone-1.png' });
  expect(errors).toEqual([]);
});
