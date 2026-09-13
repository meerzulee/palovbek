import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.skip(process.env.NEURAL_E2E !== '1', 'Requires the downloaded model and a local backend; run NEURAL_E2E=1 npm run test:e2e');

// Keep English regression selectors independent of the machine's country.
test.beforeEach(async ({page}) => {
  await page.route('**/api/locale', route => route.fulfill({contentType:'application/json',body:'{"locale":"en"}'}));
});

test('real neural backend drives snapshots, pauses, checkpoints, and output interventions', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Explore the kitchen first',exact:true}).click();
  await page.locator('.app-settings > summary').click();
  await page.getByRole('button', {name:'Live neural experiment', exact:true}).click();
  await page.locator('.model-settings > summary').click();
  const controls = page.getByRole('region', {name:'Neural experiment controls'});
  await expect(controls).toContainText('Paused · local CPU');
  const free=page.getByRole('button',{name:'Free neural experiment →',exact:true});
  if(await free.count()) await free.click();
  await expect(controls).toContainText('Paused · local CPU');
  await controls.getByRole('button', {name:'Reset', exact:true}).click();
  await expect(page.getByTestId('neural-time')).toHaveText('0.00 s');
  await page.getByRole('button', {name:'Run neural experiment', exact:true}).click();
  await expect.poll(async () => Number((await page.getByTestId('neural-time').textContent())?.split(' ')[0])).toBeGreaterThan(.3);
  await page.getByRole('button', {name:'Pause experiment', exact:true}).click();
  await expect(controls).toContainText('Paused · local CPU');
  const paused = await page.getByTestId('neural-time').textContent();
  await page.waitForTimeout(400);
  const kitchenTime = await page.locator('.canvas-host').getAttribute('data-animation-time');
  await page.waitForTimeout(450);
  expect(await page.getByTestId('neural-time').textContent()).toBe(paused);
  expect(await page.locator('.canvas-host').getAttribute('data-animation-time')).toBe(kitchenTime);
  const brain = page.getByRole('region', {name:'Simulated neural activity'});
  await expect(brain.locator('.brain-canvas')).toHaveAttribute('data-spikes', /[1-9]\d*/);
  await page.getByRole('button', {name:'Save checkpoint', exact:true}).click();
  await expect(page.getByRole('button', {name:'Restore saved state', exact:true})).toBeEnabled();
  await controls.getByRole('button', {name:'Reset', exact:true}).click();
  await expect(page.getByTestId('neural-time')).toHaveText('0.00 s');
  await page.getByRole('button', {name:'Restore saved state', exact:true}).click();
  await expect(page.getByTestId('neural-time')).toHaveText(paused!);
  await controls.getByRole('button', {name:'Reset', exact:true}).click();
  await expect(page.getByTestId('neural-time')).toHaveText('0.00 s');
  await page.getByText('Test the neural connection', {exact:true}).click();
  await page.getByLabel('Silence output neurons', {exact:true}).click();
  await expect(page.getByLabel('Silence output neurons', {exact:true})).toBeChecked();
  await page.getByRole('button', {name:'Run neural experiment', exact:true}).click();
  await expect(page.getByTestId('neural-decision')).toHaveText('wait');
  await expect.poll(async () => Number((await page.getByTestId('neural-time').textContent())?.split(' ')[0])).toBeGreaterThan(.25);
  await page.getByRole('button', {name:'Pause experiment', exact:true}).click();
  await expect(controls).toContainText('Paused · local CPU');
  await expect(page.getByTestId('neural-decision')).toHaveText('wait');
  await mkdir('artifacts', {recursive:true});
  await page.screenshot({path:'artifacts/neural-desktop.png', fullPage:true});
  expect(errors).toEqual([]);
});

test('mobile neural view fits, and loss of connection freezes the experiment', async ({page}) => {
  await page.setViewportSize({width:390, height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Explore the kitchen first',exact:true}).click();
  await page.locator('.app-settings > summary').click();
  await page.getByRole('button', {name:'Live neural experiment', exact:true}).click();
  await page.locator('.model-settings > summary').click();
  const controls = page.getByRole('region', {name:'Neural experiment controls'});
  await expect(controls).toContainText('Paused · local CPU');
  const free=page.getByRole('button',{name:'Free neural experiment →',exact:true});
  if(await free.count()) await free.click();
  await expect(controls).toContainText('Paused · local CPU');
  await controls.getByRole('button', {name:'Reset', exact:true}).click();
  await page.getByRole('button', {name:'Run neural experiment', exact:true}).click();
  await expect.poll(async () => Number((await page.getByTestId('neural-time').textContent())?.split(' ')[0])).toBeGreaterThan(.2);
  await page.getByRole('button', {name:'Pause experiment', exact:true}).click();
  await expect(controls).toContainText('Paused · local CPU');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const kitchen = await page.locator('.kitchen-card').boundingBox(), box = await controls.boundingBox();
  expect(box!.y).toBeGreaterThan(kitchen!.y + kitchen!.height);
  await page.screenshot({path:'artifacts/neural-mobile.png', fullPage:true});
  const time = await page.getByTestId('neural-time').textContent();
  // Explicitly sever the active socket; no scripted fallback may start.
  await page.context().setOffline(true);
  await expect(controls).toContainText('Local brain offline', {timeout:20000});
  await expect(page.getByRole('button', {name:'Run neural experiment', exact:true})).toBeDisabled();
  await page.waitForTimeout(500);
  expect(await page.getByTestId('neural-time').count()).toBe(0); // Live controls disappear; frozen scene remains.
  await page.context().setOffline(false);
  await page.getByRole('button', {name:'Reconnect', exact:true}).click();
  await expect(controls).toContainText('Paused · local CPU');
  await expect(page.getByTestId('neural-time')).toHaveText(time!);
});
