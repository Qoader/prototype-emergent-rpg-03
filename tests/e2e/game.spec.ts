import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

test('renders a continent and responds to movement controls', async ({ page }) => {
  await expect(page.getByText('The wilds are listening')).toBeVisible();
  const map = page.getByRole('application', { name: 'Emberwild game map' });
  await expect(map).toBeVisible();
  const box = await map.boundingBox();
  if (!box) throw new Error('Map has no bounds');
  await map.click({
    position: { x: Math.min(box.width - 20, box.width / 2 + 160), y: box.height / 2 },
  });
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('emberwild-world-v2'))))
    .toBe(true);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('The wilds wait')).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('The wilds are listening')).toBeVisible();
});

test('generates the requested countries, settlements, and compact save', async ({ page }) => {
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('emberwild-world-v2')))
    .not.toBeNull();
  const world = await page.evaluate(() => JSON.parse(localStorage.getItem('emberwild-world-v2')!));
  expect(world.version).toBe(3);
  expect(world.map).toBeUndefined();
  expect(world.countryCount).toBeGreaterThanOrEqual(4);
  expect(world.countryCount).toBeLessThanOrEqual(5);
  expect(world.settlementCounts.capital).toBe(world.countryCount);
  expect(world.settlementCounts.city).toBeGreaterThanOrEqual(world.countryCount * 3);
  expect(world.settlementCounts.village).toBeGreaterThanOrEqual(world.countryCount * 10);
  expect(world.entities.length).toBeGreaterThan(50);
  const summary = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('emberwild-world-v2')!);
    return { seed: saved.seed, hasLegacy: Boolean(localStorage.getItem('emberwild-world-v1')) };
  });
  expect(summary.hasLegacy).toBe(false);
  expect(summary.seed).toBeTruthy();
});

test('creates a fresh saved world', async ({ page }) => {
  const initialSeed = await page.locator('.eyebrow').first().textContent();
  await page.getByRole('button', { name: 'New world' }).click();
  await expect(page.locator('.eyebrow').first()).not.toHaveText(initialSeed ?? '');
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('emberwild-world-v2'))))
    .toBe(true);
});
