import { test, expect } from '@playwright/test';

test('phone and landscape layouts keep the loader and six camera controls reachable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/locale', route => route.fulfill({ contentType: 'application/json', body: '{"locale":"ru"}' }));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const modal = page.getByRole('dialog', { name: 'Просыпайся, Паловбек.' });
  await expect(modal).toBeVisible();
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const box = (await modal.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    const load = modal.getByRole('button', { name: 'Загрузить веса · 79 МБ' });
    await load.scrollIntoViewIfNeeded();
    await expect(load).toBeInViewport({ ratio: 1 });
  }
  await modal.getByRole('button', { name: 'Сначала осмотреть кухню' }).click();
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    const header = (await page.locator('.site-header').boundingBox())!;
    expect(header.height).toBeLessThanOrEqual(80);
    if (viewport.width <= 700) {
      await page.locator('.header-menu > summary').click();
      const menu = (await page.locator('.header-links').boundingBox())!;
      expect(menu.x).toBeGreaterThanOrEqual(0);
      expect(menu.x + menu.width).toBeLessThanOrEqual(viewport.width);
      await page.locator('.header-menu > summary').click();
    }
    for (const label of ['English', 'Русский']) {
      const button = page.locator('.site-header').getByRole('button', { name: label, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(await button.evaluate(el => {
        const box = el.getBoundingClientRect(), range = document.createRange();
        range.selectNodeContents(el); const text = range.getBoundingClientRect();
        return Math.abs(text.x + text.width / 2 - box.x - box.width / 2);
      })).toBeLessThan(1);
    }
    await page.getByRole('button', { name: 'Чай', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Чай', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${viewport.width}`).toBe(true);
    const buttons = await page.locator('.view-tabs button').all();
    expect(buttons).toHaveLength(6);
    for (const button of buttons) {
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      if (viewport.width <= 850) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.scene-tools button').last().click();
  const expanded = page.locator('.kitchen-card.is-expanded');
  await expect(expanded).toBeVisible();
  expect((await expanded.boundingBox())!.height).toBe(828);
  await page.setViewportSize({ width: 844, height: 390 });
  expect((await expanded.boundingBox())!.height).toBe(350);
  await page.keyboard.press('Escape');
  await expect(expanded).not.toBeVisible();
  expect(errors).toEqual([]);
});
