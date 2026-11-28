import { expect, test, type Locator, type Page } from '@playwright/test';
import records from '../records.json' with { type: 'json' };

const hero = (page: Page) => page.getByRole('heading', { name: 'movrax60', exact: true });
const resultHashes = ['#results', '#nullcon', '#ritsec', '#script', '#chronos'];
const resultTitles = [records.spotlight.title, ...records.featured.map(({ title }) => title)];
const ready = (page: Page) => page.locator('.loom[data-ready]');
const memberHash = (handle: string) => `#player-${handle.toLowerCase()}`;
const allSources = [records.spotlight.source, ...records.featured.map(({ event }) => event)];

async function swipe(page: Page, target: Locator, dx: number, dy = 0) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('Gesture target is outside the page');
  const viewport = page.viewportSize()!;
  const left = Math.max(box.x, 0);
  const right = Math.min(box.x + box.width, viewport.width);
  const x = left + (right - left) * (dx < 0 ? 0.8 : 0.2);
  const y = Math.max(20, Math.min(box.y + box.height / 2, viewport.height - 40));
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: x + dx * step / 12, y: y + dy * step / 12 }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

test.describe('Small-screen HTML fallback', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 740 } });

  test('the home page exposes all result sources, roster and contact without scripts', async ({ page }) => {
    await page.goto('/');
    await expect(hero(page)).toBeInViewport();
    await expect(hero(page)).toHaveCSS('user-select', 'none');
    await expect(page.locator('img,picture,video')).toHaveCount(0);
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
    await page.getByRole('link', { name: /explore results/i }).click();
    await expect(page).toHaveURL(/#results$/);
    for (const source of [...allSources, records.spotlight.report]) {
      const link = page.locator(`a[href="${source}"]:visible`).first();
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport();
    }
    const positions: number[] = [];
    for (const title of resultTitles) {
      const heading = page.getByRole('heading', { name: title, exact: true });
      positions.push(await heading.evaluate(el => el.getBoundingClientRect().top + scrollY));
    }
    expect(positions.slice(1).every((top, index) => top > positions[index])).toBe(true);
    await expect(page.locator('#contact').getByRole('link', { name: /CTFtime/i })).toHaveAttribute('href', records.source);
    for (const { label } of records.contacts) await expect(page.locator('#contact').getByText(label, { exact: true })).toBeVisible();
    await page.locator('main a[href="/members/"]:visible').first().click();
    await expect(page).toHaveURL(/\/members\/$/);
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
    await page.goto('/members/#player-clay_cs');
    await expect(page.locator('#player-clay_cs')).toBeInViewport();
    await expect(page.locator(`a[href="${records.members[3].profile}"]:visible`).first()).toBeVisible();
  });
});

test('all eight direct member links resolve to the right handle and public profile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const { handle, profile } of records.members) {
    const hash = memberHash(handle);
    await page.goto('/members/' + hash);
    const member = page.locator(hash);
    await expect(member).toBeInViewport();
    await expect(member).toContainText(handle);
    const active = page.getByRole('navigation', { name: 'Choose a member' }).locator('a[aria-current]');
    await expect(active).toHaveAttribute('href', hash);
    await expect(member.locator(`a[href="${profile}"]`)).toBeVisible();
  }
});

