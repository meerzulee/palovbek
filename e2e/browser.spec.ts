import {test,expect} from '@playwright/test';
import type {Route} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import type {NeuralSnapshot} from '../src/neural';
import type {CookingReport} from '../src/useNeural';
declare global {interface Window {__brainSnapshot?:NeuralSnapshot;__cookReport?:CookingReport;__loaderOpened?:boolean;__actionTimes?:{run:string;id:number;time:number;action:string}[];}}

// Keep English regression selectors independent of the machine's country.
test.beforeEach(async ({page}) => {
  await page.route('**/api/locale', route => route.fulfill({contentType:'application/json',body:'{"locale":"en"}'}));
});

test('browser cooks a complete wedding plov, repairs a corrupt download, and exports genuine activity',async({page})=>{
  test.setTimeout(600000);
  const errors:string[]=[],requests:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await page.addInitScript(()=>{
    window.__loaderOpened=false;window.__actionTimes=[];
    new MutationObserver(()=>{if(document.querySelector('.brain-load-dialog[open]'))window.__loaderOpened=true;}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    const Original=window.Worker;
    window.Worker=class extends Original {constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener('message',event=>{if(event.data.type==='snapshot'){window.__brainSnapshot=event.data;const last=event.data.cooking_log?.at(-1);if(last&&!window.__actionTimes!.some(x=>x.run===event.data.run_id&&x.id===last.id))window.__actionTimes!.push({run:event.data.run_id,id:last.id,action:last.action,time:performance.now()});}if(event.data.type==='archive')window.__cookReport=event.data.report;});}};
  });
  let attempts=0;
  await page.route('**/browser-brain/data/offsets-000.bin.dat',route=>{attempts++;return attempts===1?route.fulfill({status:200,body:'corrupt test bytes',contentType:'application/octet-stream'}):route.continue();});
  await page.goto('/');
  const loader=page.getByRole('dialog',{name:'Wake up, Palovbek.'});
  await expect(loader).toBeVisible();
  expect(requests.some(url=>url.includes('/browser-brain/data/'))).toBe(false);
  await loader.getByRole('button',{name:'Load weights · 79 MB',exact:true}).click();
  await expect(page.getByRole('progressbar',{name:'Model weights download',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible({timeout:90000});
  const controls=page.getByRole('region',{name:'Neural experiment controls'});
  await expect(controls).toContainText(/Running · browser (WebGPU|CPU)/,{timeout:90000});
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot?.world.elapsed??0)).toBeGreaterThan(0);
  await expect(page.getByRole('region',{name:'Quick cooking controls'})).toContainText('Choyxona plov');
  expect(attempts).toBeGreaterThanOrEqual(2);
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot?.performance.frame_seconds),{timeout:10000}).toBe(.375);
  await page.getByRole('button',{name:'Select To‘y oshi',exact:true}).click();
  await page.getByRole('button',{name:'Cook this plov',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot?.neural.total_spikes??0)).toBeGreaterThan(0);
  await page.locator('.neuron-details > summary').click();
  await expect(page.locator('.active-cell-row').first()).toBeVisible();
  await page.locator('.neuron-details > summary').click();
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot?.world.added.includes('oil')),{timeout:30000}).toBe(true);
  const actionTimes=await page.evaluate(()=>window.__actionTimes!.filter(x=>x.run===window.__brainSnapshot!.run_id));
  for(let i=1;i<actionTimes.length;i++){const seconds=(actionTimes[i].time-actionTimes[i-1].time)/1000;expect(seconds,actionTimes[i].action).toBeGreaterThan(1);expect(seconds,actionTimes[i].action).toBeLessThan(2.8);}
  await mkdir('artifacts',{recursive:true});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'artifacts/browser-lab-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Pause cooking from toolbar',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot?.running)).toBe(false);
  const time=await page.getByTestId('neural-time').textContent();await page.waitForTimeout(350);expect(await page.getByTestId('neural-time').textContent()).toBe(time);
  const beforeLanguage=await page.evaluate(()=>({id:window.__brainSnapshot!.run_id,seconds:window.__brainSnapshot!.world.elapsed}));
  await page.locator('.site-header').getByRole('button',{name:'Русский',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await expect(page.locator('.toolbar-summary h1')).toHaveText('Свадебный плов');
  await expect(page.locator('.fly-thought')).toContainText(/[А-Яа-я]/);
  await expect(page.locator('.cooking-log-rows')).toContainText('Добавил в казан: масло');
  expect(await page.evaluate(()=>({id:window.__brainSnapshot!.run_id,seconds:window.__brainSnapshot!.world.elapsed}))).toEqual(beforeLanguage);
  await page.getByRole('button',{name:'Продолжить готовку сверху',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot!.world.elapsed)).toBeGreaterThan(beforeLanguage.seconds);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'artifacts/russian-cooking-desktop.png',fullPage:true});
  await page.waitForFunction(()=>{
    const world=window.__brainSnapshot?.world;
    return !!world && world.water>0 && world.temperature>=96 && !world.added.includes('rice');
  },undefined,{timeout:240000,polling:50});
  await page.getByRole('button',{name:'Приостановить готовку сверху',exact:true}).click();
  await page.getByRole('button',{name:'Казан',exact:true}).click();
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(600);
  await expect(page.locator('.canvas-host')).toHaveAttribute('data-qazan-phase','boiling');
  expect(Number(await page.locator('.canvas-host').getAttribute('data-qazan-bubbles'))).toBeGreaterThan(0);
  await page.screenshot({path:'artifacts/brain-zirvak-boiling.png',fullPage:true});
  await page.getByRole('button',{name:'Продолжить готовку сверху',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot?.world.outcome),{timeout:360000,intervals:[1000]}).toBe('served');
  const report=await page.evaluate(()=>window.__cookReport!);
  expect(report.mistakes).toBe(0);expect(report.ingredients).toEqual(['oil','onion','lamb','carrot','spice','garlic','chickpea','raisin','rice','egg','qazi']);
  expect(report.actions.filter(row=>row.action==='chop')).toHaveLength(3);
  expect(report.actions.at(-1)?.action).toBe('serve');
  const riceAt=report.actions.find(row=>row.action==='add'&&row.ingredients.includes('rice'))!.time;
  expect(report.actions.some(row=>row.action==='stir'&&row.time>riceAt)).toBe(false);
  expect(report.actions.some(row=>row.neural_choice&&!row.neural_choice.fallback)).toBe(true);
  await expect(page.locator('.neural-episode')).toContainText('Плов подан');
  await page.locator('.site-header').getByRole('button',{name:'English',exact:true}).click();
  expect(await page.evaluate(()=>window.__brainSnapshot!.run_id)).toBe(beforeLanguage.id);
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Full log · JSON',exact:true}).click();const download=await downloadEvent;expect(download.suggestedFilename()).toContain('plov-wedding');
  await writeFile('docs/results/browser-wedding.json',JSON.stringify(report,null,2)+'\n');
  await page.evaluate(()=>scrollTo(0,0));
  // Allow the offscreen WebGL views to redraw after returning from the download control.
  await page.waitForTimeout(300);
  await page.screenshot({path:'artifacts/browser-lab-served.png',fullPage:true});
  await page.getByRole('button',{name:'Previous cooks',exact:false}).click();await expect(page.locator('.cook-history')).toContainText('To‘y oshi');
  expect(requests.some(url=>url.includes('/api/neural'))).toBe(false);
  const appOrigin=new URL(page.url()).origin;
  expect(requests.filter(url=>new URL(url).origin!==appOrigin)).toEqual([]);
  expect(errors).toEqual([]);

  // A real populated cache suppresses the modal and starts a fresh cook without a click.
  const beforeReload=requests.length;
  await page.reload();
  await expect(controls).toContainText(/Running · browser (WebGPU|CPU)/,{timeout:90000});
  expect(await page.evaluate(()=>window.__loaderOpened)).toBe(false);
  expect(requests.slice(beforeReload).some(url=>url.includes('/browser-brain/data/')&&url.includes('.dat'))).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot?.world.elapsed??0)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__brainSnapshot?.run_id)).not.toBe(report.run_id);
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // The primary transport stays within the mobile viewport, even deep in the dashboard.
  await page.setViewportSize({width:390,height:844});
  await page.locator('.ingredients-section').scrollIntoViewIfNeeded();
  const toolbar=page.getByRole('region',{name:'Quick cooking controls'});
  const box=await toolbar.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThan(844);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await toolbar.getByRole('button',{name:'Pause cooking from toolbar',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot?.running)).toBe(false);
  await page.screenshot({path:'artifacts/sticky-cooking-controls-mobile.png'});
  await toolbar.getByRole('button',{name:'Continue cooking from toolbar',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__brainSnapshot?.running)).toBe(true);
  // Explicit reset remains paused; automatic start applies only to initialization.
  await page.locator('.model-settings > summary').click();
  await controls.getByRole('button',{name:'Reset',exact:true}).click();
  await expect(page.getByTestId('neural-time')).toHaveText('0.00 s');
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.__brainSnapshot?.running)).toBe(false);

  // A stale completion flag cannot hide the modal after browser cache eviction.
  await page.evaluate(async()=>{
    const cache=await caches.open('malecns-verified-data-v1');
    const keys=await cache.keys();
    await cache.delete(keys.find(key=>key.url.includes('offsets-000'))!);
  });
  const beforePartialReload=requests.length;
  await page.reload();
  await expect(page.getByRole('dialog',{name:'Wake up, Palovbek.'})).toBeVisible();
  expect(requests.slice(beforePartialReload).some(url=>url.includes('/browser-brain/data/'))).toBe(false);
});

