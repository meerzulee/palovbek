import { test, expect } from '@playwright/test';

test('Russian first-visit modal, mobile layout, and remembered manual English override', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/locale', route => route.fulfill({ contentType: 'application/json', body: '{"locale":"ru"}' }));
  await page.goto('/');
  const modal = page.getByRole('dialog', { name: 'Просыпайся, Паловбек.' });
  await expect(modal).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(modal.getByRole('button', { name: 'Загрузить веса · 79 МБ' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/russian-loader-mobile.png' });
  await modal.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Wake up, Palovbek.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Wake up, Palovbek.' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore the kitchen first' }).click();
  await page.locator('.site-header').getByRole('button', { name: 'Русский', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Выберите плов' })).toBeVisible();
  await expect(page.locator('.fly-thought')).toContainText('Тюбетейка');
  await page.locator('.header-menu > summary').click();
  await page.getByRole('button', { name: 'Рецепт', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Рецепт узбекского плова' })).toContainText('накройте');
  await page.getByRole('button', { name: 'Вернуться на кухню' }).click();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Просыпайся, Паловбек.' })).toBeVisible();
  await page.getByRole('button', { name: 'Сначала осмотреть кухню' }).click();
  await page.locator('.model-settings > summary').click();
  await expect(page.getByText('Зерно случайности', { exact: true })).toBeVisible();
  await page.locator('.model-settings > summary').click();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true);
  }
});

test('known non-CIS country chooses English even with a Russian browser', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  const page = await context.newPage();
  await page.route('**/api/locale', route => route.fulfill({ contentType: 'application/json', body: '{"locale":"en"}' }));
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Wake up, Palovbek.' })).toBeVisible();
  await context.close();
});

test('unavailable geography falls back to browser language without blocking startup', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
  const page = await context.newPage();
  await page.route('**/api/locale', route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Просыпайся, Паловбек.' })).toBeVisible();
  await context.close();
});

test('Russian download failure and retry controls remain usable', async ({ page }) => {
  await page.route('**/api/locale', route => route.fulfill({ contentType: 'application/json', body: '{"locale":"ru"}' }));
  await page.route('**/browser-brain/data/offsets-000.bin.dat', route => route.fulfill({ status: 404, body: 'missing fixture' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Загрузить веса · 79 МБ' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('button', { name: 'Повторить загрузку весов' })).toBeVisible({ timeout: 30000 });
  await expect(modal.getByRole('alert')).toContainText('Не удалось');
  await expect(modal.getByRole('alert')).toContainText('HTTP 404');
  await expect(modal.getByRole('alert')).not.toContainText('Please try again');
});
