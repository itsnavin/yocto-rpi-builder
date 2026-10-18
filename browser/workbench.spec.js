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

test("Make, Autotools and CMake offer complete local projects and correct Git UI", async ({ page }) => {
  for (const template of ["make", "autotools", "cmake"]) {
    await page.locator(`input[name="template"][value="${template}"]`).check();
    const bb = page.locator("#preview");
    await expect(bb).toContainText('SRC_URI = "file://project/"');
    await expect(bb).toContainText(template === "make" ? "oe_runmake 'DESTDIR=${D}' install" : `inherit ${template}`);
    if (template !== "make") await expect(bb).not.toContainText("do_configure[noexec]");
    const file = { make: "Makefile", autotools: "Makefile.am", cmake: "CMakeLists.txt" }[template];
    await page.locator("#file-picker").selectOption({ label: `meta-myboard/recipes-apps/hello-pi/files/project/${file}` });
    await expect(bb).toContainText("hello-pi");
    const pending = page.waitForEvent("download");
    await page.locator("#download-all").click();
    const bytes = await readFile(await (await pending).path());
    expect(bytes.includes(Buffer.from(`project/${file}`))).toBe(true);
    await page.locator("#file-picker").selectOption("0");
  }
  await page.locator("#source").selectOption("git");
  await expect(page.locator("#source-file-field")).toBeHidden();
  await page.locator("#gitUrl").fill("https://github.com/example/project.git");
  await page.locator("#revision").fill("a".repeat(40));
  await page.locator("#licenseMd5").fill("b".repeat(32));
  await expect(page.locator("#download-all")).toBeEnabled();
  await expect(page.locator("#preview")).toContainText('S = "${WORKDIR}/git"');
  await page.locator('input[name="template"][value="c"]').check();
  await expect(page.locator("#source-file-field")).toBeVisible();
  await expect(page.locator("#sourceFile")).toHaveValue("main.c");
  await page.getByRole("tab", { name: "The basics" }).click();
  await expect(page.locator("#build-lessons")).toContainText("inherit autotools");
  await expect(page.locator("#build-lessons")).toContainText("inherit cmake");
  await expect(page.locator("#build-lessons")).toContainText("RDEPENDS:${PN}");
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

test("devshell instructions are copyable, recipe-specific and distinguish Make from class tasks", async ({ page }) => {
  await page.locator("#name").fill("my-demo");
  for (const template of ["make", "autotools", "cmake"]) {
    await page.locator(`input[name="template"][value="${template}"]`).check();
    await page.locator("#file-picker").selectOption({ label: "devshell-steps.txt" });
    await expect(page.locator("#preview")).toContainText("bitbake my-demo -c devshell");
    await expect(page.locator("#preview")).toContainText(`bitbake my-demo -C ${template === "make" ? "compile" : "configure"}`);
    const pending = page.waitForEvent("download");
    await page.locator("#download-file").click();
    const doc = await pending;
    expect(doc.suggestedFilename()).toBe("devshell-steps.txt");
    expect(await readFile(await doc.path(), "utf8")).toContain("pseudo/fakeroot");
  }
  await page.getByRole("tab", { name: "The basics" }).click();
  await expect(page.locator("#devshell-lessons article")).toHaveCount(3);
  await expect(page.locator("#devshell-section")).toContainText("not an executed Yocto devshell test");
  await expect(page.locator("#devshell-section")).toContainText("S/B/D/T");
  await expect(page.getByRole("button", { name: "Copy cmake devshell prepare commands", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
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
