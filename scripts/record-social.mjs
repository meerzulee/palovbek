// Record the real browser model. Presentation CSS only; simulation and weights stay unchanged.
// Run against a stable preview: npm run build && npm run preview -- --port 4173
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const locale = process.env.PALOVBEK_LANG === 'ru' ? 'ru' : 'en';
const output = resolve(process.env.PALOVBEK_MEDIA_DIR ?? 'artifacts/social');
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync(localChrome) ? localChrome : undefined),
});
await mkdir(output, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1,
  recordVideo: { dir: resolve(output, 'raw'), size: { width: 1080, height: 1920 } },
});
const page = await context.newPage();
const started = Date.now();
const events = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(locale => {
  localStorage.setItem('plov-language-v1', locale);
  const Original = window.Worker;
  window.Worker = class extends Original {
    constructor(url, options) {
      super(url, options);
      this.addEventListener('message', event => {
        if (event.data.type === 'snapshot') window.__socialSnapshot = event.data;
        if (event.data.type === 'metadata') window.__socialMetadata = event.data;
      });
    }
  };
}, locale);
try {
  await page.goto(process.env.PALOVBEK_URL ?? 'http://localhost:4173');
  await page.getByRole('button', { name: locale === 'ru' ? 'Загрузить веса · 79 МБ' : 'Load weights · 79 MB', exact: true }).click();
  await page.waitForFunction(() => window.__socialSnapshot?.world.added.includes('oil'), undefined, { timeout: 300000 });
  console.log('Real model loaded; recording the full recipe.');
  // Keep a larger, legible kitchen and measured brain view in the vertical export.
  await page.addStyleTag({ content: `
    html, body { width:1080px!important; height:1920px!important; overflow:hidden!important; background:#0d1215!important; }
    .site-header, footer, .kitchen-column > :not(.kitchen-card), .chef-column > :not(.neural-dashboard),
    .scene-topline, .scene-bottomline, .scene-caption, .neuron-details, .brain-controls { display:none!important; }
    .minimal-main { padding:0!important; margin:0!important; max-width:none!important; }
    .minimal-main .dashboard { display:block!important; }
    .minimal-main .kitchen-column, .minimal-main .chef-column { display:block!important; }
    .minimal-main .neural-lab .kitchen-card { position:absolute!important; left:32px!important; top:140px!important; width:1016px!important; height:1110px!important; border-radius:28px!important; overflow:hidden!important; }
    .canvas-host { inset:0!important; }
    .minimal-main .fly-thought { max-width:650px!important; font-size:28px!important; padding:17px 23px!important; line-height:1.35!important; border-radius:18px!important; }
    .minimal-main .neural-dashboard { position:absolute!important; left:32px!important; top:1278px!important; width:1016px!important; height:342px!important; overflow:hidden!important; border-radius:28px!important; }
    .minimal-main .brain-instruments { position:absolute!important; left:0!important; top:0!important; width:58%!important; height:100%!important; }
    .minimal-main .brain-instruments .measured-brain { height:342px!important; border-radius:0!important; }
    .minimal-main .measured-brain .brain-heading { top:24px!important; left:28px!important; right:28px!important; }
    .minimal-main .brain-heading h2 { font-size:27px!important; }
    .minimal-main .brain-live { font-size:22px!important; }
    .minimal-main .measured-brain .brain-canvas { top:65px!important; bottom:40px!important; }
    .minimal-main .measured-brain .brain-disclosure { font-size:20px!important; left:28px!important; bottom:17px!important; }
    .minimal-main .neuron-telemetry { position:absolute!important; right:24px!important; top:18px!important; width:35%!important; margin:0!important; display:block!important; border:0!important; }
    .minimal-main .neuron-telemetry>div { padding:18px 0!important; }
    .minimal-main .neuron-telemetry span { font-size:23px!important; }
    .minimal-main .neuron-telemetry strong { font-size:47px!important; margin-top:10px!important; }
    #social-title { position:absolute; left:56px; top:48px; color:#b7ecd1; font:700 32px Arial; letter-spacing:1px; }
    #social-hook { position:absolute; right:56px; top:52px; color:#bccdc6; font:400 28px/1.2 Arial; }
    #social-step { position:absolute; top:1680px; left:56px; right:56px; color:#f0f2ed; font:500 38px/1.25 Arial; }
    #social-footer { position:absolute; top:1790px; left:56px; right:56px; display:flex; align-items:center; justify-content:space-between; }
    #social-footer b { color:#b7ecd1; font:700 36px Arial; }
    #social-footer span { color:#9badb6; font:23px/1.4 Arial; text-align:right; }
  ` });
  await page.evaluate(locale => {
    for (const [id, text] of [['social-title',locale === 'ru' ? 'Паловбек' : 'Palovbek'], ['social-hook',locale === 'ru' ? '166 700 нейронов' : '166,700 neurons'], ['social-step',locale === 'ru' ? 'Шесть лапок. Один серьёзный рецепт.' : 'Six legs. One very serious recipe.']]) {
      const el = document.createElement('div'); el.id=id; el.textContent=text; el.style.whiteSpace='pre-line'; document.body.append(el);
    }
    const footer = document.createElement('div'); footer.id='social-footer';
    const url=document.createElement('b'); url.textContent='plov.mrz.sh'; footer.append(url);
    const note=document.createElement('span'); note.innerText=locale === 'ru' ? 'Готовка по рецепту\nСпайки нейросимуляции' : 'Recipe-guided cooking\nReal simulated spikes'; footer.append(note); document.body.append(footer);
    scrollTo(0,0);
  }, locale);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: resolve(output, 'recording-preview.png') });
  const deadline = Date.now() + 12 * 60 * 1000;
  let previous = '', doneAt = null;
  while (Date.now() < deadline) {
    const state = await page.evaluate(locale => {
      const s=window.__socialSnapshot, scene=document.querySelector('.canvas-host');
      const labels=locale === 'ru' ? ['Разогреваем масло. Начинаем плов.', 'Лук, баранина и немного терпения.', 'Морковь соломкой. Шесть лапок за дело.', 'Зирвак кипит. Сабр, ака.', 'Рис в казане. Ложка отдыхает.', 'Крышку закрыли. Теперь терпение.', 'Ош тайёр! Плов готов.'] : ['Heat the oil. Build the flavour.', 'Onions, lamb, and a little patience.', 'Matchstick carrots. Six-legged precision.', 'Zirvak: the best things take time.', 'Rice goes in. Spoon takes a break.', 'Lid on. Sabr, aka.', 'Osh tayyor! Plov is ready.'];
      const caption=document.querySelector('#social-step');
      if(caption) caption.textContent=s.world.outcome==='served'?labels[6]:labels[Math.min(6,s.recipe?.stage??0)];
      return { time:Date.now(), action:s.world.pending?.name??s.world.last_action, visual:scene?.dataset.chefAction,
        grooming:scene?.dataset.grooming, stage:s.recipe?.stage, label:s.recipe?.label, added:s.world.added,
        covered:s.world.covered, outcome:s.world.outcome, spikes:s.neural.total_spikes, backend:s.performance.backend,
        temperature:s.world.temperature, run_id:s.run_id, mistakes:s.world.mistakes };
    }, locale);
    state.seconds=(state.time-started)/1000; events.push(state);
    const key=`${state.stage}:${state.visual}:${state.covered}:${state.outcome}`;
    if(key!==previous) { console.log(JSON.stringify(state)); previous=key; }
    if(state.outcome && !doneAt) {
      if(state.outcome !== 'served') throw Error(`Cooking ended: ${state.outcome}`);
      doneAt=Date.now();
      await page.getByRole('button', { name:locale === 'ru' ? 'Казан' : 'Qazan cam', exact:true, includeHidden:true }).evaluate(button=>button.click());
    }
    if(doneAt && Date.now()-doneAt>6500) break;
    await page.waitForTimeout(250);
  }
  if(!doneAt) throw Error('Recording timed out before serving.');
  await page.screenshot({ path:resolve(output,'palovbek-cover.png') });
  const metadata=await page.evaluate(()=>({neurons:window.__socialMetadata.neurons,connections:window.__socialMetadata.connections}));
  await writeFile(resolve(output,'capture.json'),JSON.stringify({recorded_at:new Date().toISOString(),locale,presentation:'compact title, neuron count retained',...metadata,errors,events},null,2)+'\n');
  if(errors.length) throw Error(errors.join('\n'));
  await context.close();
  await page.video().saveAs(resolve(output,'full-cook.webm'));
  console.log(`Recording saved to ${output}/full-cook.webm`);
} finally {
  // Preserve telemetry and the recording even if a presentation step fails.
  await writeFile(resolve(output,'capture-events.json'),JSON.stringify({errors,events},null,2)+'\n');
  await context.close().catch(()=>{});
  await page.video().saveAs(resolve(output,'full-cook.webm')).catch(()=>{});
  await browser.close();
}
