import { expect, test } from '@playwright/test';

test('publishes a single sourced highlight and the roster without scripts',async({browser})=>{
  const page=await browser.newPage({javaScriptEnabled:false,viewport:{width:320,height:780}});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'movrax60'})).toBeVisible();
  await expect(page.locator('.result-line strong')).toHaveText('#10');
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Official result'})).toHaveAttribute('href',/ctftime.org\/event\//);
  await page.locator('#team').scrollIntoViewIfNeeded();
  await expect(page.locator('.roster li')).toHaveCount(8);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth',320);
  await page.close();
});

test('scroll changes the rendered viewpoint and reversing returns to the first frame',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await page.goto('/');
  const frame = page.locator('.studio canvas');
  await expect(frame).toHaveAttribute('data-frame','0');
  await page.mouse.wheel(0,380);
  await expect.poll(async()=>Number(await frame.getAttribute('data-frame'))).toBeGreaterThan(5);
  await page.mouse.wheel(0,-800);
  await expect(frame).toHaveAttribute('data-frame','0');
});

test('reduced motion keeps the still and direct team anchor',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const frames:string[]=[];
  page.on('request',req=>{if(req.url().includes('/turn/'))frames.push(req.url());});
  await page.goto('/');
  await page.getByRole('link',{name:'Meet the team'}).click();
  await expect(page).toHaveURL(/#team$/);
  await expect(page.locator('.roster')).toBeInViewport();
  expect(frames).toEqual([]);
});
