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

async function expectMascotImageDecoded(mascot: Locator) {
  await expect.poll(() => mascot.locator("img").evaluate((image: HTMLImageElement) =>
    image.complete && image.naturalWidth > 0
  )).toBe(true);
}

async function expectMascotInsideViewport(page: Page) {
  const mascot = page.getByRole("button", { name: "和小猫互动" });
  await expect(mascot).toBeVisible();
  await expectMascotImageDecoded(mascot);

  const isInsideViewport = await mascot.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.width > 0
      && bounds.height > 0
      && bounds.top >= 0
      && bounds.left >= 0
      && bounds.right <= window.innerWidth
      && bounds.bottom <= window.innerHeight;
  });
  expect(isInsideViewport).toBe(true);

  return mascot;
}

test("keeps the mascot visible and responds to interaction and completion", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  const mascot = await expectMascotInsideViewport(page);
  await mascot.click();
  await expect(mascot).toHaveAttribute("data-mascot-state", "idle");
  await expect(mascot).toHaveAttribute("data-mascot-idle-variant", "20");
  await expect(mascot.locator("img")).toHaveAttribute("src", "/mascot/idle/20.gif");
  await mascot.click();
  await expect(mascot).toHaveAttribute("data-mascot-idle-variant", "02");
  await expect(mascot.locator("img")).toHaveAttribute("src", "/mascot/idle/02.gif");
  await expectMascotImageDecoded(mascot);

  await page.getByRole("button", { name: "添加任务" }).click();
  await page.getByLabel("任务名称").fill("小猫庆祝任务");
  await page.getByRole("button", { name: "保存任务" }).click();

  const task = page.getByRole("checkbox", { name: "完成：小猫庆祝任务" });
  await expect(task).toBeVisible();
  await task.check();
  await expect(mascot).toHaveAttribute("data-mascot-state", "celebrate");
  await expectMascotImageDecoded(mascot);
});

test("loads the extracted background music and remembers its volume", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  const audio = page.getByTestId("background-music-audio");
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) =>
    element.readyState >= 1 && Number.isFinite(element.duration) && element.duration > 0
  )).toBe(true);

  const volume = page.getByLabel("音量");
  await expect(volume).toHaveValue("35");
  await volume.fill("64");
  await expect(page.getByText("64%", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "播放音乐" }).click();
  await expect(page.getByRole("button", { name: "暂停音乐" })).toBeVisible();
  await page.getByRole("button", { name: "暂停音乐" }).click();
  await expect(page.getByRole("button", { name: "播放音乐" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("音量")).toHaveValue("64");
});

test("customizes and remembers the focus timer", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  if ((page.viewportSize()?.width ?? 0) >= 480) {
    const collapsedFocusBounds = await page.getByRole("region", { name: "专注工具" }).boundingBox();
    const collapsedMedalBounds = await page.getByRole("region", { name: "我的勋章" }).boundingBox();
    expect(collapsedFocusBounds?.height).toBeGreaterThanOrEqual(78);
    expect(collapsedMedalBounds?.height).toBeGreaterThanOrEqual(78);
  }

  await page.getByRole("button", { name: /专注计时/ }).click();

  const focusBounds = await page.getByRole("region", { name: "专注工具" }).boundingBox();
  const medalBounds = await page.getByRole("region", { name: "我的勋章" }).boundingBox();
  expect(focusBounds).not.toBeNull();
  expect(medalBounds).not.toBeNull();
  expect(focusBounds!.y + focusBounds!.height <= medalBounds!.y || medalBounds!.y + medalBounds!.height <= focusBounds!.y).toBe(true);

  await page.getByRole("button", { name: "50 / 10" }).click();
  await expect(page.locator(".focus-timer")).toContainText("50:00");

  await page.getByText("自定义时长", { exact: true }).click();
  await page.getByLabel("专注分钟").fill("37");
  await page.getByLabel("休息分钟").fill("8");
  await page.getByRole("button", { name: "应用设置" }).click();
  await expect(page.locator(".focus-timer")).toContainText("37:00");
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(page.locator(".focus-timer")).toContainText("37:00");
  await page.getByRole("button", { name: "成长" }).click();
  await expect(page.getByText("等级 1", { exact: true })).toBeVisible();
  await expect(page.getByText("0 次", { exact: true })).toBeVisible();
});

