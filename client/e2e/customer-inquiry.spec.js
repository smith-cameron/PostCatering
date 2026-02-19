import { expect, test } from "@playwright/test";

const getFutureDateISO = (daysFromToday = 14) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
};

test("customer can complete and submit the inquiry flow", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /services/i }).click();
  await page.getByRole("button", { name: /send catering inquiry/i }).click();

  const inquiryModal = page.locator(".modal.show").filter({ hasText: "Send Catering Inquiry" }).first();
  await expect(inquiryModal).toBeVisible();

  await inquiryModal.locator('input[name="full_name"]').fill("E2E Customer");
  await inquiryModal.locator('input[name="email"]').fill("e2e.customer@example.com");
  await inquiryModal.locator('input[name="phone"]').fill("(619) 555-1234");
  await inquiryModal.locator('input[name="event_date"]').fill(getFutureDateISO());
  await inquiryModal.locator('input[name="guest_count"]').fill("80");

  const allSelects = inquiryModal.locator("select");
  const serviceSelect = inquiryModal.locator('select[name="service_interest"]');
  await expect.poll(async () => serviceSelect.locator("option").count()).toBeGreaterThan(1);
  if (await serviceSelect.locator('option[value="togo"]').count()) {
    await serviceSelect.selectOption("togo");
  } else {
    await serviceSelect.selectOption({ index: 1 });
  }

  if ((await allSelects.count()) > 1) {
    await allSelects.nth(1).selectOption({ index: 1 });
  }

  const desiredItems = inquiryModal.locator('input[type="checkbox"][id^="desired-item-"]');
  await expect.poll(async () => desiredItems.count()).toBeGreaterThan(0);
  await desiredItems.first().check();

  await inquiryModal.getByRole("button", { name: /submit inquiry/i }).click();
  await expect(page.getByText(/your inquiry was sent successfully/i)).toBeVisible();
});
