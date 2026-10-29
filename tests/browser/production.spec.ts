import { test, expect } from "@playwright/test";

test("public page waits honestly and fits desktop and mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Lyssna på svenska" })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Ingen sändning");
    await expect(page.locator("html")).toHaveAttribute("lang", "sv");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/public-${name}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("admin login, setup state, session cookie and logout", async ({ page, context }) => {
  await page.goto("/admin");
  await page.getByLabel("Lösenord", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Fel lösenord. Försök igen.");
  await page.screenshot({ path: "test-results/admin-login-error.png", fullPage: true });
  await page.getByLabel("Lösenord", { exact: true }).fill("playwright-admin-password");
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Anslutningar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Förbered sändning" })).toBeDisabled();
  const cookie = (await context.cookies()).find((item) => item.name === "lt_admin");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.secure).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  expect(await page.evaluate(() => document.cookie)).not.toContain("lt_admin");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/admin-setup-mobile.png", fullPage: true });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Anslutningar" })).toBeVisible();
  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(page.getByLabel("Lösenord", { exact: true })).toBeVisible();
  expect((await context.cookies()).some((item) => item.name === "lt_admin")).toBe(false);
});

test("public callers cannot perform admin actions or choose an organizer identity", async ({ request, page }) => {
  for (const [method, path, data] of [
    ["POST", "/api/sessions", { title: "unauthorized" }],
    ["DELETE", "/api/sessions/fake", undefined],
    ["PATCH", "/api/sessions/fake", { broadcasting: true }],
    ["POST", "/api/translate", { sessionId: "fake", targetLanguage: "sv" }],
    ["POST", "/api/token", { role: "organizer", sessionId: "fake", identity: "organizer-host" }],
    ["GET", "/api/admin/status", undefined],
    ["GET", "/api/sessions", undefined],
  ] as const) {
    const response = await request.fetch(path, { method, data, headers: { origin: "http://localhost:3100" } });
    expect(response.status(), `${method} ${path}`).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  const oldTokenUrl = await request.get("/api/token?role=organizer&room=fake&identity=organizer-host&password=anything");
  expect(oldTokenUrl.status()).toBe(405);
  await page.goto("/session/fake/broadcast");
  await expect(page).toHaveURL(/\/admin$/);
});

test("logged-in admin mutations reject foreign origins and do not leak configuration", async ({ request }) => {
  const login = await request.post("/api/auth/login", { data: { password: "playwright-admin-password" }, headers: { origin: "http://localhost:3100" } });
  expect(login.ok()).toBe(true);
  const blocked = await request.delete("/api/sessions/fake", { headers: { origin: "https://attacker.example" } });
  expect(blocked.status()).toBe(403);
  const publicStatus = await request.get("/api/live");
  const text = await publicStatus.text();
  expect(text).not.toContain("playwright");
  expect(text).not.toContain("configuration");
  const health = await request.get("/api/health");
  expect(await health.json()).toEqual({ status: "ok" });
  expect(health.headers()["x-content-type-options"]).toBe("nosniff");
  expect(health.headers()["x-powered-by"]).toBeUndefined();
});

test("join errors recover and old session links lead back to the public page", async ({ page }) => {
  await page.route("**/api/live", (route) => route.fulfill({ json: { state: "live", sessionId: "lt-test", title: "Testsändning", targetLanguage: "sv" } }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Lyssna på svenska" })).toBeEnabled();
  await page.screenshot({ path: "test-results/public-live-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Lyssna på svenska" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("inte redo");
  await expect(page.getByRole("button", { name: "Anslut igen" })).toBeEnabled();
  await page.goto("/session/old/watch");
  await expect(page.getByRole("link", { name: "Till aktuell sändning" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lyssna på svenska" })).toBeDisabled();
});