test("plans a timed task and shows it in the weekly view", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "添加任务" }).click();
  await page.getByLabel("任务名称").fill("英语听力训练");
  await page.getByLabel("开始时间（选填）").fill("20:30");
  await page.getByLabel("预计用时（分钟，选填）").fill("40");
  await page.getByRole("button", { name: "保存任务" }).click();

  await expect(page.getByText(/20:30 · 预计 40 分钟/)).toBeVisible();
  await page.getByRole("button", { name: "计划" }).click();
  await expect(page.getByRole("heading", { name: "本周安排" })).toBeVisible();
  await expect(page.getByText("英语听力训练", { exact: true })).toBeVisible();
  await expect(page.getByText("20:30", { exact: true })).toBeVisible();
  await expect(page.getByText("40 分", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("acts on a due task directly from the reminder", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  const currentTime = await page.evaluate(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  await page.getByRole("button", { name: "添加任务" }).click();
  await page.getByLabel("任务名称").fill("提醒交互测试");
  await page.getByLabel("开始时间（选填）").fill(currentTime);
  await page.getByRole("combobox", { name: "任务提醒" }).selectOption("0");
  await page.getByRole("button", { name: "保存任务" }).click();

  const reminder = page.getByRole("alert", { name: "任务提醒" });
  await expect(reminder).toBeVisible();
  await expect(reminder.getByRole("button", { name: "完成" })).toBeVisible();
  await expect(reminder.getByRole("combobox", { name: "稍后提醒时间" })).toHaveValue("10");
  await expect(reminder.getByRole("button", { name: "稍后提醒" })).toBeVisible();
  await expect(reminder.getByRole("button", { name: "改到明天" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await reminder.getByRole("button", { name: "完成" }).click();
  await expect(reminder).not.toBeVisible();
  await expect(page.getByRole("checkbox", { name: "完成：提醒交互测试" })).toBeChecked();
});

test("reminds a scheduled task once at its planned time", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  const currentTime = await page.evaluate(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByLabel("任务名称").fill("准时开始复习");
  await page.getByLabel("开始时间（选填）").fill(currentTime);
  await page.getByLabel("任务提醒").selectOption("0");
  await page.getByRole("button", { name: "保存任务" }).click();

  const reminder = page.getByRole("alert", { name: "任务提醒" });
  await expect(reminder).toContainText("准时开始复习");
  await expect(page.getByText(/准时提醒/)).toBeVisible();
  await reminder.getByRole("button", { name: "关闭提醒" }).click();
  await expect(reminder).toBeHidden();

  await page.reload();
  await expect(page.getByRole("alert", { name: "任务提醒" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("retroactively completes a forgotten task on its original day", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 7, 11, 10, 0, 0));
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "添加任务" }).click();
  await page.getByLabel("任务名称").fill("忘记打勾的跑步");
  await page.getByRole("button", { name: "保存任务" }).click();
  await page.evaluate(() => {
    const raw = window.localStorage.getItem("youchang:state");
    if (!raw) throw new Error("missing app state");
    const state = JSON.parse(raw);
    const date = new Date();
    const daysSinceMonday = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - daysSinceMonday);
    const originalDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
    const task = state.scheduledTasks.find((item: { title: string }) => item.title === "忘记打勾的跑步");
    task.scheduledDate = originalDate;
    task.status = "backlog";
    delete task.completedAt;
    window.localStorage.setItem("youchang:state", JSON.stringify(state));
  });
  await page.reload();

  await page.getByRole("button", { name: "补记完成：忘记打勾的跑步" }).click();
  await expect(page.locator(".backlog-panel__notice")).toContainText("补记“忘记打勾的跑步”完成");

  await page.getByRole("button", { name: "计划" }).click();
  const plannedDay = page.locator(".week-day-strip button").filter({ hasText: "1 项" });
  await expect(plannedDay).toHaveCount(1);
  await plannedDay.click();
  await expect(page.getByText("忘记打勾的跑步", { exact: true })).toBeVisible();
  await expect(page.getByText("已完成", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "撤销完成：忘记打勾的跑步" }).click();
  await expect(page.getByText("待安排", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("records manual and stopwatch time into the allocation", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "添加任务" }).click();
  await page.getByLabel("任务名称").fill("论文阅读");
  await page.getByRole("button", { name: "保存任务" }).click();

  await page.getByRole("button", { name: "记录用时：论文阅读" }).click();
  await page.getByLabel("实际用时（分钟）").fill("45");
  await page.getByRole("button", { name: "保存用时" }).click();
  await expect(page.getByText(/实际 45 分钟/)).toBeVisible();

  await page.getByRole("button", { name: /专注计时/ }).click();
  await page.getByRole("button", { name: "正计时", exact: true }).click();
  await page.getByLabel("记录到").selectOption({ label: "今日安排 · 论文阅读" });
  await page.getByRole("button", { name: "开始计时" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "完成并记录" }).click();
  await expect(page.getByText(/实际 46 分钟/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "成长" }).click();
  await expect(page.getByLabel("分类时间饼图，共 46 分钟")).toBeVisible();
  await expect(page.getByLabel("学习 46 分钟，占 100%")).toBeVisible();
  await page.getByRole("button", { name: "近 7 天" }).click();
  await expectNoHorizontalOverflow(page);
});

test("unlocks a medal and pins it into one of three equal home slots", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "添加任务" }).click();
  await page.getByLabel("任务名称").fill("勋章测试任务");
  await page.getByRole("button", { name: "保存任务" }).click();
  await page.getByRole("checkbox", { name: "完成：勋章测试任务" }).check();

  await page.getByRole("button", { name: "管理" }).click();
  const firstMedal = page.locator(".achievement-card").filter({ hasText: "初见有常" });
  await expect(firstMedal).toHaveCount(1);
  await expect(firstMedal.getByRole("button", { name: "展示到首页" })).toBeEnabled();
  await firstMedal.getByRole("button", { name: "展示到首页" }).click();
  await expect(firstMedal).toContainText("首页展示");

  await page.getByRole("button", { name: "今日" }).click();
  await expect(page.getByLabel("初见有常，铜章")).toBeVisible();
  const slots = page.locator(".today-achievement-slot");
  await expect(slots).toHaveCount(3);
  const sizes = await slots.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: Math.round(bounds.width), height: Math.round(bounds.height) };
  }));
  expect(new Set(sizes.map((size) => `${size.width}x${size.height}`)).size).toBe(1);
  await expectNoHorizontalOverflow(page);
});

