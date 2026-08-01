import { expect, test } from "@playwright/test";

test("exposes an installable manifest", async ({ page }) => {
  await page.goto("/");
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const manifest = await page.evaluate(
    async (href) => fetch(href!).then((response) => response.json()),
    manifestHref
  );
  expect(manifest).toMatchObject({ name: "有常", display: "standalone" });
});

test("opens after the network is disabled", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /早上好/ })).toBeVisible();
});
