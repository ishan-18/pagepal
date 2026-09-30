import { expect, test, type Page } from '@playwright/test';

const pal = (page: Page) => page.locator('pagepal-mascot');
const expectMood = (page: Page, mood: string) => expect(pal(page)).toHaveAttribute('data-mood', mood);
const frustrations = (page: Page) => page.evaluate(() => (window as unknown as { frustrations: string[] }).frustrations);

test('dead clicks: a button that does nothing, a clickable card, but not a working button', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await page.click('#works');
  await page.waitForTimeout(1300);
  expect(await frustrations(page)).toEqual([]);

  await page.click('#dead');
  await expectMood(page, 'confused');
  await page.click('#card');
  await expect.poll(() => frustrations(page)).toEqual(['dead-click', 'dead-click']);
});

test('steps aside for a chat widget in its corner', async ({ page }) => {
  await page.goto('/e2e/fixture.html?chat');
  const chat = (await page.locator('#chat').boundingBox())!;
  await expect.poll(async () => (await pal(page).boundingBox())!.y + 72).toBeLessThanOrEqual(chat.y);
});

test('keyboard users can reach and use the dismiss button', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  const close = page.getByRole('button', { name: 'Hide mascot' });
  await expect(close).toHaveCount(1);
  // Tab from the last page control lands on it (it is last in the document).
  await page.locator('#works').focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await expect(close).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(pal(page)).toBeHidden();
});

test('progress ring during a large upload', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await page.evaluate(() => {
    (window as unknown as { sawProgress: boolean }).sawProgress = false;
    const host = document.querySelector('pagepal-mascot')!;
    new MutationObserver(() => {
      if (host.hasAttribute('data-progress')) (window as unknown as { sawProgress: boolean }).sawProgress = true;
    }).observe(host, { attributes: true });
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.send(new Blob([new Uint8Array(8_000_000)]));
  });
  await expectMood(page, 'waiting');
  await expect.poll(() => page.evaluate(() => (window as unknown as { sawProgress: boolean }).sawProgress)).toBe(true);
  await expectMood(page, 'neutral'); // after the 2s response
  await expect(pal(page)).not.toHaveAttribute('data-progress');
});

test('analytics: events reach the endpoint, including abandonment on leave', async ({ page, request }) => {
  await page.goto('/e2e/fixture.html');
  for (let i = 0; i < 5; i++) await page.click('#dead', { delay: 10 });
  await page.getByPlaceholder('email').fill('not-an-email');
  await page.getByRole('button', { name: 'Sign up' }).click(); // typeMismatch
  await page.evaluate(() => fetch('/api/fail').then(() => undefined)); // wait for the 500
  // Other tests post to the same collector in parallel; keep only this page view's events.
  const view = await page.evaluate(() => (window as unknown as { ux: { events(): { view: string }[] } }).ux.events()[0]!.view);
  const mine = async () =>
    ((await (await request.get('/collect')).json()).events as { type: string; view: string; url?: string }[]).filter((e) => e.view === view);
  await page.goto('about:blank'); // pagehide: abandon + summary via sendBeacon

  await expect
    .poll(async () => (await mine()).map((e) => e.type))
    .toEqual(expect.arrayContaining(['page_view', 'rage_click', 'form_error', 'request_error', 'form_abandon', 'page_summary']));

  const events = await mine();
  const byType = (type: string) => events.find((e: { type: string }) => e.type === type);
  expect(byType('rage_click')).toMatchObject({ element: 'button#dead "Broken button"', page: '/e2e/fixture.html' });
  expect(byType('form_error')).toMatchObject({ form: 'form#signup', field: 'input[name="email"]', validity: 'typeMismatch' });
  expect(byType('request_error')).toMatchObject({ method: 'GET', url: '/api/fail', status: 500 });
  expect(byType('form_abandon')).toMatchObject({ form: 'form#signup' });
  // The pal's own delivery never showed up as a watched request.
  expect(events.some((e: { url?: string }) => e.url === '/collect')).toBe(false);
  // Dead clicks during the rage burst are not double counted.
  expect(events.filter((e: { type: string }) => e.type === 'dead_click')).toHaveLength(0);
});

test('<page-pal> web component in plain HTML', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await page.evaluate(() => {
    document.querySelector('pagepal-mascot')!.remove();
    document.body.insertAdjacentHTML(
      'beforeend',
      '<page-pal character="ghost" position="top-left" watch="#signup" storage-key="wc" idle="false"></page-pal>',
    );
  });
  const ghost = page.locator('page-pal pagepal-mascot, pagepal-mascot[data-character="ghost"]').first();
  await expect(ghost).toHaveAttribute('data-character', 'ghost');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(ghost).toHaveAttribute('data-mood', 'wince');
});

test('debug panel shows live signals', async ({ page }) => {
  await page.goto('/e2e/fixture.html');
  await page.evaluate(() => {
    const w = window as unknown as { pal: { use(p: unknown): void; signal(k: string, m: string): void }; PagePal: { debugPanel(): unknown } };
    w.pal.use(w.PagePal.debugPanel());
    w.pal.signal('upload', 'waiting');
  });
  await expect(page.locator('pagepal-debug table')).toContainText('user:upload');
  await expect(page.locator('pagepal-debug .mood')).toHaveText('waiting');
});
