import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

test("every page renders without errors", async ({ page }) => {
  const errors = trackErrors(page);
  for (const [path, heading] of [
    ["/", "Overview"],
    ["/providers", "Providers"],
    ["/routing", "Routing"],
    ["/playground", "Playground"],
    ["/integrations", "Integrations"],
    ["/settings", "Settings"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("provider drawer opens from search and closes with Escape", async ({ page }) => {
  await page.goto("/providers");
  await page.getByLabel("Search providers").fill("openrouter");
  await page.getByRole("button", { name: /OpenRouter/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add key" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("command palette navigates", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Search pages/).fill("routing");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/routing$/);
});

test("settings shows a dirty bar and can discard", async ({ page }) => {
  await page.goto("/settings/runtime");
  const field = page.getByLabel("Provider Rate Limit");
  await field.fill("7");
  await expect(page.getByText("1 unsaved change")).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByText("1 unsaved change")).toBeHidden();
});
