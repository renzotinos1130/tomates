import { expect, test, type Page } from "@playwright/test";

/** Demo identities (see src/lib/data/seed.ts): Dominic is the super administrator, Maya a partner. */
const MAYA = "33333333-3333-4333-8333-333333333333";

/** From the next load on, the demo is seen through that member's eyes. */
const actAs = (page: Page, id: string) =>
  page.addInitScript((who) => {
    try {
      localStorage.setItem("tthq:demo:me", who);
    } catch {
      /* storage unavailable */
    }
  }, id);

const rows = (page: Page) => page.locator("tbody tr");
const memberRow = (page: Page, name: string) => page.locator("tbody tr[data-member]", { hasText: name });
const inviteRow = (page: Page, email: string) => page.locator(`tbody tr[data-invite="${email}"]`);

async function openSettings(page: Page) {
  await page.goto("/parametres");
  await expect(page.getByRole("heading", { name: "Membres" })).toBeVisible();
}

test.describe("Paramètres — membres", () => {
  test("le super administrateur voit toute l'équipe et peut chercher", async ({ page }) => {
    await openSettings(page);
    await expect(page.getByRole("heading", { name: "Paramètres" })).toBeVisible();
    await expect(page.getByText("6 membres")).toBeVisible();
    await expect(rows(page)).toHaveCount(6);

    // Nom, courriel, rôle, arrivée — et « vous » sur sa propre ligne : la seule chose qu'on y règle est son courriel.
    const me = memberRow(page, "Dominic Renzetti");
    await expect(me).toContainText("vous");
    await expect(me.getByRole("cell", { name: "dominic@prospero.test" })).toBeVisible();
    await expect(me.getByRole("cell", { name: "Super administrateur" })).toBeVisible();
    await expect(me.getByRole("cell", { name: /^\d{1,2} \S+ \d{4}$/ })).toBeVisible();
    await me.getByRole("button", { name: "Actions pour Dominic Renzetti" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Modifier mon courriel…"]);
    await page.keyboard.press("Escape");
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
    await page.getByRole("button", { name: "Inviter", exact: true }).click();
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
    await expect(invite.getByRole("cell", { name: "Administrateur", exact: true })).toBeVisible();
    await expect(page.getByText("1 en attente")).toBeVisible();
    await expect(rows(page)).toHaveCount(7);

    // Une seconde invitation pour la même adresse n'est pas proposée.
    await page.getByRole("button", { name: "Inviter", exact: true }).click();
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
    await expect(memberRow(page, "Maya Martel").getByRole("cell", { name: "Administrateur", exact: true })).toBeVisible();
    await page.reload();
    await expect(memberRow(page, "Maya Martel").getByRole("cell", { name: "Administrateur", exact: true })).toBeVisible();
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

  test("le super administrateur ajoute un membre avec un mot de passe temporaire", async ({ page }) => {
    await openSettings(page);
    await page.getByRole("button", { name: "Ajouter un membre" }).click();
    const dialog = page.getByRole("dialog", { name: "Ajouter un membre" });
    const create = dialog.getByRole("button", { name: "Créer le compte" });

    // Un mot de passe est proposé, facile à dicter ; « Générer » en écrit un autre.
    const password = dialog.getByLabel("Mot de passe temporaire");
    const proposed = await password.inputValue();
    expect(proposed).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
    await dialog.getByRole("button", { name: "Générer" }).click();
    await expect(password).not.toHaveValue(proposed);

    // Rien ne part tant que le nom, le courriel et le mot de passe ne tiennent pas.
    await create.click();
    await expect(dialog.getByText("Indiquez le nom complet.")).toBeVisible();
    await dialog.getByLabel("Nom complet").fill("Zoé Tremblay");
    await dialog.getByLabel("Courriel").fill("maya@prospero.test");
    await create.click();
    await expect(dialog.getByText("Un compte existe déjà pour ce courriel.")).toBeVisible();
    // La réponse parlait de l'adresse envoyée : elle s'efface dès qu'on la corrige.
    await dialog.getByLabel("Courriel").fill("Zoe@Exemple.com");
    await expect(dialog.getByText("Un compte existe déjà pour ce courriel.")).toHaveCount(0);
    await password.fill("court");
    await create.click();
    await expect(dialog.getByText("Au moins 8 caractères.", { exact: true })).toBeVisible();
    await password.fill("tomate-en-grappe");
    await create.click();

    // Ce qu'il faut transmettre, affiché une seule fois.
    const ready = page.getByRole("dialog", { name: "C'est prêt pour Zoé Tremblay" });
    await expect(ready).toContainText("zoe@exemple.com");
    await expect(ready).toContainText("tomate-en-grappe");
    await ready.getByRole("button", { name: "Terminé" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Membre tout de suite, et marquée tant qu'elle n'a pas choisi le sien.
    const zoe = memberRow(page, "Zoé Tremblay");
    await expect(zoe.getByRole("cell", { name: "Partenaire" })).toBeVisible();
    await expect(zoe).toContainText("mot de passe à changer");
    await expect(page.getByText("7 membres")).toBeVisible();
    await page.reload();
    await expect(memberRow(page, "Zoé Tremblay")).toContainText("mot de passe à changer");
  });

  test("le super administrateur définit un nouveau mot de passe pour un membre", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await openSettings(page);
    await expect(memberRow(page, "Maya Martel")).not.toContainText("mot de passe à changer");
    await page.getByRole("button", { name: "Actions pour Maya Martel" }).click();
    await page.getByRole("menuitem", { name: "Définir un mot de passe…" }).click();
    const dialog = page.getByRole("dialog", { name: "Définir un mot de passe pour Maya Martel" });
    const temporary = await dialog.getByLabel("Mot de passe temporaire").inputValue();
    await dialog.getByRole("button", { name: "Définir le mot de passe" }).click();

    const ready = page.getByRole("dialog", { name: "C'est prêt pour Maya Martel" });
    await expect(ready).toContainText("maya@prospero.test");
    await expect(ready).toContainText(temporary);
    // « Copier » met les deux lignes à transmettre dans le presse-papiers.
    await ready.getByRole("button", { name: "Copier" }).click();
    await expect(ready.getByRole("button", { name: "Copié" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `Courriel : maya@prospero.test\nMot de passe temporaire : ${temporary}`,
    );
    await ready.getByRole("button", { name: "Terminé" }).click();
    await expect(memberRow(page, "Maya Martel")).toContainText("mot de passe à changer");
  });

  test("le super administrateur corrige le courriel d'un membre : l'adresse avec laquelle il se connecte", async ({ page }) => {
    await openSettings(page);
    await page.getByRole("button", { name: "Actions pour Maya Martel" }).click();
    await page.getByRole("menuitem", { name: "Modifier le courriel…" }).click();
    const dialog = page.getByRole("dialog", { name: "Modifier le courriel de Maya Martel" });
    await expect(dialog).toContainText("Le mot de passe ne change pas, et aucun message n'est envoyé");
    const field = dialog.getByLabel("Courriel de connexion");
    await expect(field).toHaveValue("maya@prospero.test");
    await expect(dialog).toContainText("Actuellement : maya@prospero.test");

    // Le même, un courriel mal écrit, celui de quelqu'un d'autre : rien ne change, et c'est dit.
    await dialog.getByRole("button", { name: "Enregistrer le courriel" }).click();
    await expect(dialog).toContainText("C'est déjà le courriel de ce compte.");
    await field.fill("maya@");
    await dialog.getByRole("button", { name: "Enregistrer le courriel" }).click();
    await expect(dialog).toContainText("Ce courriel n'est pas valide.");
    await field.fill("Marco@Prospero.test");
    await dialog.getByRole("button", { name: "Enregistrer le courriel" }).click();
    await expect(dialog).toContainText("Un autre compte utilise déjà ce courriel.");
    // (La fenêtre ouverte cache le reste à la lecture d'écran : on lit la ligne par son texte.)
    await expect(memberRow(page, "Maya Martel")).toContainText("maya@prospero.test");

    // Le bon : majuscules et espaces rangés, la ligne suit, et c'est gardé.
    await field.fill("  Maya.Martel@Prospero.test ");
    await dialog.getByRole("button", { name: "Enregistrer le courriel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Maya se connecte maintenant avec maya.martel@prospero.test.")).toBeVisible();
    await expect(memberRow(page, "Maya Martel").getByRole("cell", { name: "maya.martel@prospero.test" })).toBeVisible();
    await page.reload();
    await expect(memberRow(page, "Maya Martel").getByRole("cell", { name: "maya.martel@prospero.test" })).toBeVisible();

    // Le sien aussi.
    await page.getByRole("button", { name: "Actions pour Dominic Renzetti" }).click();
    await page.getByRole("menuitem", { name: "Modifier mon courriel…" }).click();
    const mine = page.getByRole("dialog", { name: "Modifier mon courriel" });
    await mine.getByLabel("Courriel de connexion").fill("dom@prospero.test");
    await mine.getByRole("button", { name: "Enregistrer le courriel" }).click();
    await expect(page.getByText("Vous vous connectez maintenant avec dom@prospero.test.")).toBeVisible();
    await expect(memberRow(page, "Dominic Renzetti").getByRole("cell", { name: "dom@prospero.test" })).toBeVisible();
  });

  test("un administrateur gère l'accès des partenaires, pas les rôles ni les mots de passe", async ({ page }) => {
    // Le super administrateur nomme Maya administratrice…
    await openSettings(page);
    await page.getByRole("button", { name: "Actions pour Maya Martel" }).click();
    await page.getByRole("menuitem", { name: "Nommer administrateur" }).click();
    await expect(memberRow(page, "Maya Martel").getByRole("cell", { name: "Administrateur", exact: true })).toBeVisible();

    // … et voici les paramètres tels qu'elle les voit.
    await actAs(page, MAYA);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Membres" })).toBeVisible();
    await expect(memberRow(page, "Maya Martel")).toContainText("vous");
    await expect(page.getByRole("button", { name: "Ajouter un membre" })).toHaveCount(0);
    // Rien à faire sur le super administrateur, ni sur elle-même.
    await expect(memberRow(page, "Dominic Renzetti").getByRole("button")).toHaveCount(0);
    await expect(memberRow(page, "Maya Martel").getByRole("button")).toHaveCount(0);
    // Sur un partenaire : son accès, et rien d'autre.
    await page.getByRole("button", { name: "Actions pour Marco Drouin" }).click();
    // (Ni mot de passe, ni rôle, ni courriel : ceux-là sont au super administrateur.)
    await expect(page.getByRole("menuitem")).toHaveText(["Désactiver l'accès"]);
    await page.keyboard.press("Escape");

    // Elle invite des partenaires ; nommer un administrateur ne lui est pas proposé.
    await page.getByRole("button", { name: "Inviter des membres" }).click();
    const dialog = page.getByRole("dialog", { name: "Inviter des membres" });
    await expect(dialog.getByRole("radio")).toHaveCount(1);
    await expect(dialog.getByRole("radio", { name: /Partenaire/ })).toBeChecked();
  });

  test("un partenaire règle l'apparence, mais n'a pas accès aux membres", async ({ page }) => {
    await actAs(page, MAYA);
    // Les paramètres s'ouvrent pour elle sur l'apparence ; elle a aussi son compte, pas les membres.
    await page.goto("/parametres");
    await expect(page.getByRole("heading", { name: "Apparence", level: 2 })).toBeVisible();
    await expect(page.getByRole("radio", { name: "La ferme" })).toBeChecked();
    const tabs = page.getByRole("navigation", { name: "Sections des paramètres" });
    await expect(tabs.getByRole("link")).toHaveText(["Apparence", "Compte", "Notifications"]);
    await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Membres" })).toHaveCount(0);

    // Son compte : en démo personne ne se connecte, la page le dit au lieu d'offrir un formulaire.
    await tabs.getByRole("link", { name: "Compte" }).click();
    await expect(page.getByRole("heading", { name: "Mot de passe", level: 2 })).toBeVisible();
    await expect(page.getByText("En mode démo personne ne se connecte")).toBeVisible();
    await expect(page.getByLabel("Nouveau mot de passe")).toHaveCount(0);

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
    await expect(tabs.getByRole("link")).toHaveText(["Apparence", "Compte", "Notifications", "Membres"]);
    await expect(tabs.getByRole("link", { name: "Membres" })).toHaveAttribute("aria-current", "page");
    await tabs.getByRole("link", { name: "Apparence" }).click();
    await expect(page).toHaveURL(/\/parametres\?section=apparence$/);
    await expect(page.getByRole("heading", { name: "Apparence", level: 2 })).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
  });
});
