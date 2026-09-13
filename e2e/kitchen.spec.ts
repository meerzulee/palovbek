import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Keep English regression selectors independent of the machine's country.
test.beforeEach(async ({page}) => {
  await page.route('**/api/locale', route => route.fulfill({contentType:'application/json',body:'{"locale":"en"}'}));
});

test('tool grips stay attached, cooking feet stay planted, and the director yields to dragging', async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Explore the kitchen first',exact:true}).click();
  await page.locator('.app-settings > summary').click();
  await page.getByRole('button',{name:'Scripted cooking demo',exact:true}).click();
  for (const [button, action] of [['Chop carrots', 'chopping'], ['Stir the qazan', 'stirring']] as const) {
    await page.getByRole('button',{name:button,exact:true}).click();
    const kitchen=page.locator('.canvas-host'), brain=page.locator('.brain-canvas');
    await expect(kitchen).toHaveAttribute('data-chef-action',action);
    await expect(brain).toHaveAttribute('data-chef-action',action);
    await expect(kitchen).toHaveAttribute('data-locomotion','planted');
    await expect(kitchen).toHaveAttribute('data-support-legs','4');
    const positions=new Set<string>(), toolPositions=new Set<string>();
    // Sample a whole gesture cycle, including the furthest reaches of each tool.
    for (let i=0;i<35;i++) {
      await page.waitForTimeout(100);
      const data=await kitchen.evaluate(el=>({...((el as HTMLElement).dataset)}));
      positions.add(data.flyPosition!);toolPositions.add(data.toolPosition!);
      expect(Number(data.gripError)).toBeLessThan(.01);
    }
    expect(positions.size).toBe(1);
    expect(toolPositions.size).toBeGreaterThan(15);
    const clocks=await page.evaluate(()=>['.canvas-host','.brain-canvas'].map(selector=>Number((document.querySelector(selector) as HTMLElement).dataset.animationTime)));
    expect(Math.abs(clocks[0]-clocks[1])).toBeLessThan(.12);
  }
  const follow=page.getByRole('button',{name:'Follow Palovbek',exact:true});
  await follow.click();
  await expect(page.locator('.canvas-host')).toHaveAttribute('data-camera-mode','director');
  await page.waitForTimeout(1700);
  const cameraBefore=await page.locator('.canvas-host').getAttribute('data-camera-position');
  await page.waitForTimeout(700);
  expect(await page.locator('.canvas-host').getAttribute('data-camera-position')).not.toBe(cameraBefore);
  const canvas=await page.locator('.canvas-host canvas').boundingBox();
  await page.mouse.move(canvas!.x+canvas!.width*.5,canvas!.y+canvas!.height*.55);
  await page.mouse.down();await page.mouse.move(canvas!.x+canvas!.width*.6,canvas!.y+canvas!.height*.58,{steps:8});await page.mouse.up();
  await expect(follow).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.canvas-host')).not.toHaveAttribute('data-camera-mode','director');
});

