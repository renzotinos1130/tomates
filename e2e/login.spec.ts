import { expect, test } from "@playwright/test";

/** The rotation applied to the card by the pointer ("none" when it sits flat). */
const tilt = (page: import("@playwright/test").Page) =>
  page.locator("[data-slot=sign-in-card]").evaluate((el) => getComputedStyle(el).transform);

test.describe("Connexion", () => {
  test("la carte s'affiche et « Entrer dans l'espace » ouvre l'espace de travail", async ({ page }) => {
    await page.goto("/login");
    const card = page.locator("[data-slot=sign-in-card]");
    await expect(card).toBeVisible();
    await expect(card.getByRole("img", { name: "Team Tomate HQ" })).toBeVisible();
    // Sans backend configuré, la carte annonce le mode démo au lieu du formulaire.
    await expect(card.getByRole("heading", { name: "Mode démo" })).toBeVisible();

    await card.getByRole("link", { name: "Entrer dans l'espace" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /Dominic/ })).toBeVisible();
  });

  test("la carte s'incline sous la souris, et revient à plat quand elle s'éloigne", async ({ page }) => {
    await page.goto("/login");
    const card = page.locator("[data-slot=sign-in-card]");
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width - 12, box.y + 14, { steps: 8 });
    await expect.poll(() => tilt(page)).toContain("matrix3d");

    await page.mouse.move(8, 8, { steps: 4 });
    await expect.poll(() => tilt(page)).toBe("none");
  });

  test("avec « moins de mouvement », ni inclinaison ni lumières", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");
    const card = page.locator("[data-slot=sign-in-card]");
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;

    await page.mouse.move(box.x + box.width - 12, box.y + 14, { steps: 8 });
    await page.waitForTimeout(400);
    expect(await tilt(page)).toBe("none");
    // Le calque des lumières (dernier enfant de la carte) n'est pas rendu.
    await expect(card.locator("> div[aria-hidden]").last()).toBeHidden();
  });
});