test('model loader fits mobile, reports failures, retries, and cancels a background download',async({page})=>{
  let requests=0;
  const pending:Route[]=[];
  await page.route('**/browser-brain/data/manifest.json',route=>{
    requests++;
    if(requests===1)return route.fulfill({status:404,body:'Simulated unavailable model'});
    pending.push(route);
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const initialize=page.getByRole('button',{name:'Initialize brain · 79 MB',exact:true});
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  expect(requests).toBe(0);
  await page.screenshot({path:'artifacts/model-loader-mobile.png'});
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await initialize.click();
  await page.keyboard.press('Escape');
  await expect(initialize).toBeFocused();
  await initialize.click();
  await page.getByRole('button',{name:'Load weights · 79 MB',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('HTTP 404');
  await page.getByRole('button',{name:'Retry loading weights',exact:true}).click();
  await expect.poll(()=>requests).toBe(2);
  await page.getByRole('button',{name:'Continue loading in background',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button',{name:'View loading progress',exact:true}).first().click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button',{name:'Cancel download',exact:true}).click();
  await expect(page.getByRole('button',{name:'Load weights · 79 MB',exact:true})).toBeVisible();
  await expect(dialog.getByRole('progressbar')).toHaveCount(0);
  await Promise.all(pending.map(route=>route.abort().catch(()=>{})));
  expect(requests).toBe(2);
});

test('mobile lab fits and a fresh visit starts paused without downloading weights',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.getByRole('dialog',{name:'Wake up, Palovbek.'})).toBeVisible();
  await page.getByRole('button',{name:'Explore the kitchen first',exact:true}).click();
  await expect(page.getByRole('button',{name:'Initialize brain · 79 MB',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const scene=await page.locator('.kitchen-card').boundingBox(),dashboard=await page.getByRole('region',{name:'Brain activity dashboard'}).boundingBox();
  expect(dashboard!.y).toBeGreaterThan(scene!.y+scene!.height);
  await page.screenshot({path:'artifacts/browser-lab-mobile.png',fullPage:true});
});

test('blocked browser cache still opens the initial loader',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'caches',{get(){throw new DOMException('Storage is blocked','SecurityError');}}));
  await page.goto('/');
  await expect(page.getByRole('dialog',{name:'Wake up, Palovbek.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Load weights · 79 MB',exact:true})).toBeEnabled();
});

test('minimal layout uses readable type and keeps technical panels optional',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Explore the kitchen first',exact:true}).click();
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    await expect(page.locator('.neuron-details')).toHaveJSProperty('open',false);
    await expect(page.locator('.model-settings')).toHaveJSProperty('open',false);
    await expect(page.getByRole('button',{name:'Qazan cam',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const tiny=await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(el=>el.checkVisibility()&&!el.closest('.sr-only,svg')&&[...el.childNodes].some(node=>node.nodeType===Node.TEXT_NODE&&node.textContent!.trim())&&parseFloat(getComputedStyle(el).fontSize)<14).map(el=>({text:el.textContent?.trim().slice(0,40),size:getComputedStyle(el).fontSize})));
    expect(tiny).toEqual([]);
  }
  await page.locator('.neuron-details > summary').click();
  await expect(page.getByRole('region',{name:'Measured spike raster'})).toBeVisible();
  await page.locator('.model-settings > summary').click();
  await expect(page.getByLabel('Episode seed',{exact:true})).toBeVisible();
});
