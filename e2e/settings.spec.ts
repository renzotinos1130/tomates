import { expect, test, type Page } from "@playwright/test";

/** Demo identities (see src/lib/data/seed.ts): Dominic is the administrator, Maya a partner. */
const LEA = "33333333-3333-4333-8333-333333333333";

const rows = (page: Page) => page.locator("tbody tr");
const memberRow = (page: Page, name: string) => page.locator("tbody tr[data-member]", { hasText: name });
const inviteRow = (page: Page, email: string) => page.locator(`tbody tr[data-invite="${email}"]`);

async function openSettings(page: Page) {
  await page.goto("/parametres");
  await expect(page.getByRole("heading", { name: "Membres" })).toBeVisible();
}

test.describe("Paramètres — membres", () => {
  test("l'administrateur voit toute l'équipe et peut chercher", async ({ page }) => {
    await openSettings(page);
    await expect(page.getByRole("heading", { name: "Paramètres" })).toBeVisible();
    await expect(page.getByText("6 membres")).toBeVisible();
    await expect(rows(page)).toHaveCount(6);

    // Nom, courriel, rôle, arrivée — et « vous » sur sa propre ligne, sans action possible sur soi.
    const me = memberRow(page, "Dominic Renzetti");
    await expect(me).toContainText("vous");
    await expect(me.getByRole("cell", { name: "dominic@prospero.test" })).toBeVisible();
    await expect(me.getByRole("cell", { name: "Administrateur" })).toBeVisible();
    await expect(me.getByRole("cell", { name: /^\d{1,2} \S+ \d{4}$/ })).toBeVisible();
    await expect(me.getByRole("button")).toHaveCount(0);
    await expect(memberRow(page, "Maya Martel").getByRole("cell", { name: "Partenaire" })).toBeVisible();

    // La recherche ignore les accents et la casse, sur le nom comme sur le courriel.
    await page.getByRole("button", { name: "Rechercher un membre" }).click();
    const search = page.getByRole("searchbox", { name: "Rechercher par nom ou courriel" });
    await expect(search).toBeFocused();
    await search.fill("màya");
    await expect(rows(page)).toHaveCount(1);
    await expect(memberRow(page, "Maya Martel")).toBeVisible();
    await search.fill("ANTOINE@prospero");
    await expect(rows(page)).toHaveCount(1);
    await expect(memberRow(page, "Antoine Favreau")).toBeVisible();
    await search.fill("personne");
    await expect(page.getByText("Personne ne correspond à « personne ».")).toBeVisible();
    await search.press("Escape");
    await expect(search).toHaveCount(0);
    await expect(rows(page)).toHaveCount(6);
  });

  test("une invitation ajoute une ligne en attente, puis se retire", async ({ page }) => {
    await openSettings(page);
    await page.getByRole("button", { name: "Inviter des membres" }).click();
    const dialog = page.getByRole("dialog", { name: "Inviter des membres" });
    const emails = dialog.getByLabel("Courriels");
    const submit = dialog.getByRole("button", { name: /^Inviter/ });

    // Une adresse mal formée bloque l'envoi ; une personne déjà membre est signalée et ignorée.
    await emails.fill("Zoe@Exemple.com, pas-une-adresse");
    await emails.blur();
    await expect(dialog.getByText("Adresse à corriger : pas-une-adresse")).toBeVisible();
    await expect(submit).toBeDisabled();
    await emails.fill("Zoe@Exemple.com, maya@prospero.test");
    await expect(dialog.getByText("Déjà dans l'équipe : maya@prospero.test")).toBeVisible();
    await dialog.getByText("Administrateur", { exact: true }).click();
    await expect(dialog.getByRole("radio", { name: /Administrateur/ })).toBeChecked();
    await submit.click();
    await expect(dialog).toHaveCount(0);

    const invite = inviteRow(page, "zoe@exemple.com");
    await expect(invite).toContainText("Invitation envoyée");
    await expect(invite.getByRole("cell", { name: "Administrateur" })).toBeVisible();
    await expect(page.getByText("1 en attente")).toBeVisible();
    await expect(rows(page)).toHaveCount(7);

    // Une seconde invitation pour la même adresse n'est pas proposée.
    await page.getByRole("button", { name: "Inviter des membres" }).click();
    await page.getByLabel("Courriels").fill("zoe@exemple.com");
    await expect(page.getByText("Déjà invitée : zoe@exemple.com")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: /^Inviter/ })).toBeDisabled();
    await page.keyboard.press("Escape");

    await page.reload();
    await expect(inviteRow(page, "zoe@exemple.com")).toBeVisible();
    await page.getByRole("button", { name: "Retirer l'invitation de zoe@exemple.com" }).click();
    await expect(inviteRow(page, "zoe@exemple.com")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Membres" })).toBeVisible();
    await expect(rows(page)).toHaveCount(6);
  });

  test("un changement de rôle et un accès désactivé sont conservés", async ({ page }) => {
    await openSettings(page);

    // Rôle.
    await page.getByRole("button", { name: "Actions pour Maya Martel" }).click();
    await page.getByRole("menuitem", { name: "Nommer administrateur" }).click();
    await expect(memberRow(page, "Maya Martel").getByRole("cell", { name: "Administrateur" })).toBeVisible();
    await page.reload();
    await expect(memberRow(page, "Maya Martel").getByRole("cell", { name: "Administrateur" })).toBeVisible();
    await page.getByRole("button", { name: "Actions pour Maya Martel" }).click();
    await expect(page.getByRole("menuitem", { name: "Retirer le rôle d'administrateur" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Accès : la désactivation se confirme, la personne passe « En attente » et quitte la page Équipe.
    await page.getByRole("button", { name: "Actions pour Marco Drouin" }).click();
    await page.getByRole("menuitem", { name: "Désactiver l'accès" }).click();
    const confirm = page.getByRole("dialog", { name: "Désactiver l'accès de Marco Drouin ?" });
    await confirm.getByRole("button", { name: "Désactiver l'accès" }).click();
    const marco = memberRow(page, "Marco Drouin");
    await expect(marco.getByRole("cell", { name: "En attente" })).toBeVisible();
    await expect(page.getByText("5 membres")).toBeVisible();
    await page.reload();
    await expect(memberRow(page, "Marco Drouin").getByRole("cell", { name: "En attente" })).toBeVisible();

    await page.goto("/equipe");
    await expect(page.getByRole("heading", { name: "Équipe" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Antoine Favreau" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Marco Drouin" })).toHaveCount(0);
    // L'administration ne se fait plus ici : la page y renvoie.
    await expect(page.getByLabel("Courriel à inviter")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Actions pour Antoine Favreau" })).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "paramètres" }).click();
    await expect(page).toHaveURL(/\/parametres$/);

    // Réactivation en un clic.
    await page.getByRole("button", { name: "Activer l'accès de Marco Drouin" }).click();
    await expect(memberRow(page, "Marco Drouin").getByRole("cell", { name: "Partenaire" })).toBeVisible();
    await expect(page.getByText("6 membres")).toBeVisible();
  });

  test("un partenaire règle l'apparence, mais n'a pas accès aux membres", async ({ page }) => {
    await page.addInitScript((id) => {
      try {
        localStorage.setItem("tthq:demo:me", id);
      } catch {
        /* storage unavailable */
      }
    }, LEA);
    // Les paramètres s'ouvrent pour lui sur l'apparence, la seule section qu'il a.
    await page.goto("/parametres");
    await expect(page.getByRole("heading", { name: "Apparence", level: 2 })).toBeVisible();
    await expect(page.getByRole("radio", { name: "La ferme" })).toBeChecked();
    await expect(page.getByRole("navigation", { name: "Sections des paramètres" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Membres" })).toHaveCount(0);

    // L'adresse des membres ne lui montre rien des comptes.
    await page.goto("/parametres?section=membres");
    await expect(page.getByText("Réservé aux administrateurs")).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inviter des membres" })).toHaveCount(0);
    await expect(page.getByRole("main").getByText("@")).toHaveCount(0);

    await page.getByRole("link", { name: "Voir l'équipe" }).click();
    await expect(page).toHaveURL(/\/equipe$/);
    await expect(page.getByText("Seuls les administrateurs peuvent inviter de nouveaux membres.")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "paramètres" })).toHaveCount(0);
  });

  test("l'administrateur passe des membres à l'apparence par les onglets", async ({ page }) => {
    await openSettings(page);
    const tabs = page.getByRole("navigation", { name: "Sections des paramètres" });
    await expect(tabs.getByRole("link", { name: "Membres" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "Apparence" }).click();
    await expect(page).toHaveURL(/\/parametres\?section=apparence$/);
    await expect(page.getByRole("heading", { name: "Apparence", level: 2 })).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });
});
