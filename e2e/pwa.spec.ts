import { expect, test } from "@playwright/test";

async function expectOfflineCachedAsset(page: import("@playwright/test").Page, assetPath: string) {
  const response = await page.evaluate(async (path) => {
    const assetResponse = await fetch(path, { cache: "reload" });
    const body = await assetResponse.arrayBuffer();

    return {
      ok: assetResponse.ok,
      status: assetResponse.status,
      bodyLength: body.byteLength,
      controlled: Boolean(navigator.serviceWorker.controller)
    };
  }, assetPath);

  expect(response).toMatchObject({ ok: true, status: 200, controlled: true });
  expect(response.bodyLength).toBeGreaterThan(0);
}

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

  await expectOfflineCachedAsset(page, "/mascot/idle.gif");
  await expectOfflineCachedAsset(page, "/mascot/idle.png");

  await page.reload();
  await expect(page.getByRole("heading", { name: /早上好/ })).toBeVisible();
});
