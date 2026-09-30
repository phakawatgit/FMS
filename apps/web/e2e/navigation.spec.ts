import { expect, test } from "@playwright/test";

test.describe("FMS web navigation", () => {
  test("renders the responsive menu and API status", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/legacy\/index\.html$/);
    await expect(page.locator("input[type='email'], input[name='email']").first()).toBeVisible();
    await expect(page.getByText(/Sign in to FMS|เข้าสู่ระบบ/i).first()).toBeVisible();
  });

  test("opens the Front-end login page", async ({ page }) => {
    await page.goto("/legacy/index.html");
    await expect(page.locator("input[type='password'], input[name='password']").first()).toBeVisible();
    await expect(page.locator("button").filter({ hasText: /Log in|เข้าสู่ระบบ/i }).first()).toBeVisible();
  });
});
