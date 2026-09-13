import { test, expect } from '@playwright/test';

test('wrapped bilingual jokes stay above the doppi on desktop and phones', async ({ page }) => {
  await page.route('**/api/locale', route => route.fulfill({ contentType: 'application/json', body: '{"locale":"en"}' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the kitchen first' }).click();
  await page.locator('.app-settings > summary').click();
  await page.getByRole('button', { name: 'Scripted cooking demo', exact: true }).click();
  await page.getByRole('button', { name: 'Chop carrots', exact: true }).click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(1200);
    for (const language of ['Русский', 'English']) {
      await page.locator('.site-header').getByRole('button', { name: language, exact: true }).click();
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const speech = page.locator('.fly-thought');
      await expect(speech).toBeVisible();
      if (language === 'Русский') await expect(speech).toContainText(/[А-Яа-я]/);
      await expect(speech.locator('.thought-dot')).not.toBeVisible();
      const box = (await speech.boundingBox())!, scene = (await page.locator('.canvas-host').boundingBox())!;
      const hatY = Number(await page.locator('.canvas-host').getAttribute('data-hat-screen-y'));
      expect(box.y + box.height).toBeLessThan(scene.y + hatY - 10);
      expect(box.x).toBeGreaterThanOrEqual(scene.x);
      expect(box.x + box.width).toBeLessThanOrEqual(scene.x + scene.width);
    }
  }
});
