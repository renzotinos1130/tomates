import { expect, test } from "@playwright/test";

/**
 * Notifications push : ce que l'écran dit quand elles ne peuvent pas être activées ici. On ne laisse
 * personne devant un bouton qui ne ferait rien : l'écran dit pourquoi, et quoi faire.
 */
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test.describe("Notifications push — là où elles ne s'activent pas", () => {
  test("bloquées par le navigateur : l'écran dit où les autoriser, et n'offre pas de bouton", async ({ page }) => {
    // Le navigateur de test sans interface refuse d'office les notifications : c'est le cas d'une personne qui a dit non.
    await page.goto("/parametres?section=notifications");
    await expect(page.getByText("Les notifications sont bloquées pour Tomate HQ sur cet appareil.")).toBeVisible();
    await expect(page.getByText(/Réglages → Notifications → Tomate HQ/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Activer sur cet appareil" })).toHaveCount(0);
    // Les choix, eux, restent réglables : ils valent pour les autres appareils.
    await expect(page.getByRole("switch", { name: "Nouvelle tâche" })).toBeChecked();
  });

  test.describe("sur un iPhone, dans Safari", () => {
    test.use({ userAgent: IPHONE, viewport: { width: 390, height: 844 } });

    test("l'application n'est pas installée : l'écran explique comment l'installer d'abord", async ({ page }) => {
      // Safari sur iPhone n'offre le push qu'à l'application installée sur l'écran d'accueil.
      await page.addInitScript(() => {
        delete (window as unknown as { PushManager?: unknown }).PushManager;
      });
      await page.goto("/parametres?section=notifications");
      await expect(page.getByText("Sur iPhone et iPad, les notifications arrivent dans l'application installée.")).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: "Sur l'écran d'accueil" })).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: "Ouvrez Tomate HQ depuis l'écran d'accueil." })).toBeVisible();
      await expect(page.getByRole("button", { name: "Activer sur cet appareil" })).toHaveCount(0);
    });
  });

  test("un navigateur qui ne sait pas recevoir de push le dit simplement", async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as unknown as { PushManager?: unknown }).PushManager;
    });
    await page.goto("/parametres?section=notifications");
    await expect(page.getByText(/Ce navigateur ne peut pas recevoir de notifications/)).toBeVisible();
  });
});
