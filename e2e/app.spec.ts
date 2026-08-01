import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth === document.documentElement.clientWidth
  );
  expect(fitsViewport).toBe(true);
}

async function expectVisibleFocusOutline(locator: Locator) {
  const hasOutline = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
  });
  expect(hasOutline).toBe(true);
}

test("completes the core task, growth, and backup flow", async ({ page }, testInfo) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  const expectedViewport = testInfo.project.name === "mobile"
    ? { width: 390, height: 844 }
    : { width: 1280, height: 800 };
  expect(page.viewportSize()).toEqual(expectedViewport);

  await page.getByRole("button", { name: "添加任务" }).click();
  await page.getByLabel("任务名称").fill("每日阅读");
  await page.getByRole("radio", { name: "每日固定" }).check();
  await page.getByRole("radio", { name: "学习" }).check();
  await page.getByRole("button", { name: "保存任务" }).click();
  await expect(page.getByRole("checkbox", { name: "完成：每日阅读" })).toBeVisible();

  await page.getByRole("button", { name: "添加任务" }).click();
  await page.getByLabel("任务名称").fill("拉伸训练");
  await page.getByRole("radio", { name: "临时任务" }).check();
  const exerciseRadio = page.getByRole("radio", { name: "运动" });
  await exerciseRadio.check();
  await exerciseRadio.focus();
  await expectVisibleFocusOutline(exerciseRadio.locator(".."));
  await page.getByRole("button", { name: "保存任务" }).click();

  await page.getByRole("button", { name: "只看运动" }).click();
  await expect(page.getByText("拉伸训练", { exact: true })).toBeVisible();
  await expect(page.getByText("每日阅读", { exact: true })).toBeHidden();

  const exerciseCheckbox = page.getByRole("checkbox", { name: "完成：拉伸训练" });
  await exerciseCheckbox.check();
  await expect(exerciseCheckbox).toBeChecked();
  await exerciseCheckbox.focus();
  await expectVisibleFocusOutline(exerciseCheckbox.locator("xpath=following-sibling::span[1]"));
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "完成：每日阅读" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "完成：拉伸训练" })).toBeChecked();

  await page.getByRole("button", { name: "成长" }).click();
  await expect(page.getByRole("heading", { name: "成长" })).toBeVisible();
  await expect(page.getByText("累计完成 1 项", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("heading", { name: "设置", exact: true })).toBeVisible();
  const importInput = page.getByLabel("导入备份");
  await importInput.focus();
  await expectVisibleFocusOutline(page.locator('label[for="backup-file"]'));
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^有常备份-\d{4}-\d{2}-\d{2}\.json$/);
  expect(await download.failure()).toBeNull();
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});