test("sets task priorities and recommends the high-priority task first", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  const tasks = [
    ["完成数学作业", /高 重要且紧急/],
    ["复习英语单词", /中 重要或紧急/],
    ["整理书桌", /低 日常且可灵活安排/]
  ] as const;

  for (const [title, priority] of tasks) {
    await page.getByRole("button", { name: "添加任务", exact: true }).click();
    await page.getByLabel("任务名称").fill(title);
    await page.getByRole("radio", { name: priority }).check();
    await page.getByRole("button", { name: "保存任务" }).click();
  }

  const highTask = page.getByRole("checkbox", { name: "完成：完成数学作业" }).locator("xpath=ancestor::li[1]");
  const lowTask = page.getByRole("checkbox", { name: "完成：整理书桌" }).locator("xpath=ancestor::li[1]");
  await expect(highTask).toContainText("高");
  await expect(lowTask).toContainText("低");
  await expect(page.getByRole("region", { name: "下一项任务" })).toContainText("完成数学作业");
  await expectNoHorizontalOverflow(page);
});

test("breaks a large task into steps and tracks its progress", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByLabel("任务名称").fill("完成论文");
  for (const [index, title] of ["查资料", "写正文", "修改"].entries()) {
    await page.getByRole("button", { name: /添加步骤/ }).click();
    await page.getByRole("textbox", { name: `步骤 ${index + 1}`, exact: true }).fill(title);
  }
  await page.getByRole("button", { name: "保存任务" }).click();

  await expect(page.getByLabel("完成论文步骤进度：0/3")).toBeVisible();
  await page.getByRole("button", { name: "展开步骤：完成论文" }).click();
  await page.getByRole("checkbox", { name: "完成步骤：完成论文 - 查资料" }).check();
  await page.getByRole("checkbox", { name: "完成步骤：完成论文 - 写正文" }).check();
  await expect(page.getByLabel("完成论文步骤进度：2/3")).toBeVisible();
  await expect(page.getByRole("button", { name: "收起步骤：完成论文" })).toContainText("步骤 2/3");
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(page.getByRole("button", { name: "展开步骤：完成论文" })).toContainText("步骤 2/3");
});

test("keeps edit available after a scheduled task is completed", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByLabel("任务名称").fill("考研高数");
  await page.getByRole("button", { name: "保存任务" }).click();
  await page.getByRole("checkbox", { name: "完成：考研高数" }).check();

  await page.getByRole("button", { name: "编辑：考研高数" }).click();
  await expect(page.getByLabel("完成日期")).toBeDisabled();
  await page.getByLabel("任务名称").fill("考研高数复盘");
  await page.getByRole("button", { name: "保存修改" }).click();

  await expect(page.getByRole("checkbox", { name: "完成：考研高数复盘" })).toBeChecked();
  await expect(page.getByRole("button", { name: "编辑：考研高数复盘" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

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
  await page.getByRole("radio", { name: "固定任务" }).check();
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
  await expect(page.getByRole("checkbox", { name: "完成：拉伸训练" })).toBeVisible();
  await expect(page.getByText("每日阅读", { exact: true })).toBeHidden();

  const exerciseCheckbox = page.getByRole("checkbox", { name: "完成：拉伸训练" });
  await exerciseCheckbox.check();
  await expect(exerciseCheckbox).toBeChecked();
  await exerciseCheckbox.focus();
  await expectVisibleFocusOutline(exerciseCheckbox.locator("xpath=following-sibling::span[1]"));
  await expectNoHorizontalOverflow(page);

  await page.reload();
  const firstTask = page.getByRole("checkbox", { name: "完成：每日阅读" });
  await expect(firstTask).toBeVisible();
  await firstTask.locator("xpath=ancestor::li[1]").scrollIntoViewIfNeeded();
  expect(await firstTask.evaluate((element) => {
    const bounds = element.closest("li")?.getBoundingClientRect();
    return Boolean(bounds && bounds.top >= 0 && bounds.bottom <= window.innerHeight);
  })).toBe(true);
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
