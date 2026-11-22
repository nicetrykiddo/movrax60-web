import { test, expect } from '@playwright/test';

test('range state survives navigation and selecting a result updates the stone', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const control = page.getByRole('slider');
  await control.focus();
  await page.keyboard.press('ArrowRight');
  await expect(control).toHaveValue('1');
  await page.getByRole('link', {name:'Results',exact:true}).click();
  await page.getByLabel('Season').selectOption('2025');
  await page.locator('summary').first().click();
  const name = await page.locator('details[open] .record-title').innerText();
  await page.getByRole('button', {name:'Reveal in quarry'}).click();
  await expect(page.locator('#engraving')).toHaveText(name);
  await expect(control).toHaveValue('1');
  await expect(page.locator('[data-quarry-plate]')).toHaveJSProperty('complete', true);
  expect(await page.locator('[data-quarry-plate]').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('mobile deep link and reduced-motion software renderer', async ({page}) => {
  await page.setViewportSize({width:360,height:780});
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type:string,...args:unknown[]) {
      return type.includes('webgl') ? null : Reflect.apply(get,this,[type,...args]);
    } as typeof get;
  });
  await page.goto('/#team');
  await expect(page.locator('.roster-item')).toHaveCount(8);
  await page.getByRole('link',{name:'Quarry', exact:true}).click();
  await expect(page.locator('canvas[data-renderer]')).toHaveAttribute('data-renderer','2d');
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth',360);
  await page.getByRole('button',{name:/Sound/}).click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');
});