test('sound is requested only after activation and can be muted again', async ({ page }) => {
  const audio: string[] = [];
  page.on('request', req => { if (/\.mp3(?:$|\?)/.test(req.url())) audio.push(req.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/members/');
  const off = page.getByRole('button', { name: /sound off/i });
  await expect(off).toBeVisible();
  expect(audio).toEqual([]);
  await off.press('Enter');
  const on = page.getByRole('button', { name: /sound on/i });
  await expect(on).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => audio.length).toBeGreaterThan(0);
  await on.press('Space');
  await expect(off).toHaveAttribute('aria-pressed', 'false');
});

test('missing WebGL preserves working section navigation and both routes', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...args: unknown[]) {
      if (id.includes('webgl')) return null;
      return Reflect.apply(getContext, this, [id, ...args]);
    } as typeof getContext;
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(hero(page)).toBeInViewport();
  await page.getByRole('link', { name: /explore results/i }).click();
  await expect(page.getByRole('heading', { name: resultTitles[0], exact: true })).toBeInViewport();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Members' }).click();
  await page.getByRole('link', { name: /meet the team/i }).click();
  await expect(page).toHaveURL(/\/members\/$/);
  await expect(page.locator('main h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the Blender scene loads and the fold responds to keyboard and drag', async ({ page }) => {
  const media: string[] = [];
  const errors: string[] = [];
  page.on('request', req => {
    if (/\.(?:png|jpe?g|webp|gif|avif|mp4|webm)(?:\?|$)/i.test(req.url())) media.push(req.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.loom[data-ready]')).toBeVisible({ timeout: 20000 });
  const lift = page.getByRole('button', { name: 'Lift the hem', exact: true });
  await lift.press('Enter');
  const lower = page.getByRole('button', { name: /lower the (fold|hem)/i });
  await expect(lower).toHaveAttribute('aria-pressed', 'true');
  await lower.press('Space');
  await expect(lift).toHaveAttribute('aria-pressed', 'false');
  const target = page.locator('.grab');
  const bounds = (await target.boundingBox())!;
  const x = bounds.x + bounds.width * 0.25;
  const y = bounds.y + bounds.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + Math.min(260, bounds.width * 0.65), y - 10, { steps: 12 });
  await page.mouse.up();
  await expect(lift).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('link', { name: /explore results/i }).click();
  await expect(page.getByRole('heading', { name: resultTitles[0], exact: true })).toBeInViewport();
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.getByRole('link', { name: /back to top|return to the flag/i }).click();
  await expect(hero(page)).toBeInViewport();
  expect(media).toEqual([]);
  expect(errors).toEqual([]);
});

test('five scroll stops display the corresponding result and source in both directions', async ({ page }) => {
  await page.goto('/');
  await expect(ready(page)).toBeVisible({ timeout: 20000 });
  const canvas = await ready(page).locator('canvas').elementHandle();
  const cues = [...resultHashes, ...resultHashes.slice(0, -1).reverse()];
  for (const hash of cues) {
    const index = resultHashes.indexOf(hash);
    await page.locator(hash).evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'start' }));
    const result = page.locator(hash);
    await expect(result.getByRole('heading', { name: resultTitles[index], exact: true })).toBeInViewport();
    await expect(result.locator(`a[href="${allSources[index]}"]`)).toBeInViewport();
    if (index === 0) {
      await expect(result).toContainText(`#${records.spotlight.place} overall`);
      await expect(result).toContainText(`${records.spotlight.solved} / ${records.spotlight.challenges}`);
    } else {
      const event = records.events.find(e => e.source === allSources[index])!;
      await expect(result).toContainText(`${event.points.toLocaleString('en-GB')} points`);
      if (records.featured[index - 1].metric === 'place') await expect(result).toContainText(`#${event.place}`);
    }
    await expect(page.getByRole('navigation', { name: 'Choose a competition' }).locator('a[aria-current]')).toHaveAttribute('href', hash);
    if (index === 0) {
      await expect(page.locator(`a[href="${records.spotlight.report}"]`).first()).toBeInViewport();
    }
  }
  expect(await canvas!.evaluate(el => el === document.querySelector('.loom canvas'))).toBe(true);
});

test('competition arrows and direct fragments land on each event', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#results');
  const next = page.getByRole('button', { name: 'Next competition', exact: true });
  const previous = page.getByRole('button', { name: 'Previous competition', exact: true });
  await expect(previous).toBeDisabled();
  for (const [i, title] of resultTitles.entries()) {
    if (i) await next.click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeInViewport();
    await expect(page.locator(`a[href="${allSources[i]}"]`).first()).toBeInViewport();
  }
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(page.getByRole('heading', { name: 'scriptCTF', exact: true })).toBeInViewport();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('heading', { name: 'RITSEC CTF', exact: true })).toBeInViewport();
  for (const [i, hash] of resultHashes.entries()) {
    await page.goto('/' + hash);
    await expect(page.getByRole('heading', { name: resultTitles[i], exact: true })).toBeInViewport();
  }
});

