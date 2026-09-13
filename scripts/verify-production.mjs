import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const baseURL = process.env.PALOVBEK_URL ?? 'https://plov.mrz.sh';
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync(localChrome) ? localChrome : undefined);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const requests = [], errors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__loaderOpened = false;
    new MutationObserver(() => { if (document.querySelector('.brain-load-dialog[open]')) window.__loaderOpened = true; }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    const Original = window.Worker;
    window.Worker = class extends Original {
      constructor(url, options) {
        super(url, options);
        this.addEventListener('message', event => {
          if (event.data.type === 'snapshot') window.__snapshot = event.data;
          if (event.data.type === 'metadata') window.__metadata = event.data;
        });
      }
    };
  });
  const localeResponse = await page.request.get(`${baseURL}/api/locale`);
  assert.equal(localeResponse.status(), 200);
  assert.match(localeResponse.headers()['cache-control'], /private.*no-store/);
  const countryDefault = await localeResponse.json();
  await page.goto(baseURL);
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.locator('.brand').innerText(), 'Palovbek');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (countryDefault.locale) assert.equal(await page.locator('html').getAttribute('lang'), countryDefault.locale);
  await page.getByRole('button', { name: /^(Load weights · 79 MB|Загрузить веса · 79 МБ)$/ }).click();
  console.log('Loading production weights on a fresh mobile browser context...');
  await page.waitForFunction(() => window.__snapshot?.world.added.includes('oil') && window.__snapshot?.neural.total_spikes > 0, undefined, { timeout: 300000 });
  const result = await page.evaluate(() => ({
    run_id: window.__snapshot.run_id,
    backend: window.__snapshot.performance.backend,
    neurons: window.__metadata.neurons,
    connections: window.__metadata.connections,
    total_spikes: window.__snapshot.neural.total_spikes,
    ingredients: window.__snapshot.world.added,
    engine: window.__snapshot.model_version,
    frame_seconds: window.__snapshot.performance.frame_seconds,
  }));
  assert.equal(result.neurons, 166700);
  assert(result.total_spikes > 0);
  assert(!requests.some(url => url.includes('/api/neural')));
  await page.locator('.kitchen-toolbar .cook-button').click();
  await page.waitForFunction(() => window.__snapshot.running === false);
  await page.locator('.site-header').getByRole('button', { name: 'English', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__snapshot.run_id), result.run_id);
  await page.locator('.neural-dashboard').scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(600);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/production-mobile.png', fullPage: true });
  const downloadedFiles = requests.filter(url => url.includes('/browser-brain/data/') && url.includes('.dat')).length;
  const beforeReload = requests.length;
  await page.reload();
  await page.waitForFunction(() => window.__snapshot?.running && window.__snapshot.world.elapsed > 0, undefined, { timeout: 120000 });
  assert.equal(await page.evaluate(() => window.__loaderOpened), false);
  const redownloadedFiles = requests.slice(beforeReload).filter(url => url.includes('/browser-brain/data/') && url.includes('.dat')).length;
  assert.equal(redownloadedFiles, 0);
  assert.deepEqual(errors, []);
  const report = { checked_at: new Date().toISOString(), url: baseURL, country_default: countryDefault, mobile_viewport: { width: 390, height: 844 }, ...result, downloadedFiles, redownloadedFiles, cached_visit_skips_modal: true, cached_visit_autostarts: true, page_errors: errors, cross_origin_requests: requests.filter(url => new URL(url).origin !== new URL(baseURL).origin) };
  await mkdir('docs/results', { recursive: true });
  await writeFile('docs/results/production-browser.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
