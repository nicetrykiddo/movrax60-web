import { expect,test } from '@playwright/test';
test('the complete page is scrollable without JavaScript',async({browser})=>{
  const page=await browser.newPage({javaScriptEnabled:false,viewport:{width:320,height:780}});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'MOVRAX60'})).toBeVisible();
  await page.locator('#team').scrollIntoViewIfNeeded();
  await expect(page.locator('.roster li')).toHaveCount(8);
  await page.locator('#results').scrollIntoViewIfNeeded();
  await expect(page.locator('tbody tr:visible')).toHaveCount(32);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth',320);
  await page.close();
});
test('archive supports ranking and season filters',async({page})=>{
  await page.goto('/#results');
  await page.getByLabel('Order').selectOption('best');
  await expect(page.locator('tbody tr').first()).toContainText('Nullcon Goa');
  await page.getByLabel('Season').selectOption('2025');
  await expect(page.locator('tbody tr:visible')).toHaveCount(1);
});
