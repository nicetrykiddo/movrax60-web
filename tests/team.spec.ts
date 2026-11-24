import { expect, test } from '@playwright/test';

test('the text and links work without JavaScript or image backgrounds', async ({
  browser,
}) => {
  const page = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 740 },
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'movrax60' }),
  ).toBeInViewport();
  await expect(page.locator('html')).toHaveCSS('user-select', 'none');
  await expect(page.locator('img,video,picture')).toHaveCount(0);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await page.getByRole('link', { name: 'Our results' }).click();
  await expect(page).toHaveURL(/#results$/);
  await expect(
    page.getByRole('link', { name: 'Player-reported result' }),
  ).toBeVisible();
  await expect(page.locator('.result-scene')).toHaveCount(4);
  await page.goto('/members/#player-clay_cs');
  await expect(page.getByRole('heading', { name: 'clay_cs' })).toBeInViewport();
  await expect(page.locator('.player')).toHaveCount(8);
  await page.close();
});

test('mascot waves on direct input and can turn by drag and keyboard', async ({
  page,
}) => {
  await page.goto('/');
  const world = page.locator('.live-stage');
  await expect(world).toHaveAttribute('data-ready', '');
  const mascot = page.getByRole('button', { name: /Wave to the mascot. Drag/ });
  await mascot.click();
  await expect(world).toHaveAttribute('data-greeting', '1');
  await expect(page.getByRole('button', { name: 'Wave again' })).toBeVisible();
  const bounds = await mascot.boundingBox();
  const point = {
    x: bounds!.x + bounds!.width * 0.5,
    y: bounds!.y + bounds!.height * 0.5,
  };
  await page.mouse.move(point.x, point.y);
  const angle = Number(await world.getAttribute('data-angle'));
  await page.mouse.down();
  await page.mouse.move(point.x + 70, point.y, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await world.getAttribute('data-angle')))
    .toBeGreaterThan(angle + 0.3);
  await expect(world).toHaveAttribute('data-greeting', '1');
  const previous = Number(await world.getAttribute('data-angle'));
  await mascot.press('ArrowRight');
  await expect
    .poll(async () => Number(await world.getAttribute('data-angle')))
    .toBeGreaterThan(previous + 0.18);
});

test('the same live stage follows the scroll both ways without media requests', async ({
  page,
}) => {
  const formats: string[] = [];
  const problems: string[] = [];
  page.on('request', (request) => {
    if (/\.(?:png|jpe?g|webp|mp4|svg)(?:\?|$)/.test(request.url()))
      formats.push(request.url());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const world = page.locator('.live-stage');
  await expect(world).toHaveAttribute('data-cue', 'identity');
  await page.getByRole('link', { name: 'Our results' }).click();
  await expect(
    page.getByRole('heading', { name: /Cyber Apocalypse/ }),
  ).toBeInViewport();
  const nav = page.getByRole('navigation', { name: 'Competition highlights' });
  const option = nav.getByRole('link', { name: 'RITSEC CTF', exact: true });
  await option.hover();
  await expect(nav.locator('.result-preview span')).toHaveText('RITSEC CTF');
  await option.click();
  await expect(option).toHaveAttribute('aria-current', 'location');
  await expect(
    page.getByRole('heading', { name: /RITSEC CTF/ }),
  ).toBeInViewport();
  const display = page.getByRole('button', { name: 'Fan the display plates' });
  await expect(display).toBeInViewport();
  await display.click();
  await expect(display).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(world).toHaveAttribute('data-cue', 'identity');
  expect(formats).toEqual([]);
  expect(problems).toEqual([]);
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
});

test('reduced motion keeps a usable room and sound stays opt-in', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const audio: string[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith('.mp3')) audio.push(req.url());
  });
  await page.goto('/members/#player-clay_cs');
  await expect(page.getByRole('heading', { name: 'clay_cs' })).toBeInViewport();
  const index = page.getByRole('navigation', { name: 'Choose a player' });
  const member = index.getByRole('link', { name: 'clay_cs' });
  await expect(member).toHaveAttribute('aria-current', 'location');
  await member.focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    index.getByRole('link', { name: 'nicetrykiddo' }),
  ).toHaveAttribute('aria-current', 'location');
  expect(audio).toEqual([]);
  await page.getByRole('button', { name: 'Sound off' }).click();
  await expect.poll(() => audio.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
