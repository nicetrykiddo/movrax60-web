import { expect, test } from '@playwright/test';

test('the content and deep links work at 320px without JavaScript', async ({
  browser,
}) => {
  const page = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 740 },
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole('heading', { name: /^movrax ?60$/ }),
  ).toBeInViewport();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await expect(page.locator('#identity img')).toHaveJSProperty(
    'naturalWidth',
    1080,
  );
  await page.getByRole('link', { name: 'Our results' }).click();
  await expect(page).toHaveURL(/#results$/);
  await expect(
    page.getByRole('link', { name: 'Player-reported result' }),
  ).toBeVisible();
  await expect(page.locator('.result-scene')).toHaveCount(4);
  await expect(page.locator('#contact').getByText('Coming soon')).toHaveCount(
    3,
  );
  await page.goto('/members/#player-clay_cs');
  await expect(page.getByRole('heading', { name: 'clay_cs' })).toBeInViewport();
  await expect(page.locator('.player')).toHaveCount(8);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await page.close();
});

test('the glass crossing scrubs in both directions and keeps copy anchored', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1877, height: 822 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const stage = page.locator('.relay-stage');
  await expect(stage).toHaveAttribute('data-frame', '0');
  await expect(stage.locator('video[data-active]')).toHaveJSProperty(
    'videoWidth',
    1920,
  );
  const title = page.locator('#hero-title');
  const titleTop = () =>
    title.evaluate((node) => node.getBoundingClientRect().top + scrollY);
  await title.evaluate(async (node) => {
    await Promise.allSettled(
      node.getAnimations().map((animation) => animation.finished),
    );
  });
  const start = await titleTop();
  const frame = async () => Number(await stage.getAttribute('data-frame'));
  await page.evaluate(() => window.scrollTo({ top: 470, behavior: 'instant' }));
  await expect.poll(frame).toBeGreaterThan(26);
  await expect(stage).toHaveAttribute('data-reel', 'entrance');
  expect(await titleTop()).toBeCloseTo(start, 0);
  await page
    .locator('#team')
    .evaluate((node) => node.scrollIntoView({ behavior: 'instant' }));
  await expect(stage).toHaveAttribute('data-reel', 'interior');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(stage).toHaveAttribute('data-frame', '0');
  expect(await titleTop()).toBeCloseTo(start, 0);
  expect(errors).toEqual([]);
});

test('mobile uses the portrait film for direct result and contact links', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#chronos');
  const stage = page.locator('.relay-stage');
  await expect(
    page.getByRole('heading', { name: /Chronos Security CTF/ }),
  ).toBeInViewport();
  await expect(stage).toHaveAttribute('data-view', 'tall');
  await expect(stage).toHaveAttribute('data-reel', 'contact');
  const active = stage.locator('video[data-active]');
  await expect(active).toHaveJSProperty('videoWidth', 1080);
  await expect(active).toHaveJSProperty('videoHeight', 1440);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
  await page.getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /Get in touch/ }),
  ).toBeInViewport();
  await expect
    .poll(async () => Number(await stage.getAttribute('data-frame')))
    .toBeGreaterThanOrEqual(360);
});

test('the nameplate rack follows scrolling and supports tap and keyboard focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/members/#player-clay_cs');
  const index = page.getByRole('navigation', { name: 'Choose a player' });
  await expect(index.getByRole('link', { name: 'clay_cs' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  await index.getByRole('link', { name: 'clay_cs' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('heading', { name: 'nicetrykiddo' }),
  ).toBeInViewport();
  await expect(
    index.getByRole('link', { name: 'nicetrykiddo' }),
  ).toHaveAttribute('aria-current', 'location');
  await index.getByRole('link', { name: 'm3ghar' }).click();
  await expect(page.getByRole('heading', { name: 'm3ghar' })).toBeInViewport();
  await expect(index.getByRole('link', { name: 'm3ghar' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  await expect(
    page.getByRole('link', { name: 'm3ghar profile' }),
  ).toHaveAttribute('aria-current', 'location');
});

test('reduced motion keeps the high-resolution stills and sound stays opt-in', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests: string[] = [];
  page.on('request', (req) => requests.push(new URL(req.url()).pathname));
  await page.goto('/');
  await expect(page.locator('.relay-stage')).toHaveCount(0);
  await expect(page.locator('#identity img')).toHaveJSProperty(
    'naturalHeight',
    1080,
  );
  expect(
    requests.some((path) => path.endsWith('.mp4') || path.endsWith('.mp3')),
  ).toBe(false);
  await page.getByRole('button', { name: 'Sound off' }).click();
  await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => requests).toContain('/audio/ambient.mp3');
  await page.getByRole('button', { name: 'Sound on' }).click();
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('a blocked film falls back to a current still and retains navigation', async ({
  page,
}) => {
  await page.route('**/relay/**/*.mp4', (route) => route.abort());
  await page.goto('/#ritsec');
  await expect(
    page.getByRole('heading', { name: /RITSEC CTF/ }),
  ).toBeInViewport();
  await expect(page.locator('#ritsec img')).toHaveJSProperty(
    'naturalWidth',
    1920,
  );
  await expect(page.locator('body')).not.toHaveClass(/relay-active/);
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'The roster.' }),
  ).toBeInViewport();
});

test('the room light changes the opening and competition previews can be selected', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.relay-stage')).toHaveAttribute('data-frame', '0');
  await page.getByRole('button', { name: 'Desk light', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Dim desk light' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () =>
      parseFloat(
        await page
          .locator('.desk-bounce')
          .evaluate((el) => getComputedStyle(el).opacity),
      ),
    )
    .toBeGreaterThan(0.8);
  await page.getByRole('link', { name: 'Our results' }).click();
  const dial = page.getByRole('navigation', { name: 'Competition highlights' });
  const result = dial.getByRole('link', { name: 'RITSEC CTF' });
  await result.hover();
  await expect(dial.locator('.result-preview span')).toHaveText('RITSEC CTF');
  await result.click();
  await expect(page).toHaveURL(/#ritsec$/);
  await expect(result).toHaveAttribute('aria-current', 'location');
});
