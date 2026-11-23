import { expect, test } from '@playwright/test';

test('the team and its featured result can be read without JavaScript', async ({
  browser,
}) => {
  const page = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 780 },
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'movrax60' })).toBeVisible();
  await expect(page.locator('.result-line strong')).toHaveText('#10');
  await expect(
    page.getByRole('link', { name: 'Official result' }),
  ).toHaveAttribute('href', /ctftime.org\/event\//);
  await page.getByRole('link', { name: 'Meet the team' }).click();
  await expect(page.locator('.roster')).toBeInViewport();
  await expect(page.locator('.roster li')).toHaveCount(8);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await page.close();
});

test('the full timeline reaches registration and runs backwards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const frame = page.locator('canvas');
  await expect(frame).toHaveAttribute('data-frame', '0');
  await page.evaluate(() => {
    const end = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: Math.round((end * 16.5) / 127), behavior: 'instant' });
  });
  await expect(frame).toHaveAttribute('data-frame', '16.5');
  await page.mouse.wheel(0, 670);
  await expect
    .poll(async () => Number(await frame.getAttribute('data-frame')))
    .toBeGreaterThan(40);
  await page.getByRole('link', { name: 'Result', exact: true }).click();
  await page.mouse.wheel(0, 700);
  await expect(frame).toHaveAttribute('data-frame', '127');
  await page.getByRole('link', { name: 'Replay' }).click();
  await expect(frame).toHaveAttribute('data-frame', '0');
  expect(errors).toEqual([]);
});

test('portrait uses its own camera and audio starts only on request', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const audio: string[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith('transport.mp3')) audio.push(req.url());
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('width', '768');
  await expect(page.locator('canvas')).toHaveAttribute('data-frame', '0');
  expect(audio).toEqual([]);
  await page.getByRole('button', { name: 'Sound off' }).click();
  await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => audio.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Sound on' }).click();
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('reduced motion keeps direct navigation and loads chapter stills only', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const frames: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/film/')) frames.push(req.url());
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Meet the team' }).click();
  await expect(page).toHaveURL(/#team$/);
  await expect(page.locator('.roster')).toBeInViewport();
  expect(frames.length).toBeGreaterThan(0);
  expect(
    frames.every((url) => /\/(000|062|127)\.webp$/.test(url)),
  ).toBeTruthy();
  await expect(page.locator('html')).not.toHaveClass(/film-ready/);
});
