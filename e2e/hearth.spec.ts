import { test, expect } from '@playwright/test';

test('waiting fly rubs its forelegs, pause freezes the pose, and fire follows the heat', async ({ page }) => {
  const errors: string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/locale',route=>route.fulfill({contentType:'application/json',body:'{"locale":"en"}'}));
  await page.goto('/');
  await page.getByRole('button',{name:'Explore the kitchen first'}).click();
  await page.locator('.app-settings > summary').click();
  await page.getByRole('button',{name:'Scripted cooking demo',exact:true}).click();
  const scene=page.locator('.canvas-host');
  const fireTime=await scene.getAttribute('data-fire-animation-time');
  await expect(scene).not.toHaveAttribute('data-fire-animation-time',fireTime!);
  await page.getByRole('button',{name:/Let’s make plov/}).click();
  await expect(scene).toHaveAttribute('data-grooming','true',{timeout:15000});
  await expect(scene).toHaveAttribute('data-support-legs','4');
  await expect(scene).toHaveAttribute('data-locomotion','planted');
  const tips=new Set<string>(),positions=new Set<string>();
  for(let i=0;i<6;i++){
    await page.waitForTimeout(100);
    tips.add((await scene.getAttribute('data-foreleg-tips'))!);
    positions.add((await scene.getAttribute('data-fly-position'))!);
  }
  expect(tips.size).toBeGreaterThan(3);expect(positions.size).toBe(1);
  await page.getByRole('button',{name:'Pause cooking',exact:false}).click();
  await page.getByRole('button',{name:'Qazan cam',exact:true}).click();
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(1200);
  const pausedTips=await scene.getAttribute('data-foreleg-tips');
  await page.waitForTimeout(300);await expect(scene).toHaveAttribute('data-foreleg-tips',pausedTips!);
  await page.locator('.kitchen-card').screenshot({path:'artifacts/palovbek-grooming-fire.png'});
  const heat=page.getByRole('slider',{name:'Fire intensity'});
  await heat.focus();await page.keyboard.press('Home');
  await expect(scene).toHaveAttribute('data-fire-flames','0');
  await expect(scene).toHaveAttribute('data-fire-intensity','0.000');
  await page.keyboard.press('End');
  await expect.poll(async()=>Number(await scene.getAttribute('data-fire-intensity'))).toBeGreaterThan(4);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(scene).toHaveAttribute('data-fire-animation-time','0.000');
  await expect(scene).toHaveAttribute('data-grooming','false');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByRole('button',{name:'Chop carrots',exact:true}).click();
  await expect(scene).toHaveAttribute('data-grooming','false');
  await expect(scene).toHaveAttribute('data-support-legs','4');
  expect(errors).toEqual([]);
});
