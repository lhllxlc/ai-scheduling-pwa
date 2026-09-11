import { test, expect } from "@playwright/test";
import { DateTime } from "luxon";

test("manual review, calendar, edit, preferences and logout on mobile and desktop", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Enter local demo" }).click();
  await expect(
    page.getByRole("heading", { name: "A day that works for you." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add a plan", exact: true }).click();
  await page.getByLabel("Plan title").fill("Library focus session");
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("fixed");
  await page.getByLabel("Duration (minutes)").fill("90");
  const day = DateTime.now().setZone("Australia/Melbourne").toISODate();
  await page.getByLabel("Start · Melbourne").fill(`${day}T10:00`);
  await page.getByLabel("End · Melbourne").fill(`${day}T11:30`);
  await page.getByRole("button", { name: "Review plan", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByLabel("Plan title")).toHaveValue(
    "Library focus session",
  );
  expect(
    (await (await page.request.get("/api/tasks")).json()).data,
  ).toHaveLength(0);
  await page.getByLabel("Plan title").fill("Library focus session reviewed");
  await page.getByRole("button", { name: "Confirm & save" }).click();
  await expect(page).toHaveURL(/\/$/);
  const card = page
    .locator("article.task-card")
    .filter({ hasText: "Library focus session reviewed" })
    .first();
  await expect(card).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("today.png"),
    fullPage: true,
  });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Plan title").fill("Library focus session updated");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(
    page
      .getByRole("button")
      .filter({ hasText: "Library focus session updated" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await page
    .locator("article.task-card")
    .filter({ hasText: "Library focus session updated" })
    .first()
    .getByRole("button", { name: "Complete", exact: true })
    .click();
  await expect(
    page
      .locator("article.task-card")
      .filter({ hasText: "Library focus session updated" })
      .first(),
  ).toContainText("Completed");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Daily task limit (min)").fill("180");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved.");
  await page.reload();
  await expect(page.getByLabel("Daily task limit (min)")).toHaveValue("180");
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("zh");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(
    page.getByRole("heading", { name: "你的节奏，你来定义。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enter local demo" }),
  ).toBeVisible();
  expect((await page.request.get("/api/tasks")).status()).toBe(401);
  expect(pageErrors).toEqual([]);
});

test("manifest, private offline shell and API failure state", async ({
  page,
}) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe("standalone");
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "UNAVAILABLE",
          message: "Service temporarily unavailable",
        },
      }),
    }),
  );
  await page.goto("/");
  await expect(page.locator(".alert.error")).toContainText(
    "Service temporarily unavailable",
  );
  await page.goto("/offline.html");
  await expect(page.locator("body")).toContainText(/offline|离线/i);
});
