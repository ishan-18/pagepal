import { expect, test } from '@playwright/test';

// Visual regression for every mood of every character. Update baselines with `npm run e2e:update`.
for (const character of ['blob', 'cat', 'ghost']) {
  test(`${character} renders every mood`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto('/e2e/gallery.html');
    await expect(page.locator(`.row[data-character="${character}"]`)).toHaveScreenshot(`${character}.png`);
  });
}
