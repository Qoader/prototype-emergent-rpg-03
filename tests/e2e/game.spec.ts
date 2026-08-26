import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

test('renders the world and responds to movement controls', async ({ page }) => {
  await expect(page.getByText('The wilds are listening')).toBeVisible();
  await expect(page.getByRole('application', { name: 'Emberwild game map' })).toBeVisible();
  const map = page.getByRole('application', { name: 'Emberwild game map' });
  const box = await map.boundingBox();
  if (!box) throw new Error('Map has no bounds');
  const sceneX = Math.max(12, (box.width - 960) / 2);
  const sceneY = Math.max(54, (box.height - 704) / 2);
  await map.click({ position: { x: sceneX + 5 * 32 + 16, y: sceneY + 11 * 32 + 16 } });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('emberwild-world-v1')!).state.entities.find(
            (entity: { id: string }) => entity.id === 'hero',
          ).position.x,
      ),
    )
    .toBeLessThan(10);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('The wilds wait')).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('The wilds are listening')).toBeVisible();
});

test('creates a fresh saved world', async ({ page }) => {
  const initialSeed = await page.locator('.eyebrow').first().textContent();
  await page.getByRole('button', { name: 'New world' }).click();
  await expect(page.locator('.eyebrow').first()).not.toHaveText(initialSeed ?? '');
  await page.reload();
  await expect(page.getByText('The wilds are listening')).toBeVisible();
});
