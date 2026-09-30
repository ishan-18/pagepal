import { expect, test, type Page } from '@playwright/test';

const pal = (page: Page) => page.locator('pagepal-mascot');
const expectMood = (page: Page, mood: string) => expect(pal(page)).toHaveAttribute('data-mood', mood);

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await expectMood(page, 'neutral');
});

test('fast wheel scrolling makes it dizzy', async ({ page }) => {
  await page.mouse.move(400, 400);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(30);
  }
  await expectMood(page, 'dizzy');
});

test('native validation: wince and look at the field, then cheer when valid', async ({ page }) => {
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expectMood(page, 'wince');
  // The email field is up and to the left of the pal (bottom-right), so it tilts left.
  const tilt = await pal(page).evaluate((el) => parseFloat(el.style.getPropertyValue('--pp-tilt')));
  expect(tilt).toBeLessThan(0);

  await page.getByPlaceholder('email').fill('me@example.com');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expectMood(page, 'cheer');
});

test('covers its eyes on password fields, peeks when the password is shown', async ({ page }) => {
  const password = page.getByPlaceholder('password');
  await password.focus();
  await expectMood(page, 'shy');
  await password.evaluate((el: HTMLInputElement) => (el.type = 'text'));
  await expectMood(page, 'neutral');
  await password.evaluate((el: HTMLInputElement) => (el.type = 'password'));
  await expectMood(page, 'shy');
  await page.getByPlaceholder('email').focus();
  await expectMood(page, 'neutral');
});

test('rage clicks make it concerned and emit frustration', async ({ page }) => {
  await page.locator('#dead').click({ clickCount: 1 });
  for (let i = 0; i < 4; i++) await page.locator('#dead').click({ delay: 20 });
  await expectMood(page, 'concerned');
  expect(await page.evaluate(() => (window as unknown as { frustrations: string[] }).frustrations)).toContain(
    'rage-click',
  );
});

test('waits for slow fetch and XHR, winces on server errors', async ({ page }) => {
  await page.route('**/api/slow', async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({ body: 'ok' });
  });
  await page.route('**/api/broken', (route) => route.fulfill({ status: 500, body: 'no' }));

  await page.evaluate(() => void fetch('/api/slow'));
  await expectMood(page, 'waiting');
  await expectMood(page, 'neutral');

  await page.evaluate(() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/broken');
    xhr.send();
  });
  await expectMood(page, 'wince');
});

test('offline makes it sad, coming back makes it cheer', async ({ page, context }) => {
  await context.setOffline(true);
  await expectMood(page, 'sad');
  await context.setOffline(false);
  await expectMood(page, 'cheer');
});

test('dark mode makes it sleepy', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectMood(page, 'sleepy');
});

test('poke winks; drag moves it and the spot survives a reload', async ({ page }) => {
  const box = (await pal(page).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expectMood(page, 'wink');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(300, 200, { steps: 8 });
  await page.mouse.up();
  const moved = (await pal(page).boundingBox())!;
  expect(moved.x).toBeLessThan(box.x - 200);

  await page.reload();
  const restored = (await pal(page).boundingBox())!;
  expect(Math.round(restored.x)).toBe(Math.round(moved.x));
  expect(Math.round(restored.y)).toBe(Math.round(moved.y));
});

test('the close button dismisses it for good', async ({ page }) => {
  await pal(page).hover();
  await page.locator('pagepal-mascot .close').click();
  await expect(pal(page)).toBeHidden();
  await page.reload();
  await expect(pal(page)).toBeHidden();
  await page.evaluate(() => (window as unknown as { pal: { show(): void } }).pal.show());
  await expect(pal(page)).toBeVisible();
});

test('reduced motion: no animation, expression still changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => (window as unknown as { pal: { react(m: string, d: number): void } }).pal.react('cheer', 5000));
  await expectMood(page, 'cheer');
  const animation = await pal(page).evaluate(
    (el) => getComputedStyle(el.shadowRoot!.querySelector('.figure')!).animationName,
  );
  expect(animation).toBe('none');
});
