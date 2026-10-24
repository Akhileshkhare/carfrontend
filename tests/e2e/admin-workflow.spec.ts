import { test, expect } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.skip(
  !email || !password,
  "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for an isolated test database.",
);

test("administrator signs in and creates a synthetic dealer record", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Dealers" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dealers", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: /add dealer/i }).click();
  const dialog = page.getByRole("dialog");
  const suffix = Date.now();
  await dialog.getByLabel(/dealer name/i).fill("Synthetic E2E Dealer");
  await dialog.getByLabel(/email address/i).fill(`e2e-${suffix}@example.test`);
  await dialog.getByLabel(/contact number/i).fill("+91 90000 00009");
  await dialog.getByRole("button", { name: "Create dealer" }).click();
  await expect(page.getByRole("status")).toContainText("Dealer created.");
});
