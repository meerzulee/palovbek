import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserLocale, countryLocale, RUSSIAN_DEFAULT_COUNTRIES } from '../shared/locale.ts';
import worker from '../worker/index.ts';
import { translateText } from './translation.ts';
import { BrowserKitchen } from './browserKitchen.ts';

test('country routing uses the explicit CIS defaults and English elsewhere', () => {
  for (const country of RUSSIAN_DEFAULT_COUNTRIES) assert.equal(countryLocale(country), 'ru');
  for (const country of ['US', 'GB', 'FR', 'TR', 'GE', 'UA', 'EE']) assert.equal(countryLocale(country), 'en');
  assert.equal(countryLocale('kg'), 'ru');
  assert.equal(countryLocale('XX'), null);
  assert.equal(countryLocale(undefined), null);
  assert.equal(browserLocale(['en-US', 'ru']), 'en');
  assert.equal(browserLocale(['ru-RU', 'en']), 'ru');
});

test('edge locale uses trusted country metadata and never shares a cached response', async () => {
  const env = { ASSETS: { fetch: async () => new Response('static asset') } };
  const request = Object.assign(new Request('https://plov.test/api/locale', { headers: { 'CF-IPCountry': 'US' } }), { cf: { country: 'UZ' } });
  const response = await worker.fetch(request, env);
  assert.deepEqual(await response.json(), { locale: 'ru' });
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const unknown = await worker.fetch(new Request('https://plov.test/api/locale', { headers: { 'CF-IPCountry': 'RU' } }), env);
  assert.deepEqual(await unknown.json(), { locale: null });
  assert.equal(await (await worker.fetch(new Request('https://plov.test/'), env)).text(), 'static asset');
});

test('every browser recipe instruction and completed action translates without changing its log', () => {
  for (const id of ['classic', 'quince', 'wedding', 'bedana']) {
    const kitchen = new BrowserKitchen(id);
    for (let i = 0; i < 2000 && !kitchen.world.outcome; i++) {
      const label = kitchen.progress().label;
      assert.match(translateText(label, 'ru'), /[А-Яа-я]/, label);
      if (!kitchen.world.pending) kitchen.begin(kitchen.choose().action);
      kitchen.advance();
      const original = kitchen.world.last_result;
      assert.match(translateText(original, 'ru'), /[А-Яа-я]/, original);
      assert.equal(kitchen.world.last_result, original);
      assert.equal(translateText(original, 'en'), original);
    }
    assert.equal(kitchen.world.outcome, 'served');
  }
  assert.equal(translateText('Picked up 2.4 tsp spice.', 'ru'), 'Взял: зира, 2,4 ч. л.');
  assert.match(translateText('Precious cargo: 150 ml oil. Coming through!', 'ru'), /масло, 150 мл/);
  assert.match(translateText('150 ml oil. Into the qazan you go!', 'ru'), /масло, 150 мл/);
  assert.match(translateText('Browser brain stopped: Could not verify offsets-000.bin.dat: Data download failed (HTTP 404). Please try again later.. Completed downloads are saved; retry loading.. Reload the brain to start a fresh session.', 'ru'), /Не удалось/);
});
