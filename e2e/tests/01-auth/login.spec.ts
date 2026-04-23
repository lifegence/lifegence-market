import { test, expect } from '@playwright/test';

test.describe('Market Data — Auth + landing (P0) @smoke', () => {
  test('authenticated session reaches /desk', async ({ page }) => {
    await page.goto('/desk');
    await expect(page).toHaveURL(/\/desk/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('Stock Master list loads', async ({ page }) => {
    await page.goto('/desk/stock-master');
    await expect(page).toHaveURL(/\/desk\/stock-master/);
  });

  test('Stock Price list loads', async ({ page }) => {
    await page.goto('/desk/stock-price');
    await expect(page).toHaveURL(/\/desk\/stock-price/);
  });
});
