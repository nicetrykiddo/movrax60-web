import { expect, test } from '@playwright/test';

test('the narrow homepage and member routes work without JavaScript', async ({
  browser,
}) => {
  const page = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 780 },
  });
  await page.goto('/');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(
    page.getByRole('heading', { name: /^movrax ?60$/ }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await expect(page.locator('#pin')).toHaveJSProperty('naturalWidth', 960);

  await page.getByRole('link', { name: 'Our results' }).click();
  await expect(page).toHaveURL(/#results$/);
  await expect(
    page.getByRole('heading', { name: /Cyber Apocalypse/ }),
  ).toBeInViewport();
  await expect(
    page.getByRole('link', { name: 'Player-reported result' }),
  ).toBeVisible();
  await expect(page.locator('.result-scene')).toHaveCount(4);
  await expect(
    page
      .getByRole('region', { name: /Nullcon Goa HackIM/ })
      .getByRole('link', { name: 'View scoreboard' }),
  ).toHaveAttribute('href', 'https://ctftime.org/event/3066');

  const contact = page.getByRole('region', { name: 'Get in touch.' });
  await expect(contact.getByText('Coming soon')).toHaveCount(3);
  for (const channel of ['Telegram', 'Discord', 'Email']) {
    await expect(contact.getByText(channel, { exact: true })).toBeVisible();
    await expect(contact.getByRole('link', { name: channel })).toHaveCount(0);
  }

  await page.getByRole('link', { name: 'Meet the team' }).click();
  await expect(page).toHaveURL(/\/members\/$/);
  await expect(
    page.getByRole('heading', { name: 'The roster.' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await expect(page.locator('.player')).toHaveCount(8);
  await page
    .getByRole('navigation', { name: 'Player index' })
    .getByRole('link', { name: 'clay_cs' })
    .click();
  await expect(page).toHaveURL(/\/members\/#player-clay_cs$/);
  const player = page.locator('#player-clay_cs');
  await expect(
    player.getByRole('heading', { name: 'clay_cs' }),
  ).toBeInViewport();
  await expect(
    player.getByText('Web challenges.', { exact: false }),
  ).toBeVisible();

  await page.goto('/');
  const response = await page.goto('/members/#player-m3ghar');
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'm3ghar' })).toBeInViewport();
  await page.close();
});

test('the homepage pin turns on request, responds to dragging, and follows scroll', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const pin = page.locator('#pin');
  const frame = async () => Number(await pin.getAttribute('data-frame'));
  await expect(pin).toHaveAttribute('src', /\/pin\/000\.webp$/);
  await page.getByRole('button', { name: 'Turn the mascot pin' }).click();
  await expect.poll(frame).toBe(60);
  await expect(pin).toHaveJSProperty('naturalWidth', 960);

  const dragArea = await page.locator('.pin-hit').boundingBox();
  expect(dragArea).not.toBeNull();
  const beforeDrag = await frame();
  const x = dragArea!.x + dragArea!.width * 0.6;
  const y = dragArea!.y + dragArea!.height * 0.4;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - Math.min(100, dragArea!.width * 0.4), y, {
    steps: 12,
  });
  await expect.poll(frame).toBeLessThan(beforeDrag - 20);
  await page.mouse.up();

  const pinPosition = async () =>
    page
      .locator('.runway')
      .evaluate((el) => el.style.getPropertyValue('--pin-x'));
  const beforeScroll = await pinPosition();
  await page.mouse.wheel(0, 620);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(400);
  await expect.poll(pinPosition).not.toBe(beforeScroll);
  await expect.poll(pinPosition).not.toBe('');
  await page.getByRole('link', { name: 'Explore the roster' }).click();
  await expect(page).toHaveURL(/\/members\/$/);
  await expect(
    page.getByRole('heading', { name: 'The roster.' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('the results and player backdrops play their own rendered shots', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const frames = new Set<string>();
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (response.ok() && path.startsWith('/scenes/')) frames.add(path);
  });
  await page.goto('/#results');
  const spotlight = page.locator('#results .scene-art');
  await expect(spotlight).toHaveAttribute('data-frame', /^\d+$/);
  const beforeScroll = await spotlight.getAttribute('data-frame');
  await page.evaluate(() => window.scrollBy({ top: 230, behavior: 'instant' }));
  await expect(spotlight).not.toHaveAttribute('data-frame', beforeScroll!);
  await expect
    .poll(() =>
      [...frames].some((path) =>
        /^\/scenes\/salt\/tall\/(?!016\.webp)\d+\.webp$/.test(path),
      ),
    )
    .toBe(true);

  await page.goto('/members/#player-clay_cs');
  const player = page.locator('#player-clay_cs');
  await expect(
    player.getByRole('heading', { name: 'clay_cs' }),
  ).toBeInViewport();
  await expect(player.locator('.scene-art')).toHaveAttribute(
    'data-frame',
    /^\d+$/,
  );
  await expect
    .poll(() =>
      [...frames].some((path) =>
        /^\/scenes\/player-clay_cs\/tall\/(?!005\.webp)\d+\.webp$/.test(path),
      ),
    )
    .toBe(true);
});

test('reduced motion uses a still until requested and sound starts only on request', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  const assets = new Set<string>();
  const audio: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/^\/(?:pin|scenes)\/.*\.webp$/.test(url.pathname))
      assets.add(url.pathname);
    if (url.pathname.endsWith('.mp3')) audio.push(url.pathname);
  });
  await page.goto('/');
  const pin = page.locator('#pin');
  await expect(pin).toHaveJSProperty('naturalWidth', 960);
  expect([...assets].filter((path) => path.startsWith('/pin/'))).toEqual([
    '/pin/000.webp',
  ]);
  expect(audio).toEqual([]);

  await page.getByRole('button', { name: 'Sound off' }).click();
  await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => audio).toContain('/audio/ambient.mp3');
  await page.getByRole('button', { name: 'Sound on' }).click();
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await page.getByRole('button', { name: 'Turn the mascot pin' }).click();
  await expect(pin).toHaveAttribute('data-frame', '60');
  await page.getByRole('link', { name: 'Scroll to explore' }).click();
  await expect(page).toHaveURL(/#team$/);
  await expect(
    page.getByRole('heading', { name: /Behind the handles/ }),
  ).toBeInViewport();
  await expect(pin).toHaveAttribute('data-frame', '60');
  await expect(page.locator('.scene-art[data-frame]')).toHaveCount(0);
  expect(
    [...assets]
      .filter((path) => path.startsWith('/scenes/'))
      .every((path) => /\/016\.webp$/.test(path)),
  ).toBe(true);
  expect(assets.has('/pin/orbit.webp')).toBe(false);
});