test.describe('Touch layout', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('menu traps keyboard focus, restores it, and navigates to the roster', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    await menu.tap();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(menu).toBeFocused();
    await menu.tap();
    await dialog.getByRole('link', { name: /members/i }).tap();
    await expect(page).toHaveURL(/#team$/);
    await expect(dialog).toBeHidden();
    await page.getByRole('link', { name: /meet the team/i }).tap();
    await expect(page).toHaveURL(/\/members\/$/);
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
  });

  test('touch can scroll past the cloth and select another result', async ({ page }) => {
    await page.goto('/');
    const cloth = page.locator('.grab');
    await expect(page.locator('.loom[data-ready]')).toBeVisible({ timeout: 20000 });
    const before = await page.evaluate(() => scrollY);
    await swipe(page, cloth, -8, -180);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 30);
    await page.getByRole('link', { name: /explore results/i }).click();
    await page.getByRole('button', { name: 'Next competition', exact: true }).tap();
    await expect(page.getByRole('heading', { name: /Nullcon Goa/ })).toBeInViewport();
    await swipe(page, cloth, -130);
    await expect(page.getByRole('heading', { name: 'RITSEC CTF' })).toBeInViewport();
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
  });
});

test('member jump links survive Back and the roster can be browsed with the keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#team');
  const directoryLink = page.getByRole('link', { name: /meet the team/i });
  await expect(ready(page)).toBeVisible({ timeout: 20000 });
  const canvas = await ready(page).locator('canvas').elementHandle();
  await directoryLink.click();
  await expect(page).toHaveURL(/\/members\/$/);
  const menu = page.getByRole('navigation', { name: 'Choose a member' });
  const clay = menu.getByRole('link', { name: /clay_cs/ });
  await clay.click();
  await expect(page).toHaveURL(/\/members\/#player-clay_cs$/);
  await expect(clay).toHaveAttribute('aria-current', 'location');
  expect(await canvas!.evaluate(el => el === document.querySelector('.loom canvas'))).toBe(true);
  await clay.press('ArrowDown');
  const next = menu.getByRole('link', { name: /nicetrykiddo/ });
  await expect(next).toBeFocused();
  await expect(next).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('#player-nicetrykiddo')).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/#player-clay_cs$/);
  await expect(clay).toHaveAttribute('aria-current', 'location');
  await page.goBack();
  await expect(page).toHaveURL(/\/members\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/#team$/);
  await expect(directoryLink).toBeInViewport();
});

test('a failed model download leaves working navigation and no dead cloth controls', async ({ page }) => {
  await page.route('**/models/*.glb', route => route.abort('failed'));
  await page.goto('/');
  await expect(hero(page)).toBeInViewport();
  await expect(page.locator('.grab')).toBeHidden();
  await expect(page.getByRole('button', { name: /pick up the fold|lift the hem/i })).toBeHidden();
  await page.getByRole('link', { name: /explore results/i }).click();
  await page.getByRole('button', { name: 'Next competition', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Nullcon Goa/ })).toBeInViewport();
});

test('the missing-page route returns HTTP 404 and a working way home', async ({ page }) => {
  const response = await page.goto('/nonexistent-path/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /page missing/i })).toBeVisible();
  await page.getByRole('link', { name: /return to movrax60/i }).click();
  await expect(hero(page)).toBeInViewport();
});
