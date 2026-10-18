import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders the local starter, switches templates and previews source", async ({ page }) => {
  await expect(page.locator("#file-count")).toHaveText("7 files");
  await expect(page.locator("#preview")).toContainText('SUMMARY = "A small hello');
  await page.locator('input[name="template"][value="cpp"]').check();
  await expect(page.locator("#preview")).toContainText("${CXX} ${CXXFLAGS}");
  await page.locator("#file-picker").selectOption({ label: "meta-myboard/recipes-apps/hello-pi/files/main.cpp" });
  await expect(page.locator("#preview")).toContainText("#include <iostream>");
  await page.locator('input[name="template"][value="data"]').check();
  await expect(page.locator("#preview")).toContainText("inherit allarch");
  await expect(page.locator("#preview")).toContainText("install -m 0644");
});

test("invalid input disables stale downloads and gives a linked field error", async ({ page }) => {
  await page.locator("#name").fill("../escape");
  await expect(page.locator("#name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#name-error")).toContainText("lowercase");
  await expect(page.locator("#download-all")).toBeDisabled();
  await expect(page.locator("#copy-file")).toBeDisabled();
  await expect(page.locator("#preview")).not.toContainText("SUMMARY");
  await page.getByRole("button", { name: "Reset example" }).click();
  await expect(page.locator("#download-all")).toBeEnabled();
});

test("Git scaffold requires a full revision and a license checksum", async ({ page }) => {
  await page.locator("#source").selectOption("git");
  await expect(page.locator("#git-fields")).toBeVisible();
  await expect(page.locator("#download-all")).toBeDisabled();
  await page.locator("#gitUrl").fill("https://github.com/example/fixture.git");
  await page.locator("#revision").fill("a".repeat(40));
  await page.locator("#licenseMd5").fill("b".repeat(32));
  await expect(page.locator("#download-all")).toBeEnabled();
  await expect(page.locator("#preview")).toContainText("protocol=https;branch=main");
  await expect(page.locator("#preview")).toContainText('S = "${WORKDIR}/git"');
  await page.locator("#gitUrl").fill("https://example.com/repo;protocol=file");
  await expect(page.locator("#download-all")).toBeDisabled();
  await page.locator("#gitUrl").fill("https://github.com/example/fixture.git");
  await page.locator("#license").selectOption("CLOSED");
  await expect(page.locator("#license-fields")).toBeHidden();
  await expect(page.locator("#preview")).not.toContainText("LIC_FILES_CHKSUM");
});

test("board selection updates generated config, guide and serial assumptions", async ({ page }) => {
  await page.locator("#board").selectOption("raspberrypi5");
  await expect(page.locator("#machine-label")).toHaveText("raspberrypi5");
  await page.locator("#file-picker").selectOption({ label: "local.conf.snippet" });
  await expect(page.locator("#preview")).toContainText('MACHINE = "raspberrypi5"');
  await page.getByRole("tab", { name: "Build your image" }).click();
  await expect(page.locator("#step-9")).toContainText("ttyAMA10");
  await page.locator("#step-1 input").check();
  await expect(page.locator("#progress-label")).toHaveText("1 of 10 checkpoints completed");
  await page.locator("#board").selectOption("raspberrypi4-64");
  await expect(page.locator("#step-9")).toContainText("ttyS0");
  await expect(page.locator("#progress-label")).toHaveText("0 of 10 checkpoints completed");
});

test("downloads a real archive and an individual recipe", async ({ page }) => {
  let pending = page.waitForEvent("download");
  await page.locator("#download-all").click();
  const bundle = await pending;
  expect(bundle.suggestedFilename()).toBe("hello-pi-starter.tar");
  const bytes = await readFile(await bundle.path());
  expect(bytes.length % 512).toBe(0);
  expect(bytes.toString("utf8", 257, 262)).toBe("ustar");
  expect(bytes.includes(Buffer.from('IMAGE_INSTALL:append = " hello-pi"'))).toBe(true);
  pending = page.waitForEvent("download");
  await page.locator("#download-file").click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe("hello-pi_1.0.bb");
  expect(await readFile(await file.path(), "utf8")).toContain('LICENSE = "MIT"');
});

test("tabs support keyboard navigation and the quiz gives actionable feedback", async ({ page }) => {
  await page.locator("#tab-builder").focus();
  await page.keyboard.press("End");
  await expect(page.locator("#tab-basics")).toBeFocused();
  await expect(page.locator("#panel-basics")).toBeVisible();
  await page.locator('input[name="answer"][value="image"]').check();
  await page.getByRole("button", { name: "Check my understanding" }).click();
  await expect(page.locator("#quiz-result")).toContainText("Exactly");
  await page.locator("#tab-basics").focus();
  await page.keyboard.press("Home");
  await expect(page.locator("#panel-builder")).toBeVisible();
});

test("renders user metadata as text and has no page errors or horizontal overflow", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.locator("#summary").fill("<img src=x onerror=alert(1)>");
  await expect(page.locator("#preview")).toContainText("<img src=x onerror=alert(1)>");
  await expect(page.locator("#preview img")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.getByRole("tab", { name: "Build your image" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.getByRole("tab", { name: "The basics" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  expect(errors).toEqual([]);
});
