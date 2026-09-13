import { test, expect, webkit } from '@playwright/test';
import { existsSync } from 'node:fs';

test.describe('browser brain capability checks',()=>{
test.beforeEach(async ({page})=>{
  await page.route('**/api/locale',route=>route.fulfill({contentType:'application/json',body:'{"locale":"en"}'}));
});

for(const failure of ['absent','adapter-null','device-rejected','limits','timeout'] as const) {
  test(`WebGPU ${failure}: auto-playing demo without a model download`,async({page})=>{
    const downloads:string[]=[];page.on('request',r=>{if(r.url().includes('/browser-brain/'))downloads.push(r.url());});
    await page.addInitScript(failure=>{
      const limits={maxBufferSize:268435456,maxStorageBufferBindingSize:134217728,maxStorageBuffersPerShaderStage:8,maxComputeInvocationsPerWorkgroup:256,maxComputeWorkgroupSizeX:256};
      if(failure==='limits')limits.maxStorageBufferBindingSize=1024;
      Object.defineProperty(navigator,'gpu',{configurable:true,value:failure==='absent'?undefined:{requestAdapter:()=>{
        if(failure==='timeout')return new Promise(()=>{});
        if(failure==='adapter-null')return Promise.resolve(null);
        return Promise.resolve({limits,requestDevice:async()=>{throw Error('Device unavailable');}});
      }}});
    },failure);
    await page.setViewportSize({width:440,height:956});
    await page.goto('/');
    await expect(page.locator('.demo-notice')).toContainText('Demo mode');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('.brain-disclosure')).toContainText('neural model not connected');
    const scene=page.locator('.canvas-host'),time=await scene.getAttribute('data-animation-time');
    await expect(scene).not.toHaveAttribute('data-animation-time',time!);
    await page.getByRole('button',{name:'Pause cooking from toolbar',exact:true}).click();
    await page.waitForTimeout(250);
    const paused=await scene.getAttribute('data-animation-time');
    await page.waitForTimeout(300);await expect(scene).toHaveAttribute('data-animation-time',paused!);
    await page.getByRole('button',{name:'Continue cooking from toolbar',exact:true}).click();
    await page.locator('.site-header').getByRole('button',{name:'Русский',exact:true}).click();
    await expect(page.locator('.demo-notice')).toContainText('Демо-режим');
    await expect(page.locator('.site-footer')).not.toContainText('Сделано с узбекской душой');
    expect(downloads).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('an incompatible worker GPU kernel falls back before downloading the graph',async({page})=>{
  const graph:string[]=[];page.on('request',r=>{if(r.url().includes('/browser-brain/data/'))graph.push(r.url());});
  await page.route('**/browser-brain/kernels/**',route=>route.fulfill({status:404,body:'Unsupported test kernel'}));
  await page.goto('/');
  await page.getByRole('button',{name:'Load weights · 79 MB',exact:true}).click();
  await expect(page.locator('.demo-notice')).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Pause cooking from toolbar',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(graph).toEqual([]);
});

test('blocked worker startup opens the demo',async({page})=>{
  await page.addInitScript(()=>{
    window.Worker=class extends Worker { constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.terminate();throw Error('Worker blocked');} };
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Load weights · 79 MB',exact:true}).click();
  await expect(page.locator('.demo-notice')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('choosing the demo cancels an in-progress model download',async({page})=>{
  await page.route('**/browser-brain/data/**',async route=>{
    await new Promise(resolve=>setTimeout(resolve,1000));
    await route.abort();
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Load weights · 79 MB',exact:true}).click();
  await page.getByRole('button',{name:'Watch cooking demo',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.brain-disclosure')).toContainText('neural model not connected');
  await page.waitForTimeout(1500);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const scene=page.locator('.canvas-host'),time=await scene.getAttribute('data-animation-time');
  await expect(scene).not.toHaveAttribute('data-animation-time',time!);
});

test('a supported browser still loads real spikes and reuses its cache',async({page})=>{
  test.setTimeout(120000);
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
  await page.goto('/');
  await page.getByRole('button',{name:'Load weights · 79 MB',exact:true}).click();
  await expect(page.getByTestId('active-neurons')).toHaveText(/[1-9]/,{timeout:90000});
  await expect(page.locator('.demo-notice')).toHaveCount(0);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const before=requests.length;
  await page.reload();
  await expect(page.getByTestId('active-neurons')).toHaveText(/[1-9]/,{timeout:90000});
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(requests.slice(before).some(url=>url.includes('/browser-brain/data/')&&url.includes('.dat'))).toBe(false);
});
});

test('WebKit touch layout has aligned icons, working demo controls, and no footer message',async()=>{
  test.skip(!existsSync(webkit.executablePath()),'Install the WebKit browser with npx playwright install webkit.');
  // Override the project's locally installed Chrome executable for this WebKit check.
  const browser=await webkit.launch({executablePath:webkit.executablePath(),timeout:15000});
  try {
    const page=await browser.newPage({viewport:{width:440,height:956},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{localStorage.setItem('plov-language-v1','ru');Object.defineProperty(navigator,'gpu',{value:undefined});});
    await page.goto(process.env.PLAYWRIGHT_BASE_URL??'http://localhost:5173',{waitUntil:'domcontentloaded',timeout:15000});
    await expect(page.locator('.demo-notice')).toContainText('Демо-режим');
    await page.waitForTimeout(1500);
    for(const width of [440,390,320]){
      await page.setViewportSize({width,height:956});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const controls=page.locator('.chef-moves button,.scene-tools button');
      const boxes=await controls.evaluateAll(nodes=>nodes.map(node=>{
        const b=node.getBoundingClientRect(),i=node.querySelector('svg')!.getBoundingClientRect();
        return {x:b.x,y:b.y,width:b.width,height:b.height,iconX:i.x+i.width/2,iconY:i.y+i.height/2};
      }));
      for(const b of boxes){expect(b.width).toBe(44);expect(b.height).toBe(44);expect(Math.abs(b.iconX-b.x-22)).toBeLessThan(1);expect(Math.abs(b.iconY-b.y-22)).toBeLessThan(1);}
      expect(new Set(boxes.map(b=>b.y)).size).toBe(1);
    }
    await page.setViewportSize({width:440,height:956});
    await page.waitForTimeout(1000);
    await page.getByRole('button',{name:'Приостановить готовку сверху',exact:true}).click();
    await expect(page.getByRole('button',{name:'Продолжить готовку сверху',exact:true})).toBeVisible();
    await page.screenshot({path:'artifacts/safari-demo-mobile.png'});
    expect(await page.locator('.site-footer').innerText()).not.toMatch(/узбекской душой|Ош бўлсин/);
    expect(errors).toEqual([]);
  }finally{await browser.close();}
});