test('3D chef moves, ingredients, pause, and a complete plov', async ({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button',{name:'Explore the kitchen first',exact:true}).click();
  await page.locator('.app-settings > summary').click();
  await page.getByRole('button',{name:'Scripted cooking demo',exact:true}).click();
  await expect(page.locator('.canvas-host canvas')).toBeVisible();
  await expect(page.locator('.canvas-host')).toHaveAttribute('data-chef-action','idle');
  await page.evaluate(()=>document.fonts.ready);
  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Chop carrots',exact:true}).click();
  await expect(page.locator('.canvas-host')).toHaveAttribute('data-chef-action','chopping');
  await expect(page.getByRole('button',{name:'Prep cam',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.waitForTimeout(1400);
  const firstTime=Number(await page.locator('.canvas-host').getAttribute('data-animation-time'));
  await page.waitForTimeout(300);
  expect(Number(await page.locator('.canvas-host').getAttribute('data-animation-time'))).toBeGreaterThan(firstTime);
  await page.screenshot({path:'artifacts/chopping.png',fullPage:true});
  await page.getByRole('button',{name:'Stir the qazan',exact:true}).click();
  await expect(page.locator('.canvas-host')).toHaveAttribute('data-chef-action','stirring');
  await page.waitForTimeout(1400);
  await page.screenshot({path:'artifacts/stirring.png',fullPage:true});
  await page.getByRole('button',{name:'Add 500 g carrot',exact:true}).click();
  await expect(page.getByRole('button',{name:'Carrot, added',exact:true})).toBeDisabled();
  await expect(page.locator('.small-meta')).toHaveText('1 / 7 IN THE QAZAN');
  await page.getByRole('button',{name:'4×',exact:true}).click();
  await page.getByRole('slider',{name:'Fire intensity'}).focus();
  await page.keyboard.press('End');
  await page.getByRole('button',{name:/Let’s make plov/}).click();
  await expect(page.getByRole('button',{name:/Pause cooking/})).toBeVisible();
  await expect(page.locator('.progress-label')).toContainText('Build the zirvak',{timeout:15000});
  await page.getByRole('button',{name:/Pause cooking/}).click();
  await expect(page.locator('.brain-canvas')).toHaveAttribute('data-active','false');
  // Both independently rendered canvases must paint the committed pause before sampling.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const progress=await page.getByRole('progressbar').getAttribute('aria-valuenow');
  const pausedTime=await page.locator('.canvas-host').getAttribute('data-animation-time');
  const pausedBrainTime=await page.locator('.brain-canvas').getAttribute('data-animation-time');
  await page.waitForTimeout(800);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow',progress!);
  await expect(page.locator('.canvas-host')).toHaveAttribute('data-animation-time',pausedTime!);
  await expect(page.locator('.brain-canvas')).toHaveAttribute('data-animation-time',pausedBrainTime!);
  await page.getByRole('button',{name:/Keep cooking/}).click();
  await expect(page.getByRole('button',{name:/Cook another plov/})).toBeVisible({timeout:35000});
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');
  await expect(page.locator('.small-meta')).toHaveText('7 / 7 IN THE QAZAN');
  await page.getByRole('button',{name:'Qazan cam',exact:true}).click();
  await page.evaluate(()=>scrollTo(0,0));
  await page.waitForTimeout(1000);
  await page.screenshot({path:'artifacts/plov-ready.png',fullPage:true});
  await page.getByRole('button',{name:'Reset cooking',exact:true}).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
  await expect(page.locator('.small-meta')).toHaveText('0 / 7 IN THE QAZAN');
  expect(errors).toEqual([]);
});

test('recipe dialogs, sound, expanded view, and mobile layout',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Explore the kitchen first',exact:true}).click();
  await page.locator('.app-settings > summary').click();
  await page.getByRole('button',{name:'Scripted cooking demo',exact:true}).click();
  await expect(page.locator('.brain-canvas canvas')).toBeVisible();
  await expect(page.locator('.brain-disclosure')).toContainText('neural model not connected');
  await page.getByRole('button',{name:'Expand brain view',exact:true}).click();
  await expect(page.locator('.brain-card')).toHaveClass(/brain-expanded/);
  await page.waitForTimeout(500);
  await page.screenshot({path:'artifacts/brain.png',fullPage:true});
  await page.keyboard.press('Escape');
  await expect(page.locator('.brain-card')).not.toHaveClass(/brain-expanded/);
  await page.getByRole('button',{name:'Tandyr cam',exact:true}).click();
  await page.waitForTimeout(1100);
  await page.screenshot({path:'artifacts/tandyr.png',fullPage:true});
  await page.getByRole('button',{name:'The yard',exact:true}).click();
  await page.getByRole('button',{name:'The experiment',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'About the Palovbek experiment'})).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('does not run a biological neural simulation');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'The recipe',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Uzbek plov recipe'})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Enable fire sounds',exact:true}).click();
  await expect(page.getByRole('button',{name:'Mute fire sounds',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Mute fire sounds',exact:true}).click();
  await page.getByRole('button',{name:'Expand kitchen',exact:true}).click();
  await expect(page.locator('.kitchen-card')).toHaveClass(/is-expanded/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.kitchen-card')).not.toHaveClass(/is-expanded/);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>scrollTo(0,0));
  await expect(page.locator('.canvas-host canvas')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const kitchenBottom=await page.locator('.kitchen-card').evaluate(el=>el.getBoundingClientRect().bottom);
  const controlsTop=await page.locator('.controls-card').evaluate(el=>el.getBoundingClientRect().top);
  expect(controlsTop-kitchenBottom).toBeLessThan(30);
  await page.locator('.brain-card').scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.evaluate(()=>scrollTo(0,0));
  await page.waitForTimeout(700);
  await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Chop carrots',exact:true}).click();
  await expect(page.locator('.canvas-host')).toHaveAttribute('data-chef-action','chopping');
  await page.waitForTimeout(900);
  await page.screenshot({path:'artifacts/mobile-chopping.png',fullPage:true});
});
